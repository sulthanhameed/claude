import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ordersApi, type KhangOrder } from "../lib/api";
import { CloseIcon } from "./Icons";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 ring-blue-200",
  preparing: "bg-amber-50 text-amber-700 ring-amber-200",
  out_for_delivery: "bg-violet-50 text-violet-700 ring-violet-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

export default function MyOrdersModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<KhangOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (user) {
      setLoading(true);
      setError(null);
      ordersApi
        .myOrders()
        .then(({ orders: list }) => setOrders(list))
        .catch((err: unknown) =>
          setError(
            err instanceof Error ? err.message : "Failed to load orders",
          ),
        )
        .finally(() => setLoading(false));
    }

  }, [open, user]);

  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] animate-fade-in">
      <div
        className="absolute inset-0 bg-khang-ink/70 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative h-full overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-scale-in">
          <div className="flex items-center justify-between bg-khang-ink p-7 text-white">
            <div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
                My Account · 我的订单
              </div>
              <h2 className="mt-2 font-brush text-3xl font-medium tracking-tight">
                Your Orders
              </h2>
              {user && (
                <p className="mt-1 font-mono text-[11px] text-white/55">
                  {user.email}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close orders"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {!user && (
              <p className="py-10 text-center font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                Sign in to view your orders.
              </p>
            )}

            {loading && (
              <p className="py-10 text-center font-mono text-xs uppercase tracking-[0.25em] text-zinc-400">
                Loading your orders…
              </p>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-mono text-xs text-red-600">
                {error}
              </div>
            )}

            {!loading && !error && user && orders.length === 0 && (
              <div className="py-14 text-center">
                <div className="text-5xl opacity-50">🥡</div>
                <p className="mt-5 font-brush text-2xl text-khang-ink">
                  No orders yet
                </p>
                <p className="mt-2 font-body text-sm font-light text-zinc-500">
                  Your first dim sum basket is waiting.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 rounded-full bg-khang-ink px-8 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white hover:bg-khang-red"
                >
                  Browse the menu
                </button>
              </div>
            )}

            <ul className="space-y-4">
              {orders.map((order) => (
                <li
                  key={order._id}
                  className="rounded-2xl border border-khang-ink/10 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-semibold tracking-[0.08em] text-khang-red">
                        {order.orderId}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                        {new Date(order.createdAt).toLocaleString()} ·{" "}
                        {order.payment.method.toUpperCase()} ·{" "}
                        {order.payment.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] ring-1 ${
                          STATUS_COLORS[order.status] ||
                          "bg-zinc-50 text-zinc-600 ring-zinc-200"
                        }`}
                      >
                        {order.status.replace(/_/g, " ")}
                      </span>
                      <span className="font-brush text-xl font-medium text-khang-ink">
                        ₹{order.total}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-khang-ink/8 pt-3 font-body text-[13px] font-light leading-relaxed text-zinc-600">
                    {order.items
                      .map((i) => `${i.name} × ${i.qty}`)
                      .join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
