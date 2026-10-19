export function toBuddhistDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${Number(match[1]) + 543}`;
}

export function fromBuddhistDate(value: string): string | null {
  if (!value) return "";
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match || Number(match[3]) < 2400) return null;
  const iso = `${String(Number(match[3]) - 543).padStart(4, "0")}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}
