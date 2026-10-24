/**
 * The restaurant's data layer.
 *
 * Supabase is the backend: Postgres (with row level security) for the menu,
 * reviews, orders and newsletter list; Supabase Auth for accounts; and three
 * Edge Functions for the operations that need secrets — creating an order with
 * server-side pricing and emails (`create-order`), talking to Razorpay
 * (`razorpay`), and receiving payment webhooks (`razorpay-webhook`).
 *
 * Every component still calls the same six *Api objects it always has, so the
 * UI knows nothing about the change of backend.
 *
 * Local preview: if VITE_SUPABASE_URL is not set, a development-only REST
 * driver talks to `/api` (the mock in frontend/mock/server.mjs) so the site can be
 * clicked through without a project. Production builds without Supabase throw
 * a configuration error rather than inventing one.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from "./supabase";

/* ── errors ─────────────────────────────────────────────────────────────── */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/* ── session token ──────────────────────────────────────────────────────── */
// Kept as the app's "am I signed in" flag. With Supabase this mirrors the
// access token; the client itself refreshes the real session.

const TOKEN_KEY = "khang_token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token: string) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage disabled — the in-memory session still works */
  }
};
export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
};

/* ── types ──────────────────────────────────────────────────────────────── */

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

interface ListParams {
  category?: string;
  q?: string;
  featured?: boolean;
  sort?: string;
}

interface Driver {
  authApi: {
    signup: (body: {
      name: string;
      email: string;
      password: string;
      phone?: string;
    }) => Promise<{ token: string; user: KhangUser }>;
    login: (body: { email: string; password: string }) => Promise<{ token: string; user: KhangUser }>;
    me: () => Promise<{ user: KhangUser }>;
    updateMe: (body: { name?: string; phone?: string }) => Promise<{ user: KhangUser }>;
    logout: () => Promise<void>;
  };
  productsApi: {
    list: (params?: ListParams) => Promise<{ count: number; items: KhangProduct[] }>;
    get: (slug: string) => Promise<{ product: KhangProduct; reviews: KhangReview[] }>;
  };
  ordersApi: {
    create: (body: CreateOrderBody) => Promise<{ order: KhangOrder }>;
    myOrders: () => Promise<{ count: number; orders: KhangOrder[] }>;
    get: (orderId: string) => Promise<{ order: KhangOrder }>;
    track: (orderId: string) => Promise<{ order: KhangOrder }>;
    listAll: (status?: string) => Promise<{ count: number; orders: KhangOrder[] }>;
    updateStatus: (
      orderUuid: string,
      status: OrderStatus,
      note?: string,
    ) => Promise<{ order: KhangOrder }>;
  };
  paymentsApi: {
    createRazorpayOrder: (orderId: string) => Promise<RazorpayInit>;
    verifyRazorpay: (
      body: RazorpayVerifyBody,
    ) => Promise<{ message: string; order: { orderId: string; status: string; total: number } }>;
  };
  reviewsApi: {
    list: (limit?: number) => Promise<{ count: number; reviews: KhangReview[] }>;
  };
  newsletterApi: {
    subscribe: (
      email: string,
    ) => Promise<{ message: string; subscriber: { email: string } }>;
  };
}

/* ── row → app shape ────────────────────────────────────────────────────── */

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  chinese_name: string | null;
  category: string;
  price: number;
  description: string;
  ingredients: string[] | null;
  image: string;
  rating: number | string;
  reviews_count: number;
  spicy: number | null;
  veg: boolean;
  featured: boolean;
  prep_time: string | null;
  in_stock: boolean;
}

interface ReviewRow {
  id: string;
  rating: number;
  body: string;
  user_name: string | null;
  location: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  name: string;
  phone: string | null;
  role: "user" | "admin";
  created_at: string;
}

function toProduct(row: ProductRow): KhangProduct {
  return {
    _id: row.id,
    slug: row.slug,
    name: row.name,
    chineseName: row.chinese_name ?? "",
    category: row.category,
    price: row.price,
    rating: Number(row.rating),
    reviewsCount: row.reviews_count,
    description: row.description,
    ingredients: row.ingredients ?? [],
    image: row.image,
    spicy: row.spicy ?? 0,
    veg: row.veg,
    featured: row.featured,
    prepTime: row.prep_time ?? "15 min",
    inStock: row.in_stock,
  };
}

function toReview(row: ReviewRow): KhangReview {
  return {
    _id: row.id,
    rating: row.rating,
    text: row.body,
    userName: row.user_name ?? "A guest",
    location: row.location ?? undefined,
    createdAt: row.created_at,
  };
}

function toUser(row: ProfileRow): KhangUser {
  return {
    _id: row.id,
    name: row.name,
    email: "",
    phone: row.phone ?? undefined,
    role: row.role,
    createdAt: row.created_at,
  };
}

/* an order as the SQL function builds it (already camelCase) */
type OrderPayload = KhangOrder & {
  user?: string;
  deliveredAt?: string | null;
};

const asOrder = (payload: unknown): KhangOrder => payload as KhangOrder;

/* ── the Supabase driver ────────────────────────────────────────────────── */

async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke(name, {
    body: body as Record<string, unknown>,
  });

  if (error) {
    // FunctionsHttpError carries the Response — read the JSON message from it.
    let message = error.message;
    let status = 400;
    const context = (error as { context?: Response }).context;
    if (context) {
      status = context.status;
      try {
        const parsed = (await context.json()) as { message?: string };
        if (parsed?.message) message = parsed.message;
      } catch {
        /* keep the SDK message */
      }
    }
    throw new ApiError(message, status);
  }
  return data as T;
}

async function currentProfile(): Promise<ProfileRow> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new ApiError("Please sign in again", 401);
  }
  const { data, error } = await client
    .from("profiles")
    .select("id, name, phone, role, created_at")
    .eq("id", sessionData.session.user.id)
    .single();
  if (error) throw new ApiError(error.message, 400);
  return data as ProfileRow;
}

const supabaseDriver: Driver = {
  authApi: {
    async signup({ name, email, password, phone }) {
      const client = requireSupabase();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name, phone: phone ?? null } },
      });
      if (error) throw new ApiError(error.message, error.status ?? 400);

      let session = data.session;
      if (!session) {
        // The project asks for email confirmation; sign in if it already
        // allows it, otherwise tell the guest what to do next.
        const retry = await client.auth.signInWithPassword({ email, password });
        if (retry.error || !retry.data.session) {
          throw new ApiError(
            "Account created — check your inbox to confirm the email, then sign in.",
            401,
          );
        }
        session = retry.data.session;
      }

      const profile = await currentProfile();
      setToken(session.access_token);
      return { token: session.access_token, user: { ...toUser(profile), email } };
    },

    async login({ email, password }) {
      const client = requireSupabase();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new ApiError(error.message, error.status ?? 401);

      const profile = await currentProfile();
      setToken(data.session.access_token);
      return {
        token: data.session.access_token,
        user: { ...toUser(profile), email: data.user.email ?? email },
      };
    },

    async me() {
      const profile = await currentProfile();
      const client = requireSupabase();
      const { data } = await client.auth.getSession();
      return {
        user: { ...toUser(profile), email: data.session?.user.email ?? "" },
      };
    },

    async updateMe(body) {
      const client = requireSupabase();
      const { data: sessionData } = await client.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) throw new ApiError("Please sign in again", 401);

      const patch: Record<string, string> = {};
      if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
      if (typeof body.phone === "string") patch.phone = body.phone.trim();

      const { data, error } = await client
        .from("profiles")
        .update(patch)
        .eq("id", id)
        .select("id, name, phone, role, created_at")
        .single();
      if (error) throw new ApiError(error.message, 400);

      const email = sessionData.session?.user.email ?? "";
      return { user: { ...toUser(data as ProfileRow), email } };
    },

    async logout() {
      if (!supabase) return;
      await supabase.auth.signOut({ scope: "local" });
    },
  },

  productsApi: {
    async list(params = {}) {
      const client = requireSupabase();
      let query = client.from("products").select("*");

      if (params.category && params.category !== "All") {
        query = query.eq("category", params.category);
      }
      if (params.featured) query = query.eq("featured", true);
      if (params.q) {
        const term = params.q.replace(/[,()%]/g, " ").trim();
        if (term) {
          query = query.or(
            `name.ilike.%${term}%,chinese_name.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`,
          );
        }
      }

      if (params.sort === "popular") {
        query = query.order("rating", { ascending: false }).order("reviews_count", { ascending: false });
      } else if (params.sort === "low") {
        query = query.order("price", { ascending: true });
      } else if (params.sort === "high") {
        query = query.order("price", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw new ApiError(error.message, 400);

      const items = (data as ProductRow[] | null)?.map(toProduct) ?? [];
      return { count: items.length, items };
    },

    async get(slug) {
      const client = requireSupabase();
      const { data, error } = await client
        .from("products")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new ApiError(error.message, 400);
      if (!data) throw new ApiError("Product not found", 404);

      const product = toProduct(data as ProductRow);

      const { data: reviewRows } = await client
        .from("reviews")
        .select("id, rating, body, user_name, location, created_at")
        .eq("product_id", product._id)
        .order("created_at", { ascending: false })
        .limit(20);

      return {
        product,
        reviews: ((reviewRows as ReviewRow[] | null) ?? []).map(toReview),
      };
    },
  },

  ordersApi: {
    async create(body) {
      const data = await invokeFunction<{ order: OrderPayload }>("create-order", body);
      return { order: asOrder(data.order) };
    },

    async myOrders() {
      const client = requireSupabase();
      // my_orders() is a SECURITY DEFINER function filtered on auth.uid();
      // it returns the same camelCase payload the rest of the app speaks.
      const { data, error } = await client.rpc("my_orders");
      if (error) throw new ApiError(error.message, 400);

      const orders = ((data as unknown[] | null) ?? []).map(asOrder);
      return { count: orders.length, orders };
    },

    async get(orderId) {
      const client = requireSupabase();
      const { data, error } = await client.rpc("get_my_order", { p_order_id: orderId });
      if (error) throw new ApiError(error.message, 404);
      return { order: asOrder(data) };
    },

    async track(orderId) {
      const client = requireSupabase();
      const { data, error } = await client.rpc("track_order", { p_order_id: orderId });
      if (error) throw new ApiError(error.message, 404);
      return { order: asOrder(data) };
    },

    async listAll(status) {
      const client = requireSupabase();
      const { data, error } = await client.rpc("admin_list_orders", {
        p_status: status ?? null,
      });
      if (error) throw new ApiError(error.message, error.code === "42501" ? 403 : 400);

      const orders = ((data as unknown[] | null) ?? []).map(asOrder);
      return { count: orders.length, orders };
    },

    async updateStatus(orderUuid, status, note) {
      const client = requireSupabase();
      const { data, error } = await client.rpc("admin_set_order_status", {
        p_order: orderUuid,
        p_status: status,
        p_note: note ?? null,
      });
      if (error) throw new ApiError(error.message, error.code === "42501" ? 403 : 400);
      return { order: asOrder(data) };
    },
  },

  paymentsApi: {
    createRazorpayOrder(orderId) {
      return invokeFunction<RazorpayInit>("razorpay", { action: "create", orderId });
    },
    verifyRazorpay(body) {
      return invokeFunction<{
        message: string;
        order: { orderId: string; status: string; total: number };
      }>("razorpay", { action: "verify", ...body });
    },
  },

  reviewsApi: {
    async list(limit = 8) {
      const client = requireSupabase();
      const { data, error } = await client
        .from("reviews")
        .select("id, rating, body, user_name, location, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new ApiError(error.message, 400);

      const reviews = ((data as ReviewRow[] | null) ?? []).map(toReview);
      return { count: reviews.length, reviews };
    },
  },

  newsletterApi: {
    async subscribe(email) {
      const client = requireSupabase();
      const { data, error } = await client.rpc("subscribe_newsletter", { p_email: email });
      if (error) throw new ApiError(error.message, 400);
      return data as { message: string; subscriber: { email: string } };
    },
  },
};

/* ── the local preview driver ───────────────────────────────────────────── */
/*
 * Only for `npm run dev` without a Supabase project: the same request shapes
 * against `/api`, which `npm run mock` answers. It is never bundled
 * into a production build — there, a missing Supabase URL is a hard error.
 */

const PREVIEW_BASE = (import.meta.env.VITE_PREVIEW_API || "/api").replace(/\/+$/, "") || "/api";

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...((opts.headers as Record<string, string>) || {}) };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${PREVIEW_BASE}${path}`, {
      ...opts,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the preview API on /api.", 0);
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
    throw new ApiError(
      typeof data.message === "string" ? data.message : `Request failed (${res.status})`,
      res.status,
    );
  }

  // signup/login answer with the session token; keep it for the calls after
  if (typeof data.token === "string" && data.token) setToken(data.token);

  return data as T;
}

const previewDriver: Driver = {
  authApi: {
    signup: (body) => request("/auth/signup", { method: "POST", body }),
    login: (body) => request("/auth/login", { method: "POST", body }),
    me: () => request("/auth/me"),
    updateMe: (body) => request("/auth/me", { method: "PUT", body }),
    logout: async () => {
      clearToken();
    },
  },
  productsApi: {
    list: (params = {}) => {
      const qs = new URLSearchParams();
      if (params.category) qs.set("category", params.category);
      if (params.q) qs.set("q", params.q);
      if (params.featured) qs.set("featured", "true");
      if (params.sort) qs.set("sort", params.sort);
      const s = qs.toString();
      return request(`/products${s ? `?${s}` : ""}`);
    },
    get: (slug) => request(`/products/${encodeURIComponent(slug)}`),
  },
  ordersApi: {
    create: (body) => request("/orders", { method: "POST", body }),
    myOrders: () => request("/orders/me"),
    get: (orderId) => request(`/orders/${encodeURIComponent(orderId)}`),
    track: (orderId) => request(`/orders/track/${encodeURIComponent(orderId)}`),
    listAll: (status) =>
      request(`/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    updateStatus: (orderUuid, status, note) =>
      request(`/orders/${encodeURIComponent(orderUuid)}/status`, {
        method: "PUT",
        body: { status, note },
      }),
  },
  paymentsApi: {
    createRazorpayOrder: (orderId) =>
      request("/payments/razorpay/create-order", { method: "POST", body: { orderId } }),
    verifyRazorpay: (body) =>
      request("/payments/razorpay/verify", { method: "POST", body }),
  },
  reviewsApi: {
    list: (limit = 8) => request(`/reviews?limit=${limit}`),
  },
  newsletterApi: {
    subscribe: (email) => request("/newsletter", { method: "POST", body: { email } }),
  },
};

/* ── which backend is this build using? ─────────────────────────────────── */

const noBackend = (): never => {
  throw new ApiError(
    "Supabase is not configured for this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    0,
  );
};

const unconfiguredDriver: Driver = {
  authApi: {
    signup: noBackend,
    login: noBackend,
    me: noBackend,
    updateMe: noBackend,
    logout: async () => {},
  },
  productsApi: { list: noBackend, get: noBackend },
  ordersApi: {
    create: noBackend,
    myOrders: noBackend,
    get: noBackend,
    track: noBackend,
    listAll: noBackend,
    updateStatus: noBackend,
  },
  paymentsApi: { createRazorpayOrder: noBackend, verifyRazorpay: noBackend },
  reviewsApi: { list: noBackend },
  newsletterApi: { subscribe: noBackend },
};

const driver: Driver = isSupabaseConfigured
  ? supabaseDriver
  : import.meta.env.DEV
    ? previewDriver
    : unconfiguredDriver;

/** Which backend this build talks to — surfaced in the admin dashboard. */
export const BACKEND: "supabase" | "preview" | "unconfigured" = isSupabaseConfigured
  ? "supabase"
  : import.meta.env.DEV
    ? "preview"
    : "unconfigured";

export const authApi = driver.authApi;
export const productsApi = driver.productsApi;
export const ordersApi = driver.ordersApi;
export const paymentsApi = driver.paymentsApi;
export const reviewsApi = driver.reviewsApi;
export const newsletterApi = driver.newsletterApi;
