import nodemailer from "nodemailer";

/**
 * Transactional email for Khang.
 *
 * • Every order sends a confirmation to the customer (the email stored on
 *   their account) AND a copy / new-order alert to ORDER_NOTIFY_EMAIL.
 * • ORDER_NOTIFY_EMAIL defaults to sultham456@gmail.com so the restaurant
 *   owner receives every order even if the env var is not set.
 * • Delivery flags on the order keep retries idempotent — a payment retry
 *   will never email the customer twice.
 */

export const DEFAULT_OWNER_EMAIL = "sultham456@gmail.com";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

let transporter;
let transporterChecked = false;

function getTransport() {
  if (transporterChecked) return transporter;
  transporterChecked = true;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const host =
    process.env.EMAIL_HOST ||
    (user && /@gmail\.com$/i.test(user) ? "smtp.gmail.com" : "");

  if (!host || !user || !pass) {
    console.warn(
      "⚠  Email is not configured (EMAIL_HOST / EMAIL_USER / EMAIL_PASS). " +
        "Order emails will be skipped.",
    );
    return null;
  }

  const port = Number(process.env.EMAIL_PORT) || 587;
  const secure =
    String(process.env.EMAIL_SECURE || "").toLowerCase() === "true" ||
    port === 465;

  // Google displays app passwords with spaces; SMTP expects them without.
  const smtpPass = /gmail\.com$/i.test(host) ? pass.replace(/\s+/g, "") : pass;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: smtpPass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });

  return transporter;
}

export function isEmailConfigured() {
  return Boolean(getTransport());
}

function fromAddress() {
  return (
    process.env.EMAIL_FROM ||
    `"Khang Restaurant" <${process.env.EMAIL_USER}>`
  );
}

function ownerAddress() {
  return process.env.ORDER_NOTIFY_EMAIL?.trim() || DEFAULT_OWNER_EMAIL;
}

function layout(title, subtitle, bodyHtml) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a">
    <div style="max-width:620px;margin:0 auto;padding:24px 12px">
      <div style="background:#0a0a0a;color:#fff;padding:28px 32px;border-radius:16px 16px 0 0">
        <div style="font-size:30px;letter-spacing:2px">康 Khang</div>
        <div style="margin-top:6px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#6ee7b7">
          ${escapeHtml(subtitle)}
        </div>
        <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25">${escapeHtml(title)}</h1>
      </div>
      <div style="background:#fff;padding:30px 32px;border-radius:0 0 16px 16px;border:1px solid #e7e5e4;border-top:0">
        ${bodyHtml}
        <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #eee;font-size:11px;color:#888;line-height:1.6">
          Khang Chinese Restaurant &amp; Dimsum · Lane 7, Koregaon Park, Pune 411001<br/>
          Questions? Reply to this email or call +91 98765 43210.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function itemsTable(order) {
  const rows = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px">
          ${escapeHtml(item.name)}
          <span style="color:#999">× ${Number(item.qty) || 0}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;white-space:nowrap">
          ${money(Number(item.price) * Number(item.qty))}
        </td>
      </tr>`,
    )
    .join("");

  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0 8px">
      <tbody>${rows}</tbody>
    </table>
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

function addressBlock(address = {}) {
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");
}

function paymentLabel(order) {
  const method = String(order.payment?.method || "").toLowerCase();
  const status = String(order.payment?.status || "").toUpperCase();
  if (method === "cod") {
    return status === "PAID"
      ? "CASH ON DELIVERY · COLLECTED"
      : "CASH ON DELIVERY · PAY AT THE DOOR";
  }
  return `${method.toUpperCase() || "—"} · ${status || "—"}`;
}

function customerEmailHtml(order) {
  const name = order.customer?.name || "there";
  return layout(
    `Thank you, ${name}!`,
    "Order confirmed",
    `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7">
        Your order <strong>${escapeHtml(order.orderId)}</strong> is confirmed and
        the kitchen has started preparing it. It should arrive in about 30–40 minutes.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 18px;margin:18px 0">
        <div style="font-size:11px;letter-spacing:2px;color:#15803d;text-transform:uppercase">Order ID</div>
        <div style="font-family:monospace;font-size:20px;font-weight:bold;margin-top:4px">${escapeHtml(order.orderId)}</div>
        <div style="margin-top:8px;font-size:12px;color:#555">Payment: ${escapeHtml(paymentLabel(order))}</div>
      </div>
      ${itemsTable(order)}
      <h3 style="margin:22px 0 6px;font-size:14px">Delivering to</h3>
      <p style="margin:0;font-size:13px;color:#555;line-height:1.7">
        ${escapeHtml(order.customer?.name || "")}<br/>
        ${addressBlock(order.address)}<br/>
        ${escapeHtml(order.customer?.phone || "")}
      </p>
      <p style="margin:22px 0 0;font-size:13px;color:#555">
        Track your order any time with your Order ID on our website.
      </p>
    `,
  );
}

function ownerEmailHtml(order) {
  return layout(
    `New order · ${order.orderId}`,
    "New order received",
    `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7">
        A new order has been placed on <strong>Khang</strong>.
      </p>
      <div style="background:#0a0a0a;color:#fff;border-radius:12px;padding:16px 20px;margin:18px 0">
        <div style="font-family:monospace;font-size:20px;font-weight:bold">${escapeHtml(order.orderId)}</div>
        <div style="margin-top:8px;font-size:13px;color:#a7f3d0">Total: ${money(order.total)} · ${escapeHtml(paymentLabel(order))}</div>
        <div style="margin-top:4px;font-size:12px;color:#d6d3d1">Status: ${escapeHtml(order.status)}</div>
      </div>
      <h3 style="margin:0 0 6px;font-size:14px">Customer</h3>
      <p style="margin:0 0 4px;font-size:13px;color:#444;line-height:1.7">
        ${escapeHtml(order.customer?.name || "—")}<br/>
        <a href="mailto:${escapeHtml(order.customer?.email || "")}" style="color:#15803d">${escapeHtml(order.customer?.email || "—")}</a><br/>
        <a href="tel:${escapeHtml(order.customer?.phone || "")}" style="color:#15803d">${escapeHtml(order.customer?.phone || "—")}</a>
      </p>
      <h3 style="margin:18px 0 6px;font-size:14px">Delivery address</h3>
      <p style="margin:0;font-size:13px;color:#555;line-height:1.7">${addressBlock(order.address) || "—"}</p>
      ${itemsTable(order)}
      <p style="margin:18px 0 0;font-size:12px;color:#777">
        Open the admin dashboard on the website to update the order status.
      </p>
    `,
  );
}

function siteUrl() {
  const first = (process.env.CLIENT_URL || "").split(",")[0].trim();
  return /^https?:\/\//i.test(first) ? first : "";
}

function welcomeEmailHtml(user) {
  return layout(
    `Welcome to Khang, ${user.name}!`,
    "Your account is ready",
    `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7">
        Thanks for creating an account with Khang. Your email
        <strong>${escapeHtml(user.email)}</strong> is now saved securely, and
        every order confirmation will arrive here.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:18px 0;font-size:13px;line-height:1.8">
        ✓ Faster checkout with your saved details<br/>
        ✓ Order history &amp; live tracking<br/>
        ✓ Members-only chef specials
      </div>
      <p style="margin:18px 0 0;font-size:14px">
        <a href="${escapeHtml(siteUrl())}"
           style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">
          Browse the menu
        </a>
      </p>
    `,
  );
}

function refundEmailHtml(order) {
  return layout(
    "Refund processed",
    "Refund confirmation",
    `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7">
        A refund of <strong>${money(order.total)}</strong> has been initiated for
        order <strong>${escapeHtml(order.orderId)}</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:#555;line-height:1.7">
        Depending on your bank, the amount should appear in 5–7 business days.
      </p>
    `,
  );
}

/**
 * Sends the customer receipt + the owner's new-order alert.
 * Safe to call more than once: delivered emails are not repeated, and a
 * per-order in-flight lock prevents verify + webhook races.
 */
const inFlight = new Set();

export async function sendOrderConfirmation(order) {
  const key = String(order.orderId || order._id);
  if (inFlight.has(key)) {
    return { sent: false, reason: "in-flight" };
  }
  inFlight.add(key);
  try {
    return await deliverOrderConfirmation(order);
  } finally {
    inFlight.delete(key);
  }
}

async function deliverOrderConfirmation(order) {
  const transport = getTransport();
  if (!transport) return { sent: false, reason: "email-not-configured" };

  if (!order.notifications) order.notifications = {};
  const customerEmail = String(order.customer?.email || "")
    .trim()
    .toLowerCase();
  const owner = ownerAddress().toLowerCase();
  const sameAddress = customerEmail && customerEmail === owner;

  const tasks = [];

  if (
    sameAddress &&
    !order.notifications.customerEmailSentAt &&
    !order.notifications.ownerEmailSentAt
  ) {
    // The customer's email is the owner's inbox — send a single copy.
    tasks.push(
      transport
        .sendMail({
          from: fromAddress(),
          to: ownerAddress(),
          subject: `🛎 New order ${order.orderId} · ${money(order.total)} · Khang`,
          html: ownerEmailHtml(order),
        })
        .then(() => {
          order.notifications.customerEmailSentAt = new Date();
          order.notifications.ownerEmailSentAt = new Date();
          console.log(`✉  Order email sent → ${ownerAddress()}`);
        }),
    );
  } else {
    if (customerEmail && !order.notifications.customerEmailSentAt) {
      tasks.push(
        transport
          .sendMail({
            from: fromAddress(),
            to: order.customer.email,
            replyTo: ownerAddress(),
            subject: `Order Confirmed · ${order.orderId} · Khang`,
            html: customerEmailHtml(order),
          })
          .then(() => {
            order.notifications.customerEmailSentAt = new Date();
            console.log(`✉  Customer receipt sent → ${order.customer.email}`);
          }),
      );
    }

    if (!order.notifications.ownerEmailSentAt) {
      tasks.push(
        transport
          .sendMail({
            from: fromAddress(),
            to: ownerAddress(),
            replyTo: customerEmail || undefined,
            subject: `🛎 New order ${order.orderId} · ${money(order.total)} · Khang`,
            html: ownerEmailHtml(order),
          })
          .then(() => {
            order.notifications.ownerEmailSentAt = new Date();
            console.log(`✉  Owner alert sent → ${ownerAddress()}`);
          }),
      );
    }
  }

  if (tasks.length === 0) return { sent: false, reason: "already-sent" };

  const results = await Promise.allSettled(tasks);
  const failures = results.filter((r) => r.status === "rejected");
  failures.forEach((f) => {
    if (f.status === "rejected") {
      console.error("✉  Email failed:", f.reason?.message || f.reason);
    }
  });

  if (results.some((r) => r.status === "fulfilled")) {
    try {
      await order.save();
    } catch (err) {
      console.error("✉  Could not persist email flags:", err.message);
    }
  }

  return { sent: failures.length < tasks.length, failures: failures.length };
}

export async function sendWelcomeEmail(user) {
  const transport = getTransport();
  if (!transport || !user?.email) return { sent: false };

  try {
    await transport.sendMail({
      from: fromAddress(),
      to: user.email,
      subject: "Welcome to Khang · 欢迎",
      html: welcomeEmailHtml(user),
    });
    console.log(`✉  Welcome email sent → ${user.email}`);
    return { sent: true };
  } catch (err) {
    console.error("✉  Welcome email failed:", err.message);
    return { sent: false };
  }
}

export async function sendRefundEmail(order) {
  const transport = getTransport();
  if (!transport || !order?.customer?.email) return { sent: false };

  try {
    await transport.sendMail({
      from: fromAddress(),
      to: order.customer.email,
      subject: `Refund processed · ${order.orderId} · Khang`,
      html: refundEmailHtml(order),
    });
    return { sent: true };
  } catch (err) {
    console.error("✉  Refund email failed:", err.message);
    return { sent: false };
  }
}
