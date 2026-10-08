export function formatDueDate(ms: number) {
  const date = new Date(ms);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
  return `${day}, ${formatTime(ms)}`;
}

export function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Default for a newly added due date: the next full hour. */
export function nextFullHour() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date.getTime();
}

/** Keeps the time of `base` and takes the calendar day from `picked`. */
export function withDate(base: number, picked: Date) {
  const date = new Date(base);
  date.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return date.getTime();
}

/** Keeps the calendar day of `base` and takes hours/minutes from `picked`. */
export function withTime(base: number, picked: Date) {
  const date = new Date(base);
  date.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return date.getTime();
}
