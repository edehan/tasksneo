"use client";

import { SWRConfig, unstable_serialize } from "swr";

interface SWRFallbackEntry {
  key: ReadonlyArray<string>;
  data: unknown;
}

interface SWRProviderProps {
  fallbackEntries?: SWRFallbackEntry[];
  children: React.ReactNode;
}

export function SWRProvider({
  fallbackEntries = [],
  children,
}: SWRProviderProps) {
  const fallback = Object.fromEntries(
    fallbackEntries.map(({ key, data }) => [unstable_serialize(key), data]),
  );

  return (
    <SWRConfig
      value={{
        fallback,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
