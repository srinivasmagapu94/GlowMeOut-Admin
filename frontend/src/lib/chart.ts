// recharts formatter helpers.
// recharts types formatter/label params as broad union types, so these accept `unknown`
// and narrow inside — a `(value: number) => string` formatter is not assignable.
import { fmtCompactMoney, fmtNumber } from "@/lib/format";

export const moneyTick = (value: number) => fmtCompactMoney(value);

export const moneyTooltip = (value: unknown) => fmtCompactMoney(Number(value));

export const countTooltip = (value: unknown) => fmtNumber(Number(value));

export const reviewsTooltip = (value: unknown) => `${fmtNumber(Number(value))} reviews`;

/** Maps a series dataKey ("a" / "b") onto a human label in the tooltip. */
export function seriesTooltip(labels: Record<string, string>, money = true) {
  return (value: unknown, name: unknown): [string, string] => [
    money ? fmtCompactMoney(Number(value)) : fmtNumber(Number(value)),
    labels[String(name)] ?? String(name),
  ];
}

/** Pie slice label renderer — recharts passes a wide props union. */
export const sliceLabel = (props: unknown) =>
  String((props as { label?: string | number }).label ?? "");
