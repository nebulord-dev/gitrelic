// Every analyzer preset Atlas can navigate to, in rail order: label, group,
// docs page and a one-line explanation. Presets without an Atlas view yet
// open in the classic dashboard (`/classic/#preset=<id>`).
//
// The ids match apps/web's preset registry; a web test keeps the two in step.

export const PRESET_GROUPS = [
  { id: 'overview', label: 'Overview' },
  { id: 'code-health', label: 'Code Health' },
  { id: 'ownership-risk', label: 'Ownership & Risk' },
  { id: 'team-activity', label: 'Team & Activity' },
  { id: 'structure', label: 'Structure' },
] as const;
export type PresetGroup = (typeof PRESET_GROUPS)[number]['id'];

export interface CatalogEntry {
  id: string;
  label: string;
  group: PresetGroup;
  /** One sentence: what the analyzer measures and why it matters. */
  explain: string;
  /** Under https://nebulord-dev.github.io/gitrelic/, when a page exists. */
  docsPath?: string;
  /** Whether Atlas has a view for it yet (else it links to classic). */
  atlas: boolean;
}

export const CATALOG: readonly CatalogEntry[] = [
  {
    id: 'overview',
    label: 'Repo map',
    group: 'overview',
    explain:
      'Every lens around the repository, sized by how far outside normal it reads: where to look first.',
    atlas: true,
  },
  {
    id: 'risk',
    label: 'Risk',
    group: 'overview',
    explain:
      'Files where several risk signals overlap, and the people they depend on.',
    atlas: false,
  },
  {
    id: 'tech-debt',
    label: 'Tech Debt',
    group: 'overview',
    explain:
      'Files that keep growing and getting rewritten: maintenance cost building up.',
    atlas: false,
  },
  {
    id: 'hotspots',
    label: 'Hotspots',
    group: 'code-health',
    explain:
      'Churn × size: large files that change often, where bugs and slow reviews collect.',
    docsPath: 'analyzers/hotspots',
    atlas: true,
  },
  {
    id: 'churn',
    label: 'Churn',
    group: 'code-health',
    explain: 'How often each file changes, relative to the most-changed file.',
    docsPath: 'analyzers/churn',
    atlas: true,
  },
  {
    id: 'cursed-files',
    label: 'Cursed Files',
    group: 'code-health',
    explain:
      'Files flagged on several risk dimensions at once: high churn, concentrated ownership, shame and age anomalies.',
    docsPath: 'analyzers/cursed-files',
    atlas: false,
  },
  {
    id: 'dead-code',
    label: 'Stale Files',
    group: 'code-health',
    explain:
      'Tracked files with no commits in the analysis window: stable, or forgotten.',
    atlas: false,
  },
  {
    id: 'blast-radius',
    label: 'Blast Radius',
    group: 'code-health',
    explain:
      'How many other files change alongside a file: its coordination cost.',
    docsPath: 'analyzers/blast-radius',
    atlas: false,
  },
  {
    id: 'complexity-trend',
    label: 'Complexity Trend',
    group: 'code-health',
    explain:
      'Whether files are growing or shrinking over time; growth accumulates maintenance burden.',
    atlas: false,
  },
  {
    id: 'age-map',
    label: 'Age Map',
    group: 'code-health',
    explain:
      'Time since each file last changed: fresh, ageing, stale or ancient.',
    docsPath: 'analyzers/age-map',
    atlas: false,
  },
  {
    id: 'rewrite-ratio',
    label: 'Rewrite Ratio',
    group: 'code-health',
    explain:
      'Deletions against insertions: code being rewritten rather than added to.',
    docsPath: 'analyzers/rewrite-ratio',
    atlas: false,
  },
  {
    id: 'shame',
    label: 'Shame',
    group: 'code-health',
    explain:
      'Fix, hotfix and revert commits per file: histories that keep needing repair.',
    docsPath: 'analyzers/shame',
    atlas: false,
  },
  {
    id: 'bus-factor',
    label: 'Bus Factor',
    group: 'ownership-risk',
    explain:
      'Files where one author wrote 80%+ of the commits: single points of failure.',
    docsPath: 'analyzers/bus-factor',
    atlas: false,
  },
  {
    id: 'coupling',
    label: 'Coupling',
    group: 'ownership-risk',
    explain:
      'Files that change together in the same commits: hidden dependencies.',
    atlas: false,
  },
  {
    id: 'knowledge-silos',
    label: 'Knowledge Silos',
    group: 'ownership-risk',
    explain:
      'The share of files with a single dominant author: how fragile the team is.',
    atlas: false,
  },
  {
    id: 'ghost-files',
    label: 'Ghost Files',
    group: 'ownership-risk',
    explain:
      'Files owned by people who are no longer active: knowledge that may be gone.',
    docsPath: 'analyzers/ghost-files',
    atlas: false,
  },
  {
    id: 'contributors',
    label: 'Contributors',
    group: 'team-activity',
    explain: 'Who works on what, when, and who has gone quiet.',
    docsPath: 'analyzers/contributors',
    atlas: false,
  },
  {
    id: 'parallel-dev',
    label: 'Parallel Dev',
    group: 'team-activity',
    explain:
      'Files edited by several people in the same week; concurrent work correlates with defects.',
    docsPath: 'analyzers/parallel-dev',
    atlas: false,
  },
  {
    id: 'commit-timing',
    label: 'Commit Timing',
    group: 'team-activity',
    explain:
      'Late-night and weekend commit patterns; a lot of off-hours work can signal stress.',
    docsPath: 'analyzers/commit-timing',
    atlas: false,
  },
  {
    id: 'co-authors',
    label: 'Co-Authors / AI',
    group: 'team-activity',
    explain:
      'Pair programming and AI assistance, from Co-authored-by trailers.',
    docsPath: 'analyzers/co-authors',
    atlas: false,
  },
  {
    id: 'languages',
    label: 'Languages',
    group: 'structure',
    explain: 'Lines of code and files by language.',
    atlas: false,
  },
  {
    id: 'test-coverage',
    label: 'Test Coverage',
    group: 'structure',
    explain:
      'Test files per source file by directory — a proximity proxy, not runtime coverage.',
    atlas: false,
  },
  {
    id: 'renames',
    label: 'Renames',
    group: 'structure',
    explain:
      'Files renamed over their history; frequent renames can signal instability.',
    docsPath: 'analyzers/renames',
    atlas: false,
  },
];

const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

export function catalogEntry(id: string): CatalogEntry | undefined {
  return BY_ID.get(id);
}

const GROUP_IDS = new Set<string>(PRESET_GROUPS.map((g) => g.id));

export function isPresetGroup(id: string): id is PresetGroup {
  return GROUP_IDS.has(id);
}

/** A view's lenses, in lens-bar order (Atlas views and classic links alike). */
export function lensesOf(group: PresetGroup): readonly CatalogEntry[] {
  return CATALOG.filter((e) => e.group === group);
}

/** The lens a view opens on: its first with an Atlas view, else none. */
export function defaultLens(group: PresetGroup): string | null {
  return lensesOf(group).find((e) => e.atlas)?.id ?? null;
}

export const DOCS_BASE = 'https://nebulord-dev.github.io/gitrelic/';

/** The docs page for an entry, or null when it has none. */
export function docsUrl(entry: CatalogEntry): string | null {
  return entry.docsPath ? `${DOCS_BASE}${entry.docsPath}` : null;
}

/** Where a preset Atlas can't show yet opens: classic, deep-linked. */
export function classicUrl(id: string): string {
  return `/classic/#preset=${encodeURIComponent(id)}`;
}
