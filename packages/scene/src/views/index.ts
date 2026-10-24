// Every lens Atlas has a view for, by preset id. A preset listed here should
// be `atlas: true` in the catalog; views.test.ts keeps the two in step.

import { ageView } from './age';
import { aiCoauthorsView } from './aiCoauthors';
import { churnView } from './churn';
import { commitTimingView } from './commitTiming';
import { contributorsView } from './contributors';
import { couplingView } from './coupling';
import { fixRateView } from './fixRate';
import { hotspotsView } from './hotspots';
import { overviewView } from './overview';
import { ownershipView } from './ownership';
import { parallelDevView } from './parallelDev';
import { riskView } from './risk';
import type { AnalyzerView } from '../model';

export const VIEWS: ReadonlyMap<string, AnalyzerView> = new Map([
  ['overview', overviewView],
  ['hotspots', hotspotsView],
  ['churn', churnView],
  ['cursed-files', riskView],
  ['age-map', ageView],
  ['fix-rate', fixRateView],
  ['bus-factor', ownershipView],
  ['coupling', couplingView],
  ['contributors', contributorsView],
  ['parallel-dev', parallelDevView],
  ['commit-timing', commitTimingView],
  ['co-authors', aiCoauthorsView],
]);
