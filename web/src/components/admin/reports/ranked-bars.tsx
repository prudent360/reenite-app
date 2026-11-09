import { formatNaira } from "@/lib/utils";

/**
 * A ranked list with a bar per row, in one hue: the label, the value as text and a bar scaled
 * to the largest row. It's a real table, so the values never depend on the bar alone.
 */
export function RankedBars({ rows, caption, detail }: { rows: { label: string; amount: number; count: number }[]; caption: string; detail: (count: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.amount));

  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">Nothing in this period.</p>;
  }

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Amount</th>
          <th scope="col">Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="block px-5 py-3 sm:px-6">
            <th scope="row" className="flex items-baseline justify-between gap-3 text-left font-normal">
              <span className="font-medium text-foreground">{row.label}</span>
              <span className="text-xs text-muted">{detail(row.count)}</span>
            </th>
            <td className="mt-2 flex items-center gap-3">
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                <span className="block h-full rounded-full bg-chart-bar" style={{ width: `${Math.max(2, (row.amount / max) * 100)}%` }} />
              </span>
              <span className="w-28 text-right font-semibold text-foreground">{formatNaira(row.amount)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
