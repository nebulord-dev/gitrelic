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

export { topGhostOwners, type TopGhostOwner } from './ownership/ghostOwners';
export { sortCriticalByImpact } from './ownership/sortBusFactor';
export {
  topDominantOwners,
  type DominantOwnerRow,
} from './ownership/topDominantOwners';

export { normalizeReport } from './report/normalizeReport';
