"use client";

import { useTranslations } from "next-intl";

interface StatCardsProps {
  total: number;
  inProgress: number;
  overdue: number;
  notStarted: number;
}

interface CardDef {
  labelKey: string;
  key: keyof StatCardsProps;
  errorColor?: boolean;
}

const cards: CardDef[] = [
  { labelKey: "totalTasks", key: "total" },
  { labelKey: "inProgress", key: "inProgress" },
  { labelKey: "overdue", key: "overdue", errorColor: true },
  { labelKey: "notStarted", key: "notStarted" },
];

export function StatCards({ total, inProgress, overdue, notStarted }: StatCardsProps) {
  const t = useTranslations("dashboardStatCards");
  const values: StatCardsProps = { total, inProgress, overdue, notStarted };

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-lg border border-border bg-card px-5 py-4"
        >
          <p
            className={`font-serif text-[2.5rem] font-bold leading-none ${
              card.errorColor ? "text-status-error" : "text-foreground"
            }`}
          >
            {values[card.key]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t(card.labelKey)}</p>
        </div>
      ))}
    </div>
  );
}
