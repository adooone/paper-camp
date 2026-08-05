let base = '';

export function setApiBase(value: string): void {
  base = value;
}

export function apiUrl(path: string): string {
  return `${base}${path}`;
}
