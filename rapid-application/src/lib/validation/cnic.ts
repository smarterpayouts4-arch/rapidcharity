export function normalizeCnicDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 13);
}

export function formatCnicDisplay(digits: string): string {
  const d = normalizeCnicDigits(digits);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export function isValidCnic(raw: string): boolean {
  return normalizeCnicDigits(raw).length === 13;
}
