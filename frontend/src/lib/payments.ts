/**
 * Checkout orchestrator.
 *
 *   1. create-order Edge Function → an order priced by Postgres, not the browser
 *   2. COD                        → done; the function sends the two emails
 *   3. UPI / Card / Wallet        → Razorpay Checkout popup
 *   4. razorpay (verify)          → HMAC signature check, order marked paid,
 *                                   receipt + kitchen copy sent
 */
import { ordersApi, paymentsApi, type CreateOrderBody } from "./api";
import { openRazorpayCheckout } from "./razorpay";

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  total?: number;
  error?: string;
  cancelled?: boolean;
}

export async function runCheckout(body: CreateOrderBody): Promise<PaymentResult> {
  try {
    // 1. Create the order. Totals and customer email are derived server-side
    //    — never from the browser.
    const { order } = await ordersApi.create(body);

    // 2. Cash on delivery — order is confirmed immediately.
    if (body.paymentMethod === "cod") {
      return { success: true, orderId: order.orderId, total: order.total };
    }

    // 3. Razorpay handles UPI, cards and wallets in one Checkout popup.
    const init = await paymentsApi.createRazorpayOrder(order.orderId);

    return await new Promise<PaymentResult>((resolve) => {
      openRazorpayCheckout({
        key: init.key,
        amount: init.amount,
        currency: init.currency,
        name: "Khang Chinese Restaurant",
        description: `Order ${init.orderId}`,
        order_id: init.razorpayOrderId,
        prefill: {
          name: init.customer?.name,
          email: init.customer?.email,
          contact: init.customer?.phone,
        },
        theme: { color: "#15803d" },
        notes: { khangOrderId: init.orderId },
        handler: async (resp) => {
          try {
            const verified = await paymentsApi.verifyRazorpay({
              ...resp,
              orderId: init.orderId,
            });
            resolve({
              success: true,
              orderId: verified.order.orderId,
              total: verified.order.total,
            });
          } catch (err) {
            resolve({
              success: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Payment verification failed",
            });
          }
        },
        modal: {
          ondismiss: () =>
            resolve({
              success: false,
              cancelled: true,
              error: "Payment cancelled — your order was not charged.",
            }),
        },
      }).catch((err: unknown) =>
        resolve({
          success: false,
          error:
            err instanceof Error ? err.message : "Could not open Razorpay",
        }),
      );
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Checkout failed",
    };
  }
}
