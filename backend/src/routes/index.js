import { Router } from "express";
import auth from "./auth.js";
import products from "./products.js";
import orders from "./orders.js";
import payments from "./payments.js";
import reviews from "./reviews.js";
import newsletter from "./newsletter.js";

const router = Router();

router.get("/", (_req, res) =>
  res.json({
    name: "Khang Chinese Restaurant API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      orders: "/api/orders",
      payments: "/api/payments",
      reviews: "/api/reviews",
      newsletter: "/api/newsletter",
    },
  }),
);

router.use("/auth", auth);
router.use("/products", products);
router.use("/orders", orders);
router.use("/payments", payments);
router.use("/reviews", reviews);
router.use("/newsletter", newsletter);

export default router;
