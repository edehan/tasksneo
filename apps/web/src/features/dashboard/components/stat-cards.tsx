"use client";

interface StatCardsProps {
  total: number;
  inProgress: number;
  overdue: number;
  notStarted: number;
}

interface CardDef {
  label: string;
  key: keyof StatCardsProps;
  errorColor?: boolean;
}

const cards: CardDef[] = [
  { label: "Total Tasks", key: "total" },
  { label: "In Progress", key: "inProgress" },
  { label: "Overdue", key: "overdue", errorColor: true },
  { label: "Not Started", key: "notStarted" },
];

export function StatCards({ total, inProgress, overdue, notStarted }: StatCardsProps) {
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
          <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
