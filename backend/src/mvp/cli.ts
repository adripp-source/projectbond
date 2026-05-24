/**
 * ProjectBond MVP CLI Entry Point (Updated for Scan Sessions)
 * 
 * Now creates scan sessions with unique IDs.
 * Never overwrites. Preserves complete history.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  DiscoveryEngine,
  PlaywrightRunner,
  SafeInteractionEngine,
  IssueDetectionEngine,
  generateReport,
  saveReport,
} from './scanner';
import { recordScanSession, getLatestScanForUrl, getStatusSummary } from './state-manager';
import {
  runBehaviorConsistencyChecks,
  printBehaviorConsistencyResults,
} from './behavior-consistency-cli';
import { randomUUID } from 'crypto';

// ============================================================================
// UTILITIES
// ============================================================================

function validateURL(urlString: string): URL {
  try {
    const url = new URL(urlString);
    if (!url.protocol.startsWith('http')) {
      throw new Error('URL must start with http:// or https://');
    }
    return url;
  } catch (e) {
    throw new Error(`Invalid URL: ${urlString}. ${(e as Error).message}`);
  }
}

function createArtifactDirectory(): string {
  const dir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function createReportDirectory(): string {
  const dir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function printHeader(url: string): void {
  console.log('\n' + '='.repeat(70));
  console.log('ProjectBond MVP Scanner');
  console.log('='.repeat(70));
  console.log(`URL: ${url}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(70) + '\n');
}

function printSummary(
  url: string,
  pagesScanned: number,
  ctasFound: number,
  safeInteractionsTested: number,
  issuesFound: number,
  reportPath: string
): void {
  console.log('\n' + '='.repeat(70));
  console.log('SCAN COMPLETE');
  console.log('='.repeat(70));
  console.log(`✓ URL scanned:              ${url}`);
  console.log(`✓ Pages checked:            ${pagesScanned}`);
  console.log(`✓ CTAs found:               ${ctasFound}`);
  console.log(`✓ Safe interactions tested: ${safeInteractionsTested}`);
  console.log(`✓ Issues found:             ${issuesFound}`);
  console.log(`✓ Report saved:             ${reportPath}`);
  console.log('='.repeat(70) + '\n');
}

function printErrorSummary(error: string): void {
  console.log('\n' + '='.repeat(70));
  console.log('SCAN FAILED');
  console.log('='.repeat(70));
  console.log(`✗ Error: ${error}`);
  console.log('='.repeat(70) + '\n');
}

// ============================================================================
// MAIN ORCHESTRATOR (UPDATED FOR SCAN SESSIONS)
// ============================================================================

async function runScan(urlString: string): Promise<void> {
  let url: URL;

  try {
    url = validateURL(urlString);
  } catch (e) {
    printErrorSummary((e as Error).message);
    process.exit(1);
  }

  printHeader(url.toString());

  const artifactDir = createArtifactDirectory();
  const reportDir = createReportDirectory();

  const runner = new PlaywrightRunner();
  const discoveryEngine = new DiscoveryEngine();
  const interactionEngine = new SafeInteractionEngine();
  const issueEngine = new IssueDetectionEngine();

  let ctasFound = 0;
  let safeInteractionsTested = 0;
  let allIssues: any[] = [];

  try {
    // Initialize Playwright
    console.log('📦 Initializing browser...');
    await runner.initialize();

    // Render homepage
    console.log(`📄 Rendering homepage: ${url.toString()}`);
    const renderResult = await runner.renderPage(url.toString());

    if (!renderResult.success) {
      throw new Error(`Failed to render page: ${renderResult.error}`);
    }

    console.log(`✓ Page rendered in ${renderResult.loadTime}ms`);
    if (renderResult.consoleErrors.length > 0) {
      console.log(`⚠ Console errors: ${renderResult.consoleErrors.length}`);
    }
    if (renderResult.failedRequests.length > 0) {
      console.log(`⚠ Failed requests: ${renderResult.failedRequests.length}`);
    }

    // Discover page content
    console.log('🔍 Discovering page structure...');

    const page = runner.getPage();
    const discoveredPage = await discoveryEngine.discoverFromPage(page, url.toString());

    console.log(`✓ Discovered ${discoveredPage.links.length} navigation links`);
    console.log(`✓ Found ${discoveredPage.buttons.length} buttons/CTAs`);
    console.log(`✓ Found ${discoveredPage.forms.length} forms`);

    ctasFound = discoveredPage.buttons.length;

    // Classify and test safe interactions
    console.log('\n🔐 Testing safe interactions...');
    const safeButtons = discoveredPage.buttons.filter((btn) => btn.isSafe);
    console.log(`✓ Safe CTAs to test: ${safeButtons.length}`);

    for (const button of safeButtons) {
      const classification = interactionEngine.classifyInteraction(button.text);
      if (classification.safe) {
        const isClickable = await interactionEngine.isCTAClickable(page, button.selector);
        if (isClickable) {
          safeInteractionsTested++;
          console.log(`  ✓ Can test: "${button.text}"`);
        } else {
          console.log(`  ⚠ Cannot click: "${button.text}" (not visible or disabled)`);
        }
      }
    }

    // Detect issues
    console.log('\n🚨 Detecting workflow issues...');

    for (const button of safeButtons) {
      const hiddenIssue = await issueEngine.detectHiddenCTA(
        page,
        button.text,
        button.selector,
        renderResult.screenshotPath || ''
      );
      if (hiddenIssue) {
        allIssues.push(hiddenIssue);
        console.log(`  🔴 CRITICAL: ${hiddenIssue.title}`);
      }
    }

    for (const button of safeButtons) {
      const isClickable = await interactionEngine.isCTAClickable(page, button.selector);
      if (isClickable) {
        const deadClickIssue = await issueEngine.detectDeadClick(
          page,
          button.selector,
          button.text,
          renderResult.screenshotPath || ''
        );
        if (deadClickIssue) {
          allIssues.push(deadClickIssue);
          console.log(`  🟠 HIGH: ${deadClickIssue.title}`);
        }
      }
    }

    const infiniteLoadIssue = await issueEngine.detectInfiniteLoading(
      page,
      renderResult.screenshotPath || ''
    );
    if (infiniteLoadIssue) {
      allIssues.push(infiniteLoadIssue);
      console.log(`  🔴 CRITICAL: ${infiniteLoadIssue.title}`);
    }

    const formFailureIssue = await issueEngine.detectFormFailure(
      page,
      renderResult.screenshotPath || '',
      renderResult.consoleErrors
    );
    if (formFailureIssue) {
      allIssues.push(formFailureIssue);
      console.log(`  🟠 HIGH: ${formFailureIssue.title}`);
    }

    const navFailureIssue = await issueEngine.detectNavigationFailure(
      page,
      renderResult.screenshotPath || '',
      renderResult.failedRequests
    );
    if (navFailureIssue) {
      allIssues.push(navFailureIssue);
      console.log(`  🟠 HIGH: ${navFailureIssue.title}`);
    }

    if (allIssues.length === 0) {
      console.log('  ✓ No issues detected on homepage');
    }

    // Generate report
    console.log('\n📝 Generating report...');
    const report = generateReport(url.toString(), [discoveredPage], allIssues);

    const reportPath = path.join(reportDir, `report-${Date.now()}.json`);
    saveReport(report, reportPath);

    // Record as scan session (with unique ID, never overwrites)
    console.log('\n📊 Recording scan session...');
    const issues = allIssues.map((issue) => ({
      type: issue.type,
      severity: issue.severity,
      confidence: issue.confidence,
      title: issue.title,
      description: issue.description,
      isRealFinding: true, // Default: user can mark as false positive later
      workflowImpact: 'general', // Default: can be refined
    }));

    recordScanSession({
      url: url.toString(),
      timestamp: new Date().toISOString(),
      device: 'iPhone 12 (375x812)',
      browser: 'Chromium (WebKit-like)',
      pagesScanned: 1,
      issues,
      reportPath,
    });

    // Cleanup
    await runner.shutdown();

    // Print summary
    printSummary(
      url.toString(),
      1,
      ctasFound,
      safeInteractionsTested,
      allIssues.length,
      reportPath
    );

    // Print current status
    console.log(getStatusSummary());

    // Print detailed findings
    if (allIssues.length > 0) {
      console.log('\n📋 FINDINGS:\n');
      allIssues.forEach((issue, idx) => {
        console.log(`${idx + 1}. ${issue.title}`);
        console.log(`   Severity: ${issue.severity.toUpperCase()}`);
        console.log(`   Confidence: ${issue.confidence}`);
        console.log(`   Page: ${issue.page}`);
        console.log(`   Description: ${issue.description}`);
        if (issue.evidence.consoleErrors.length > 0) {
          console.log(`   Errors:`);
          issue.evidence.consoleErrors.forEach((err: string) => {
            console.log(`     - ${err}`);
          });
        }
        console.log();
      });
    }
  } catch (e) {
    const error = (e as Error).message || String(e);
    printErrorSummary(error);
    await runner.shutdown();
    process.exit(1);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

const urlArg = process.argv[2];

if (!urlArg) {
  console.error('❌ Usage: npm run scan <url>');
  console.error('Example: npm run scan https://example.com');
  console.log(getStatusSummary());
  process.exit(1);
}

runScan(urlArg).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
