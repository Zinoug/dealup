export function formatEuros(cents: number, showDecimals = false) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(cents / 100);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function isLeboncoinUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && /(^|\.)leboncoin\.fr$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function findUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match?.[0] ?? null;
}
