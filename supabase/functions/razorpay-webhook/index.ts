/**
 * POST /functions/v1/razorpay-webhook
 *
 * Razorpay calls this when a payment settles, so an order is marked paid even
 * if the customer closed the tab before the Checkout handler ran.
 *
 * Security: the raw body is HMAC-SHA256'd with RAZORPAY_WEBHOOK_SECRET and
 * compared against the X-Razorpay-Signature header. Unsigned calls are refused.
 *
 * Configure:
 *   supabase secrets set RAZORPAY_WEBHOOK_SECRET=whsec_…
 *   Razorpay Dashboard → Settings → Webhooks → add
 *     https://<ref>.supabase.co/functions/v1/razorpay-webhook
 *     events: payment.captured, payment.failed
 *
 * This function runs without a JWT — Razorpay has no user session.
 */
import { serviceClient } from "../_shared/client.ts";
import { json, preflight } from "../_shared/cors.ts";
import { sendOrderEmails, type OrderPayload } from "../_shared/email.ts";

const SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ message: "Method not allowed" }, 405);

  if (!SECRET) {
    console.error("[webhook] RAZORPAY_WEBHOOK_SECRET is not set");
    return json({ message: "Webhook not configured" }, 503);
  }

  const raw = await req.text(); // signature is over the exact bytes
  const signature = req.headers.get("X-Razorpay-Signature") ?? "";

  if (!same(await hmacHex(SECRET, raw), signature)) {
    console.warn("[webhook] signature mismatch");
    return json({ message: "Invalid signature" }, 400);
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          notes?: Record<string, string>;
          error_description?: string;
        };
      };
    };
  };

  try {
    event = JSON.parse(raw);
  } catch {
    return json({ message: "Invalid JSON" }, 400);
  }

  const payment = event.payload?.payment?.entity;
  const khangOrderId = payment?.notes?.khangOrderId;
  if (!khangOrderId) return json({ message: "No khangOrderId in notes" }, 200);

  const service = serviceClient();

  if (event.event === "payment.captured") {
    const { data: before } = await service
      .from("orders")
      .select("id, customer_email_sent_at, owner_email_sent_at")
      .eq("order_id", khangOrderId)
      .maybeSingle();

    const { data, error } = await service.rpc("mark_order_paid", {
      p_order_id: khangOrderId,
      p_razorpay_order_id: payment?.order_id ?? null,
      p_payment_id: payment?.id ?? null,
      p_signature: null,
    });

    if (error) {
      console.error(`[webhook] mark paid failed: ${error.message}`);
      return json({ message: error.message }, 400);
    }

    const { order, newlyPaid } = data as { order: OrderPayload; newlyPaid: boolean };
    if (newlyPaid) {
      await sendOrderEmails(service, order, {
        customerSentAt: before?.customer_email_sent_at ?? null,
        ownerSentAt: before?.owner_email_sent_at ?? null,
      });
      console.log(`[webhook] ${khangOrderId} paid via webhook`);
    }

    return json({ received: true });
  }

  if (event.event === "payment.failed") {
    await service.rpc("mark_order_failed", { p_order_id: khangOrderId });
    console.log(`[webhook] ${khangOrderId} payment failed: ${payment?.error_description ?? ""}`);
    return json({ received: true });
  }

  return json({ received: true, ignored: event.event });
});
