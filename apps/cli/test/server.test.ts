import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request, type Server, createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  COMMITS_PATH,
  createDashboardServer,
  findMount,
  LITE_REPORT_PATH,
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
  bytes: Buffer;
}

function hit(
  port: number,
  urlPath: string,
  opts: { method?: string; host?: string; acceptEncoding?: string } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: urlPath,
        method: opts.method ?? 'GET',
        headers: {
          Host: opts.host ?? `127.0.0.1:${port}`,
          ...(opts.acceptEncoding
            ? { 'Accept-Encoding': opts.acceptEncoding }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const bytes = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: bytes.toString('utf8'),
            bytes,
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const report = {
  repoName: 'fixture',
  meta: { totalCommits: 2 },
  commits: [
    {
      hash: 'a'.repeat(40),
      authorEmail: 'ann@corp.com',
      authorName: 'Ann Lee',
      date: '2026-01-01T23:30:00-08:00',
      message: 'feat: a',
      coAuthors: [],
      files: ['src/a.ts'],
      fileStats: [{ file: 'src/a.ts', insertions: 2, deletions: 0 }],
      insertions: 2,
      deletions: 0,
    },
    {
      hash: 'b'.repeat(40),
      authorEmail: 'bob@corp.com',
      authorName: 'Bob Brown',
      date: '2026-01-03T09:00:00Z',
      message: 'fix: b',
      coAuthors: [],
      files: ['src/a.ts', 'src/b.ts'],
      fileStats: [],
      insertions: 4,
      deletions: 1,
    },
  ],
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

  server = createDashboardServer({
    report,
    mounts: [{ prefix: '/', dist: webDist }],
  });
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
    // whole CLI died. A directory is now just a stray path.
    const res = await hit(port, '/assets');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    // And the server is still alive afterwards.
    expect((await hit(port, '/')).status).toBe(200);
  });

  it('serves the shell at the root as HTML', async () => {
    const res = await hit(port, '/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
  });

  it('redirects stray paths to the root, where relative assets resolve', async () => {
    const res = await hit(port, '/some/route');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
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
      expect([302, 400, 404]).toContain(res.status);
    }
  });
});

describe('data endpoints', () => {
  it('serves the lite report without raw commits', async () => {
    const res = await hit(port, LITE_REPORT_PATH);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const lite = JSON.parse(res.body);
    expect(lite.commits).toEqual([]);
    expect(lite.repoName).toBe('fixture');
  });

  it('serves the columnar commit index', async () => {
    const res = await hit(port, COMMITS_PATH);
    const ix = JSON.parse(res.body);
    expect(ix.version).toBe(1);
    expect(ix.hash).toEqual(['aaaaaaaaaaaa', 'bbbbbbbbbbbb']);
    expect(ix.authors).toEqual(['ann@corp.com', 'bob@corp.com']);
    expect(ix.tz).toEqual([-480, 0]);
    expect(ix.files).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('gzips JSON when the client accepts it', async () => {
    for (const p of [REPORT_PATH, LITE_REPORT_PATH, COMMITS_PATH]) {
      const res = await hit(port, p, { acceptEncoding: 'gzip, deflate, br' });
      expect(res.headers['content-encoding']).toBe('gzip');
      expect(res.headers.vary).toBe('Accept-Encoding');
      expect(JSON.parse(gunzipSync(res.bytes).toString('utf8'))).toBeTruthy();
    }
  });

  it('sends plain JSON when the client does not accept gzip', async () => {
    const res = await hit(port, COMMITS_PATH);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(res.body).version).toBe(1);
  });

  it('keeps the classic report complete', async () => {
    const full = JSON.parse((await hit(port, REPORT_PATH)).body);
    expect(full.commits).toHaveLength(2);
  });
});

// --ui atlas: Atlas at the root, classic under /classic/.
describe('two dashboards', () => {
  let atlasDist = '';
  let classicDist = '';
  let dual: Server;
  let dualPort = 0;

  beforeAll(async () => {
    atlasDist = mkdtempSync(path.join(tmpdir(), 'gitrelic-atlas-'));
    writeFileSync(path.join(atlasDist, 'index.html'), '<p>atlas</p>');
    mkdirSync(path.join(atlasDist, 'assets'));
    writeFileSync(path.join(atlasDist, 'assets', 'atlas.js'), 'atlas()');
    classicDist = mkdtempSync(path.join(tmpdir(), 'gitrelic-classic-'));
    writeFileSync(path.join(classicDist, 'index.html'), '<p>classic</p>');
    mkdirSync(path.join(classicDist, 'assets'));
    writeFileSync(path.join(classicDist, 'assets', 'app.js'), 'classic()');

    dual = createDashboardServer({
      report,
      mounts: [
        { prefix: '/', dist: atlasDist },
        { prefix: '/classic/', dist: classicDist },
      ],
    });
    dualPort = await listenOnFreePort(dual, 0);
  });

  afterAll(async () => {
    await new Promise<void>((r) => dual.close(() => r()));
    rmSync(atlasDist, { recursive: true, force: true });
    rmSync(classicDist, { recursive: true, force: true });
  });

  it('serves Atlas at the root and classic under /classic/', async () => {
    expect((await hit(dualPort, '/')).body).toBe('<p>atlas</p>');
    expect((await hit(dualPort, '/assets/atlas.js')).body).toBe('atlas()');
    expect((await hit(dualPort, '/classic/')).body).toBe('<p>classic</p>');
    expect((await hit(dualPort, '/classic/assets/app.js')).body).toBe(
      'classic()',
    );
  });

  it('keeps each dashboard to its own files', async () => {
    expect((await hit(dualPort, '/assets/app.js')).status).toBe(404);
    expect((await hit(dualPort, '/classic/assets/atlas.js')).status).toBe(404);
  });

  it('redirects /classic to /classic/ so relative assets resolve', async () => {
    const res = await hit(dualPort, '/classic?x=1');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('/classic/?x=1');
  });

  it("sends stray paths to their own mount's root", async () => {
    expect((await hit(dualPort, '/some/route')).headers.location).toBe('/');
    expect((await hit(dualPort, '/classic/some/route')).headers.location).toBe(
      '/classic/',
    );
  });

  it('serves the JSON endpoints at the root for both', async () => {
    for (const p of [REPORT_PATH, LITE_REPORT_PATH, COMMITS_PATH]) {
      expect((await hit(dualPort, p)).status).toBe(200);
    }
  });

  it('never serves files outside a mount', async () => {
    // Encoded separators survive URL parsing and are refused per segment.
    for (const p of ['/classic/..%2fassets%2fatlas.js', '/classic/%2e%2e%2f']) {
      expect((await hit(dualPort, p)).status).toBe(400);
    }
    // Whole `%2e%2e` segments are collapsed by the URL parser before routing,
    // so this is just `/etc/passwd`: a stray path on the root mount.
    const dotted = await hit(dualPort, '/classic/%2e%2e/%2e%2e/etc/passwd');
    expect(dotted.status).toBe(302);
    expect(dotted.headers.location).toBe('/');
  });
});

describe('findMount', () => {
  const mounts = [
    { prefix: '/', dist: 'a' },
    { prefix: '/classic/', dist: 'c' },
  ];

  it('picks the longest matching prefix, whatever the order', () => {
    expect(findMount(mounts, '/classic/x.js')?.dist).toBe('c');
    expect(findMount([...mounts].reverse(), '/classic/x.js')?.dist).toBe('c');
    expect(findMount(mounts, '/classical')?.dist).toBe('a');
  });

  it('finds nothing when no prefix matches', () => {
    expect(
      findMount([{ prefix: '/classic/', dist: 'c' }], '/'),
    ).toBeUndefined();
  });
});

describe('createDashboardServer', () => {
  it('rejects a mount prefix without both slashes', () => {
    expect(() =>
      createDashboardServer({
        report,
        mounts: [{ prefix: '/classic', dist: 'c' }],
      }),
    ).toThrow(/must start and end/);
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
