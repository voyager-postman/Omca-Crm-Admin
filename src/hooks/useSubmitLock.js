import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Prevents double-submit on async actions.
 * Sets busy instantly (flushSync) so the button shows "Submitting..."
 * before the request starts, and blocks a second click via a ref.
 *
 * Usage: const { busy, run } = useSubmitLock();
 *   onClick={() => run(async () => { await api(); })}
 *   disabled={busy}
 */
export function useSubmitLock() {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    flushSync(() => {
      setBusy(true);
    });
    try {
      return await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}

/**
 * Same as useSubmitLock but tracks which action is busy (for multiple buttons).
 * Usage: const { busyKey, run } = useKeyedSubmitLock();
 *   onClick={() => run("save", async () => { ... })}
 *   disabled={busyKey === "save"}
 */
export function useKeyedSubmitLock() {
  const [busyKey, setBusyKey] = useState(null);
  const busyRef = useRef(null);

  const run = useCallback(async (key, fn) => {
    if (busyRef.current) return;
    busyRef.current = key;
    flushSync(() => {
      setBusyKey(key);
    });
    try {
      return await fn();
    } finally {
      busyRef.current = null;
      setBusyKey(null);
    }
  }, []);

  return {
    busyKey,
    busy: Boolean(busyKey),
    isBusy: (key) => busyKey === key,
    run,
  };
}
