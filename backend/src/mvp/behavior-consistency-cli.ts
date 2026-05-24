/**
 * CLI Integration - Behavior Consistency Scanner
 * 
 * Quietly added as an add-on layer.
 * Runs automatically after main scan.
 * Reports only meaningful behavior changes.
 */

import { Page } from 'playwright';
import {
  BehaviorSnapshotter,
  BehaviorComparator,
  formatBehaviorChangeReport,
} from './behavior-consistency';
import { SnapshotManager } from './snapshot-store';

/**
 * Run behavior consistency checks as an add-on
 */
export async function runBehaviorConsistencyChecks(
  page: Page,
  url: string,
  scanId: string
): Promise<{
  changes: any[];
  report: string;
}> {
  const snapshotter = new BehaviorSnapshotter();
  const comparator = new BehaviorComparator();
  const snapshotStore = new SnapshotManager();

  try {
    // Capture current behavior
    const currentSnapshot = await snapshotter.capturePageBehavior(page, scanId, url);

    // Get previous snapshot
    const previousSnapshot = snapshotStore.getLatestSnapshotForUrl(url);

    // Save current snapshot
    snapshotStore.saveSnapshot(scanId, url, currentSnapshot);

    // If no previous snapshot, nothing to compare
    if (!previousSnapshot) {
      return {
        changes: [],
        report: '✓ First scan - baseline established for future comparisons',
      };
    }

    // Compare and detect changes
    const changes = comparator.compareSnapshots(previousSnapshot, currentSnapshot);

    // Format report
    const report = formatBehaviorChangeReport(changes);

    return { changes, report };
  } catch (e) {
    return {
      changes: [],
      report: `Note: Behavior consistency check skipped (${(e as Error).message})`,
    };
  }
}

/**
 * Print behavior consistency results
 */
export function printBehaviorConsistencyResults(report: string): void {
  if (report.includes('No behavior changes')) {
    console.log(report);
  } else {
    console.log(report);
  }
}
