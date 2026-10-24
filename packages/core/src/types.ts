// ─── Core report shape ────────────────────────────────────────────────────────

import type { FileClass } from './utils/fileClass.js';
import type { RawCommit } from './utils/git.js';

export interface GitrelicReport {
  timestamp: string;
  repoPath: string;
  repoName: string;
  meta: RepoMeta;
  churn: ChurnReport;
  busFactors: BusFactorReport;
  ageMap: AgeMapReport;
  contributors: ContributorReport;
  cursedFiles: CursedFilesReport;
  forensics: ForensicsReport;
  fixRate: FixRateReport;
  parallelDev: ParallelDevReport;
  loc: LocReport;
  hotspots: HotspotReport;
  coupling: CouplingReport;
  churnVelocity: ChurnVelocityReport;
  rewriteRatio: RewriteRatioReport;
  blastRadius: BlastRadiusReport;
  deadCode: DeadCodeReport;
  testCoverage: TestCoverageProxyReport;
  ghostFiles: GhostFilesReport;
  knowledgeConcentration: KnowledgeConcentrationReport;
  coAuthors: CoAuthorReport;
  hotspotClusters: HotspotClusterReport;
  complexityTrend: ComplexityTrendReport;
  commitTiming: CommitTimingReport;
  renameTracking: RenameTrackingReport;
  /** People whose split emails were merged into one canonical identity. */
  identities: IdentityAlias[];
  /**
   * Non-source files in the analyzed tree, keyed by path (source files are
   * omitted). Fixture and generated files are excluded from ownership
   * analysis unless `includeFixtures` is set.
   */
  fileClasses: Record<string, Exclude<FileClass, 'source'>>;
  /** The repository's packages, from its workspace files or by convention. */
  workspace: Workspace;
  commits: RawCommit[];
}

// ─── Commit index ──────────────────────────────────────────────────────────────

/**
 * Compact, columnar form of the commit history for the dashboard: one array
 * per field, authors and paths stored once and referenced by position. About
 * 10× smaller than `RawCommit[]` as JSON. Commits are sorted by instant.
 * Files of commit `i` are `fileIds.slice(fileOffsets[i], fileOffsets[i + 1])`.
 */
export interface CommitIndex {
  version: 1;
  /** Canonical author emails; `author[i]` indexes into this. */
  authors: string[];
  /** Display name for each entry in `authors`. */
  authorNames: string[];
  files: string[];
  /** Commit instant, epoch seconds (ascending). */
  time: number[];
  /** Author's UTC offset in minutes at commit time (local = time + tz·60). */
  tz: number[];
  author: number[];
  /** Length commits + 1. */
  fileOffsets: number[];
  fileIds: number[];
  insertions: number[];
  deletions: number[];
  /** 12-character abbreviated hashes. */
  hash: string[];
  /** 0 no AI, 1 AI-assisted (an AI co-author), 2 authored by an AI agent. */
  ai: number[];
}

// ─── Workspace ────────────────────────────────────────────────────────────────

export type WorkspaceSource =
  | 'npm'
  | 'pnpm'
  | 'lerna'
  | 'cargo'
  | 'go'
  | 'nx'
  | 'convention';

/**
 * The repository's packages (utils/workspace.ts): the folders its workspace
 * files declare, or `packages/*`, `apps/*`, `libs/*` and `services/*` by
 * convention. A file belongs to the longest root containing it, else its
 * top-level folder, else the root.
 */
export interface Workspace {
  /** Which workspace files declared the roots, sorted; empty with no packages. */
  sources: WorkspaceSource[];
  /** Package folders, sorted. */
  roots: string[];
}

// ─── Author identities ────────────────────────────────────────────────────────

export interface IdentityAlias {
  canonicalEmail: string;
  name: string;
  /** Every email folded into this identity, most commits first. */
  aliases: { email: string; name: string; commits: number }[];
}

// ─── Repo metadata ─────────────────────────────────────────────────────────────

export interface RepoMeta {
  totalCommits: number;
  totalFiles: number;
  totalAuthors: number;
  firstCommit: string; // ISO date
  lastCommit: string; // ISO date
  ageInDays: number;
  primaryLanguage: string;
  branches: string[];
  analyzedBranch: string;
  gitrelicVersion: string;
}

// ─── Churn ─────────────────────────────────────────────────────────────────────

export interface FileChurn {
  file: string;
  commitCount: number; // how many commits touched this file
  churnScore: number; // 0–100 relative to repo max
  category: ChurnCategory;
}

export type ChurnCategory = 'hot' | 'warm' | 'cold' | 'frozen';

export interface ChurnReport {
  files: FileChurn[];
  topFiles: FileChurn[]; // top 20 by commit count
  hotspotCount: number; // files with churnScore > 75
  summary: string; // e.g. "auth.ts has been modified in 34% of all commits"
}

// ─── Bus factor ────────────────────────────────────────────────────────────────

export interface FileBusFactor {
  file: string;
  uniqueAuthors: number;
  authors: string[]; // email list
  dominantAuthor: string; // author with most commits to this file
  dominantAuthorPercent: number;
  risk: BusFactorRisk;
}

export type BusFactorRisk = 'critical' | 'high' | 'medium' | 'low';

export interface BusFactorReport {
  files: FileBusFactor[];
  criticalFiles: FileBusFactor[]; // single author owns >80% of commits
  overallBusFactor: number; // min unique authors across top files
  /** Tracked files left out of ownership analysis (0/0 with includeFixtures). */
  excluded: { fixture: number; generated: number };
  summary: string;
}

// ─── Age map ───────────────────────────────────────────────────────────────────

export interface FileAge {
  file: string;
  lastCommitDate: string; // ISO date
  ageInDays: number; // days before the analyzed commit (the newest in the window), not today
  status: AgeStatus;
  /**
   * Cold (unchanged for `COLD_DAYS`), and every person who changed it has made
   * no commit in the `COLD_DAYS` before the analyzed commit.
   */
  orphaned?: boolean;
  /** An orphaned file's authors, most changes first, up to three. */
  orphanedAuthors?: string[];
  /** Changed in the last `COLD_DAYS` after at least that long untouched: the gap, in days. */
  wokeAfterDays?: number;
}

/** A package with no source change in `COLD_DAYS`: archive it, delete it, or say why it stays. */
export interface DormantPackage {
  package: string;
  sourceFiles: number;
  /** Days since its newest source change. */
  newestAgeDays: number;
}

export type AgeStatus = 'fresh' | 'aging' | 'stale' | 'ancient';

export interface AgeMapReport {
  /**
   * Every tracked file, oldest first. A tier's files are `files` filtered by
   * `status` (scene's `filesInTier`): reports before RELIC-374 also carried
   * `staleFiles` and `ancientFiles`, copies that became most of the report
   * once every file had an age.
   */
  files: FileAge[];
  medianAgeDays: number;
  thresholds: {
    /** Files at or below `freshLimit` days are tier "fresh". */
    freshLimit: number;
    /** Files at or below `agingLimit` (and above `freshLimit`) are tier "aging". */
    agingLimit: number;
    /** Files at or below `staleLimit` (and above `agingLimit`) are tier "stale". Files above this are "ancient". */
    staleLimit: number;
  };
  /**
   * 'history': every tracked file's last change, from all of history.
   * 'window': only files changed in the analysis window (the older history
   * couldn't be read), as before RELIC-374.
   */
  source: 'history' | 'window';
  dormantPackages: DormantPackage[];
  summary: string;
}

// ─── Contributors ──────────────────────────────────────────────────────────────

export interface Contributor {
  email: string;
  name: string;
  commitCount: number;
  firstCommit: string;
  lastCommit: string;
  filesOwned: number; // files where they are dominant author
  linesChanged: number;
  activeDays: number;
  focusAreas: string[]; // top directories they work in
  // Windows count back from the analyzed commit (the newest in the window), not today.
  isActive: boolean; // last commit within the active window (≥ max(90, repoAge * 0.25) days)
  isGhost: boolean; // last commit predates the ghost cutoff (max(180, repoAge * 0.5) days). Mutually exclusive with isActive; both false = intermediate zone.
}

export interface ContributorReport {
  contributors: Contributor[];
  activeContributors: Contributor[];
  ghostContributors: Contributor[]; // committed but no activity in >6 months
  topContributor: Contributor;
  summary: string;
  top3CommitShare: number; // % (0-100), top-3 commit-count concentration
  newcomers90d: number; // count of contributors whose firstCommit is ≤ 90d before the analyzed commit
}

// ─── Cursed files ──────────────────────────────────────────────────────────────

/** Which check in the curse score a reason comes from. */
export type CurseReasonKind =
  | 'churn'
  | 'ownership' // one author dominates (critical or high bus factor)
  | 'authors' // many authors; the other branch of the ownership check
  | 'abandoned'
  | 'fixes'
  | 'parallel';

/** One reason's share of a curse score. */
export interface CurseReasonPoints {
  kind: CurseReasonKind;
  label: string; // the same text as the matching `reasons` entry
  points: number;
}

export interface CursedFile {
  file: string;
  curseScore: number; // 0–100: the breakdown's sum, capped at 100
  reasons: string[]; // human-readable explanations
  // The score split by reason, in the order of `reasons`. Its points sum to
  // the uncapped score (curseScore is that sum capped at 100).
  breakdown: CurseReasonPoints[];
  churn: number;
  authors: number;
  ageDays: number;
  narrative: string; // e.g. "This file has been touched by 7 authors in 89 commits — it's either the heart of the codebase or a ticking time bomb."
}

export interface CursedFilesReport {
  files: CursedFile[];
  // Files that scored as cursed but whose churn is overwhelmingly automated
  // (semantic-release, dependabot, …). Surfaced rather than silently dropped so
  // an empty panel is explainable instead of just looking broken.
  excludedBotFiles: string[];
  // The score a file needs to be cursed (files at or above it are `files`).
  threshold: number;
  // Files that scored just under the threshold, highest first, so a view can
  // show how close they came. Bot-driven files are left out, as from `files`.
  nearMisses: CursedFile[];
  summary: string;
}

// ─── Forensics (commit message shame scoring) ──────────────────────────────────

export interface ShamefulCommit {
  hash: string;
  message: string;
  date: string;
  shamePoints: number; // weighted score from this commit's keywords
  keywords: string[]; // which keywords fired
}

export interface FileForensics {
  file: string;
  shameScore: number; // 0–100 normalized ratio
  rawShamePoints: number; // absolute weighted sum across all commits
  shameCommitCount: number; // how many commits had shame keywords
  topShameCommits: ShamefulCommit[]; // top 3 by shamePoints
  dominantKeywords: string[]; // most frequent shame keywords for this file
}

export interface ShameByMonth {
  month: string; // ISO YYYY-MM (e.g. "2026-04")
  critical: number;
  moderate: number;
  mild: number;
}

export interface ForensicsReport {
  files: FileForensics[];
  shameLeaderboard: FileForensics[]; // top 10 most shameful files
  totalShameCommits: number;
  keywordTiers: { critical: number; moderate: number; mild: number };
  byMonth: ShameByMonth[];
  summary: string;
}

// ─── Fix rate (changes followed by a fix of their lines) ─────────────────────

export interface FixRateFix {
  hash: string;
  message: string; // subject line
  date: string;
  revert: boolean; // a `Revert "…"` commit rather than a fix
  causes: string[]; // hashes of this file's changes whose lines it fixed
}

export interface FileFixRate {
  file: string;
  changes: number; // changes old enough to have had a full window to be fixed
  fixedAfter: number; // of those, how many a fix within the window traced back to
  rate: number; // fixedAfter / changes
  fixes: FixRateFix[]; // newest first, at most 5
}

export interface FixRateMonth {
  month: string; // ISO YYYY-MM of the change, not the fix
  changes: number;
  fixedAfter: number;
}

export interface FixRateReport {
  // Files with at least minChanges rated changes, by rate, then by changes.
  files: FileFixRate[];
  unratedFiles: number; // files with rated changes, but fewer than minChanges
  changes: number;
  fixedAfter: number;
  rate: number | null; // repo-wide; null with no rated change
  byMonth: FixRateMonth[];
  fixCommits: number; // fix and revert commits traced with blame
  reverts: number; // of those, reverts
  sweepingSkipped: number; // fix commits left untraced for touching too many files
  blameTimeouts: number; // per-file blames that hit the time limit and were skipped
  windowDays: number;
  minChanges: number;
  // Changes in commits with AI in them (assisted or agent-authored), against
  // the rest: `versusOthers` is null when either side has too few changes.
  ai: FixRateAiSplit;
  summary: string;
}

export interface FixRateAiSplit {
  changes: number;
  fixedAfter: number;
  versusOthers: 'above' | 'within' | 'below' | null;
}

// ─── Parallel development ─────────────────────────────────────────────────────

export interface ParallelWindow {
  weekStart: string; // ISO date of the Monday starting this week
  authors: string[]; // distinct authors who committed that week
  commitCount: number; // total commits from all authors that week
}

export interface FileParallelDev {
  file: string;
  parallelScore: number; // 0–100
  totalActiveWeeks: number; // weeks where any commit happened
  parallelWeeks: number; // weeks where 2+ distinct authors committed
  peakAuthors: number; // max distinct authors in a single week
  peakWindow: ParallelWindow; // the week with the most author overlap
  topWindows: ParallelWindow[]; // top 3 parallel windows by author count
  windows: ParallelWindow[]; // every parallel window, oldest first
  narrative: string; // human-readable summary
}

/** Two people who committed to the same file in the same week. */
export interface ParallelPair {
  a: string; // email; a < b
  b: string;
  weeks: number; // distinct weeks they shared a file (not file-weeks)
  files: string[]; // the files they shared most, at most 5
}

export interface ParallelByMonth {
  month: string; // ISO YYYY-MM (e.g. "2026-04")
  parallelEvents: number; // distinct (file, week) parallel-development events that started in this month
  uniqueFiles: number; // distinct files with at least one parallel event in this month
  avgAuthors: number; // average author count across parallel events in this month
}

export interface ParallelDevReport {
  files: FileParallelDev[];
  hotFiles: FileParallelDev[]; // top 10 by parallelScore
  totalParallelFiles: number; // files with any parallel activity
  highParallel: number; // files at or above the 70 polish-pattern threshold (spans high tier 70–74 + critical tier 75+)
  tierMix: { low: number; medium: number; high: number; critical: number }; // 0-24 / 25-49 / 50-74 / 75-100
  byMonth: ParallelByMonth[]; // repo-aggregate monthly parallel activity
  pairs: ParallelPair[]; // most shared weeks first
  // Commits left out: sweeping (> 20 files) and bot-authored.
  leftOut: { sweepingCommits: number; botCommits: number };
  summary: string;
}

// ─── Lines of code ───────────────────────────────────────────────────────────

export interface FileLocEntry {
  file: string;
  lines: number;
  language: string;
}

export interface LanguageBreakdown {
  language: string;
  files: number;
  lines: number;
  percentage: number;
}

export interface LocReport {
  totalFiles: number;
  totalLines: number;
  files: FileLocEntry[];
  languages: LanguageBreakdown[];
  summary: string;
}

// ─── Hotspot score ───────────────────────────────────────────────────────────

export interface HotspotEntry {
  file: string;
  hotspotScore: number;
  churnScore: number;
  loc: number;
  category: HotspotCategory;
}

export type HotspotCategory = 'critical' | 'warning' | 'moderate' | 'low';

export interface HotspotReport {
  files: HotspotEntry[];
  topHotspots: HotspotEntry[];
  summary: string;
}

// ─── Coupling map ────────────────────────────────────────────────────────────

export interface CoupledPair {
  fileA: string;
  fileB: string;
  coCommits: number;
  totalCommitsA: number;
  totalCommitsB: number;
  couplingStrength: number;
}

export interface FileCouplingProfile {
  file: string;
  partners: CoupledPair[];
  topPartner: string | null;
  couplingScore: number;
}

/** Two packages' files changing in the same commits. */
export interface PackageCoupling {
  /** `packageOf` the files ('' for the root); `packageA` sorts first. */
  packageA: string;
  packageB: string;
  /** Commits that changed a file in both. */
  commits: number;
  /** `commits` as a share of the smaller package's commits, 0–1. */
  share: number;
  /** The coupled file pairs between them, most shared commits first (up to 4). */
  filePairs: CoupledPair[];
}

export interface PackageCommits {
  package: string;
  commits: number;
}

/**
 * Files that change together both ways: one change, made in several places
 * (forks, copies, generated twins).
 */
export interface CouplingFamily {
  /** Sorted. */
  files: string[];
  /** The packages they span, sorted. */
  packages: string[];
  /** The pairs that hold them together. */
  pairs: CoupledPair[];
}

export interface CouplingReport {
  pairs: CoupledPair[];
  fileProfiles: FileCouplingProfile[];
  topPairs: CoupledPair[];
  /** Commits per package, most first. */
  packageCommits: PackageCommits[];
  /** Package pairs with `MIN_CO_OCCURRENCES`+ commits in common, most first. */
  packages: PackageCoupling[];
  /** Largest first. */
  families: CouplingFamily[];
  summary: string;
}

// ─── Churn velocity ──────────────────────────────────────────────────────────

export interface FileChurnVelocity {
  file: string;
  velocityScore: number;
  trend: ChurnTrend;
  recentCommits: number;
  olderCommits: number;
  totalCommits: number;
}

export type ChurnTrend = 'accelerating' | 'decelerating' | 'stable';

export interface ChurnVelocityReport {
  files: FileChurnVelocity[];
  acceleratingFiles: FileChurnVelocity[];
  summary: string;
}

// ─── Rewrite ratio ──────────────────────────────────────────────────────────

export interface FileRewriteRatio {
  file: string;
  rewriteScore: number;
  totalInsertions: number;
  totalDeletions: number;
  ratio: number;
}

export interface RewriteRatioReport {
  files: FileRewriteRatio[];
  topRewriters: FileRewriteRatio[];
  totalInsertions: number;
  totalDeletions: number;
  highRewrite: number;
  summary: string;
}

// ─── Blast radius ───────────────────────────────────────────────────────────

export interface FileBlastRadius {
  file: string;
  /** Classic's score: the average scaled to the widest file's (0–100). */
  blastScore: number;
  avgCoChangedFiles: number;
  maxCoChangedFiles: number;
  totalCommits: number;
  /**
   * The median number of other files its commits changed: the blast radius
   * Atlas shows. Only with `minCommits`+ commits; one wide commit can't drag
   * a median up the way it drags an average.
   */
  medianCoChanged?: number;
  /** Its commits by how many other files each changed (index 0–19), when rated. */
  footprint?: number[];
}

export interface BlastRadiusReport {
  files: FileBlastRadius[];
  topBlasters: FileBlastRadius[];
  /** Commits a file needs for a `medianCoChanged`. */
  minCommits: number;
  /** Files with one. */
  rated: number;
  summary: string;
}

// ─── Dead code candidates ───────────────────────────────────────────────────

export interface DeadCodeCandidate {
  file: string;
  lastCommitDate: string;
  ageInDays: number;
  language: string;
  loc: number;
}

export interface DeadCodeReport {
  candidates: DeadCodeCandidate[];
  totalDeadFiles: number;
  totalDeadLines: number;
  summary: string;
}

// ─── Test coverage proxy ────────────────────────────────────────────────────

export interface DirectoryCoverage {
  directory: string;
  sourceFiles: number;
  testFiles: number;
  coverageRatio: number; // testFiles / sourceFiles, 0-1
  hasTests: boolean;
}

export interface TestCoverageFile {
  file: string;
  hasTestSibling: boolean;
}

export interface TestCoverageProxyReport {
  directories: DirectoryCoverage[];
  uncoveredDirectories: DirectoryCoverage[]; // directories with 0 test files
  files: TestCoverageFile[];
  overallRatio: number; // repo-wide test/source ratio
  summary: string;
}

// ─── Ghost files ────────────────────────────────────────────────────────────

export interface GhostFile {
  file: string;
  dominantAuthor: string;
  dominantAuthorPercent: number;
  lastAuthorCommitDate: string; // ISO date of dominant author's last commit anywhere
  authorInactiveDays: number; // days from that commit to the analyzed commit
  loc: number;
}

export interface GhostFilesReport {
  files: GhostFile[];
  totalGhostFiles: number;
  ghostOwners: number; // distinct dominant-author count
  ghostLoc: number; // total LOC across ghost files
  tierMix: {
    trueGhost: number; // authorInactiveDays >= 365
    fading: number; // 180 <= authorInactiveDays < 365
  };
  summary: string;
}

// ─── Knowledge concentration ────────────────────────────────────────────────

export interface KnowledgeConcentrationReport {
  singleAuthorFiles: number; // files where one author has >80% of commits
  totalFiles: number;
  concentrationIndex: number; // singleAuthorFiles / totalFiles × 100
  summary: string;
}

// ─── Co-author analysis ─────────────────────────────────────────────────────

export type AdoptionTier = 'none' | 'low' | 'moderate' | 'high';

// Bots are filtered out of pairs[] before they reach consumers, so a
// 'bot-involved' classification is structurally impossible here.
export type CoAuthorPairClassification = 'human-pair' | 'human-ai';

export interface CoAuthorPair {
  authorA: string;
  authorB: string;
  coAuthoredCommits: number;
  files: string[];
  classification: CoAuthorPairClassification;
}

export interface CoAuthorStats {
  author: string;
  coAuthoredCommits: number; // commits where this author was a co-author
  primaryPartner: string | null;
}

export interface AiAuthorStat {
  author: string; // email (lowercased)
  displayName: string;
  aiCommits: number; // commits authored by this human with AI co-author
  totalCommits: number; // all commits authored by this human in window
  personalRatio: number; // 0–100, aiCommits / totalCommits
}

export interface PerAuthorMixEntry {
  author: string;
  displayName: string;
  aiCommits: number;
  soloCommits: number;
  totalCommits: number;
  personalRatio: number; // 0–100
}

export interface CoAuthorMonthEntry {
  month: string; // ISO `YYYY-MM`
  aiAssisted: number;
  pureHuman: number;
  total: number; // aiAssisted + pureHuman: human-authored commits
  aiAuthored: number; // commits an AI agent authored itself, not in total
}

/** An AI tool's commits: as a co-author (assisted) and as the author. */
export interface AiToolStat {
  product: string; // 'Claude', 'GitHub Copilot', …
  assisted: number;
  authored: number;
}

/** An AI agent that authored commits itself (the Claude or Copilot app). */
export interface AiAgentStat {
  author: string; // email (lowercased)
  displayName: string;
  product: string;
  commits: number;
}

/** A package's commits, and how many of them AI helped write or wrote. */
export interface CoAuthorPackage {
  package: string; // commit timing's packageOf; '' is the root
  commits: number;
  aiAssisted: number;
  aiAuthored: number;
}

export interface CoAuthorReport {
  // Strict invariant: pairs[] never contains a bot endpoint (filtered at the
  // analyzer). humanPairs is a strict subset where classification is
  // 'human-pair' (no AI either) — maintained by the analyzer, not derived at
  // consumer time, so tabs don't have to re-filter on every render.
  pairs: CoAuthorPair[];
  humanPairs: CoAuthorPair[];

  authorStats: CoAuthorStats[];
  totalCoAuthoredCommits: number;
  summary: string;

  aiAssistedCommits: number;
  humanAuthoredCommits: number; // denominator for B%
  aiAdoptionPercent: number; // 0–100 (B-formula)
  aiAdoptionTier: AdoptionTier;
  aiAuthors: AiAuthorStat[]; // humans with personalRatio > 0, sorted desc by aiCommits
  filteredBotCommits: number; // for the panel footnote
  byMonth: CoAuthorMonthEntry[];
  perAuthorMix: PerAuthorMixEntry[];

  // Commits an AI agent authored itself. aiAdoptionPercent counts them with
  // the assisted ones: (assisted + authored) / (human-authored + authored).
  aiAuthoredCommits: number;
  aiTools: AiToolStat[]; // by commits, most first
  aiAgents: AiAgentStat[]; // by commits, most first
  // Every package a counted commit touched, by commits. Bot commits and
  // sweeping ones (over fix rate's MAX_FIX_FILES) are left out.
  packages: CoAuthorPackage[];
  sweepingLeftOut: number;
}

// ─── Hotspot clustering ────────────────────────────────────────────────────

export type ClusterDimension =
  | 'structural'
  | 'ownership'
  | 'temporal'
  | 'coupling-hub';

export interface ClusterMember {
  file: string;
  hotspotScore: number;
}

export interface HotspotCluster {
  dimension: ClusterDimension;
  label: string;
  members: ClusterMember[];
  clusterScore: number;
  narrative: string;
  sharedTrait: string;
}

export interface HotspotClusterReport {
  clusters: HotspotCluster[];
  multiSignalFiles: MultiSignalFile[];
  summary: string;
}

export interface MultiSignalFile {
  file: string;
  clusterCount: number;
  dimensions: ClusterDimension[];
}

// ─── Complexity trend ─────────────────────────────────────────────────

export interface FileGrowthBucket {
  month: string; // "2025-06"
  netLines: number; // insertions - deletions that month
  cumulative: number; // running total of net lines within the analysis window (not absolute file size)
}

export interface FileComplexityTrend {
  file: string;
  buckets: FileGrowthBucket[];
  totalNetLines: number; // sum of all net lines across all buckets
  recentGrowthRate: number; // avg net lines/month over last 3 active months
  trend: GrowthTrend;
}

export type GrowthTrend = 'growing' | 'shrinking' | 'stable';

export interface ComplexityTrendReport {
  files: FileComplexityTrend[];
  growingFiles: FileComplexityTrend[]; // top 10 growers by recentGrowthRate
  shrinkingFiles: FileComplexityTrend[]; // top 10 shrinkers
  summary: string;
}

// ─── Commit timing forensics ─────────────────────────────────────────

export type TimeOfDay =
  | 'early-morning'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night';
export type DayType = 'weekday' | 'weekend';

export interface FileTimingProfile {
  file: string;
  totalCommits: number;
  lateNightPercent: number; // commits between 11pm–5am as percentage
  weekendPercent: number; // Saturday + Sunday commits as percentage
  peakHour: number; // 0-23, hour with most commits
  peakDay: number; // 0-6 (Sun=0), day with most commits
  hourDistribution: number[]; // 24 entries, commit count per hour
  stressScore: number; // 0–100, weighted from late-night + weekend frequency
}

export interface AuthorStressProfile {
  email: string; // stable id, lowercased
  name: string; // display, full git author name (with collision suffix if needed)
  totalCommits: number;
  lateNightCommits: number;
  weekendCommits: number;
  lateNightPercent: number; // 0–100, rounded
  weekendPercent: number; // 0–100, rounded
  stressScore: number; // round(lateNightPercent × 0.6 + weekendPercent × 0.4), 0–100
  // Regularity, which a single crunch can't fake: weeks (Monday-start, local
  // time) with any commit, with a weekend commit, with a late-night commit,
  // and distinct late nights (a 1am commit counts toward the evening before).
  activeWeeks: number;
  weekendWeeks: number;
  lateNightWeeks: number;
  lateNights: number;
  // Off-hours in at least REGULAR_SHARE (a third) of active weeks, over at
  // least REGULAR_MIN_WEEKS (6); never for bots.
  regularWeekends: boolean;
  regularLateNights: boolean;
}

export interface CommitTimingMonthlyBucket {
  month: string; // ISO YYYY-MM (local time)
  weekendLateNight: number; // commits matching BOTH criteria
  singleCriterion: number; // commits matching exactly one criterion (XOR)
  healthy: number; // commits matching neither
  total: number; // sum of the three above
}

export interface CommitTimingTierMix {
  low: number; // stressScore 0–24
  medium: number; // 25–49
  high: number; // 50–74
  critical: number; // 75+
}

export interface CommitTimingReport {
  files: FileTimingProfile[];
  stressFiles: FileTimingProfile[]; // top 10 by stressScore
  repoLateNightPercent: number; // repo-wide late night commit percentage
  repoWeekendPercent: number; // repo-wide weekend commit percentage
  summary: string;
  repoHourDayMatrix: number[][]; // 7 rows × 24 cols, [dayOfWeek][hour]; Sun=0
  highStress: number; // count of files with stressScore ≥ 70
  tierMix: CommitTimingTierMix; // file-score band counts
  byMonth: CommitTimingMonthlyBucket[]; // disjoint, sorted ascending by month
  authorStress: AuthorStressProfile[]; // sorted desc by stressScore, post-floor and post-disambiguation
  offHours: CommitTimingOffHours; // which code changes off-hours, against chance
}

/** One package's off-hours commits against the repo's rate. */
export interface PackageOffHours {
  package: string; // `packages/<name>`, else the top-level directory; '' for the root
  commits: number; // commits touching it (sweeping and bot commits left out)
  offHours: number; // of those, late night (11pm–5am) or weekend, author's local time
  percent: number; // 0–100, rounded
  allowed: number; // the most off-hours commits chance explains at the repo's rate
  aboveChance: boolean; // under a 2.5% chance at the repo's rate (Fix rate's test)
}

export interface CommitTimingOffHours {
  commits: number; // commits counted (sweeping and bot commits left out)
  offHours: number; // of those, off-hours
  rate: number; // offHours / commits, 0–1
  minCommits: number; // a package needs this many commits to be tested
  packages: PackageOffHours[]; // above chance first, then by share
}

// ─── Rename tracking ─────────────────────────────────────────────────────────

export interface FileRename {
  oldPath: string;
  newPath: string;
  commitHash: string;
  date: string; // ISO date of the rename commit
}

export interface FileRenameChain {
  currentPath: string;
  previousNames: string[]; // ordered oldest → newest (not including currentPath)
  renameCount: number;
}

export interface RenameTrackingReport {
  renames: FileRename[];
  chains: FileRenameChain[]; // files with rename history
  totalRenames: number;
  filesWithRenames: number; // how many current files have been renamed at least once
  summary: string;
}

// ─── Runner options ────────────────────────────────────────────────────────────

export interface RunGitrelicOptions {
  repoPath: string;
  branch?: string;
  since?: string; // e.g. "6 months ago", "2023-01-01"
  maxFiles?: number; // limit analysis to top N churned files
  /** Merge split author identities (see utils/identity.ts). Default true. */
  mergeIdentities?: boolean;
  /**
   * Keep test fixtures, snapshots and generated code in ownership analysis
   * (bus factor and everything derived from it). Default false.
   */
  includeFixtures?: boolean;
  /**
   * Time limit, in ms, for each heavy git read (`git log`, the rename log,
   * `cat-file --batch`). Default `GIT_HEAVY_TIMEOUT_MS` (10 minutes). Quick
   * lookups keep their own short limit.
   */
  gitTimeoutMs?: number;
  /**
   * Version stamped into `meta.gitrelicVersion`. Passed in by the caller (the
   * CLI) rather than read from a package.json at runtime: core is bundled into
   * the CLI, so any path relative to core's own module is fragile.
   * Omitted → `''`, which consumers treat as "unknown".
   */
  version?: string;
  onProgress?: (step: string) => void;
}
