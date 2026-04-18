export function parseSheetTimeHour(value?: string): number | null {
  if (!value?.trim()) return null;
  const raw = value.trim();

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    if (numeric >= 0 && numeric < 1) return numeric * 24;
    return numeric;
  }

  const timeLike = raw.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?(?:$|\s)/i);
  if (!timeLike) return null;

  let hour = Number(timeLike[1]);
  const minutes = Number(timeLike[2] || '0');
  const seconds = Number(timeLike[3] || '0');
  const meridiem = (timeLike[4] || '').toLowerCase();

  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  return hour + minutes / 60 + seconds / 3600;
}

export function formatSheetTime(value?: string): string | undefined {
  const hour = parseSheetTimeHour(value);
  if (hour === null) return value?.trim() || undefined;

  let wholeHour = Math.floor(hour);
  let minutes = Math.round((hour - wholeHour) * 60);
  if (minutes === 60) {
    wholeHour += 1;
    minutes = 0;
  }

  const normalizedHour = ((wholeHour % 24) + 24) % 24;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  let displayHour = normalizedHour % 12;
  if (displayHour === 0) displayHour = 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function joinDateTime(date?: string, time?: string): string | undefined {
  const normalizedDate = date?.trim();
  const normalizedTime = formatSheetTime(time);
  const parts = [normalizedDate, normalizedTime].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}
