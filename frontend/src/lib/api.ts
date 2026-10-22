/**
 * Typed REST client for the Khang Express backend.
 *
 * Local dev: VITE_API_URL is unset → requests go to `/api`, which Vite proxies
 *           to http://localhost:5000 (see vite.config.ts).
 * Production: set VITE_API_URL=https://your-api.onrender.com/api in Vercel.
 *
 * The JWT from localStorage is attached automatically to every request.
 */

const rawBase = (import.meta.env.VITE_API_URL || "/api").trim();
export const API_BASE_URL = rawBase.replace(/\/+$/, "") || "/api";

const TOKEN_KEY = "khang_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token && opts.auth !== false) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...opts,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the restaurant server. Check your connection and try again.",
      0,
    );
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

// ─── Auth ─────────────────────────────────
export const authApi = {
  signup: (body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) =>
    request<{ token: string; user: KhangUser }>("/auth/signup", {
      method: "POST",
      body,
      auth: false,
    }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: KhangUser }>("/auth/login", {
      method: "POST",
      body,
      auth: false,
    }),
  me: () => request<{ user: KhangUser }>("/auth/me"),
  updateMe: (body: { name?: string; phone?: string }) =>
    request<{ user: KhangUser }>("/auth/me", { method: "PUT", body }),
};

// ─── Products ─────────────────────────────
export const productsApi = {
  list: (params?: {
    category?: string;
    q?: string;
    featured?: boolean;
    sort?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.q) qs.set("q", params.q);
    if (params?.featured) qs.set("featured", "true");
    if (params?.sort) qs.set("sort", params.sort);
    const qsStr = qs.toString();
    return request<{ count: number; items: KhangProduct[] }>(
      `/products${qsStr ? `?${qsStr}` : ""}`,
      { auth: false },
    );
  },
  get: (slug: string) =>
    request<{ product: KhangProduct; reviews: KhangReview[] }>(
      `/products/${encodeURIComponent(slug)}`,
      { auth: false },
    ),
};

// ─── Orders ───────────────────────────────
export const ordersApi = {
  create: (body: CreateOrderBody) =>
    request<{ order: KhangOrder }>("/orders", { method: "POST", body }),
  myOrders: () =>
    request<{ count: number; orders: KhangOrder[] }>("/orders/me"),
  get: (orderId: string) =>
    request<{ order: KhangOrder }>(`/orders/${encodeURIComponent(orderId)}`),
  track: (orderId: string) =>
    request<{ order: KhangOrder }>(
      `/orders/track/${encodeURIComponent(orderId)}`,
      { auth: false },
    ),
  listAll: (status?: string) =>
    request<{ count: number; orders: KhangOrder[] }>(
      `/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  updateStatus: (mongoId: string, status: OrderStatus, note?: string) =>
    request<{ order: KhangOrder }>(`/orders/${mongoId}/status`, {
      method: "PUT",
      body: { status, note },
    }),
};

// ─── Payments (Razorpay) ──────────────────
export const paymentsApi = {
  createRazorpayOrder: (orderId: string) =>
    request<RazorpayInit>("/payments/razorpay/create-order", {
      method: "POST",
      body: { orderId },
    }),
  verifyRazorpay: (body: RazorpayVerifyBody) =>
    request<{
      message: string;
      order: { orderId: string; status: string; total: number };
    }>("/payments/razorpay/verify", { method: "POST", body }),
};

// ─── Reviews ──────────────────────────────
export const reviewsApi = {
  list: (limit = 8) =>
    request<{ count: number; reviews: KhangReview[] }>(
      `/reviews?limit=${limit}`,
      { auth: false },
    ),
};

// ─── Newsletter ───────────────────────────
export const newsletterApi = {
  subscribe: (email: string) =>
    request<{ message: string; subscriber: { email: string } }>(
      "/newsletter",
      { method: "POST", body: { email }, auth: false },
    ),
};

// ─── Types ────────────────────────────────
export interface KhangUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "user" | "admin";
  createdAt?: string;
}

export interface KhangProduct {
  _id: string;
  slug: string;
  name: string;
  chineseName: string;
  category: string;
  price: number;
  rating: number;
  reviewsCount: number;
  description: string;
  ingredients: string[];
  image: string;
  spicy?: number;
  veg: boolean;
  featured?: boolean;
  prepTime: string;
  inStock?: boolean;
}

export interface KhangReview {
  _id: string;
  rating: number;
  text: string;
  userName: string;
  location?: string;
  createdAt: string;
}

export type OrderStatus =
  | "received"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface KhangOrder {
  _id: string;
  orderId: string;
  items: Array<{
    product: string;
    name: string;
    price: number;
    qty: number;
    image?: string;
    chineseName?: string;
  }>;
  customer: { name?: string; phone?: string; email?: string };
  address: Record<string, string>;
  subtotal: number;
  tax: number;
  delivery: number;
  total: number;
  payment: {
    method: string;
    gateway: string;
    status: "pending" | "paid" | "failed" | "refunded";
  };
  status: OrderStatus;
  tracking: Array<{ stage: string; note?: string; at: string }>;
  estimatedDelivery?: string;
  createdAt: string;
}

export interface CreateOrderBody {
  items: Array<{ product: string; qty: number }>;
  customer: { name: string; phone: string };
  address: {
    line1: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  paymentMethod: "upi" | "card" | "wallet" | "cod";
}

export interface RazorpayInit {
  key: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderId: string;
  customer: { name?: string; phone?: string; email?: string };
}

export interface RazorpayVerifyBody {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  orderId: string;
}
