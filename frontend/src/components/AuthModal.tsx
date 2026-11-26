import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { CloseIcon } from "./Icons";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

/* ─────────────────────────────────────────────────────────────────────────
   The sign-in / create-account dialog.

   Everything here is sized against the *smallest* screen it has to survive:
   a 375 × 553 phone with the browser's own bars showing, and a laptop with a
   640 px-tall viewport. The old version stacked ~950 px of content in a card
   with no height cap, centred by a grid — so on anything shorter than that the
   overflow split evenly top and bottom, and the close button (absolute, top-5,
   inside the card) was pushed above the top of the screen and clipped by the
   card's own overflow. The button was always there; it just could not be seen
   or reached.

   Two rules keep that from happening again:
     · the card is capped at the viewport and scrolls *inside*, so its own
       edges — and the close button on them — are always on screen;
     · the close button sits in a fixed header row rather than absolutely
       positioned, so no amount of content can move it.
   ───────────────────────────────────────────────────────────────────────── */

export default function AuthModal() {
  const {
    isAuthOpen,
    authMode,
    setAuthMode,
    closeAuth,
    login,
    signup,
    signInWithGoogle,
    oauthError,
    clearOAuthError,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    remember: true,
  });

  useEffect(() => {
    if (isAuthOpen) {
      setError(null);
      setForm({ name: "", email: "", phone: "", password: "", remember: true });
    }
  }, [isAuthOpen, authMode]);

  useBodyScrollLock(isAuthOpen);

  // Escape closes it, like every other dialog on the site.
  useEffect(() => {
    if (!isAuthOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuth();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthOpen, closeAuth]);

  if (!isAuthOpen) return null;

  const isLogin = authMode === "login";
  const shown = error ?? oauthError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        if (!form.email || !form.password) throw new Error("Fill all fields");
        await login(form.email, form.password);
      } else {
        if (!form.name || !form.email || !form.password)
          throw new Error("Fill all required fields");
        if (form.password.length < 6)
          throw new Error("Password must be at least 6 characters");
        await signup(form.name, form.email, form.password, form.phone);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    clearOAuthError();
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // success navigates away; keep the spinner so the button cannot be
      // pressed twice before the page unloads
    } catch {
      // the message is already in the context, shown in the banner above
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-khang-ink/60 backdrop-blur-md"
        onClick={closeAuth}
      />

      {/* The card. `max-h` + `overflow-y-auto` on the same element keeps the
          rounded corners and the shadow intact while the content scrolls. */}
      <div className="absolute inset-0 grid place-items-center p-3 sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
          className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-khang-ink/10 bg-white shadow-2xl animate-scale-in"
        >
          {/* Header row — the close button lives here, so it can never be
              scrolled away or pushed off the top by a long form. */}
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-1 pt-5 sm:px-7">
            <div className="flex items-baseline gap-2.5">
              <span className="font-cn text-xl text-khang-red">康</span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-khang-ink/50">
                {isLogin ? "Welcome Back" : "Join Khang"}
              </span>
            </div>
            <button
              type="button"
              onClick={closeAuth}
              aria-label="Close"
              className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-khang-ink/10 bg-white text-khang-ink transition hover:border-khang-ink hover:bg-khang-ink hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* The scrolling body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-7 sm:pb-7">
            <h2
              id="auth-title"
              className="mt-2 font-brush text-[1.75rem] font-medium leading-[1.12] tracking-[-0.02em] text-khang-ink sm:text-[2rem]"
            >
              {isLogin ? (
                <>
                  Sign in to <span className="italic font-light text-khang-red">Khang</span>
                </>
              ) : (
                <>
                  Create your <span className="italic font-light text-khang-red">account</span>
                </>
              )}
            </h2>
            <p className="mt-2 font-body text-[13px] font-light leading-relaxed text-zinc-500">
              {isLogin
                ? "Order faster, track meals & save your favourites."
                : "Get a free dim sum on your first order. Members save 10%."}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              {!isLogin && (
                <Field
                  label="Full Name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder="John Doe"
                  autoComplete="name"
                  required
                />
              )}
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="you@example.com"
                autoComplete={isLogin ? "email" : "email"}
                required
              />
              {!isLogin && (
                <Field
                  label="Phone (optional)"
                  type="tel"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                />
              )}
              <Field
                label="Password"
                type="password"
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                placeholder={isLogin ? "Enter your password" : "Min 6 characters"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
              />

              {isLogin ? (
                <label className="flex items-center gap-2 font-mono text-[11px] text-khang-ink/60">
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                    className="h-3.5 w-3.5 accent-khang-ink"
                  />
                  Keep me signed in on this device
                </label>
              ) : (
                <p className="font-mono text-[10px] leading-relaxed tracking-wide text-zinc-500">
                  Your email is stored securely in our database. Order confirmations
                  and receipts are sent to it.
                </p>
              )}

              {shown && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 p-3 font-mono text-[11px] leading-relaxed text-red-600"
                >
                  {shown}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full rounded-full bg-khang-ink py-3.5 font-display text-[12px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-khang-red disabled:opacity-60"
              >
                {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-khang-ink/10" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-khang-ink/40">
                or
              </span>
              <div className="h-px flex-1 bg-khang-ink/10" />
            </div>

            <GoogleBtn loading={googleLoading} onClick={handleGoogle} />

            {/* Switch mode */}
            <div className="mt-5 text-center font-body text-[13px] text-khang-ink/60">
              {isLogin ? "New to Khang? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setAuthMode(isLogin ? "signup" : "login")}
                className="font-display font-semibold text-khang-ink underline-offset-4 hover:text-khang-red hover:underline"
              >
                {isLogin ? "Create an account" : "Sign in instead"}
              </button>
            </div>
          </div>

          {/* Footer strip — outside the scroll area so the terms stay put */}
          <div className="shrink-0 border-t border-khang-ink/8 bg-zinc-50 px-5 py-3 sm:px-7">
            <p className="text-center font-mono text-[10px] leading-relaxed tracking-wide text-khang-ink/40">
              By continuing you agree to our{" "}
              <a href="#" className="underline-offset-2 hover:text-khang-ink hover:underline">
                Terms
              </a>{" "}
              &amp;{" "}
              <a href="#" className="underline-offset-2 hover:text-khang-ink hover:underline">
                Privacy
              </a>
              .
            </p>
          </div>
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
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-khang-ink/60">
        {label}
      </label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-full border border-khang-ink/15 bg-white px-5 py-2.5 font-body text-[15px] tracking-wide text-khang-ink focus:border-khang-ink focus:outline-none focus:ring-1 focus:ring-khang-ink/20"
      />
    </div>
  );
}

/**
 * The Google button — a real one now.
 *
 * It used to be a `<button type="button">` with no onClick at all: no OAuth
 * code existed anywhere in the project, so tapping it did nothing and gave no
 * explanation. It now starts the redirect through Supabase.
 */
function GoogleBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-full border border-khang-ink/15 bg-white py-3 font-display text-[13px] font-semibold tracking-wide text-khang-ink transition hover:border-khang-ink hover:bg-zinc-50 disabled:opacity-60"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-khang-ink/25 border-t-khang-ink" />
          Taking you to Google…
        </>
      ) : (
        <>
          <GoogleMark />
          Continue with Google
        </>
      )}
    </button>
  );
}

/** Google's own four-colour G, drawn inline so there is no image request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
