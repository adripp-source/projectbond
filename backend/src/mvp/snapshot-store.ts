/**
 * Snapshot Store — local JSON persistence for behavior snapshots.
 *
 * Stores one snapshot per scan, indexed by URL, in /snapshots.
 * No DB. No external services. Deterministic. Bias to false negatives.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { BehaviorSnapshot } from './behavior-consistency';

const SNAPSHOT_DIR = path.join(process.cwd(), 'snapshots');

function ensureDir(): void {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

function urlKey(url: string): string {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
}

export class SnapshotManager {
  saveSnapshot(scanId: string, url: string, snapshot: BehaviorSnapshot): string {
    ensureDir();
    const file = path.join(
      SNAPSHOT_DIR,
      `${urlKey(url)}-${Date.now()}-${scanId.slice(0, 8)}.json`
    );
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
    return file;
  }

  getLatestSnapshotForUrl(url: string): BehaviorSnapshot | null {
    ensureDir();
    const key = urlKey(url);
    const files = fs
      .readdirSync(SNAPSHOT_DIR)
      .filter((f) => f.startsWith(key) && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    try {
      const raw = fs.readFileSync(path.join(SNAPSHOT_DIR, files[0]), 'utf-8');
      return JSON.parse(raw) as BehaviorSnapshot;
    } catch {
      return null;
    }
  }

  listSnapshotsForUrl(url: string): string[] {
    ensureDir();
    const key = urlKey(url);
    return fs
      .readdirSync(SNAPSHOT_DIR)
      .filter((f) => f.startsWith(key) && f.endsWith('.json'))
      .sort();
  }
}
