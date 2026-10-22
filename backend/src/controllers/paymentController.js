import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../models/Order.js";
import {
  sendOrderConfirmation,
  sendRefundEmail,
} from "../utils/notifications.js";

// ─── Lazy Razorpay client (missing keys must not crash boot) ───
let razorpay;
function getRazorpay() {
  if (razorpay) return razorpay;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw Object.assign(
      new Error(
        "Razorpay is not configured on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      ),
      { status: 503 },
    );
  }

  razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return razorpay;
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function markPaidAndNotify(order, paymentId, signature) {
  if (order.payment.status === "paid") {
    // Payment is already recorded; retry any email that failed earlier.
    await sendOrderConfirmation(order).catch((err) =>
      console.error("Order email retry failed:", err.message),
    );
    return false;
  }

  order.payment.status = "paid";
  order.payment.paidAt = new Date();
  if (paymentId) order.payment.razorpayPaymentId = paymentId;
  if (signature) order.payment.razorpaySignature = signature;
  order.payment.gateway = "razorpay";
  await order.save();

  await sendOrderConfirmation(order).catch((err) =>
    console.error("Order email failed:", err.message),
  );
  return true;
}

// ─── RAZORPAY ──────────────────────────────────────────────────

/**
 * POST /api/payments/razorpay/create-order
 * Body: { orderId } — internal Khang order id
 * Returns the Razorpay order details for the frontend Checkout widget.
 */
export async function createRazorpayOrder(req, res, next) {
  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "This order belongs to another user" });
    }
    if (order.payment.status === "paid") {
      return res.status(400).json({ message: "This order is already paid" });
    }
    if (order.payment.method === "cod") {
      return res
        .status(400)
        .json({ message: "Cash-on-delivery orders do not need online payment" });
    }

    const rp = getRazorpay();
    const rpOrder = await rp.orders.create({
      amount: Math.round(order.total * 100), // paise
      currency: "INR",
      receipt: order.orderId,
      notes: {
        khangOrderId: order.orderId,
        userId: String(order.user),
      },
    });

    order.payment.razorpayOrderId = rpOrder.id;
    order.payment.gateway = "razorpay";
    await order.save();

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      orderId: order.orderId,
      customer: order.customer,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/razorpay/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }
 * Verifies the HMAC-SHA256 signature, marks the order as paid, sends emails.
 */
export async function verifyRazorpayPayment(req, res, next) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body || {};

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !orderId
    ) {
      return res
        .status(400)
        .json({ message: "Incomplete payment verification payload" });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res
        .status(503)
        .json({ message: "Razorpay is not configured on the server" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "This order belongs to another user" });
    }

    // Idempotent: Razorpay may call the handler twice.
    if (order.payment.status === "paid") {
      await sendOrderConfirmation(order).catch(() => {});
      return res.json({
        message: "Payment already verified",
        order: {
          orderId: order.orderId,
          status: order.status,
          total: order.total,
        },
      });
    }

    if (
      order.payment.razorpayOrderId &&
      order.payment.razorpayOrderId !== razorpay_order_id
    ) {
      return res
        .status(400)
        .json({ message: "Payment does not match this order" });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!safeCompare(expected, razorpay_signature)) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    await markPaidAndNotify(
      order,
      razorpay_payment_id,
      razorpay_signature,
    );

    res.json({
      message: "Payment verified",
      order: {
        orderId: order.orderId,
        status: order.status,
        total: order.total,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/razorpay/webhook
 * Mounted in server.js with express.raw() BEFORE express.json().
 * Handles payments captured even if the customer closed the browser.
 */
export async function razorpayWebhook(req, res) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ message: "Webhook secret not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || "");

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (!safeCompare(expected, signature)) {
      console.warn("Razorpay webhook signature mismatch");
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ message: "Invalid JSON body" });
    }

    const entity = event?.payload?.payment?.entity;
    if (entity) {
      const internalOrderId = entity.notes?.khangOrderId;
      let order = internalOrderId
        ? await Order.findOne({ orderId: internalOrderId })
        : null;
      if (!order) {
        order = await Order.findOne({
          "payment.razorpayOrderId": entity.order_id,
        });
      }

      if (order) {
        if (event.event === "payment.captured") {
          await markPaidAndNotify(order, entity.id, undefined);
        } else if (
          event.event === "payment.failed" &&
          order.payment.status === "pending"
        ) {
          order.payment.status = "failed";
          await order.save();
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Razorpay webhook failed:", err.message);
    res.status(500).json({ message: "Webhook processing failed" });
  }
}

// ─── REFUNDS ───────────────────────────────────────────────────

/**
 * POST /api/payments/refund
 * Body: { orderId } — admin only
 */
export async function refundOrder(req, res, next) {
  try {
    const { orderId } = req.body || {};
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.payment.status !== "paid") {
      return res.status(400).json({ message: "Order is not paid" });
    }
    if (order.payment.gateway !== "razorpay" || !order.payment.razorpayPaymentId) {
      return res.status(400).json({
        message: "Only Razorpay payments can be refunded automatically",
      });
    }

    const rp = getRazorpay();
    const refund = await rp.payments.refund(order.payment.razorpayPaymentId, {
      amount: Math.round(order.total * 100),
      notes: { khangOrderId: order.orderId, reason: "Admin refund" },
    });

    order.payment.status = "refunded";
    order.payment.refundId = refund.id;
    order.payment.refundedAt = new Date();
    order.status = "cancelled";
    order.tracking.push({
      stage: "cancelled",
      note: "Order refunded by admin",
      at: new Date(),
    });
    await order.save();

    sendRefundEmail(order).catch(() => {});

    res.json({ message: "Refund processed", order, refundId: refund.id });
  } catch (err) {
    next(err);
  }
}
