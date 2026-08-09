"use client";

function chipColor(amount: number): [string, string] {
  if (amount >= 5000) return ["#1c1917", "#facc15"];
  if (amount >= 1000) return ["#1e3a8a", "#93c5fd"];
  if (amount >= 250) return ["#14532d", "#86efac"];
  if (amount >= 50) return ["#7f1d1d", "#fca5a5"];
  return ["#e2e8f0", "#64748b"];
}

export default function ChipStack({
  amount,
  label,
  big = false,
}: {
  amount: number;
  label?: string;
  big?: boolean;
}) {
  if (amount <= 0) return null;
  const [base, accent] = chipColor(amount);
  const count = Math.min(4, 1 + Math.floor(Math.log10(Math.max(1, amount)) / 1.2));

  return (
    <div className={`chips ${big ? "chips-big" : ""}`}>
      <div className="chips-stack">
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className="chip"
            style={{
              background: base,
              borderColor: accent,
              bottom: `${i * 3}px`,
              zIndex: i,
            }}
          />
        ))}
      </div>
      <span className="chips-amount">
        {label ? `${label} ` : ""}
        {amount.toLocaleString("nl-BE")}
      </span>
    </div>
  );
}
