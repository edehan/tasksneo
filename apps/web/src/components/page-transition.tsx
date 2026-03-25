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

  useEffect(() => {
    // Increment key on each navigation to re-trigger the CSS animation
    setKey((k) => k + 1);
  }, [pathname]);

  return (
    <div
      key={key}
      className={className}
      style={{ animation: "page-fade-in 0.2s ease-out" }}
    >
      {children}
    </div>
  );
}
