import { readFileSync, statSync } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import path from 'node:path';

import type { GitrelicReport } from '@gitrelic/core';

// ─── Local dashboard server ────────────────────────────────────────────────────
//
// Binding to 127.0.0.1 keeps other machines out, but not other *web pages*:
// any site open in the user's browser can fire requests at localhost, and a
// DNS-rebinding site can read the responses. The report holds author emails
// and commit messages, so every request is checked against the Host header,
// and nothing a request can trigger is allowed to crash the process.

export const REPORT_PATH = '/gitrelic-report.json';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export interface DashboardServerOptions {
  report: GitrelicReport;
  /** Absolute path to the built dashboard (contains index.html). */
  webDist: string;
}

/** Only requests addressed to this machine's loopback, on our port, are served. */
export function isAllowedHost(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const allowed = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
  return allowed.includes(host.toLowerCase());
}

/**
 * Maps a URL pathname to a file under `webDist`, or null when the path can't
 * be safely served. Each segment is decoded and must be a plain filename, so
 * encoded traversal (`%2e%2e`, `%2f`) and null bytes never reach the fs.
 */
export function resolveStaticPath(
  webDist: string,
  pathname: string,
): string | null {
  let segments: string[];
  try {
    segments = pathname
      .split('/')
      .filter((s) => s.length > 0)
      .map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  for (const seg of segments) {
    if (
      seg === '.' ||
      seg === '..' ||
      seg.includes('\0') ||
      seg.includes('/') ||
      seg.includes('\\')
    ) {
      return null;
    }
  }
  const candidate = path.join(webDist, ...segments);
  // Defense in depth: the checks above should make this unreachable.
  const boundary = webDist.endsWith(path.sep) ? webDist : webDist + path.sep;
  if (candidate !== webDist && !candidate.startsWith(boundary)) return null;
  return candidate;
}

function isFile(p: string): boolean {
  return statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
}

function send(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  headers: Record<string, string>,
  body?: string | Buffer,
): void {
  res.writeHead(status, { ...BASE_HEADERS, ...headers });
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function createDashboardHandler({
  report,
  webDist,
}: DashboardServerOptions) {
  let reportJson: string | null = null;
  const indexPath = path.join(webDist, 'index.html');

  return (req: IncomingMessage, res: ServerResponse): void => {
    try {
      if (!isAllowedHost(req.headers.host, req.socket.localPort ?? -1)) {
        send(
          req,
          res,
          403,
          { 'Content-Type': 'text/plain; charset=utf-8' },
          'Forbidden',
        );
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        send(req, res, 405, { Allow: 'GET, HEAD' });
        return;
      }

      // Only `pathname` is trusted from this. An absolute-form request target
      // (`GET http://evil/x`) sets URL#host from the target, not the Host header
      // checked above — never route on it.
      const { pathname } = new URL(req.url ?? '/', 'http://localhost');

      if (pathname === REPORT_PATH) {
        reportJson ??= JSON.stringify(report);
        send(
          req,
          res,
          200,
          {
            'Content-Type': MIME_TYPES['.json'],
            'Cache-Control': 'no-store',
          },
          reportJson,
        );
        return;
      }

      const candidate = resolveStaticPath(webDist, pathname);
      if (candidate === null) {
        send(req, res, 400, {});
        return;
      }

      if (isFile(candidate)) {
        const type =
          MIME_TYPES[path.extname(candidate).toLowerCase()] ??
          'application/octet-stream';
        send(req, res, 200, { 'Content-Type': type }, readFileSync(candidate));
        return;
      }

      // Asset-looking paths (anything with an extension) that don't exist are
      // real 404s; handing them index.html would mask broken builds. Everything
      // else is a client-side route and gets the SPA shell.
      if (path.extname(pathname) !== '') {
        send(
          req,
          res,
          404,
          { 'Content-Type': 'text/plain; charset=utf-8' },
          'Not found',
        );
        return;
      }
      send(
        req,
        res,
        200,
        { 'Content-Type': MIME_TYPES['.html'] },
        readFileSync(indexPath),
      );
    } catch (err) {
      process.stderr.write(
        `gitrelic: dashboard request failed: ${(err as Error).message}\n`,
      );
      if (res.headersSent) {
        res.destroy();
      } else {
        send(
          req,
          res,
          500,
          { 'Content-Type': 'text/plain; charset=utf-8' },
          'Internal error',
        );
      }
    }
  };
}

export function createDashboardServer(options: DashboardServerOptions): Server {
  return createServer(createDashboardHandler(options));
}

/**
 * Listens on `preferred`, walking forward on EADDRINUSE. Retries with the real
 * server rather than probing first, so there's no gap between "port is free"
 * and "we own it" for another process to slip into.
 */
export async function listenOnFreePort(
  server: Server,
  preferred: number,
  attempts = 10,
): Promise<number> {
  for (let i = 0; i < attempts; i++) {
    const port = preferred + i;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => {
          server.off('listening', onListening);
          reject(err);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '127.0.0.1');
      });
      return (server.address() as { port: number }).port;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
    }
  }
  throw new Error(
    `No free port found after ${attempts} attempts starting from port ${preferred}`,
  );
}
