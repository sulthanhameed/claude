import crypto from "crypto";

/**
 * Generate a friendly order ID like KH-2026-0042.
 * The caller retries on the rare unique-index collision.
 */
export function generateOrderId() {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(1000, 10000);
  return `KH-${year}-${rand}`;
}
