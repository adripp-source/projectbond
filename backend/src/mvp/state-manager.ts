/**
 * ProjectBond State Manager (Fixed - Scan Sessions)
 * 
 * Unified source of truth for all MVP state.
 * Preserves complete scan history. NO overwrites.
 * Metrics aggregate across all sessions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'crypto';

export interface IssueEvidence {
  type: 'hidden_cta' | 'dead_click' | 'infinite_loading' | 'form_failure' | 'nav_failure';
  severity: 'critical' | 'high' | 'medium';
  confidence: 'verified' | 'strong' | 'possible';
  title: string;
  description: string;
  isRealFinding: boolean;
  workflowImpact: string;
}

export interface ScanSession {
  scanId: string;
  url: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  device: string;
  browser: string;
  pagesScanned: number;
  issues: IssueEvidence[];
  reportPath: string;
  status: 'completed' | 'failed' | 'pending';
  notes?: string;
}

export interface ProjectState {
  project: string;
  phase: number;
  status: string;
  lastUpdated: string;
  core: {
    goal: string;
    focus: string;
    stage: string;
  };
  testing: {
    phase: string;
    command: string;
    targetCount: number;
    scanSessions: ScanSession[];
  };
  validation: {
    metrics: {
      total_scans: number;
      total_real_findings: number;
      total_false_positives: number;
      workflow_breakages_found: number;
      critical_user_blockages_found: number;
      scans_with_useful_findings: number;
      scans_with_zero_useful_findings: number;
      false_positive_rate: number;
      average_findings_per_site: number;
      workflow_types_detected: string[];
      unique_urls_tested: number;
    };
    confidence_distribution: {
      verified: number;
      strong: number;
      possible: number;
    };
    issue_severity_distribution: {
      critical: number;
      high: number;
      medium: number;
    };
    issue_type_breakdown: Record<
      string,
      {
        count: number;
        real_findings: number;
        false_positives: number;
      }
    >;
    trust_indicators: {
      highest_confidence_findings: string[];
      evidence_quality_score: number;
      reliability_score: number;
      trust_score: number;
    };
  };
}

const STATE_FILE = path.join(process.cwd(), 'PROJECTBOND-STATE.json');

/**
 * Load current state
 */
export function loadState(): ProjectState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn('Could not load state file, using defaults');
  }

  return getDefaultState();
}

/**
 * Calculate all metrics from ALL scan sessions (never overwrites, aggregates)
 */
function calculateMetrics(scanSessions: ScanSession[]): any {
  if (scanSessions.length === 0) {
    return getDefaultMetrics();
  }

  let totalRealFindings = 0;
  let totalFalsePositives = 0;
  let workflowBreakages = 0;
  let criticalBlockages = 0;
  let scansWithUseful = 0;
  let scansWithZero = 0;
  const workflowTypesSet = new Set<string>();
  const urlsTestedSet = new Set<string>();
  const confidenceDistribution = { verified: 0, strong: 0, possible: 0 };
  const severityDistribution = { critical: 0, high: 0, medium: 0 };
  const issueTypeBreakdown: Record<
    string,
    { count: number; real_findings: number; false_positives: number }
  > = {
    hidden_cta: { count: 0, real_findings: 0, false_positives: 0 },
    dead_click: { count: 0, real_findings: 0, false_positives: 0 },
    infinite_loading: { count: 0, real_findings: 0, false_positives: 0 },
    form_failure: { count: 0, real_findings: 0, false_positives: 0 },
    nav_failure: { count: 0, real_findings: 0, false_positives: 0 },
  };
  const highestConfidenceFindings: string[] = [];

  // Process EVERY scan session (never skip, never overwrite)
  scanSessions.forEach((session) => {
    urlsTestedSet.add(session.url);
    let usefulInThisScan = 0;

    session.issues.forEach((issue) => {
      // Count by type
      if (issueTypeBreakdown[issue.type]) {
        issueTypeBreakdown[issue.type].count++;

        if (issue.isRealFinding) {
          issueTypeBreakdown[issue.type].real_findings++;
          totalRealFindings++;
          usefulInThisScan++;
        } else {
          issueTypeBreakdown[issue.type].false_positives++;
          totalFalsePositives++;
        }
      }

      // Count by confidence
      confidenceDistribution[issue.confidence]++;

      // Count by severity
      severityDistribution[issue.severity]++;

      // Track verified high-confidence findings
      if (issue.confidence === 'verified' && issue.isRealFinding) {
        highestConfidenceFindings.push(`${issue.title} (${session.url})`);
      }

      // Track workflow impact
      if (issue.workflowImpact) {
        workflowTypesSet.add(issue.workflowImpact);
      }

      // Count blocking issues
      if (issue.isRealFinding && issue.severity === 'critical') {
        criticalBlockages++;
        if (
          issue.type === 'hidden_cta' ||
          issue.type === 'dead_click' ||
          issue.type === 'infinite_loading'
        ) {
          workflowBreakages++;
        }
      }
    });

    // Track scans with/without useful findings
    if (usefulInThisScan > 0) {
      scansWithUseful++;
    } else {
      scansWithZero++;
    }
  });

  const totalScans = scanSessions.length;
  const uniqueUrls = urlsTestedSet.size;
  const falsePositiveRate =
    totalRealFindings + totalFalsePositives > 0
      ? (totalFalsePositives / (totalRealFindings + totalFalsePositives)) * 100
      : 0;

  const averageFindingsPerSite = uniqueUrls > 0 ? totalRealFindings / uniqueUrls : 0;

  // Calculate trust score
  const evidenceQualityScore =
    totalScans > 0 && confidenceDistribution.verified / totalScans > 0.5 ? 85 : 60;
  const reliabilityScore = 100 - Math.min(falsePositiveRate, 100);
  const trustScore = (evidenceQualityScore + reliabilityScore) / 2;

  return {
    metrics: {
      total_scans: totalScans,
      total_real_findings: totalRealFindings,
      total_false_positives: totalFalsePositives,
      workflow_breakages_found: workflowBreakages,
      critical_user_blockages_found: criticalBlockages,
      scans_with_useful_findings: scansWithUseful,
      scans_with_zero_useful_findings: scansWithZero,
      false_positive_rate: Math.round(falsePositiveRate * 100) / 100,
      average_findings_per_site: Math.round(averageFindingsPerSite * 100) / 100,
      workflow_types_detected: Array.from(workflowTypesSet),
      unique_urls_tested: uniqueUrls,
    },
    confidence_distribution: confidenceDistribution,
    issue_severity_distribution: severityDistribution,
    issue_type_breakdown: issueTypeBreakdown,
    trust_indicators: {
      highest_confidence_findings: highestConfidenceFindings.slice(0, 5),
      evidence_quality_score: Math.round(evidenceQualityScore),
      reliability_score: Math.round(reliabilityScore),
      trust_score: Math.round(trustScore),
    },
  };
}

/**
 * Save state with auto-calculated metrics
 */
export function saveState(state: ProjectState): void {
  // Recalculate all metrics from ALL scan sessions
  const newValidation = calculateMetrics(state.testing.scanSessions);
  state.validation = newValidation;
  state.lastUpdated = new Date().toISOString();

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Record a new scan session (NEVER overwrites, ALWAYS appends)
 */
export function recordScanSession(session: Omit<ScanSession, 'scanId' | 'createdAt' | 'updatedAt'>): ScanSession {
  const state = loadState();

  // Create new scan session with unique ID
  const newSession: ScanSession = {
    scanId: generateScanId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...session,
    status: 'completed',
  };

  // APPEND to history, DO NOT replace
  state.testing.scanSessions.push(newSession);

  // Save and recalculate
  saveState(state);

  // Print progress
  printScanRecorded(newSession, state);

  return newSession;
}

/**
 * Get latest scan for a URL
 */
export function getLatestScanForUrl(url: string): ScanSession | null {
  const state = loadState();
  const scansForUrl = state.testing.scanSessions.filter((s) => s.url === url);
  if (scansForUrl.length === 0) return null;
  return scansForUrl[scansForUrl.length - 1]; // Most recent
}

/**
 * Get all scans for a URL (full history)
 */
export function getScanHistoryForUrl(url: string): ScanSession[] {
  const state = loadState();
  return state.testing.scanSessions.filter((s) => s.url === url);
}

/**
 * Get all scan sessions
 */
export function getAllScanSessions(): ScanSession[] {
  const state = loadState();
  return state.testing.scanSessions;
}

/**
 * Get current progress metrics
 */
export function getProgress(): {
  totalScans: number;
  uniqueUrls: number;
  target: number;
  percent: number;
  realFindings: number;
  falsePositives: number;
  falsePositiveRate: number;
  criticalBlockages: number;
  workflowBreakages: number;
  trustScore: number;
  averageFindingsPerSite: number;
} {
  const state = loadState();
  const totalScans = state.testing.scanSessions.length;
  const uniqueUrls = state.validation.metrics.unique_urls_tested;
  const target = state.testing.targetCount;
  const percent = Math.round((uniqueUrls / target) * 100);

  return {
    totalScans,
    uniqueUrls,
    target,
    percent,
    realFindings: state.validation.metrics.total_real_findings,
    falsePositives: state.validation.metrics.total_false_positives,
    falsePositiveRate: state.validation.metrics.false_positive_rate,
    criticalBlockages: state.validation.metrics.critical_user_blockages_found,
    workflowBreakages: state.validation.metrics.workflow_breakages_found,
    trustScore: state.validation.trust_indicators.trust_score,
    averageFindingsPerSite: state.validation.metrics.average_findings_per_site,
  };
}

/**
 * Get status summary
 */
export function getStatusSummary(): string {
  const progress = getProgress();
  const state = loadState();

  return `
ProjectBond MVP Validation Status
${'-'.repeat(70)}
Phase: ${state.phase} | Status: ${state.status}
Last Updated: ${new Date(state.lastUpdated).toLocaleString()}

PROGRESS
  Total scans: ${progress.totalScans}
  Unique URLs tested: ${progress.uniqueUrls}/${progress.target} (${progress.percent}%)

REAL FINDINGS (What Actually Matters)
  Real workflow issues: ${progress.realFindings}
  Critical user blockages: ${progress.criticalBlockages}
  Workflow breakages: ${progress.workflowBreakages}
  False positives: ${progress.falsePositives}

QUALITY METRICS
  False positive rate: ${progress.falsePositiveRate}%
  Average findings per site: ${progress.averageFindingsPerSite}
  Trust score: ${progress.trustScore}/100
  Sites with useful findings: ${state.validation.metrics.scans_with_useful_findings}

OPTIMIZATION
  NOT measured by: scan count, issue count, technical filler
  MEASURED by: real workflow value, trust, reliability

${'-'.repeat(70)}
`;
}

/**
 * Utilities
 */

function generateScanId(): string {
  // Simple unique ID: timestamp + random
  return `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function printScanRecorded(session: ScanSession, state: ProjectState): void {
  const progress = getProgress();
  console.log(`\n✓ Scan session recorded (ID: ${session.scanId})`);
  console.log(`✓ URL: ${session.url}`);
  console.log(`✓ Issues detected: ${session.issues.length}`);
  console.log(
    `✓ Progress: ${progress.uniqueUrls}/${progress.target} unique URLs (${progress.percent}%)`
  );
  console.log(`✓ Total scans in history: ${progress.totalScans}`);
  console.log(`✓ Real findings: ${progress.realFindings}`);
  console.log(`✓ False positive rate: ${progress.falsePositiveRate}%`);
  console.log(`✓ Trust score: ${progress.trustScore}/100`);
}

function getDefaultState(): ProjectState {
  return {
    project: 'ProjectBond',
    phase: 2,
    status: 'MVP - Real-world validation testing',
    lastUpdated: new Date().toISOString(),
    core: {
      goal: 'Find one undeniable workflow-breaking issue automatically with proof',
      focus:
        'Reliability over intelligence. False negatives over false positives.',
      stage: 'Real-world validation testing',
    },
    testing: {
      phase: 'Real-world validation',
      command: 'npm run scan <url>',
      targetCount: 20,
      scanSessions: [],
    },
    validation: getDefaultMetrics(),
  };
}

function getDefaultMetrics() {
  return {
    metrics: {
      total_scans: 0,
      total_real_findings: 0,
      total_false_positives: 0,
      workflow_breakages_found: 0,
      critical_user_blockages_found: 0,
      scans_with_useful_findings: 0,
      scans_with_zero_useful_findings: 0,
      false_positive_rate: 0,
      average_findings_per_site: 0,
      workflow_types_detected: [],
      unique_urls_tested: 0,
    },
    confidence_distribution: {
      verified: 0,
      strong: 0,
      possible: 0,
    },
    issue_severity_distribution: {
      critical: 0,
      high: 0,
      medium: 0,
    },
    issue_type_breakdown: {
      hidden_cta: { count: 0, real_findings: 0, false_positives: 0 },
      dead_click: { count: 0, real_findings: 0, false_positives: 0 },
      infinite_loading: { count: 0, real_findings: 0, false_positives: 0 },
      form_failure: { count: 0, real_findings: 0, false_positives: 0 },
      nav_failure: { count: 0, real_findings: 0, false_positives: 0 },
    },
    trust_indicators: {
      highest_confidence_findings: [],
      evidence_quality_score: 0,
      reliability_score: 0,
      trust_score: 0,
    },
  };
}
