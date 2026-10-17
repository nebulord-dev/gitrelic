import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request, type Server, createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDashboardServer,
  isAllowedHost,
  listenOnFreePort,
  REPORT_PATH,
  resolveStaticPath,
} from '../src/server.js';
import type { GitrelicReport } from '@gitrelic/core';

// In-process: these exercise the request handler directly on an ephemeral
// port, so unlike json-output.test.ts they don't need the built binary.

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function hit(
  port: number,
  urlPath: string,
  opts: { method?: string; host?: string } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: urlPath,
        method: opts.method ?? 'GET',
        headers: { Host: opts.host ?? `127.0.0.1:${port}` },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const report = {
  repoName: 'fixture',
  meta: { totalCommits: 3 },
} as unknown as GitrelicReport;

let webDist = '';
let server: Server;
let port = 0;

beforeAll(async () => {
  webDist = mkdtempSync(path.join(tmpdir(), 'gitrelic-web-'));
  writeFileSync(
    path.join(webDist, 'index.html'),
    '<!doctype html><p>shell</p>',
  );
  mkdirSync(path.join(webDist, 'assets'));
  writeFileSync(path.join(webDist, 'assets', 'app.js'), 'console.log(1)');
  writeFileSync(path.join(webDist, 'assets', 'mod.mjs'), 'export {}');
  writeFileSync(path.join(webDist, 'favicon.ico'), 'ico');

  server = createDashboardServer({ report, webDist });
  port = await listenOnFreePort(server, 0);
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(webDist, { recursive: true, force: true });
});

describe('dashboard server', () => {
  it('serves the report as uncached JSON', async () => {
    const res = await hit(port, REPORT_PATH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(res.body)).toEqual(report);
  });

  it('routes the report even with a cache-busting query string', async () => {
    const res = await hit(port, `${REPORT_PATH}?t=123`);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  });

  it('serves static assets with the right MIME type', async () => {
    expect((await hit(port, '/assets/app.js')).headers['content-type']).toMatch(
      /^text\/javascript/,
    );
    expect(
      (await hit(port, '/assets/mod.mjs')).headers['content-type'],
    ).toMatch(/^text\/javascript/);
    expect((await hit(port, '/favicon.ico')).headers['content-type']).toBe(
      'image/x-icon',
    );
  });

  it('sends nosniff on every response', async () => {
    expect((await hit(port, '/')).headers['x-content-type-options']).toBe(
      'nosniff',
    );
  });

  it('does not crash on a directory request', async () => {
    // Used to readFileSync a directory → EISDIR thrown in the handler → the
    // whole CLI died. A directory now falls through to the SPA shell.
    const res = await hit(port, '/assets');
    expect(res.status).toBe(200);
    expect(res.body).toContain('shell');
    // And the server is still alive afterwards.
    expect((await hit(port, '/')).status).toBe(200);
  });

  it('returns the SPA shell for client-side routes', async () => {
    const res = await hit(port, '/some/route');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
  });

  it('404s missing asset-looking paths instead of serving HTML', async () => {
    const res = await hit(port, '/assets/missing.js');
    expect(res.status).toBe(404);
  });

  it('rejects requests whose Host is not loopback (DNS rebinding)', async () => {
    const res = await hit(port, REPORT_PATH, { host: `evil.example:${port}` });
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('fixture');
  });

  it('accepts localhost and [::1] hosts', async () => {
    expect((await hit(port, '/', { host: `localhost:${port}` })).status).toBe(
      200,
    );
    expect((await hit(port, '/', { host: `[::1]:${port}` })).status).toBe(200);
  });

  it('allows only GET and HEAD', async () => {
    const post = await hit(port, REPORT_PATH, { method: 'POST' });
    expect(post.status).toBe(405);
    expect(post.headers.allow).toBe('GET, HEAD');

    const head = await hit(port, REPORT_PATH, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
  });

  it('never serves files outside the dist root', async () => {
    for (const p of [
      '/%2e%2e/%2e%2e/etc/passwd',
      '/assets/%2e%2e%2f%2e%2e%2fx',
      '/a%00b',
    ]) {
      const res = await hit(port, p);
      expect(res.body).not.toContain('root:');
      expect([200, 400, 404]).toContain(res.status);
    }
  });
});

describe('resolveStaticPath', () => {
  const root = path.join(tmpdir(), 'dist');

  it('joins plain segments under the root', () => {
    expect(resolveStaticPath(root, '/assets/app.js')).toBe(
      path.join(root, 'assets', 'app.js'),
    );
  });

  it.each([
    '/%2e%2e/secret',
    '/assets/..%2fsecret',
    '/a%2fb',
    '/a%5cb',
    '/a%00b',
    '/%E0%A4%A',
  ])('refuses %s', (p) => {
    expect(resolveStaticPath(root, p)).toBeNull();
  });
});

describe('isAllowedHost', () => {
  it.each([
    ['localhost:7777', true],
    ['127.0.0.1:7777', true],
    ['[::1]:7777', true],
    ['LOCALHOST:7777', true],
    ['localhost:7778', false],
    ['localhost', false],
    ['evil.example:7777', false],
    [undefined, false],
  ])('%s → %s', (host, ok) => {
    expect(isAllowedHost(host, 7777)).toBe(ok);
  });
});

describe('listenOnFreePort', () => {
  it('walks past a port that is already taken', async () => {
    const blocker = createServer();
    const taken = await listenOnFreePort(blocker, 0);
    const s = createServer();
    try {
      const got = await listenOnFreePort(s, taken, 5);
      expect(got).toBeGreaterThan(taken);
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
      await new Promise<void>((r) => blocker.close(() => r()));
    }
  });

  it('gives up after the attempt budget', async () => {
    const blocker = createServer();
    const taken = await listenOnFreePort(blocker, 0);
    try {
      await expect(listenOnFreePort(createServer(), taken, 1)).rejects.toThrow(
        /No free port found after 1 attempts/,
      );
    } finally {
      await new Promise<void>((r) => blocker.close(() => r()));
    }
  });
});
