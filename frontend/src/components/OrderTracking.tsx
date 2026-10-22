import { useCallback, useEffect, useState } from "react";
import { CheckIcon, ChefIcon, TruckIcon } from "./Icons";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";
import { ordersApi, type OrderStatus } from "../lib/api";

const STAGES = [
  { label: "Received", desc: "We got your order", icon: "📝" },
  { label: "Preparing", desc: "Wok is sizzling", icon: "🔥" },
  { label: "On the Way", desc: "Out for delivery", icon: "🚚" },
  { label: "Delivered", desc: "Enjoy your meal", icon: "🥢" },
];

const STAGE_BY_STATUS: Record<OrderStatus, number> = {
  received: 0,
  preparing: 1,
  out_for_delivery: 2,
  delivered: 3,
  cancelled: 0,
};

interface TrackedOrder {
  orderId: string;
  status: OrderStatus;
  tracking?: Array<{ stage: string; note?: string; at: string }>;
  estimatedDelivery?: string;
  deliveredAt?: string;
  total?: number;
  customer?: { name?: string };
}

export default function OrderTracking() {
  const [orderId, setOrderId] = useState(
    () => {
      try {
        return localStorage.getItem("khang_last_order") || "";
      } catch {
        return "";
      }
    },
  );
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const track = useCallback(async (rawId?: string) => {
    const id = (rawId ?? orderId).trim().toUpperCase();
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const { order: found } = await ordersApi.track(id);
      setOrder(found as unknown as TrackedOrder);
      setOrderId(found.orderId);
    } catch (err) {
      setOrder(null);
      setError(
        err instanceof Error
          ? err.message
          : "Could not find that order. Check the ID and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // When checkout completes, pick up the new order automatically.
  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id) {
        setOrderId(id);
        void track(id);
      }
    };
    window.addEventListener("khang:order-created", handler as EventListener);
    return () =>
      window.removeEventListener(
        "khang:order-created",
        handler as EventListener,
      );
  }, [track]);

  // Auto-refresh live orders every 30s until they are finished.
  useEffect(() => {
    if (
      !order ||
      order.status === "delivered" ||
      order.status === "cancelled"
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      ordersApi
        .track(order.orderId)
        .then(({ order: fresh }) =>
          setOrder(fresh as unknown as TrackedOrder),
        )
        .catch(() => {
          /* keep the last known status */
        });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [order]);

  const stage = order ? STAGE_BY_STATUS[order.status] ?? 0 : 0;
  const cancelled = order?.status === "cancelled";
  const latest = order?.tracking?.[order.tracking.length - 1];
  const eta = order?.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "25–35 min";

  return (
    <section id="tracking" className="relative bg-zinc-50 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          number="06"
          eyebrow="Live Tracking"
          eyebrowCn="跟踪订单"
          title={
            <>
              Track your{" "}
              <span className="italic font-light text-khang-red">order</span>
            </>
          }
          description="Enter your Order ID to see exactly where your meal is, in real time."
        />

        {/* Tracker card — reveals from below on scroll */}
        <Reveal
          variant="up"
          delay={150}
          duration={600}
          className="mt-14 overflow-hidden rounded-3xl border border-khang-ink/10 bg-white"
        >
          {/* Input bar */}
          <div className="border-b border-khang-ink/8 p-6 sm:p-8">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void track();
              }}
            >
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-khang-ink/40">
                  ID
                </span>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="KH-2026-0042"
                  className="w-full rounded-full border border-khang-ink/10 bg-zinc-50 px-5 py-4 pl-12 font-mono text-sm uppercase tracking-wide text-khang-ink placeholder:text-zinc-400 focus:border-khang-ink focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-khang-ink px-8 py-4 font-display text-[12px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-khang-red disabled:opacity-60"
              >
                {loading ? "Looking…" : "Track Order"}
              </button>
            </form>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[11px] text-red-600">
                {error}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-6 sm:p-10">
            {!order ? (
              <div className="py-16 text-center">
                <div className="text-6xl opacity-60">🥡</div>
                <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-400">
                  {loading
                    ? "Checking with the kitchen…"
                    : "Enter your order ID above to begin tracking"}
                </p>
              </div>
            ) : (
              <>
                {/* Status header */}
                <div className="flex items-center justify-between border-b border-khang-ink/8 pb-5">
                  <div>
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-khang-ink/50">
                      Order
                    </div>
                    <div className="mt-1 font-mono text-base font-semibold tracking-[0.1em] text-khang-ink">
                      #{order.orderId}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${
                        cancelled ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      <span className="relative flex h-2 w-2">
                        <span
                          className={`absolute inset-0 animate-ping rounded-full opacity-75 ${
                            cancelled ? "bg-red-400" : "bg-emerald-400"
                          }`}
                        />
                        <span
                          className={`relative inline-flex h-2 w-2 rounded-full ${
                            cancelled ? "bg-red-500" : "bg-emerald-500"
                          }`}
                        />
                      </span>
                      {cancelled ? "Cancelled" : "Live"}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-khang-ink/40">
                      ETA · {eta}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="relative mt-10">
                  <div className="absolute left-0 right-0 top-7 h-px bg-khang-ink/10" />
                  <div
                    className={`absolute left-0 top-7 h-px transition-all duration-700 ${
                      cancelled ? "bg-red-400" : "bg-khang-ink"
                    }`}
                    style={{
                      width: `${(stage / (STAGES.length - 1)) * 100}%`,
                    }}
                  />

                  <div className="grid grid-cols-4 gap-2">
                    {STAGES.map((s, i) => {
                      const done = i <= stage;
                      const current = i === stage;
                      return (
                        <div
                          key={s.label}
                          className="flex flex-col items-center text-center"
                        >
                          <div
                            className={`relative grid h-14 w-14 place-items-center rounded-full border transition-all duration-500 ${
                              done
                                ? cancelled
                                  ? "border-red-500 bg-red-500 text-white"
                                  : "border-khang-ink bg-khang-ink text-white"
                                : "border-khang-ink/15 bg-white text-zinc-300"
                            }`}
                          >
                            {done && !current ? (
                              <CheckIcon className="h-5 w-5" />
                            ) : (
                              <span className="text-lg">{s.icon}</span>
                            )}
                            {current && !cancelled && (
                              <span className="pulse-ring absolute inset-0 rounded-full ring-2 ring-khang-ink/30" />
                            )}
                          </div>
                          <div
                            className={`mt-4 font-display text-xs font-semibold tracking-tight sm:text-[13px] ${
                              done ? "text-khang-ink" : "text-zinc-400"
                            }`}
                          >
                            {s.label}
                          </div>
                          <div className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400 sm:block">
                            {s.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status card */}
                <div className="mt-10 flex items-center gap-4 rounded-2xl border border-khang-ink/10 bg-zinc-50 p-5">
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white ${
                      cancelled ? "bg-red-600" : "bg-khang-ink"
                    }`}
                  >
                    {stage < 2 ? (
                      <ChefIcon className="h-5 w-5" />
                    ) : (
                      <TruckIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[15px] font-semibold tracking-tight text-khang-ink">
                      {cancelled
                        ? "Order cancelled"
                        : STAGES[stage].label}
                    </div>
                    <div className="mt-0.5 font-body text-[13px] font-light leading-relaxed text-zinc-500">
                      {latest?.note ||
                        (cancelled
                          ? "This order was cancelled. Contact us for a refund."
                          : `${STAGES[stage].desc} · Estimated ${eta}`)}
                    </div>
                  </div>
                  {typeof order.total === "number" && (
                    <div className="text-right">
                      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-400">
                        Total
                      </div>
                      <div className="font-brush text-xl font-medium text-khang-ink">
                        ₹{order.total}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
