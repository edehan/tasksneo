"use client";

import { useCallback, useEffect, useState } from "react";

export function useCooldown() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const deadline = expiresAt;

    function updateRemaining() {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        setExpiresAt(null);
      }
    }

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const startCooldown = useCallback((seconds: number) => {
    setExpiresAt(Date.now() + seconds * 1000);
  }, []);

  return {
    coolingDown: remainingSeconds > 0,
    remainingSeconds,
    startCooldown,
  };
}
