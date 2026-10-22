import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { generateOrderId } from "../utils/generateOrderId.js";
import { sendOrderConfirmation } from "../utils/notifications.js";

const PAYMENT_METHODS = ["upi", "card", "wallet", "cod"];
const ORDER_STATUSES = [
  "received",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const MAX_QTY_PER_ITEM = 50;
const MAX_ITEMS = 40;

/**
 * Recalculate totals server-side from product IDs and quantities.
 * Client-sent prices are never trusted.
 */
async function calculateTotals(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error("Cart is empty"), { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    throw Object.assign(new Error("Too many different items in one order"), {
      status: 400,
    });
  }

  const cleaned = items.map((item) => {
    const id = String(item?.product || "");
    const qty = Number(item?.qty);
    if (!mongoose.isValidObjectId(id)) {
      throw Object.assign(new Error("Invalid product in cart"), {
        status: 400,
      });
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw Object.assign(
        new Error(`Quantity must be between 1 and ${MAX_QTY_PER_ITEM}`),
        { status: 400 },
      );
    }
    return { id, qty };
  });

  const products = await Product.find({
    _id: { $in: cleaned.map((c) => c.id) },
  });
  const map = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const lines = cleaned.map(({ id, qty }) => {
    const product = map.get(id);
    if (!product) {
      throw Object.assign(
        new Error("A dish in your cart is no longer available"),
        { status: 400 },
      );
    }
    if (product.inStock === false) {
      throw Object.assign(
        new Error(`${product.name} is currently sold out`),
        { status: 400 },
      );
    }
    subtotal += product.price * qty;
    return {
      product: product._id,
      name: product.name,
      chineseName: product.chineseName,
      image: product.image,
      price: product.price,
      qty,
    };
  });

  const tax = Math.round(subtotal * 0.05);
  const delivery = subtotal > 500 ? 0 : 40;
  const total = subtotal + tax + delivery;
  return { lines, subtotal, tax, delivery, total };
}

// POST /api/orders — create a new order (pending payment, except COD)
export async function createOrder(req, res, next) {
  try {
    const { items, address, customer, paymentMethod } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    if (!address?.line1?.trim()) {
      return res.status(400).json({ message: "Delivery address is required" });
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }
    if (!customer?.phone?.trim()) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const { lines, subtotal, tax, delivery, total } =
      await calculateTotals(items);

    const payload = {
      user: req.user._id,
      items: lines,
      customer: {
        name: customer?.name?.trim() || req.user.name,
        phone: customer.phone.trim(),
        // Always use the email stored on the account so the receipt,
        // the order history and the database never disagree.
        email: req.user.email,
      },
      address: {
        line1: address.line1.trim(),
        line2: address.line2?.trim(),
        city: address.city?.trim(),
        state: address.state?.trim(),
        pincode: address.pincode?.trim(),
      },
      subtotal,
      tax,
      delivery,
      total,
      payment: {
        method: paymentMethod,
        gateway: paymentMethod === "cod" ? "cod" : "razorpay",
        status: "pending",
      },
      estimatedDelivery: new Date(Date.now() + 35 * 60 * 1000),
    };

    // Retry in the rare case of a friendly-id collision.
    let order = null;
    for (let attempt = 0; attempt < 5 && !order; attempt += 1) {
      try {
        order = await Order.create({
          ...payload,
          orderId: generateOrderId(),
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    if (!order) {
      return res.status(500).json({
        message: "Could not allocate an order ID — please try again",
      });
    }

    // COD is confirmed immediately, so both emails go out now.
    // Online orders are emailed after Razorpay signature verification.
    if (paymentMethod === "cod") {
      sendOrderConfirmation(order).catch((err) =>
        console.error("Order email failed:", err.message),
      );
    }

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/me — user's own orders
export async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:orderId — owner or admin only
export async function getOrder(req, res, next) {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    const isOwner = String(order.user) === String(req.user._id);
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not allowed to view this order" });
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/track/:orderId — public tracking (no auth, limited fields)
export async function trackOrder(req, res, next) {
  try {
    const order = await Order.findOne({
      orderId: String(req.params.orderId).trim().toUpperCase(),
    })
      .select(
        "orderId status tracking estimatedDelivery deliveredAt total customer.name payment.status payment.method items.name items.qty",
      )
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// PUT /api/orders/:id/status — admin updates status
export async function updateStatus(req, res, next) {
  try {
    const { status, note } = req.body || {};
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    order.tracking.push({
      stage: status,
      note: note?.trim() || undefined,
      at: new Date(),
    });

    if (status === "delivered") {
      order.deliveredAt = new Date();
      if (order.payment.method === "cod" && order.payment.status === "pending") {
        order.payment.status = "paid";
        order.payment.paidAt = new Date();
      }
    }

    await order.save();
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders — admin lists all
export async function listAllOrders(req, res, next) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      filter.status = status;
    }
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .lean();
    res.json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
}
