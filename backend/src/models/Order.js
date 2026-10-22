import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: String,
    chineseName: String,
    image: String,
    price: Number,
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const trackingEventSchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      enum: [
        "received",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      required: true,
    },
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true, // KH-2026-XXXX
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [orderItemSchema],

    // Customer snapshot at order time
    customer: {
      name: String,
      phone: String,
      email: { type: String, lowercase: true, trim: true },
    },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
    },

    // Pricing (always recalculated on the server)
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    delivery: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },

    // Payment — Razorpay for UPI / cards / wallets, or cash on delivery
    payment: {
      method: {
        type: String,
        enum: ["upi", "card", "wallet", "cod"],
        required: true,
      },
      gateway: {
        type: String,
        enum: ["razorpay", "cod", "none"],
        default: "none",
      },
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
        index: true,
      },
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      paidAt: Date,
      refundedAt: Date,
      refundId: String,
    },

    // Order status + tracking
    status: {
      type: String,
      enum: [
        "received",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      default: "received",
      index: true,
    },
    tracking: [trackingEventSchema],
    estimatedDelivery: Date,
    deliveredAt: Date,

    // Email delivery flags — keeps retries idempotent.
    notifications: {
      customerEmailSentAt: Date,
      ownerEmailSentAt: Date,
    },
  },
  { timestamps: true },
);

// Auto-add the first tracking event
orderSchema.pre("save", function (next) {
  if (this.isNew && (!this.tracking || this.tracking.length === 0)) {
    this.tracking = [
      { stage: "received", note: "Order received", at: new Date() },
    ];
  }
  next();
});

orderSchema.index({ "customer.email": 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
