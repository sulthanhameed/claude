import { Router } from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  refundOrder,
} from "../controllers/paymentController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

// Razorpay checkout flow
router.post("/razorpay/create-order", protect, createRazorpayOrder);
router.post("/razorpay/verify", protect, verifyRazorpayPayment);

// NOTE: POST /api/payments/razorpay/webhook is mounted directly in server.js
// with express.raw() so the HMAC is calculated over the exact raw body.

// Refunds (admin)
router.post("/refund", protect, adminOnly, refundOrder);

export default router;
