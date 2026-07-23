const WEEKS_PER_MONTH = 31 / 7;

export function formatBillingPrice(price: number, currencyCode: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function monthlyPricePerWeek(monthlyPrice: number) {
  return Math.round((monthlyPrice / WEEKS_PER_MONTH + Number.EPSILON) * 100) / 100;
}

export function formatMonthlyPricePerWeek(monthlyPrice: number, currencyCode: string) {
  return formatBillingPrice(monthlyPricePerWeek(monthlyPrice), currencyCode);
}
