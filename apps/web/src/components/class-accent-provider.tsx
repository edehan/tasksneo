"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";

import { useClasses } from "@/features/classes/hooks/use-classes";

const DEFAULT_ACCENT = "#6366f1";

interface ClassAccentContextValue {
  accentColor: string;
  classId: string | null;
}

const ClassAccentContext = createContext<ClassAccentContextValue>({
  accentColor: DEFAULT_ACCENT,
  classId: null,
});

export function ClassAccentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const classId = typeof params.classId === "string" ? params.classId : null;
  const { classes } = useClasses();

  const accentColor = useMemo(() => {
    if (!classId) return DEFAULT_ACCENT;
    const cls = classes.find((c) => c.id === classId);
    return cls?.color ?? DEFAULT_ACCENT;
  }, [classId, classes]);

  useEffect(() => {
    document.documentElement.style.setProperty("--class-accent", accentColor);
    return () => {
      document.documentElement.style.setProperty(
        "--class-accent",
        DEFAULT_ACCENT,
      );
    };
  }, [accentColor]);

  return (
    <ClassAccentContext.Provider value={{ accentColor, classId }}>
      {children}
    </ClassAccentContext.Provider>
  );
}

export function useClassAccent() {
  return useContext(ClassAccentContext);
}
