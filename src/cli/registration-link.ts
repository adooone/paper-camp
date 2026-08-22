export function buildRegistrationLink(port: number, pairingToken: string): string {
  const runtimeUrl = `http://localhost:${port}`;
  const params = new URLSearchParams({ runtime: runtimeUrl, token: pairingToken });
  return `${runtimeUrl}/?${params}`;
}
