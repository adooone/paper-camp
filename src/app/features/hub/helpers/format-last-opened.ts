const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function formatLastOpened(lastOpenedAt: string | null): string | null {
  if (!lastOpenedAt) return null;
  const date = new Date(lastOpenedAt);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isSameDay(date, new Date()) ? time : `${date.toLocaleDateString()} ${time}`;
}
