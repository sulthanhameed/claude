import mongoose from "mongoose";

/**
 * Newsletter subscribers — the footer "Subscribe" form stores the email here.
 */
const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    source: { type: String, default: "footer" },
    active: { type: Boolean, default: true },
    subscribedAt: { type: Date, default: Date.now },
    unsubscribedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("Subscriber", subscriberSchema);
