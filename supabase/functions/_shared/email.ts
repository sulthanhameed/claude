/**
 * Transactional email for Khang.
 *
 * Every confirmed order sends two messages:
 *   • a receipt to the customer's account email
 *   • a copy / new-order alert to the restaurant (ORDER_NOTIFY_EMAIL,
 *     sultham456@gmail.com by default — that is the owner's inbox)
 *
 * Delivery is through Resend's HTTP API, which needs no SMTP sockets from the
 * edge runtime. Without RESEND_API_KEY the function logs and skips, so a
 * missing key never blocks an order.
 *
 * orders.customer_email_sent_at / owner_email_sent_at keep retries idempotent.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const DEFAULT_OWNER_EMAIL = "sultham456@gmail.com";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("EMAIL_FROM") ?? "Khang Restaurant <onboarding@resend.dev>";
const OWNER = Deno.env.get("ORDER_NOTIFY_EMAIL")?.trim() || DEFAULT_OWNER_EMAIL;

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface OrderPayload {
  _id: string;
  orderId: string;
  items: OrderItem[];
  customer: { name?: string; phone?: string; email?: string };
  address: Record<string, string | null | undefined>;
  subtotal: number;
  tax: number;
  delivery: number;
  total: number;
  payment: { method: string; status: string };
  status: string;
  createdAt: string;
}

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

function layout(title: string, subtitle: string, bodyHtml: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a">
  <div style="max-width:620px;margin:0 auto;padding:24px 12px">
    <div style="background:#0a0a0a;color:#fff;padding:28px 32px;border-radius:16px 16px 0 0">
      <div style="font-size:30px;letter-spacing:2px">康 Khang</div>
      <div style="margin-top:6px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#6ee7b7">${esc(subtitle)}</div>
      <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25">${esc(title)}</h1>
    </div>
    <div style="background:#fff;padding:30px 32px;border-radius:0 0 16px 16px;border:1px solid #e7e5e4;border-top:0">
      ${bodyHtml}
      <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #eee;font-size:11px;color:#888;line-height:1.6">
        Khang Chinese Restaurant &amp; Dimsum · Lane 7, Koregaon Park, Pune 411001<br/>
        Questions? Reply to this email or call +91 98765 43210.
      </p>
    </div>
  </div>
</body></html>`;
}

function itemsTable(order: OrderPayload) {
  const rows = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px">
          ${esc(item.name)} <span style="color:#999">× ${Number(item.qty) || 0}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;white-space:nowrap">
          ${money(Number(item.price) * Number(item.qty))}
        </td>
      </tr>`,
    )
    .join("");

  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0 8px"><tbody>${rows}</tbody></table>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:3px 0;color:#666">Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr>
      <tr><td style="padding:3px 0;color:#666">GST (5%)</td><td style="text-align:right">${money(order.tax)}</td></tr>
      <tr><td style="padding:3px 0;color:#666">Delivery</td><td style="text-align:right">${order.delivery ? money(order.delivery) : "Free"}</td></tr>
      <tr>
        <td style="padding:12px 0 0;border-top:1px solid #ddd;font-weight:bold;font-size:16px">Total</td>
        <td style="padding:12px 0 0;border-top:1px solid #ddd;text-align:right;font-weight:bold;font-size:16px">${money(order.total)}</td>
      </tr>
    </table>`;
}

const addressLine = (a: OrderPayload["address"]) =>
  [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).map(esc).join(", ");

function paymentLabel(order: OrderPayload) {
  const method = String(order.payment?.method ?? "").toLowerCase();
  const status = String(order.payment?.status ?? "").toUpperCase();
  if (method === "cod") {
    return status === "PAID" ? "CASH ON DELIVERY · COLLECTED" : "CASH ON DELIVERY · PAY AT THE DOOR";
  }
  return `${method.toUpperCase() || "—"} · ${status || "—"}`;
}

function customerEmailHtml(order: OrderPayload) {
  return layout(
    `Thank you, ${order.customer?.name || "there"}!`,
    "Order confirmed",
    `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7">
        Your order <strong>${esc(order.orderId)}</strong> is confirmed and the kitchen has started
        preparing it. It should arrive in about 30–40 minutes.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 18px;margin:18px 0">
        <div style="font-size:11px;letter-spacing:2px;color:#15803d;text-transform:uppercase">Order ID</div>
        <div style="font-family:monospace;font-size:20px;font-weight:bold;margin-top:4px">${esc(order.orderId)}</div>
        <div style="margin-top:8px;font-size:12px;color:#555">Payment: ${esc(paymentLabel(order))}</div>
      </div>
      ${itemsTable(order)}
      <h3 style="margin:22px 0 6px;font-size:14px">Delivering to</h3>
      <p style="margin:0;font-size:13px;color:#555;line-height:1.7">
        ${esc(order.customer?.name ?? "")}<br/>
        ${addressLine(order.address)}<br/>
        ${esc(order.customer?.phone ?? "")}
      </p>
      <p style="margin:22px 0 0;font-size:13px;color:#555">
        Track your order any time with your Order ID on our website.
      </p>
    `,
  );
}

function ownerEmailHtml(order: OrderPayload) {
  return layout(
    `New order · ${order.orderId}`,
    "Kitchen copy",
    `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7">
        <strong>${esc(order.customer?.name ?? "A guest")}</strong> just placed
        <strong>${esc(order.orderId)}</strong> — ${esc(paymentLabel(order))}.
      </p>
      ${itemsTable(order)}
      <h3 style="margin:22px 0 6px;font-size:14px">Deliver to</h3>
      <p style="margin:0;font-size:13px;color:#555;line-height:1.7">
        ${esc(order.customer?.name ?? "")} · ${esc(order.customer?.phone ?? "")}<br/>
        ${addressLine(order.address)}
      </p>
      <p style="margin:22px 0 0;font-size:13px;color:#555">
        Customer email: ${esc(order.customer?.email ?? "—")}
      </p>
    `,
  );
}

interface Mail {
  to: string;
  subject: string;
  html: string;
}

async function send(mail: Mail): Promise<boolean> {
  if (!RESEND_KEY) {
    console.log(`[email] skipped (RESEND_API_KEY unset): ${mail.subject} → ${mail.to}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, html: mail.html }),
  });
  if (!res.ok) {
    console.error(`[email] ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

/**
 * Sends the customer receipt and the owner copy, then records which of the two
 * actually went out. Safe to call twice: a flag that is already set is skipped.
 */
export async function sendOrderEmails(
  service: SupabaseClient,
  order: OrderPayload,
  flags: { customerSentAt?: string | null; ownerSentAt?: string | null },
): Promise<{ customer: boolean; owner: boolean }> {
  const out = { customer: false, owner: false };

  if (!flags.customerSentAt && order.customer?.email) {
    out.customer = await send({
      to: order.customer.email,
      subject: `Khang · order ${order.orderId} confirmed`,
      html: customerEmailHtml(order),
    });
    if (out.customer) await service.rpc("mark_order_emailed", { p_order_id: order._id, p_audience: "customer" });
  }

  if (!flags.ownerSentAt) {
    out.owner = await send({
      to: OWNER,
      subject: `New order ${order.orderId} · ${money(order.total)}`,
      html: ownerEmailHtml(order),
    });
    if (out.owner) await service.rpc("mark_order_emailed", { p_order_id: order._id, p_audience: "owner" });
  }

  return out;
}
