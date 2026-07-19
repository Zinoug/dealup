import { formatEuros } from '@/utils/format';

export const DISPLAY_PRICES = {
  monthlyCents: 1299,
  weeklyCents: 499,
} as const;

export function monthlyPricePerWeekCents(monthlyCents: number) {
  return Math.round(monthlyCents / (31 / 7));
}

export function formatMonthlyPricePerWeek(monthlyCents: number) {
  return formatEuros(monthlyPricePerWeekCents(monthlyCents), true);
}
