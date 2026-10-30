/**
 * Razorpay Checkout SDK loader & helper.
 * Loads https://checkout.razorpay.com/v1/checkout.js on demand.
 */

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

let loaded = false;
let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    // A failed attempt must not be cached: `loading` is cleared before the
    // rejection is delivered, so the next call starts a fresh request. Without
    // this one offline moment (or an ad-blocker, or a strict CSP) would make
    // every online payment fail for the rest of the session.
    const fail = (error: Error) => {
      loading = null;
      script.remove();
      reject(error);
    };

    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      // The file can load and still not define the constructor (an intercepted
      // or corrupted response). Retrying is useless in that case, so say so.
      if (typeof window.Razorpay !== "function") {
        loaded = false;
        fail(new Error("Razorpay SDK loaded but did not initialise"));
        return;
      }
      loaded = true;
      resolve();
    };
    script.onerror = () => fail(new Error("Razorpay SDK failed to load"));

    document.body.appendChild(script);
  });

  return loading;
}

export async function openRazorpayCheckout(options: RazorpayOptions): Promise<void> {
  await loadRazorpay();
  const rp = new window.Razorpay(options);
  rp.open();
}
