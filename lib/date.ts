import type { DatePreset } from "@/types/analytics";

const DAY_MS = 86_400_000;
const ANALYTICS_TIME_ZONE = process.env.ANALYTICS_TIME_ZONE || "America/New_York";

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDateInAnalyticsTimeZone(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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

  if (preset === "custom" && start && end) return { start, end };
  if (preset === "all") return { start: "2025-01-01", end: formatDate(today) };
  if (preset === "today") return { start: formatDate(today), end: formatDate(today) };
  if (preset === "last7") return { start: formatDate(new Date(today.getTime() - 6 * DAY_MS)), end: formatDate(today) };
  if (preset === "last30") return { start: formatDate(new Date(today.getTime() - 29 * DAY_MS)), end: formatDate(today) };
  if (preset === "year") return { start: formatDate(new Date(today.getFullYear(), 0, 1)), end: formatDate(today) };
  if (preset === "lastMonth") return { start: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), end: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)) };
  return { start: formatDate(new Date(today.getTime() - 6 * DAY_MS)), end: formatDate(today) };
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
  const startDate = parseDate(start);
  const year = startDate?.getFullYear() || Number(start.slice(0, 4));
  return {
    key: `${start}__${end}`,
    start,
    end,
    label: `${String(year).slice(2)}年第${weekNumberFromThursdayStart(start)}周（${formatChineseDate(start)}到${formatChineseDate(end)}）`,
  };
}

export function weekNumberFromThursdayStart(start: string): number {
  const date = parseDate(start);
  if (!date) return 1;
  const year = date.getFullYear();
  const first = new Date(year, 0, 1);
  first.setHours(0, 0, 0, 0);
  first.setDate(first.getDate() - ((first.getDay() + 3) % 7));
  return Math.floor((date.getTime() - first.getTime()) / DAY_MS / 7) + 1;
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
