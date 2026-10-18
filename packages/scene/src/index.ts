// @gitrelic/scene — framework-free derivations shared by the classic web
// dashboard and Atlas. Browser code: `import type` only from @gitrelic/core,
// and no React or Svelte.

export { aiAdoptionByMonth } from './authors/aiAdoptionByMonth';
export {
  aiProductName,
  classifyAuthor,
  isAiEmail,
  isBotEmail,
  resolveAuthorDisplayName,
} from './authors/authorClassification';
export { perAuthorAiMix } from './authors/perAuthorAiMix';
export { topAiUsers } from './authors/topAiUsers';

export {
  buildAuthorGraph,
  type AuthorGraphLink,
  type AuthorGraphNode,
  type AuthorGraphResult,
  type GraphAuthorClass,
} from './coauthors/authorGraph';

export {
  fromCommitIndex,
  fromRawCommits,
  type CommitLike,
} from './commits/commitLike';

export {
  prepareSwimlaneData,
  type SwimCommit,
  type SwimLane,
} from './contributors/swimlanes';
export { binCommitsByWeek, type WeekBin } from './contributors/weeklyBins';

export {
  churnCategoryDescription,
  severityForChurn,
} from './churn/churnCategory';

export {
  aggregateAgeByDirectory,
  type AgeDirectoryRow,
} from './directory/ageByDirectory';
export {
  aggregateBlastByDirectory,
  type BlastDirectoryRow,
} from './directory/blastByDirectory';
export {
  aggregateBusFactorByDirectory,
  type BusFactorDirectoryRow,
} from './directory/busFactorByDirectory';
export {
  aggregateChurnByDirectory,
  type DirectoryChurnRow,
} from './directory/churnByDirectory';
export {
  aggregateCommitTimingByDirectory,
  type CommitTimingDirectoryRow,
} from './directory/commitTimingByDirectory';
export {
  aggregateGhostFilesByDirectory,
  type GhostDirectoryRow,
} from './directory/ghostFilesByDirectory';
export {
  aggregateParallelDevByDirectory,
  type ParallelDevDirectoryRow,
} from './directory/parallelDevByDirectory';
export {
  aggregateRewriteByDirectory,
  type RewriteDirectoryRow,
} from './directory/rewriteByDirectory';
export {
  aggregateShameByDirectory,
  type ShameDirectoryRow,
} from './directory/shameByDirectory';

export { makeFileKind, type FileKind } from './files/fileKind';
export { isTestPath } from './files/isTestPath';

export { formatRelative } from './format/relativeTime';

export { fileFacts, type FactTier, type FileFact } from './inspect/fileFacts';

export { topGhostOwners, type TopGhostOwner } from './ownership/ghostOwners';
export { sortCriticalByImpact } from './ownership/sortBusFactor';
export {
  topDominantOwners,
  type DominantOwnerRow,
} from './ownership/topDominantOwners';

export {
  ENTITY_KINDS,
  entityKey,
  entityKind,
  ids,
  parentOf,
  REPO_ID,
  type EntityId,
  type EntityKind,
} from './ids';

export {
  DEFAULT_LABEL_CAP,
  planLabels,
  type LabelCandidate,
  type LabelOptions,
} from './labels/plan';

export {
  checkScene,
  emptyScene,
  type AnalyzerView,
  type Bounds,
  type ColorRole,
  type Finding,
  type FindingSegment,
  type Guide,
  type Layout,
  type Link,
  type Mark,
  type MarkGeom,
  type MarkShape,
  type Paint,
  type Scene,
  type ViewInput,
  type Viewport,
} from './model';

export { clamp01, easeOutCubic, linear, trackProgress } from './motion/ease';
export {
  lerp,
  lerpArc,
  lerpGeom,
  mixColor,
  parseColor,
  resolvePaint,
  type Palette,
  type Rgba,
} from './motion/interp';
export {
  EMPTY_LIVE,
  geomOf,
  planTransition,
  TIMING,
  type EaseName,
  type GuideTrack,
  type LinkTrack,
  type LiveGuide,
  type LiveLink,
  type LiveMark,
  type LiveState,
  type MarkTrack,
  type Phase,
  type PlanOptions,
  type TransitionPlan,
} from './motion/plan';

export { normalizeReport } from './report/normalizeReport';

export {
  DEFAULT_THEME,
  isThemeName,
  THEME_TOKENS,
  THEMES,
  type ThemeName,
  type ThemeToken,
} from './theme/tokens';

export {
  HEADCOUNT_MODERATE_THRESHOLD,
  headcountTier,
  type HeadcountTier,
} from './tiers/headcount';

export { startOfUtcWeek, WEEK_MS } from './time/week';
