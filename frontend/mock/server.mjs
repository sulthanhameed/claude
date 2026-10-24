/**
 * Local stand-in for the Supabase backend.
 *
 * `npm run dev` talks to Supabase when `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` are set. When they are not, the dev build uses the
 * preview driver in `src/lib/api.ts` instead, and that driver calls `/api/...`
 * — which Vite proxies to this server.
 *
 * It answers with the same shapes the Supabase driver produces, so the preview
 * can be exercised end to end — menu, signup, cart, COD order, tracking, admin
 * status changes — with in-memory state and no project, database, Razorpay
 * account or email key.
 *
 * It is a development harness only: nothing in the app imports it, and it is
 * never part of a production build.
 *
 *   npm run mock        → http://0.0.0.0:5000
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";

const PRODUCTS = JSON.parse(
  readFileSync(new URL("./products.json", import.meta.url), "utf8"),
);

/* ── in-memory state ───────────────────────────────────────────────────── */

const users = []; // { _id, name, email, password, phone, role, createdAt } — the _id is a stand-in uid
const orders = []; // order documents in the API's shape
const subscribers = new Set();
const reviews = PRODUCTS.slice(0, 4).map((p, i) => ({
  _id: `rev-${i + 1}`,
  product: p._id,
  rating: [5, 5, 4, 5][i],
  text: [
    "The momos are the best I have had outside of Kolkata. Steamed perfectly, and that schezwan dip is dangerous.",
    "Ordered for a small birthday dinner — everything arrived hot, and the hargao looked hand-pleated. Lovely.",
    "Solid dim sum and generous portions. Delivery took a little longer than promised but the food was worth it.",
    "The chilli chicken gravy with steamed rice is my weekly order now. Proper heat, not just colour.",
  ][i],
  userName: ["Ananya R.", "Vikram S.", "Meera K.", "Rahul D."][i],
  location: ["Madurai", "Chennai", "Madurai", "Coimbatore"][i],
  createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
}));

/* ── helpers ───────────────────────────────────────────────────────────── */

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(payload);
};

const fail = (res, status, message) => json(res, status, { message });

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

/** The API's user projection — never leak the password. */
const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  createdAt: u.createdAt,
});

/** A stand-in bearer token: base64 of the user id. */
const tokenFor = (u) => Buffer.from(`khang:${u._id}`).toString("base64url");

function userFromAuth(req) {
  const header = req.headers.authorization || "";
  const raw = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!raw) return null;
  try {
    const id = Buffer.from(raw, "base64url").toString().split(":")[1];
    return users.find((u) => u._id === id) || null;
  } catch {
    return null;
  }
}

const nextOrderId = () => {
  const year = new Date().getFullYear();
  const n = String(orders.length + 1).padStart(4, "0");
  return `KH-${year}-${n}`;
};

const QTY_MAX = 20;

/* ── routes ────────────────────────────────────────────────────────────── */

function listProducts(url) {
  const category = url.searchParams.get("category");
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const featured = url.searchParams.get("featured");
  const sort = url.searchParams.get("sort");

  let items = [...PRODUCTS];
  if (category && category !== "All") {
    items = items.filter((p) => p.category === category);
  }
  if (featured === "true") items = items.filter((p) => p.featured);
  if (q) {
    items = items.filter((p) =>
      [p.name, p.chineseName, p.description, p.category]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (sort === "popular") {
    items.sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount);
  } else if (sort === "low") {
    items.sort((a, b) => a.price - b.price);
  } else if (sort === "high") {
    items.sort((a, b) => b.price - a.price);
  }
  return items;
}

/** Totals the way public.place_order() computes them: 5 % GST, ₹40 delivery, free over ₹500. */
function calculateTotals(items) {
  const lines = [];
  let subtotal = 0;
  for (const item of items) {
    const product = PRODUCTS.find((p) => p._id === String(item?.product));
    const qty = Number(item?.qty);
    if (!product) throw { status: 400, message: "A dish in your cart is no longer available" };
    if (!Number.isInteger(qty) || qty < 1 || qty > QTY_MAX) {
      throw { status: 400, message: `Quantity must be between 1 and ${QTY_MAX}` };
    }
    subtotal += product.price * qty;
    lines.push({
      product: product._id,
      name: product.name,
      chineseName: product.chineseName,
      image: product.image,
      price: product.price,
      qty,
    });
  }
  const tax = Math.round(subtotal * 0.05);
  const delivery = subtotal > 500 ? 0 : 40;
  return { lines, subtotal, tax, delivery, total: subtotal + tax + delivery };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Max-Age": "600",
    });
    return res.end();
  }

  try {
    /* health */
    if (path === "/health" || path === "/") {
      return json(res, 200, {
        status: "ok",
        mode: "preview-mock",
        products: PRODUCTS.length,
        orders: orders.length,
        users: users.length,
        uptime: Math.round(process.uptime()),
      });
    }

    /* ── auth ── */
    if (path === "/auth/signup" && method === "POST") {
      const { name, email, password, phone } = await readBody(req);
      if (!name?.trim() || !email?.trim() || !password) {
        return fail(res, 400, "Name, email and password are required");
      }
      if (String(password).length < 6) {
        return fail(res, 400, "Password must be at least 6 characters");
      }
      const normalised = String(email).trim().toLowerCase();
      if (users.some((u) => u.email === normalised)) {
        return fail(res, 409, "An account with that email already exists");
      }
      const user = {
        _id: randomUUID().replace(/-/g, "").slice(0, 24),
        name: String(name).trim(),
        email: normalised,
        password: String(password),
        phone: phone ? String(phone).trim() : undefined,
        role: normalised.includes("admin") ? "admin" : "user",
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      console.log(`[mock] signup persisted: ${user.email} (${users.length} total)`);
      return json(res, 201, { token: tokenFor(user), user: publicUser(user) });
    }

    if (path === "/auth/login" && method === "POST") {
      const { email, password } = await readBody(req);
      const user = users.find(
        (u) => u.email === String(email || "").trim().toLowerCase(),
      );
      if (!user || user.password !== password) {
        return fail(res, 401, "Email or password is incorrect");
      }
      return json(res, 200, { token: tokenFor(user), user: publicUser(user) });
    }

    if (path === "/auth/me") {
      const user = userFromAuth(req);
      if (!user) return fail(res, 401, "Please sign in again");
      if (method === "PUT") {
        const body = await readBody(req);
        if (typeof body.name === "string") user.name = body.name.trim() || user.name;
        if (typeof body.phone === "string") user.phone = body.phone.trim();
      }
      return json(res, 200, { user: publicUser(user) });
    }

    /* ── products ── */
    if (path === "/products" && method === "GET") {
      const items = listProducts(url);
      return json(res, 200, { count: items.length, items });
    }

    if (path.startsWith("/products/") && method === "GET") {
      const slug = decodeURIComponent(path.slice("/products/".length));
      const product = PRODUCTS.find((p) => p.slug === slug || p._id === slug);
      if (!product) return fail(res, 404, "Product not found");
      return json(res, 200, {
        product,
        reviews: reviews.filter((r) => r.product === product._id),
      });
    }

    /* ── reviews ── */
    if (path === "/reviews" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") || 8);
      return json(res, 200, { count: reviews.length, reviews: reviews.slice(0, limit) });
    }

    /* ── newsletter ── */
    if (path === "/newsletter" && method === "POST") {
      const { email } = await readBody(req);
      if (!String(email || "").includes("@")) {
        return fail(res, 400, "A valid email is required");
      }
      const normalised = String(email).trim().toLowerCase();
      const already = subscribers.has(normalised);
      subscribers.add(normalised);
      console.log(`[mock] newsletter: ${normalised} (${subscribers.size} total)`);
      return json(res, 201, {
        message: already
          ? "You are already on the list — check your inbox for the 10% code."
          : "You are on the list. Watch for chef's specials.",
        subscriber: { email: normalised },
      });
    }

    /* ── orders ── */
    if (path === "/orders" && method === "POST") {
      const user = userFromAuth(req);
      if (!user) return fail(res, 401, "Please sign in to place an order");
      const { items, address, customer, paymentMethod } = await readBody(req);
      if (!Array.isArray(items) || items.length === 0) return fail(res, 400, "Cart is empty");
      if (!address?.line1?.trim()) return fail(res, 400, "Delivery address is required");
      if (!["upi", "card", "wallet", "cod"].includes(paymentMethod)) {
        return fail(res, 400, "Invalid payment method");
      }
      if (!customer?.phone?.trim()) return fail(res, 400, "Phone number is required");

      let totals;
      try {
        totals = calculateTotals(items);
      } catch (err) {
        return fail(res, err.status || 400, err.message || "Could not price the cart");
      }

      const order = {
        _id: randomUUID().replace(/-/g, "").slice(0, 24),
        orderId: nextOrderId(),
        user: user._id,
        items: totals.lines,
        customer: {
          name: customer?.name?.trim() || user.name,
          phone: customer.phone.trim(),
          email: user.email,
        },
        address: {
          line1: address.line1.trim(),
          line2: address.line2?.trim(),
          city: address.city?.trim(),
          state: address.state?.trim(),
          pincode: address.pincode?.trim(),
        },
        subtotal: totals.subtotal,
        tax: totals.tax,
        delivery: totals.delivery,
        total: totals.total,
        payment: {
          method: paymentMethod,
          gateway: paymentMethod === "cod" ? "cod" : "razorpay",
          status: "pending",
        },
        status: "received",
        tracking: [{ stage: "received", note: "Order placed", at: new Date().toISOString() }],
        estimatedDelivery: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      orders.push(order);
      console.log(
        `[mock] order ${order.orderId} · ${order.items.length} line(s) · ₹${order.total} · ${paymentMethod} · ${order.customer.email}`,
      );
      return json(res, 201, { order });
    }

    if (path === "/orders/me" && method === "GET") {
      const user = userFromAuth(req);
      if (!user) return fail(res, 401, "Please sign in again");
      const mine = orders.filter((o) => o.user === user._id).reverse();
      return json(res, 200, { count: mine.length, orders: mine });
    }

    if (path === "/orders" && method === "GET") {
      const user = userFromAuth(req);
      if (!user) return fail(res, 401, "Please sign in again");
      const status = url.searchParams.get("status");
      const list = (status ? orders.filter((o) => o.status === status) : [...orders]).reverse();
      return json(res, 200, { count: list.length, orders: list });
    }

    if (path.startsWith("/orders/track/") && method === "GET") {
      const id = decodeURIComponent(path.slice("/orders/track/".length)).trim().toUpperCase();
      const order = orders.find((o) => o.orderId === id);
      if (!order) return fail(res, 404, "No order found with that ID");
      return json(res, 200, { order });
    }

    if (path.startsWith("/orders/") && path.endsWith("/status") && method === "PUT") {
      const user = userFromAuth(req);
      if (!user) return fail(res, 401, "Please sign in again");
      const orderKey = path.slice("/orders/".length, -"/status".length);
      const order = orders.find((o) => o._id === orderKey || o.orderId === orderKey);
      if (!order) return fail(res, 404, "Order not found");
      const { status, note } = await readBody(req);
      const allowed = ["received", "preparing", "out_for_delivery", "delivered", "cancelled"];
      if (!allowed.includes(status)) return fail(res, 400, "Unknown status");
      order.status = status;
      order.tracking.push({ stage: status, note, at: new Date().toISOString() });
      console.log(`[mock] order ${order.orderId} → ${status}`);
      return json(res, 200, { order });
    }

    if (path.startsWith("/orders/") && method === "GET") {
      const id = decodeURIComponent(path.slice("/orders/".length));
      const order = orders.find((o) => o.orderId === id || o._id === id);
      if (!order) return fail(res, 404, "Order not found");
      return json(res, 200, { order });
    }

    /* ── payments ── */
    if (path.startsWith("/payments/")) {
      // Mirrors the real API's behaviour when Razorpay keys are absent.
      return fail(
        res,
        503,
        "Razorpay is not configured on this preview server — choose Cash on delivery to place the order.",
      );
    }

    return fail(res, 404, `No route for ${method} ${url.pathname}`);
  } catch (err) {
    console.error("[mock] unhandled:", err);
    return fail(res, err?.status || 500, err?.message || "Mock API error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-api] Khang preview API on http://${HOST}:${PORT}`);
  console.log(`[mock-api] ${PRODUCTS.length} products · ${reviews.length} reviews · in-memory orders/users`);
});
