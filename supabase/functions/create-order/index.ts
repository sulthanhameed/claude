/**
 * POST /functions/v1/create-order
 *
 * Turns a cart into an order. Everything that decides money lives in Postgres
 * (public.place_order): prices come from the menu table, not the browser, and
 * the order id comes from a sequence. This function only proves who is asking
 * and then sends the two confirmation emails for cash orders, which are
 * confirmed immediately.
 *
 * Body: { items: [{ product, qty }], customer: { name, phone },
 *         address: { line1, line2, city, state, pincode },
 *         paymentMethod: "upi" | "card" | "wallet" | "cod" }
 * Returns: { order }
 */
import { caller, serviceClient } from "../_shared/client.ts";
import { corsHeaders, json, preflight } from "../_shared/cors.ts";
import { sendOrderEmails, type OrderPayload } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ message: "Method not allowed" }, 405);

  const user = await caller(req);
  if (!user) return json({ message: "Please sign in to place an order" }, 401);
  if (!user.email) return json({ message: "Your account has no email address" }, 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ message: "Invalid JSON body" }, 400);
  }

  const customer = (body.customer ?? {}) as Record<string, string>;
  const service = serviceClient();

  const { data, error } = await service.rpc("place_order", {
    p_user: user.id,
    p_items: body.items ?? [],
    // the email always comes from the account, never from the form
    p_customer: { name: customer.name ?? "", phone: customer.phone ?? "", email: user.email },
    p_address: body.address ?? {},
    p_payment_method: body.paymentMethod ?? "",
  });

  if (error) return json({ message: error.message }, 400);

  const order = data as OrderPayload;

  if (order.payment.method === "cod") {
    // cash is confirmed at the door, so the receipt goes out now
    await sendOrderEmails(service, order, {});
  }

  return json({ order });
});
