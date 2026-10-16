const MAX_SERVICE_AREAS = 50;

export function normalizeServiceAreas(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const area = value.trim();
    const key = area.toLocaleLowerCase();
    if (!area || seen.has(key)) continue;
    seen.add(key);
    normalized.push(area);
    if (normalized.length === MAX_SERVICE_AREAS) break;
  }

  return normalized;
}

export function validateBusinessHours(hours: {
  workDays: string[];
  startTime: string;
  endTime: string;
}): { workDays?: string; endTime?: string } {
  const errors: { workDays?: string; endTime?: string } = {};
  if (hours.workDays.length === 0) errors.workDays = "Elige al menos un día laborable.";
  if (hours.endTime <= hours.startTime) errors.endTime = "La hora de cierre debe ser posterior a la de apertura.";
  return errors;
}
