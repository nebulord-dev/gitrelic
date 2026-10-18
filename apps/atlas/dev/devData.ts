// Serves the two JSON endpoints the CLI serves, so `pnpm dev` works without
// the CLI. Node-side only: this file runs inside Vite's dev server and never
// reaches the browser bundle, which is why it may value-import core.
//
// GITRELIC_DEV_REPO=<path> analyzes a real repo (needs a built core), over
// GITRELIC_DEV_SINCE (default "12 months ago"; "all" for full history);
// otherwise the committed sample-repo fixture is served.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

export interface DevPayload {
  /** `/gitrelic-report.lite.json`: the report without `commits`. */
  lite: string;
  /** `/gitrelic-commits.json`: the columnar commit index. */
  commits: string;
}

const FIXTURES = new URL(
  '../../../packages/scene/test/fixtures/',
  import.meta.url,
);

export async function loadDevPayload(
  env: NodeJS.ProcessEnv = process.env,
): Promise<DevPayload> {
  const repo = env.GITRELIC_DEV_REPO;
  if (!repo) {
    const [report, commits] = await Promise.all([
      readFile(new URL('report.small.json', FIXTURES), 'utf8'),
      readFile(new URL('commits.small.json', FIXTURES), 'utf8'),
    ]);
    return {
      lite: JSON.stringify({ ...JSON.parse(report), commits: [] }),
      commits,
    };
  }
  // Vite bundles this config file and resolves every literal import up front,
  // even lazy ones, so a literal specifier would demand a core build in
  // fixture mode too. Through a variable, Node resolves it only here.
  const coreModule = '@gitrelic/core';
  const { buildCommitIndex, runGitrelic } = (await import(
    /* @vite-ignore */ coreModule
  )) as typeof import('@gitrelic/core');
  // Same default as the CLI's --since, so dev data matches `gitrelic --web`.
  const since = env.GITRELIC_DEV_SINCE ?? '12 months ago';
  const report = await runGitrelic({
    repoPath: path.resolve(repo),
    since: since === 'all' ? undefined : since,
  });
  return {
    lite: JSON.stringify({ ...report, commits: [] }),
    commits: JSON.stringify(buildCommitIndex(report.commits)),
  };
}

const ROUTES: Record<string, keyof DevPayload> = {
  '/gitrelic-report.lite.json': 'lite',
  '/gitrelic-commits.json': 'commits',
};

export function devData(): Plugin {
  // Analyzed once per dev-server start; a failure is retried on the next
  // request rather than cached.
  let payload: Promise<DevPayload> | undefined;
  const load = () =>
    (payload ??= loadDevPayload().catch((err: unknown) => {
      payload = undefined;
      throw err;
    }));

  return {
    name: 'gitrelic-dev-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(
        (
          req: IncomingMessage,
          res: ServerResponse,
          next: (err?: unknown) => void,
        ) => {
          const key = ROUTES[(req.url ?? '').split('?')[0]];
          if (!key) return next();
          load().then((data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(data[key]);
          }, next);
        },
      );
    },
  };
}
