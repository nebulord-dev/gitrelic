import { describe, expect, it } from 'vitest';

import { computeDisplayName, prepareSankeyData } from './RenameSankey';
import type { FileRenameChain, GitrelicReport } from '@gitrelic/core';

function makeChain(
  currentPath: string,
  previousNames: string[],
  renameCount?: number,
): FileRenameChain {
  return {
    currentPath,
    previousNames,
    renameCount: renameCount ?? previousNames.length,
  };
}

function makeReport(chains: FileRenameChain[]): GitrelicReport {
  return {
    renameTracking: {
      renames: [],
      chains,
      totalRenames: chains.reduce((s, c) => s + c.renameCount, 0),
      filesWithRenames: chains.length,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('prepareSankeyData', () => {
  it('returns empty graph when there are no chains', () => {
    const result = prepareSankeyData(makeReport([]));
    expect(result).toEqual({ nodes: [], links: [] });
  });

  it('emits 2 nodes and 1 link for a single-step chain', () => {
    const chain = makeChain('new.ts', ['old.ts']);
    const { nodes, links } = prepareSankeyData(makeReport([chain]));
    expect(nodes).toHaveLength(2);
    expect(links).toHaveLength(1);
    expect(nodes.map((n) => n.name)).toEqual(['old.ts', 'new.ts']);
  });

  it('emits consecutive links for a multi-step chain', () => {
    const chain = makeChain('v3.ts', ['v1.ts', 'v2.ts']);
    const { nodes, links } = prepareSankeyData(makeReport([chain]));
    expect(nodes.map((n) => n.name)).toEqual(['v1.ts', 'v2.ts', 'v3.ts']);
    expect(links).toHaveLength(2);
    expect(nodes[links[0].source].name).toBe('v1.ts');
    expect(nodes[links[0].target].name).toBe('v2.ts');
    expect(nodes[links[1].source].name).toBe('v2.ts');
    expect(nodes[links[1].target].name).toBe('v3.ts');
  });

  it('concatenates two disjoint chains into a single node list', () => {
    const chains = [makeChain('a2', ['a1']), makeChain('b2', ['b1'])];
    const { nodes, links } = prepareSankeyData(makeReport(chains));
    expect(nodes).toHaveLength(4);
    expect(links).toHaveLength(2);
  });

  it('deduplicates a name that appears in multiple chains', () => {
    const chains = [
      makeChain('shared', ['orig']),
      makeChain('final', ['shared']),
    ];
    const { nodes, links } = prepareSankeyData(makeReport(chains));
    expect(nodes.map((n) => n.name)).toEqual(['orig', 'shared', 'final']);
    expect(links).toHaveLength(2);
    expect(nodes[links[0].target].name).toBe('shared');
    expect(nodes[links[1].source].name).toBe('shared');
  });

  it('uses value=1 for every link', () => {
    const chain = makeChain('c', ['a', 'b']);
    const { links } = prepareSankeyData(makeReport([chain]));
    expect(links.every((l) => l.value === 1)).toBe(true);
  });

  it('marks terminus nodes and carries currentPath reference', () => {
    const chain = makeChain('final.ts', ['one.ts', 'two.ts']);
    const { nodes } = prepareSankeyData(makeReport([chain]));
    const terminus = nodes.find((n) => n.isTerminus)!;
    expect(terminus.name).toBe('final.ts');
    expect(terminus.currentPath).toBe('final.ts');
    const nonTerminus = nodes.find((n) => n.name === 'one.ts')!;
    expect(nonTerminus.isTerminus).toBe(false);
    expect(nonTerminus.currentPath).toBe('final.ts');
  });

  it('sorts chains by renameCount desc before emitting nodes', () => {
    const chains = [
      makeChain('small', ['a'], 1),
      makeChain('big', ['b', 'c', 'd'], 3),
      makeChain('medium', ['e', 'f'], 2),
    ];
    const { nodes } = prepareSankeyData(makeReport(chains));
    // First chain to emit should be 'big', so its nodes come first
    expect(nodes[0].name).toBe('b');
    expect(nodes.findIndex((n) => n.name === 'big')).toBeLessThan(
      nodes.findIndex((n) => n.name === 'medium'),
    );
  });

  it('honors topN option to cap the number of chains rendered', () => {
    const chains = Array.from({ length: 10 }, (_, i) =>
      makeChain(`c${i}`, [`prev${i}`]),
    );
    const { nodes, links } = prepareSankeyData(makeReport(chains), { topN: 3 });
    expect(links).toHaveLength(3);
    expect(nodes).toHaveLength(6);
  });

  it('defaults to all chains when topN unspecified', () => {
    const chains = Array.from({ length: 25 }, (_, i) =>
      makeChain(`c${i}`, [`prev${i}`]),
    );
    const { links } = prepareSankeyData(makeReport(chains));
    expect(links).toHaveLength(25);
  });

  it('skips chains with empty previousNames (no rename to draw)', () => {
    const chains = [makeChain('alone', [])];
    const { nodes, links } = prepareSankeyData(makeReport(chains));
    expect(nodes).toEqual([]);
    expect(links).toEqual([]);
  });

  it('uses basename as displayName when every chain basename is unique', () => {
    const chain = makeChain('new.ts', ['old.ts']);
    const { nodes } = prepareSankeyData(makeReport([chain]));
    expect(nodes.map((n) => n.displayName)).toEqual(['old.ts', 'new.ts']);
  });

  it('extends displayName with parent dir when chain paths share a basename', () => {
    const chain = makeChain('packages/web/Panel.tsx', [
      'packages/cli/Panel.tsx',
      'packages/core/Panel.tsx',
    ]);
    const { nodes } = prepareSankeyData(makeReport([chain]));
    const byPath = new Map(nodes.map((n) => [n.name, n.displayName]));
    expect(byPath.get('packages/cli/Panel.tsx')).toBe('cli/Panel.tsx');
    expect(byPath.get('packages/core/Panel.tsx')).toBe('core/Panel.tsx');
    expect(byPath.get('packages/web/Panel.tsx')).toBe('web/Panel.tsx');
  });

  it('walks deeper into the path when shallow parent dirs also match', () => {
    const chain = makeChain('a/b/d/Foo.ts', ['a/b/c/Foo.ts']);
    const { nodes } = prepareSankeyData(makeReport([chain]));
    const byPath = new Map(nodes.map((n) => [n.name, n.displayName]));
    expect(byPath.get('a/b/c/Foo.ts')).toBe('c/Foo.ts');
    expect(byPath.get('a/b/d/Foo.ts')).toBe('d/Foo.ts');
  });

  it('only adds path context when needed — mixed basenames stay short', () => {
    const chain = makeChain('lib/Renamed.tsx', ['lib/Original.tsx']);
    const { nodes } = prepareSankeyData(makeReport([chain]));
    const byPath = new Map(nodes.map((n) => [n.name, n.displayName]));
    expect(byPath.get('lib/Original.tsx')).toBe('Original.tsx');
    expect(byPath.get('lib/Renamed.tsx')).toBe('Renamed.tsx');
  });
});

describe('computeDisplayName', () => {
  it('returns the basename when no peer shares it', () => {
    expect(computeDisplayName('src/a.ts', ['src/b.ts'])).toBe('a.ts');
  });

  it('walks up a directory when peers share the basename', () => {
    expect(computeDisplayName('cli/Foo.ts', ['cli/Foo.ts', 'web/Foo.ts'])).toBe(
      'cli/Foo.ts',
    );
  });

  it('falls back to the longest segment count needed when one path is a suffix of another', () => {
    expect(
      computeDisplayName('nested/Foo.ts', ['nested/Foo.ts', 'Foo.ts']),
    ).toBe('nested/Foo.ts');
  });

  it('handles a single-path chain by returning the basename', () => {
    expect(computeDisplayName('only/Foo.ts', ['only/Foo.ts'])).toBe('Foo.ts');
  });
});
