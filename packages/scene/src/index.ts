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
  computeOutlierBadges,
  outlierGrades,
  RULES as BADGE_RULES,
  type Badge,
  type Outlier,
  type OutlierGrade,
} from './badges';
export {
  CATALOG,
  catalogEntry,
  classicUrl,
  defaultLens,
  DOCS_BASE,
  docsUrl,
  isPresetGroup,
  lensesOf,
  PRESET_GROUPS,
  type CatalogEntry,
  type PresetGroup,
} from './catalog';

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

export {
  buildEntityIndex,
  type EntityEntry,
  type EntityIndex,
  type SearchKind,
} from './entities';
export { fileFacts, type FactTier, type FileFact } from './inspect/fileFacts';
export { dirFacts } from './inspect/dirFacts';
export { coupledWith, type CoupledFile } from './inspect/coupledWith';
export {
  fileContributors,
  type FileContributor,
} from './inspect/fileContributors';
export {
  personFacts,
  reportNow,
  STRESS_WARNING,
  type PersonFacts,
} from './inspect/personFacts';
export { fuzzyScore, rankEntities, type Ranked } from './search/rank';

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
  COLOR_ROLES,
  emptyScene,
  type AnalyzerView,
  type Bounds,
  type ColorRole,
  type Finding,
  type FindingSegment,
  type LensTable,
  type TableColumn,
  type TableRow,
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
  lerpGuide,
  mixColor,
  mixPalette,
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

export { readPalette } from './theme/palette';
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
export {
  previousNamesOf,
  touchesEntity,
  weeklyActivity,
  weeklyHits,
  type WeeklyActivity,
} from './time/activity';
export { lensReadings, type LensReading } from './overview/readings';
export { lensTopEntities, type FannedEntity } from './overview/topEntities';
export { ringScene, type RingFocus } from './layouts/ring';
export { overviewView, ringLayout } from './views/overview';
export {
  commitsForScore,
  HOTSPOT_TIERS,
  hotspotPoints,
  hotspotScale,
  hotspotSummary,
  hotspotTier,
  hotspotTip,
  HOTSPOT_TIER_NAMES,
  packageOf,
  type HotspotPoint,
  type HotspotSummary,
  type HotspotTier,
} from './hotspots/points';
export {
  BLAST_HOT,
  CLUSTERS_HOT,
  COUPLING_HOT,
  fileFacets,
  REWRITE_HOT,
  type FacetId,
  type FileFacet,
} from './hotspots/facets';
export {
  ADVICE_LIMIT,
  COUPLING_MIN_COMMITS,
  SHAME_ACT,
  whatToDo,
  type Advice,
  type AdviceId,
  type AdviceSection,
} from './advice/whatToDo';
export { distinctNames } from './format/distinctNames';
export { fieldScene, type FieldInput } from './layouts/field';
export {
  PACKAGES_DOT_CAP,
  PACKAGES_MAX_GROW,
  packagesScene,
} from './layouts/packages';
export {
  fieldLayout,
  hotspotFindings,
  hotspotsView,
  hotspotTable,
  pointsOf as hotspotPointsOf,
  packagesLayout,
} from './views/hotspots';
export {
  CHURN_TIER_NAMES,
  churnCharacter,
  churnSwarm,
  churnSwarmOf,
  perFile,
  QUIET_COMMITS,
  rowName,
  type ChurnCharacter,
  type SwarmFile,
  type SwarmRow,
} from './churn/swarm';
export { SWARM_ROWS, swarmScene } from './layouts/swarm';
export {
  churnFindings,
  churnTable,
  churnView,
  hardestRow,
  lockstepGroups,
  swarmLayout,
} from './views/churn';
export { VIEWS } from './views/index';
