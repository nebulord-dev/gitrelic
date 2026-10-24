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
export { filesInTier } from './report/ageTiers';
export { packageResolver, packagesOf } from './report/packages';

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
export { fanScene, type FanFocus } from './layouts/fan';
export { dashboardLayout, fanLayout, overviewView } from './views/overview';
export {
  FAN_VIEWS,
  isFanView,
  loudestView,
  VIEW_BLURBS,
  viewHeadline,
  type FanView,
} from './overview/viewHeadlines';
export {
  commitsForScore,
  HOTSPOT_TIERS,
  hotspotPoints,
  hotspotScale,
  hotspotSummary,
  hotspotTier,
  hotspotTip,
  HOTSPOT_TIER_NAMES,
  type HotspotPoint,
  type HotspotSummary,
  type HotspotTier,
} from './hotspots/points';
export {
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
  whatToDo,
  type Advice,
  type AdviceId,
  type AdviceSection,
} from './advice/whatToDo';
export { distinctNames } from './format/distinctNames';
export { fieldScene, type FieldInput } from './layouts/field';
export {
  PACKAGES_DOT_CAP,
  PACKAGES_HOT_MIN,
  PACKAGES_MAX_GROW,
  PACKAGES_SHOWN,
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
export {
  churnRhythm,
  churnRhythmOf,
  RHYTHM_ROWS,
  topChurnFiles,
  type Rhythm,
  type RhythmRow,
} from './churn/rhythm';
export { rhythmScene, rhythmTip } from './layouts/rhythm';
export { SWARM_ROWS, swarmScene } from './layouts/swarm';
export {
  AGE_BAND_NAMES,
  ageFileTip,
  ageRowName,
  ageStrata,
  ageStrataOf,
  ageSummaryOf,
  bandOf,
  COLD_DAYS,
  sinceText,
  type AgeBand,
  type AgeFile,
  type AgeRow,
  type AgeSummary,
} from './age/strata';
export { strataScene } from './layouts/strata';
export {
  BLAST_WIDE,
  blastSummaryOf,
  boundariesOf,
  onRing,
  rippleOf,
  RING_PACKAGES,
  type BlastSummary,
  type Boundaries,
  type FileBlast,
  type Ripple,
  type RipplePartner,
  type RingLink,
  type RingPackage,
} from './coupling/boundaries';
export { boundariesScene, shortPackage } from './layouts/boundaries';
export {
  boundariesLayout,
  couplingFindings,
  couplingTable,
  couplingView,
} from './views/coupling';
export {
  OWNER_SLOTS,
  onMap,
  ownershipMapOf,
  surname,
  type MapPackage,
  type MapPerson,
  type OwnershipMap,
} from './ownership/map';
export {
  MAP_SEED,
  organicMapScene,
  ownerPaint,
  ownershipTip,
  strength,
} from './layouts/organicMap';
export {
  circlePolygon,
  insetPolygon,
  polygonArea,
  polygonCentroid,
  voronoiTreemap,
  type Point,
} from './layouts/voronoiTreemap';
export {
  organicMapLayout,
  ownershipFindings,
  ownershipTable,
  ownershipView,
} from './views/ownership';
export { warmColdScene } from './layouts/warmCold';
export {
  AGE_TESTS_PANEL,
  ageFindings,
  ageTable,
  ageView,
  STRATA_ROWS,
  strataLayout,
  warmColdLayout,
} from './views/age';
export {
  churnFindings,
  churnTable,
  churnView,
  hardestRow,
  lockstepGroups,
  rhythmLayout,
  swarmLayout,
} from './views/churn';
export {
  HOTSPOT_MARK,
  REASON_KINDS,
  REASON_NAMES,
  reasonList,
  RISK_HIGH,
  RISK_TIER_NAMES,
  riskStacks,
  riskStacksOf,
  riskTier,
  segmentTip,
  sharedReasons,
  signalText,
  stackRowTip,
  type RiskStacks,
  type RiskTier,
  type StackRow,
} from './risk/stacks';
export { REASON_PAINT, stacksScene } from './layouts/stacks';
export {
  FAMILY_COMMITS,
  FAMILY_STRENGTH,
  familyName,
  MAX_HUBS,
  rootCauses,
  rootCausesOf,
  type Hub,
  type HubLink,
  type RiskNode,
  type RootCauses,
} from './risk/rootCauses';
export { rootCausesScene } from './layouts/rootCauses';
export {
  riskFindings,
  riskTable,
  riskView,
  rootCausesLayout,
  stacksLayout,
} from './views/risk';
export {
  binomialUpperTail,
  CHANCE_TAIL,
  chanceAllows,
  FIX_TIER_NAMES,
  fixPointOf,
  fixRateOf,
  ratePct,
  type FixPoint,
  type FixRateData,
  type FixTier,
} from './fixRate/points';
export { fixTip, funnelScene, type FunnelInput } from './layouts/funnel';
export {
  fixRateFindings,
  fixRateTable,
  fixRateView,
  funnelLayout,
} from './views/fixRate';
export {
  contributorFlow,
  contributorFlowOf,
  FLOW_PACKAGES,
  FLOW_PEOPLE,
  LEFT_BEHIND_SHARE,
  notActiveShare,
  personStatus,
  type ContributorFlow,
  type FlowLink,
  type FlowPackage,
  type FlowPerson,
  type PersonStatus,
} from './contributors/flow';
export {
  flowScene,
  OTHER_PACKAGES_ID,
  OTHER_PEOPLE_ID,
  packageId,
  packageName,
  STATUS_TEXT,
} from './layouts/flow';
export {
  CARRIERS,
  CONTRIBUTOR_TIER_NAMES,
  contributorsFindings,
  contributorsTable,
  contributorsView,
  flowLayout,
  lanesLayout,
} from './views/contributors';
export {
  contributorLanes,
  contributorLanesOf,
  statusCutoffs,
  type LaneRow,
  type Lanes,
} from './contributors/lanes';
export { lanesScene } from './layouts/lanes';
export { timeBins, type TimeBins } from './time/bins';
export {
  PAIR_PEOPLE,
  parallelPairs,
  parallelPairsOf,
  type Pair,
  type PairPerson,
  type PairsData,
} from './parallel/pairs';
export { pairsScene } from './layouts/pairs';
export {
  COLLISION_ROWS,
  collisions,
  collisionsOf,
  type CollisionMark,
  type CollisionPerson,
  type CollisionRow,
  type Collisions,
} from './parallel/collisions';
export { collisionsScene } from './layouts/collisions';
export {
  collisionsLayout,
  filePeople,
  PARALLEL_TIER_NAMES,
  PARALLEL_TIERS,
  pairsLayout,
  parallelDevFindings,
  parallelDevTable,
  parallelDevView,
} from './views/parallelDev';
export {
  busiestCells,
  DAY_NAMES,
  DAY_ORDER,
  hourName,
  isOffHours,
  repoGrid,
  selectionHours,
  selectionHoursOf,
  selectionRule,
  cellAuthors,
  cellAuthorsOf,
  OFF_HOURS_MIN_WEEKS,
  offHoursLine,
  offHoursPeople,
  offHoursRegulars,
  regularLine,
  topAuthors,
  type CellAuthors,
  type OffHoursRegular,
  type SelectionRule,
  touchesSelection,
  workingHoursShare,
  type DayHourGrid,
  type SelectionHours,
} from './timing/punchCard';
export { punchCardScene } from './layouts/punchCard';
export {
  offHoursFunnelScene,
  type OffHoursFunnelInput,
  type OffHoursPoint,
} from './layouts/offHoursFunnel';
export {
  commitTimingFindings,
  commitTimingTable,
  commitTimingView,
  offHoursFunnelLayout,
  offHoursPoints,
  punchCardLayout,
  TIMING_TIER_NAMES,
  timingPackageId,
  timingPackageName,
  timingTier,
} from './views/commitTiming';
export { localDayHour, utcOffsetMinutes, withAi } from './commits/commitLike';
export { VIEWS } from './views/index';
export {
  ADOPTION_ROWS,
  adoptionLanes,
  adoptionLanesOf,
  type AdoptionLanes,
  type AdoptionRow,
} from './ai/adoption';
export {
  AI_PACKAGE_ROWS,
  aiPackageId,
  aiPackageName,
  aiPackagesFrom,
  aiPackagesOf,
  type AiPackageRow,
  type AiPackages,
} from './ai/packages';
export {
  adoptionLanesScene,
  adoptionLine,
  adoptionShare,
} from './layouts/adoptionLanes';
export {
  aiPackagesScene,
  AUTHORED_PAINT,
  type AiPackagesInput,
} from './layouts/aiPackages';
export {
  AI_SHARE_MIN_COMMITS,
  AI_TIER_NAMES,
  adoptionLanesLayout,
  aiCoauthorsFindings,
  aiCoauthorsTable,
  aiCoauthorsView,
  aiTier,
  aiToolsLine,
  personIdOf,
  whereAiLayout,
} from './views/aiCoauthors';
