const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether a browser on `clientOrigin` will let a fetch through to `runtimeUrl`: browsers
 *  treat loopback as trustworthy regardless of scheme, but otherwise refuse an http: fetch
 *  from an https: page outright as mixed content, without ever attempting the request.
 *  Node-free so both the CLI banner and the hub (running in the browser) can share it. */
export function canReachRuntime(clientOrigin: string, runtimeUrl: string): boolean {
  const runtime = new URL(runtimeUrl);
  if (LOOPBACK_HOSTS.has(runtime.hostname)) return true;
  const client = new URL(clientOrigin);
  return client.protocol !== 'https:' || runtime.protocol === 'https:';
}
