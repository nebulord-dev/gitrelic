// Every lens Atlas has a view for, by preset id. A preset listed here should
// be `atlas: true` in the catalog; views.test.ts keeps the two in step.

import { aiCoauthorsView } from './aiCoauthors';
import { churnView } from './churn';
import { commitTimingView } from './commitTiming';
import { contributorsView } from './contributors';
import { fixRateView } from './fixRate';
import { hotspotsView } from './hotspots';
import { overviewView } from './overview';
import { parallelDevView } from './parallelDev';
import { riskView } from './risk';
import type { AnalyzerView } from '../model';

export const VIEWS: ReadonlyMap<string, AnalyzerView> = new Map([
  ['overview', overviewView],
  ['hotspots', hotspotsView],
  ['churn', churnView],
  ['cursed-files', riskView],
  ['fix-rate', fixRateView],
  ['contributors', contributorsView],
  ['parallel-dev', parallelDevView],
  ['commit-timing', commitTimingView],
  ['co-authors', aiCoauthorsView],
]);
