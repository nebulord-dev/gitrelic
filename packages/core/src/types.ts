// ─── Core report shape ────────────────────────────────────────────────────────

export interface CodeloreReport {
  timestamp: string;
  repoPath: string;
  repoName: string;
  meta: RepoMeta;
  churn: ChurnReport;
  busFactors: BusFactorReport;
  ageMap: AgeMapReport;
  contributors: ContributorReport;
  cursedFiles: CursedFile[];
  forensics: ForensicsReport;
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
}

// ─── Repo metadata ─────────────────────────────────────────────────────────────

export interface RepoMeta {
  totalCommits: number;
  totalFiles: number;
  totalAuthors: number;
  firstCommit: string;       // ISO date
  lastCommit: string;        // ISO date
  ageInDays: number;
  primaryLanguage: string;
  branches: string[];
}

// ─── Churn ─────────────────────────────────────────────────────────────────────

export interface FileChurn {
  file: string;
  commitCount: number;       // how many commits touched this file
  churnScore: number;        // 0–100 relative to repo max
  category: ChurnCategory;
}

export type ChurnCategory = 'hot' | 'warm' | 'cold' | 'frozen';

export interface ChurnReport {
  files: FileChurn[];
  topFiles: FileChurn[];     // top 20 by commit count
  hotspotCount: number;      // files with churnScore > 75
  summary: string;           // e.g. "auth.ts has been modified in 34% of all commits"
}

// ─── Bus factor ────────────────────────────────────────────────────────────────

export interface FileBusFactor {
  file: string;
  uniqueAuthors: number;
  authors: string[];         // email list
  dominantAuthor: string;    // author with most commits to this file
  dominantAuthorPercent: number;
  risk: BusFactorRisk;
}

export type BusFactorRisk = 'critical' | 'high' | 'medium' | 'low';

export interface BusFactorReport {
  files: FileBusFactor[];
  criticalFiles: FileBusFactor[];   // single author owns >80% of commits
  overallBusFactor: number;          // min unique authors across top files
  summary: string;
}

// ─── Age map ───────────────────────────────────────────────────────────────────

export interface FileAge {
  file: string;
  lastCommitDate: string;    // ISO date
  ageInDays: number;
  status: AgeStatus;
}

export type AgeStatus = 'fresh' | 'aging' | 'stale' | 'ancient';

export interface AgeMapReport {
  files: FileAge[];
  staleFiles: FileAge[];     // not touched in >180 days
  ancientFiles: FileAge[];   // not touched in >365 days
  medianAgeDays: number;
  summary: string;
}

// ─── Contributors ──────────────────────────────────────────────────────────────

export interface Contributor {
  email: string;
  name: string;
  commitCount: number;
  firstCommit: string;
  lastCommit: string;
  filesOwned: number;        // files where they are dominant author
  linesChanged: number;
  activeDays: number;
  focusAreas: string[];      // top directories they work in
  isActive: boolean;         // committed in last 90 days
}

export interface ContributorReport {
  contributors: Contributor[];
  activeContributors: Contributor[];
  ghostContributors: Contributor[];  // committed but no activity in >6 months
  topContributor: Contributor;
  summary: string;
}

// ─── Cursed files ──────────────────────────────────────────────────────────────

export interface CursedFile {
  file: string;
  curseScore: number;        // 0–100
  reasons: string[];         // human-readable explanations
  churn: number;
  authors: number;
  ageDays: number;
  narrative: string;         // e.g. "This file has been touched by 7 authors in 89 commits — it's either the heart of the codebase or a ticking time bomb."
}

// ─── Forensics (commit message shame scoring) ──────────────────────────────────

export interface ShamefulCommit {
  hash: string;
  message: string;
  date: string;
  shamePoints: number;   // weighted score from this commit's keywords
  keywords: string[];    // which keywords fired
}

export interface FileForensics {
  file: string;
  shameScore: number;          // 0–100 normalized ratio
  rawShamePoints: number;      // absolute weighted sum across all commits
  shameCommitCount: number;    // how many commits had shame keywords
  topShameCommits: ShamefulCommit[];   // top 3 by shamePoints
  dominantKeywords: string[];          // most frequent shame keywords for this file
}

export interface ForensicsReport {
  files: FileForensics[];
  shameLeaderboard: FileForensics[];  // top 10 most shameful files
  totalShameCommits: number;
  summary: string;
}

// ─── Parallel development ─────────────────────────────────────────────────────

export interface ParallelWindow {
  weekStart: string;           // ISO date of the Monday starting this week
  authors: string[];           // distinct authors who committed that week
  commitCount: number;         // total commits from all authors that week
}

export interface FileParallelDev {
  file: string;
  parallelScore: number;       // 0–100
  totalActiveWeeks: number;    // weeks where any commit happened
  parallelWeeks: number;       // weeks where 2+ distinct authors committed
  peakAuthors: number;         // max distinct authors in a single week
  peakWindow: ParallelWindow;  // the week with the most author overlap
  topWindows: ParallelWindow[];// top 3 parallel windows by author count
  narrative: string;           // human-readable summary
}

export interface ParallelDevReport {
  files: FileParallelDev[];
  hotFiles: FileParallelDev[]; // top 10 by parallelScore
  totalParallelFiles: number;  // files with any parallel activity
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

export interface CouplingReport {
  pairs: CoupledPair[];
  fileProfiles: FileCouplingProfile[];
  topPairs: CoupledPair[];
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
  summary: string;
}

// ─── Blast radius ───────────────────────────────────────────────────────────

export interface FileBlastRadius {
  file: string;
  blastScore: number;
  avgCoChangedFiles: number;
  maxCoChangedFiles: number;
  totalCommits: number;
}

export interface BlastRadiusReport {
  files: FileBlastRadius[];
  topBlasters: FileBlastRadius[];
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
  coverageRatio: number;        // testFiles / sourceFiles, 0-1
  hasTests: boolean;
}

export interface TestCoverageProxyReport {
  directories: DirectoryCoverage[];
  uncoveredDirectories: DirectoryCoverage[];  // directories with 0 test files
  overallRatio: number;                        // repo-wide test/source ratio
  summary: string;
}

// ─── Ghost files ────────────────────────────────────────────────────────────

export interface GhostFile {
  file: string;
  dominantAuthor: string;
  dominantAuthorPercent: number;
  lastAuthorCommitDate: string;  // ISO date of dominant author's last commit anywhere
  authorInactiveDays: number;
  loc: number;
}

export interface GhostFilesReport {
  files: GhostFile[];
  totalGhostFiles: number;
  summary: string;
}

// ─── Knowledge concentration ────────────────────────────────────────────────

export interface KnowledgeConcentrationReport {
  singleAuthorFiles: number;     // files where one author has >80% of commits
  totalFiles: number;
  concentrationIndex: number;    // singleAuthorFiles / totalFiles × 100
  summary: string;
}

// ─── Co-author analysis ─────────────────────────────────────────────────────

export interface CoAuthorPair {
  authorA: string;
  authorB: string;
  coAuthoredCommits: number;
  files: string[];               // files they co-authored together
}

export interface CoAuthorStats {
  author: string;
  coAuthoredCommits: number;     // commits where this author was a co-author
  primaryPartner: string | null;
}

export interface CoAuthorReport {
  pairs: CoAuthorPair[];
  authorStats: CoAuthorStats[];
  totalCoAuthoredCommits: number;
  summary: string;
}

// ─── Runner options ────────────────────────────────────────────────────────────

export interface RunCodeloreOptions {
  repoPath: string;
  branch?: string;
  since?: string;            // e.g. "6 months ago", "2023-01-01"
  maxFiles?: number;         // limit analysis to top N churned files
  onProgress?: (step: string) => void;
}
