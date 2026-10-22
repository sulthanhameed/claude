import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { razorpayWebhook } from "./controllers/paymentController.js";
import { isEmailConfigured } from "./utils/notifications.js";

const app = express();

// Render / Vercel proxies sit in front of the app.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ─── Security headers ───
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ─── CORS ───
// CLIENT_URL accepts a comma-separated list, e.g.
//   https://khang.vercel.app,https://khang.netlify.app
// Use * (or leave unset) to allow any origin. Auth uses Bearer tokens, not
// cookies, so credentials are intentionally disabled.
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const allowAllOrigins =
  allowedOrigins.length === 0 || allowedOrigins.includes("*");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAllOrigins) return callback(null, true);

      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
        origin,
      );
      if (isLocalhost) return callback(null, true);

      const normalized = origin.replace(/\/+$/, "");
      const allowed = allowedOrigins.some(
        (value) =>
          value === normalized ||
          (value.startsWith("*.") && normalized.endsWith(value.slice(1))),
      );
      return callback(null, allowed);
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// ─── Razorpay webhook MUST use the raw body, before express.json() ───
app.post(
  "/api/payments/razorpay/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

// ─── Body parsing ───
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── Rate limiting ───
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Try again in 15 minutes." },
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

// ─── Health check ───
app.get("/health", (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    database: dbReady ? "connected" : "disconnected",
    emailConfigured: isEmailConfigured(),
    razorpayConfigured: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
    ),
    version: "1.0.0",
  });
});

// ─── API ───
app.use("/api", routes);

app.get("/", (_req, res) =>
  res.json({
    name: "Khang Chinese Restaurant API",
    status: "running",
    docs: "/api",
    health: "/health",
  }),
);

// ─── 404 + error handler ───
app.use(notFound);
app.use(errorHandler);

// ─── Env sanity check ───
function validateEnv() {
  const warnings = [];
  if (!process.env.JWT_SECRET) warnings.push("JWT_SECRET is missing");
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    warnings.push("Razorpay keys are missing — online payments disabled");
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    warnings.push("Email credentials are missing — order emails disabled");
  }
  warnings.forEach((w) => console.warn(`⚠  ${w}`));

  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    console.error("❌ Refusing to start in production without JWT_SECRET");
    process.exit(1);
  }
}

// ─── Boot ───
const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";

validateEnv();

(async () => {
  await connectDB();

  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Khang API running on http://${HOST}:${PORT}`);
    console.log(`📚 Docs:   /api`);
    console.log(`💓 Health: /health`);
    console.log(
      `📧 Order notifications → ${
        process.env.ORDER_NOTIFY_EMAIL || "sultham456@gmail.com"
      }`,
    );
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received — shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
})();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
