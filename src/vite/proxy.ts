import { type IncomingMessage, type ServerResponse, request as httpRequest } from 'node:http';

export interface ProxyToCampServerOptions {
  port: number;
  host?: string;
}

export function proxyToCampServer(
  req: IncomingMessage,
  res: ServerResponse,
  { port, host = '127.0.0.1' }: ProxyToCampServerOptions,
): void {
  const proxyReq = httpRequest(
    {
      host,
      port,
      path: req.url ?? '/',
      method: req.method,
      headers: { ...req.headers, host: `${host}:${port}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    res.statusCode = 502;
    res.end(`paper-camp server is not reachable on port ${port} — run \`paper-camp dev\`.`);
  });
  req.pipe(proxyReq);
}
