// Every lens Atlas has a view for, by preset id. A preset listed here should
// be `atlas: true` in the catalog; views.test.ts keeps the two in step.

import { churnView } from './churn';
import { hotspotsView } from './hotspots';
import { overviewView } from './overview';
import type { AnalyzerView } from '../model';

export const VIEWS: ReadonlyMap<string, AnalyzerView> = new Map([
  ['overview', overviewView],
  ['hotspots', hotspotsView],
  ['churn', churnView],
]);
