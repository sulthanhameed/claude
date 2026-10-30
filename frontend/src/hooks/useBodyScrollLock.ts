import { useEffect } from "react";

/**
 * Locks page scroll while a modal is open — and keeps it locked while *any*
 * other modal is still open.
 *
 * Several overlays can be on screen at once (the cart, then checkout, then an
 * auth prompt on top of both). The naive `body.style.overflow = "hidden"` in
 * each component looked fine, but every close handler reset the style to "",
 * so dismissing the top modal unlocked the page underneath it and the
 * background started scrolling behind a dialog that was still open.
 *
 * Locks are reference counted: the first one remembers whatever the page had
 * before, and only the last one releases it.
 */
let locks = 0;
let overflowBeforeLock = "";

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    if (locks === 0) {
      overflowBeforeLock = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    locks += 1;

    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = overflowBeforeLock;
    };
  }, [active]);
}
