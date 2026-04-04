"use client";

import { useEffect, useState } from "react";
import { getAvatarUrl } from "@/lib/avatar";

/**
 * Returns a WeAvatar URL for the given identifier (email or user ID).
 * The hash is computed asynchronously via Web Crypto.
 */
export function useAvatarUrl(
  identifier: string | null | undefined,
  size = 80,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!identifier) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getAvatarUrl(identifier, size).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [identifier, size]);

  return url;
}
