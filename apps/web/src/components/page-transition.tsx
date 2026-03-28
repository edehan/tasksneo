"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const [key, setKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-trigger animation on route change
  useEffect(() => {
    setKey((k) => k + 1);
  }, [pathname]);

  return (
    <div
      key={key}
      className={className}
      style={{ animation: "page-fade-in 0.4s ease-out" }}
    >
      {children}
    </div>
  );
}
