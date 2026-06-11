import type { DatePreset } from "@/types/analytics";

const DAY_MS = 86_400_000;

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatChineseDate(value: string): string {
  const date = parseDate(value);
  if (!date) return value;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function parseDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function parseShopifyDate(value: string): Date | null {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

export function resolveDateRange(preset: DatePreset, start?: string, end?: string, referenceDate?: string): { start: string; end: string } {
  const today = referenceDate ? parseDate(referenceDate) || new Date() : new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - DAY_MS);

  if (preset === "custom" && start && end) return { start, end };
  if (preset === "today") return { start: formatDate(today), end: formatDate(today) };
  if (preset === "yesterday") return { start: formatDate(yesterday), end: formatDate(yesterday) };
  if (preset === "last7") return { start: formatDate(new Date(today.getTime() - 6 * DAY_MS)), end: formatDate(today) };
  if (preset === "last30") return { start: formatDate(new Date(today.getTime() - 29 * DAY_MS)), end: formatDate(today) };
  if (preset === "year") return { start: formatDate(new Date(today.getFullYear(), 0, 1)), end: formatDate(today) };
  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return { start: formatDate(new Date(today.getFullYear(), quarterStartMonth, 1)), end: formatDate(today) };
  }
  if (preset === "month") return { start: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)), end: formatDate(today) };
  if (preset === "lastMonth") return { start: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), end: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)) };
  if (preset === "week") return thursdayWeekRange(today);
  return thursdayWeekRange(today);
}

export function previousRange(range: { start: string; end: string }): { start: string; end: string } {
  const startDate = parseDate(range.start) || new Date(range.start);
  const endDate = parseDate(range.end) || new Date(range.end);
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1);
  const previousEnd = new Date(startDate.getTime() - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * DAY_MS);
  return { start: formatDate(previousStart), end: formatDate(previousEnd) };
}

export function previousYearRange(range: { start: string; end: string }): { start: string; end: string } {
  const startDate = parseDate(range.start) || new Date(range.start);
  const endDate = parseDate(range.end) || new Date(range.end);
  return {
    start: formatDate(new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate())),
    end: formatDate(new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())),
  };
}

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function dateDimension(date: string) {
  const parsed = parseDate(date);
  const year = parsed?.getFullYear() ?? Number(date.slice(0, 4));
  const month = date.slice(0, 7);
  return { date, year, month, week: getThursdayWeek(parsed || new Date(date)) };
}

export function weekOption(start: string, end: string) {
  return {
    key: `${start}__${end}`,
    start,
    end,
    label: `${formatChineseDate(start)}到${formatChineseDate(end)}`,
  };
}

function getThursdayWeek(date: Date): string {
  const range = thursdayWeekRange(date);
  return `${range.start} 至 ${range.end}`;
}

function thursdayWeekRange(date: Date): { start: string; end: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 3) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: formatDate(start), end: formatDate(end) };
}
