import { type IncomingMessage, type ServerResponse, request as httpRequest } from 'node:http';
import { MOUNT_ATTRIBUTE } from '../app/services/mount';

export interface ProxyToCampServerOptions {
  port: number;
  host?: string;
  mount?: string;
}

export function injectMountAttribute(html: string, mount: string): string {
  return html.replace('<div id="root">', `<div id="root" ${MOUNT_ATTRIBUTE}="${mount}">`);
}

export function proxyToCampServer(
  req: IncomingMessage,
  res: ServerResponse,
  { port, host = '127.0.0.1', mount = '' }: ProxyToCampServerOptions,
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
      const isHtml = (proxyRes.headers['content-type'] ?? '').includes('text/html');
      if (mount && isHtml) {
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const body = injectMountAttribute(Buffer.concat(chunks).toString('utf-8'), mount);
          const { 'transfer-encoding': _te, ...headers } = proxyRes.headers;
          res.writeHead(proxyRes.statusCode ?? 502, {
            ...headers,
            'content-length': String(Buffer.byteLength(body)),
          });
          res.end(body);
        });
        return;
      }
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
