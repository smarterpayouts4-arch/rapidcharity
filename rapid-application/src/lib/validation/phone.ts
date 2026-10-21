export function normalizePkMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+92${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("3")) {
    return `+92${digits}`;
  }
  return null;
}

export function isValidPkMobile(raw: string): boolean {
  return normalizePkMobile(raw) !== null;
}
