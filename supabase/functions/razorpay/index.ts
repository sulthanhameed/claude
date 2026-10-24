/**
 * POST /functions/v1/razorpay
 *
 * Two actions, both requiring the caller to own the order:
 *
 *   { action: "create", orderId: "KH-2026-0001" }
 *     → creates a Razorpay order for the amount the kitchen calculated and
 *       returns the details Checkout needs. The key *secret* never leaves here.
 *
 *   { action: "verify", orderId, razorpay_order_id, razorpay_payment_id,
 *     razorpay_signature }
 *     → checks the HMAC-SHA256 signature, then marks the order paid and sends
 *       the confirmation emails. Idempotent: a retried verify will not email
 *       twice.
 *
 *   { action: "refund", orderId, amount? }
 *     → admin only: refunds the captured payment, marks the order refunded.
 *
 * Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 */
import { caller, serviceClient } from "../_shared/client.ts";
import { json, preflight } from "../_shared/cors.ts";
import { sendOrderEmails, type OrderPayload } from "../_shared/email.ts";

const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish comparison for two hex strings. */
function sameSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ message: "Method not allowed" }, 405);

  if (!KEY_ID || !KEY_SECRET) {
    return json(
      { message: "Razorpay is not configured on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      503,
    );
  }

  const user = await caller(req);
  if (!user) return json({ message: "Please sign in again" }, 401);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ message: "Invalid JSON body" }, 400);
  }

  const action = body.action ?? "create";
  const orderId = (body.orderId ?? "").trim();
  if (!orderId) return json({ message: "orderId is required" }, 400);

  const service = serviceClient();

  // the order must belong to whoever is asking
  const { data: order, error: lookupError } = await service
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (lookupError) return json({ message: lookupError.message }, 500);
  if (!order) return json({ message: "Order not found" }, 404);
  if (order.user_id !== user.id) return json({ message: "Order not found" }, 404);
  // A refunded/paid order must not start a second payment. Refunds are the
  // exception: they act on an order that is already paid.
  if (order.payment_status === "paid" && action !== "refund") {
    return json({
      message: "This order is already paid",
      order: { orderId: order.order_id, status: order.status, total: order.total },
    });
  }
  if (order.payment_status === "refunded") {
    return json({ message: "This order has been refunded", orderId }, 400);
  }

  /* ── create ───────────────────────────────────────────────────────────── */
  if (action === "create") {
    const amount = Math.round(Number(order.total) * 100); // paise
    const auth = btoa(`${KEY_ID}:${KEY_SECRET}`);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: order.order_id,
        notes: { khangOrderId: order.order_id },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[razorpay] create failed ${res.status}: ${detail}`);
      return json({ message: "Could not start the payment. Please try again." }, 502);
    }

    const rp = await res.json();
    await service.from("orders").update({ razorpay_order_id: rp.id }).eq("id", order.id);

    return json({
      key: KEY_ID,
      razorpayOrderId: rp.id,
      amount,
      currency: "INR",
      orderId: order.order_id,
      customer: {
        name: order.customer_name ?? undefined,
        phone: order.customer_phone ?? undefined,
        email: order.customer_email ?? undefined,
      },
    });
  }

  /* ── refund (admin) ───────────────────────────────────────────────────── */
  if (action === "refund") {
    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") return json({ message: "Admins only" }, 403);
    if (order.payment_status !== "paid") {
      return json({ message: "Only a paid order can be refunded" }, 400);
    }
    if (!order.razorpay_payment_id) {
      return json({ message: "This order has no Razorpay payment to refund" }, 400);
    }

    const amount = body.amount ? Math.round(Number(body.amount) * 100) : undefined;
    const auth = btoa(`${KEY_ID}:${KEY_SECRET}`);

    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${order.razorpay_payment_id}/refund`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify(amount ? { amount } : {}),
      },
    );

    if (!res.ok) {
      console.error(`[razorpay] refund failed ${res.status}: ${await res.text()}`);
      return json({ message: "Razorpay refused the refund" }, 502);
    }

    const refund = await res.json();
    const { data } = await service.rpc("mark_order_refunded", {
      p_order_id: order.order_id,
      p_refund_id: refund.id,
    });

    return json({ message: "Refund issued", order: data });
  }

  /* ── verify ───────────────────────────────────────────────────────────── */
  if (action === "verify") {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ message: "Missing Razorpay fields" }, 400);
    }

    const expected = await hmacHex(KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (!sameSignature(expected, razorpay_signature)) {
      console.warn(`[razorpay] signature mismatch for ${order.order_id}`);
      return json({ message: "Payment signature could not be verified" }, 400);
    }

    const { data, error } = await service.rpc("mark_order_paid", {
      p_order_id: order.order_id,
      p_razorpay_order_id: razorpay_order_id,
      p_payment_id: razorpay_payment_id,
      p_signature: razorpay_signature,
    });

    if (error) return json({ message: error.message }, 400);

    const { order: paid, newlyPaid } = data as { order: OrderPayload; newlyPaid: boolean };

    if (newlyPaid) {
      await sendOrderEmails(service, paid, {
        customerSentAt: order.customer_email_sent_at,
        ownerSentAt: order.owner_email_sent_at,
      });
    }

    return json({
      message: "Payment verified",
      order: { orderId: paid.orderId, status: paid.status, total: paid.total },
    });
  }

  return json({ message: `Unknown action: ${action}` }, 400);
});
