import { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useMenu } from "../context/MenuContext";
import { CheckIcon, CloseIcon } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PAYMENTS = [
  { id: "upi", label: "UPI", icon: "📱", desc: "GPay · PhonePe · Paytm" },
  { id: "card", label: "Card", icon: "💳", desc: "Credit / Debit · Razorpay" },
  { id: "wallet", label: "Wallet", icon: "👛", desc: "Paytm · Mobikwik" },
  { id: "cod", label: "Cash", icon: "💵", desc: "Pay at the door" },
] as const;

export default function CheckoutModal({ open, onClose }: Props) {
  const { total, count, lines, clear, closeCart } = useCart();
  const { user, openAuth } = useAuth();
  const { live, loading: menuLoading, error: menuError, refresh } = useMenu();

  const [step, setStep] = useState<"form" | "success">("form");
  const [orderId, setOrderId] = useState("");
  const [paidTotal, setPaidTotal] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
    payment: "upi" as (typeof PAYMENTS)[number]["id"],
  });

  useEffect(() => {
    if (open) {
      setStep("form");
      setError(null);
      setForm((prev) => ({
        ...prev,
        name: user?.name || prev.name,
        phone: user?.phone || prev.phone,
      }));
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, user]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      openAuth("login");
      return;
    }
    if (!live) {
      setError("The live menu is not connected yet. Please retry in a moment.");
      return;
    }

    setProcessing(true);
    try {
      const { runCheckout } = await import("../lib/payments");
      const result = await runCheckout({
        items: lines.map((l) => ({ product: l.item.id, qty: l.qty })),
        customer: { name: form.name.trim(), phone: form.phone.trim() },
        address: {
          line1: form.address.trim(),
          city: form.city.trim() || undefined,
          pincode: form.pincode.trim() || undefined,
        },
        paymentMethod: form.payment,
      });

      if (result.success && result.orderId) {
        setOrderId(result.orderId);
        setPaidTotal(result.total ?? total);
        localStorage.setItem("khang_last_order", result.orderId);
        window.dispatchEvent(
          new CustomEvent("khang:order-created", {
            detail: result.orderId,
          }),
        );
        setStep("success");
        clear();
        closeCart();
      } else {
        setError(result.error || "Payment failed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    closeCart();
    onClose();
  };

  const email = user?.email || "";

  return (
    <div className="fixed inset-0 z-[60] animate-fade-in">
      <div
        className="absolute inset-0 bg-khang-ink/60 backdrop-blur-md"
        onClick={handleClose}
      />
      <div className="relative grid h-full place-items-center p-4">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-scale-in max-h-[92vh] overflow-y-auto">
          <button
            onClick={handleClose}
            aria-label="Close checkout"
            className="absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full border border-khang-ink/10 bg-white text-khang-ink shadow-sm transition hover:border-khang-ink hover:bg-khang-ink hover:text-white"
          >
            <CloseIcon />
          </button>

          {step === "form" ? (
            <form onSubmit={submit}>
              {/* Header */}
              <div className="border-b border-khang-ink/8 px-8 py-7">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-khang-ink/50">
                  Checkout · 结账
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-brush text-3xl font-medium tracking-tight text-khang-ink">
                    {count} {count === 1 ? "item" : "items"}
                  </span>
                  <span className="font-mono text-sm text-khang-ink/40">·</span>
                  <span className="font-brush text-3xl font-medium tracking-tight text-khang-red">
                    ₹{total}
                  </span>
                </div>
              </div>

              <div className="space-y-7 px-8 py-7">
                {!user && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="font-display text-sm font-semibold text-khang-ink">
                      Sign in to place your order
                    </div>
                    <p className="mt-1 font-body text-[13px] font-light leading-relaxed text-zinc-600">
                      Your order confirmation is sent to the email saved on your
                      account. New here? Creating an account takes 10 seconds.
                    </p>
                    <button
                      type="button"
                      onClick={() => openAuth("login")}
                      className="mt-4 rounded-full bg-khang-ink px-6 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-khang-red"
                    >
                      Sign in / Create account
                    </button>
                  </div>
                )}

                {!menuLoading && !live && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="font-display text-sm font-semibold text-amber-900">
                      Kitchen connection unavailable
                    </div>
                    <p className="mt-1 font-body text-[13px] font-light leading-relaxed text-amber-800">
                      {menuError ||
                        "We could not load the live menu, so ordering is paused."}
                    </p>
                    <button
                      type="button"
                      onClick={() => void refresh()}
                      className="mt-4 rounded-full border border-amber-300 px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-900 hover:bg-amber-100"
                    >
                      Retry connection
                    </button>
                  </div>
                )}

                <Field
                  label="Full Name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  required
                  placeholder="John Doe"
                />
                <Field
                  label="Phone Number"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  required
                  type="tel"
                  placeholder="+91 98765 43210"
                />

                <div>
                  <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-khang-ink/60">
                    Email for confirmation
                  </label>
                  <input
                    value={email}
                    readOnly
                    placeholder="Sign in to use your account email"
                    className="mt-3 w-full cursor-not-allowed rounded-full border border-khang-ink/10 bg-zinc-50 px-5 py-3.5 font-body text-sm tracking-wide text-zinc-600"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-khang-ink/60">
                    Delivery Address
                  </label>
                  <textarea
                    required
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    rows={3}
                    placeholder="House no, street, area"
                    className="mt-3 w-full rounded-2xl border border-khang-ink/15 bg-white px-5 py-3.5 font-body text-sm leading-relaxed text-khang-ink focus:border-khang-ink focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="City"
                    value={form.city}
                    onChange={(v) => setForm({ ...form, city: v })}
                    placeholder="Tirunelveli"
                  />
                  <Field
                    label="Pincode"
                    value={form.pincode}
                    onChange={(v) => setForm({ ...form, pincode: v })}
                    placeholder="627001"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-khang-ink/60">
                    Payment Method
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {PAYMENTS.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setForm({ ...form, payment: p.id })}
                        className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                          form.payment === p.id
                            ? "border-khang-ink bg-zinc-50"
                            : "border-khang-ink/10 bg-white hover:border-khang-ink/40"
                        }`}
                      >
                        <div className="text-2xl">{p.icon}</div>
                        <div className="min-w-0">
                          <div className="font-display text-sm font-semibold tracking-tight">
                            {p.label}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                            {p.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-khang-ink/8 bg-zinc-50 p-5">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-khang-ink/50">
                    Secure payments by
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Razorpay", "UPI", "Visa", "Mastercard", "RuPay"].map(
                      (p) => (
                        <span
                          key={p}
                          className="rounded-full bg-white px-3 py-1 font-mono text-[11px] font-semibold tracking-wide text-khang-ink ring-1 ring-khang-ink/10"
                        >
                          {p}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 font-mono text-[11px] text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={processing || !live}
                  className="w-full rounded-full bg-khang-ink py-4 font-display text-[12px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-khang-red disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-khang-ink"
                >
                  {processing
                    ? "Processing payment…"
                    : form.payment === "cod"
                      ? `Place Order · ₹${total}`
                      : `Pay ₹${total} Securely →`}
                </button>

                <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-khang-ink/40">
                  <span>🔒</span>
                  <span>256-bit encrypted · Razorpay</span>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-12 text-center">
              <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-khang-ink text-white">
                <CheckIcon className="h-10 w-10" />
                <span className="pulse-ring absolute inset-0 rounded-full ring-2 ring-khang-ink/30" />
              </div>

              <div className="mt-8 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-600">
                Order Confirmed
              </div>
              <h3 className="mt-3 font-brush text-[2.5rem] font-medium tracking-tight text-khang-ink">
                Thank you,{" "}
                <span className="italic font-light text-khang-red">
                  {form.name || "friend"}.
                </span>
              </h3>
              <p className="mt-3 max-w-md mx-auto font-body text-[15px] font-light leading-[1.8] text-zinc-500">
                Your dim sum dreams are about to come true. 🥟
              </p>

              <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-dashed border-khang-ink/20 bg-white p-6 text-left">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-khang-ink/50">
                  Order ID
                </div>
                <div className="mt-2 font-mono text-xl font-semibold tracking-[0.1em] text-khang-ink">
                  {orderId}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-khang-ink/8 pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    {form.payment === "cod" ? "Amount due" : "Total Paid"}
                  </span>
                  <span className="font-brush text-xl font-medium tracking-tight">
                    ₹{paidTotal ?? total}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                  Arrives in 30 – 40 min
                </div>
              </div>

              <ul className="mt-8 space-y-2 font-mono text-[11px] tracking-wide text-zinc-500">
                <li>✓ Confirmation email → {email || "your inbox"}</li>
                <li>✓ Our kitchen has received your order</li>
                <li>✓ Live tracking enabled</li>
              </ul>

              <button
                onClick={handleClose}
                className="mt-8 rounded-full bg-khang-ink px-10 py-3.5 font-display text-[12px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-khang-red"
              >
                Continue Browsing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-khang-ink/60">
        {label}
      </label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full rounded-full border border-khang-ink/15 bg-white px-5 py-3.5 font-body text-sm tracking-wide text-khang-ink focus:border-khang-ink focus:outline-none"
      />
    </div>
  );
}
