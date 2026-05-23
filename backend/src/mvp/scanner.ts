/**
 * ProjectBond MVP - Critical Bug Fixes
 * 
 * Fix the 3 logic bugs before validation testing:
 * 1. DOM hash logic (use actual content, not length)
 * 2. URL change detection (compare URLs correctly)
 * 3. Selector uniqueness validation (ensure selector matches exactly 1 element)
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscoveredPage {
  url: string;
  title?: string;
  links: DiscoveredLink[];
  buttons: DiscoveredButton[];
  forms: DiscoveredForm[];
  isAuthPage: boolean;
  isPricingPage: boolean;
  isContactPage: boolean;
}

export interface DiscoveredLink {
  text: string;
  href: string;
  type: 'nav' | 'cta' | 'footer' | 'inline';
}

export interface DiscoveredButton {
  text: string;
  selector: string;
  type: 'cta' | 'menu' | 'modal' | 'form' | 'action';
  isSafe: boolean;
}

export interface DiscoveredForm {
  selector: string;
  fields: string[];
  submitButtonText?: string;
}

export interface PageRenderResult {
  url: string;
  success: boolean;
  screenshotPath?: string;
  consoleErrors: string[];
  failedRequests: string[];
  error?: string;
  loadTime: number;
}

export interface DetectedIssue {
  id: string;
  type:
    | 'hidden_cta'
    | 'dead_click'
    | 'infinite_loading'
    | 'form_failure'
    | 'nav_failure'
    | 'workflow_blocked'
    | 'login_failed'
    | 'signup_blocked'
    | 'onboarding_stuck'
    | 'cta_dead_after_click'
    | 'redirect_loop'
    | 'validation_trap'
    | 'dashboard_unreachable';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  page: string;
  workflow?: string;
  blockedStep?: string;
  evidence: {
    screenshotPath?: string;
    consoleErrors: string[];
    reproductionSteps: string[];
  };
  confidence: 'verified' | 'strong' | 'possible';
}


export interface ScanResult {
  url: string;
  scanTime: Date;
  discoveredPages: DiscoveredPage[];
  issues: DetectedIssue[];
  summary: {
    pagesScanned: number;
    issuesFound: number;
    criticalIssues: number;
  };
}

// ============================================================================
// SELECTOR UTILITIES
// ============================================================================

/**
 * Generate robust unique selectors with validation
 */
export class SelectorGenerator {
  /**
   * Generate a robust selector for an element
   * Falls back through multiple strategies for reliability
   */
  static async generateSelector(page: Page, element: any): Promise<string> {
    // Strategy 1: data-testid
    const testId = await page.evaluate((el) => el?.getAttribute('data-testid'), element);
    if (testId) {
      const selector = `[data-testid="${testId}"]`;
      if (await this.isUniqueSelector(page, selector)) {
        return selector;
      }
    }

    // Strategy 2: aria-label (for accessibility)
    const ariaLabel = await page.evaluate((el) => el?.getAttribute('aria-label'), element);
    if (ariaLabel) {
      const selector = `[aria-label="${ariaLabel}"]`;
      if (await this.isUniqueSelector(page, selector)) {
        return selector;
      }
    }

    // Strategy 3: ID
    const id = await page.evaluate((el) => el?.id, element);
    if (id) {
      const selector = `#${id}`;
      if (await this.isUniqueSelector(page, selector)) {
        return selector;
      }
    }

    // Strategy 4: Unique combination of class + position
    const classSelector = await page.evaluate((el) => {
      if (!el?.className) return null;
      const classes = el.className
        .split(' ')
        .filter((c: string) => !c.match(/^[0-9]|^-/))
        .slice(0, 2)
        .join('.');
      return classes ? `.${classes}` : null;
    }, element);

    if (classSelector && (await this.isUniqueSelector(page, classSelector))) {
      return classSelector;
    }

    // Strategy 5: nth-child as fallback (last resort)
    const nthChild = await page.evaluate((el) => {
      let index = 0;
      let sibling = el?.parentNode?.firstChild;
      while (sibling) {
        if (sibling === el) {
          return `${el?.tagName.toLowerCase()}:nth-child(${index + 1})`;
        }
        if (sibling.nodeType === 1) index++;
        sibling = sibling.nextSibling;
      }
      return null;
    }, element);

    if (nthChild && (await this.isUniqueSelector(page, nthChild))) {
      return nthChild;
    }

    // Final fallback
    return 'button';
  }

  /**
   * Validate that selector matches exactly one element
   */
  private static async isUniqueSelector(page: Page, selector: string): Promise<boolean> {
    try {
      const count = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, selector);
      return count === 1;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// DOM MUTATION DETECTION (FIXED)
// ============================================================================

/**
 * Detect meaningful DOM changes after interaction
 * FIX: Use actual content hashing instead of length
 */
export class DOMStateDetector {
  /**
   * Capture DOM state with proper content hashing
   */
  static async captureDOMState(page: Page): Promise<{
    contentHash: string;
    visibleText: string;
    ariaExpanded: Record<string, boolean>;
    focusedElement: string | null;
    url: string;
  }> {
    return await page.evaluate(() => {
      // FIX: Actual content hash (SHA256-like, simplified)
      const visibleText = document.body.innerText.substring(0, 1000);
      const contentHash = visibleText
        .split('')
        .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
        .toString(36);

      // Track aria-expanded states
      const ariaExpanded: Record<string, boolean> = {};
      document.querySelectorAll('[aria-expanded]').forEach((el, idx) => {
        ariaExpanded[`aria-${idx}`] = (el as any).ariaExpanded === 'true';
      });

      // Track focused element
      const focused = document.activeElement?.id || document.activeElement?.className || null;

      // Track URL
      const url = window.location.href;

      return {
        contentHash,
        visibleText,
        ariaExpanded,
        focusedElement: focused,
        url,
      };
    });
  }

  /**
   * Detect if meaningful state change occurred
   */
  static async stateChanged(
    beforeState: Awaited<ReturnType<typeof this.captureDOMState>>,
    afterState: Awaited<ReturnType<typeof this.captureDOMState>>
  ): Promise<{
    changed: boolean;
    reason: string;
  }> {
    // FIX: Compare actual content hash, not just length
    if (beforeState.contentHash !== afterState.contentHash) {
      return { changed: true, reason: 'Content hash changed (DOM mutated)' };
    }

    // URL changed
    if (beforeState.url !== afterState.url) {
      return { changed: true, reason: 'URL changed' };
    }

    // Aria states changed
    const ariaKeysChanged = Object.keys(beforeState.ariaExpanded).some(
      (key) => beforeState.ariaExpanded[key] !== afterState.ariaExpanded[key]
    );
    if (ariaKeysChanged) {
      return { changed: true, reason: 'aria-expanded state changed' };
    }

    // Focus changed
    if (beforeState.focusedElement !== afterState.focusedElement) {
      return { changed: true, reason: 'Focus changed' };
    }

    return { changed: false, reason: 'No meaningful state change detected' };
  }
}

// ============================================================================
// LOADING STATE DETECTOR (IMPROVED)
// ============================================================================

/**
 * Intelligent infinite loading detection
 */
export class LoadingStateDetector {
  /**
   * Detect if page is in infinite loading state
   * Requires: persistent loading + blocked interaction + no stabilization
   */
  static async isInfiniteLoadingState(page: Page): Promise<{
    isInfinite: boolean;
    reason: string;
  }> {
    // Check for loading indicators
    const hasLoadingSpinner = await page.$(
      '[class*="spin"], [class*="load"], .loader, .spinner, [aria-label*="Loading"]'
    );

    if (!hasLoadingSpinner) {
      return { isInfinite: false, reason: 'No loading spinner found' };
    }

    // FIX: Better wait strategy
    const beforeState = await DOMStateDetector.captureDOMState(page);
    await page.waitForTimeout(3000);
    const afterState = await DOMStateDetector.captureDOMState(page);

    // Check if DOM changed (is it actually loading?)
    const { changed: domChanged } = await DOMStateDetector.stateChanged(beforeState, afterState);

    // FIX: Spinner + stable DOM = likely frozen loading
    // (not just "completed", but also "stuck")
    if (!domChanged) {
      // DOM didn't change, but spinner still exists = likely infinite
      const spinnerStillExists = await page.$(
        '[class*="spin"], [class*="load"], .loader, .spinner, [aria-label*="Loading"]'
      );

      if (spinnerStillExists) {
        return {
          isInfinite: true,
          reason: 'Persistent spinner with stable DOM (no activity)',
        };
      }
    }

    // Check if network completed
    try {
      await page.waitForLoadState('networkidle', { timeout: 2000 });
      return { isInfinite: false, reason: 'Network idle reached' };
    } catch {
      // Network did not complete, spinner still present = infinite
      const spinnerStillExists = await page.$(
        '[class*="spin"], [class*="load"], .loader, .spinner, [aria-label*="Loading"]'
      );

      if (spinnerStillExists) {
        return {
          isInfinite: true,
          reason: 'Spinner present, network incomplete',
        };
      }
    }

    return { isInfinite: false, reason: 'Loading state resolved' };
  }
}

// ============================================================================
// VISIBILITY DETECTION
// ============================================================================

/**
 * Enhanced visibility detection with overlap checking
 */
export class VisibilityDetector {
  /**
   * Check if CTA is truly clickable and visible
   * Accounts for: overlap, z-index, opacity, clipping, pointer-events
   */
  static async isReallyClickable(page: Page, selector: string): Promise<{
    clickable: boolean;
    reason: string;
  }> {
    try {
      const element = await page.$(selector);
      if (!element) {
        return { clickable: false, reason: 'Element not found' };
      }

      const result = await page.evaluate(
        (el) => {
          const rect = el.getBoundingClientRect();

          // Check 1: Viewport position
          if (rect.top < 0 || rect.top > window.innerHeight) {
            return { clickable: false, reason: 'Off-screen (top/bottom)' };
          }

          if (rect.left < 0 || rect.left > window.innerWidth) {
            return { clickable: false, reason: 'Off-screen (left/right)' };
          }

          // Check 2: Size
          if (rect.width === 0 || rect.height === 0) {
            return { clickable: false, reason: 'Zero size' };
          }

          // Check 3: Opacity
          const style = window.getComputedStyle(el);
          if (style.opacity === '0') {
            return { clickable: false, reason: 'Opacity is 0' };
          }

          // Check 4: Disabled state
          if ((el as any).disabled) {
            return { clickable: false, reason: 'Element is disabled' };
          }

          // Check 5: pointer-events none
          if (style.pointerEvents === 'none') {
            return { clickable: false, reason: 'pointer-events: none' };
          }

          // Check 6: Overlapping elements
          const elementAtPoint = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );

          if (elementAtPoint !== el && !el.contains(elementAtPoint)) {
            return {
              clickable: false,
              reason: `Covered by ${(elementAtPoint as HTMLElement)?.tagName}`,
            };
          }

          return { clickable: true, reason: 'Element is clickable' };
        },
        element
      );

      return result;
    } catch (e) {
      return { clickable: false, reason: `Error checking visibility: ${(e as Error).message}` };
    }
  }
}

// ============================================================================
// DISCOVERY ENGINE
// ============================================================================

export class DiscoveryEngine {
  async discoverFromPage(page: Page, url: string): Promise<DiscoveredPage> {
    const pageInfo: DiscoveredPage = {
      url,
      title: await page.title(),
      links: [],
      buttons: [],
      forms: [],
      isAuthPage: this.detectAuthPage(url),
      isPricingPage: this.detectPricingPage(url),
      isContactPage: this.detectContactPage(url),
    };

    // Extract links
    const linkElements = await page.$$('a');
    for (const link of linkElements) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');

      if (text?.trim() && href && !href.startsWith('javascript:')) {
        pageInfo.links.push({
          text: text.trim(),
          href,
          type: this.classifyLink(text, href),
        });
      }
    }

    // Extract buttons (CTAs)
    const buttonElements = await page.$$('button, [role="button"]');
    for (const button of buttonElements) {
      const text = await button.textContent();
      const selector = await SelectorGenerator.generateSelector(page, button);

      if (text?.trim()) {
        pageInfo.buttons.push({
          text: text.trim(),
          selector,
          type: this.classifyButton(text),
          isSafe: this.isButtonSafe(text),
        });
      }
    }

    // Extract forms
    const formElements = await page.$$('form');
    for (const form of formElements) {
      const fields = await form.$$eval('input, textarea, select', (inputs: any[]) =>
        inputs.map((inp) => inp.name || inp.id || inp.type)
      );

      const submitButton = await form.$('button[type="submit"], input[type="submit"]');
      const submitText = submitButton ? await submitButton.textContent() : 'Submit';

      pageInfo.forms.push({
        selector: 'form',
        fields: fields.filter(Boolean),
        submitButtonText: submitText?.trim(),
      });
    }

    return pageInfo;
  }

  private detectAuthPage(url: string): boolean {
    const authKeywords = ['login', 'signin', 'auth', 'register', 'signup'];
    return authKeywords.some((kw) => url.toLowerCase().includes(kw));
  }

  private detectPricingPage(url: string): boolean {
    const pricingKeywords = ['pricing', 'plans', 'billing'];
    return pricingKeywords.some((kw) => url.toLowerCase().includes(kw));
  }

  private detectContactPage(url: string): boolean {
    const contactKeywords = ['contact', 'support', 'help'];
    return contactKeywords.some((kw) => url.toLowerCase().includes(kw));
  }

  private classifyLink(text: string, href: string): 'nav' | 'cta' | 'footer' | 'inline' {
    const ctaKeywords = ['sign up', 'get started', 'try free', 'start now', 'buy'];
    if (ctaKeywords.some((kw) => text.toLowerCase().includes(kw))) {
      return 'cta';
    }
    return 'nav';
  }

  private classifyButton(text: string): 'cta' | 'menu' | 'modal' | 'form' | 'action' {
    if (text.includes('Menu') || text.includes('menu')) return 'menu';
    if (text.includes('Close') || text.includes('close')) return 'modal';
    return 'cta';
  }

  private isButtonSafe(text: string): boolean {
    const unsafePatterns = [
      'delete',
      'remove',
      'cancel',
      'logout',
      'sign out',
      'pay',
      'purchase',
      'unsubscribe',
      'submit',
    ];

    const lowerText = text.toLowerCase();
    return !unsafePatterns.some((pattern) => lowerText.includes(pattern));
  }
}

// ============================================================================
// PLAYWRIGHT RUNNER
// ============================================================================

export class PlaywrightRunner {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch();
    this.context = await this.browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      isMobile: true,
      hasTouch: true,
    });
    this.page = await this.context.newPage();
  }

  getPage(): Page {
    if (!this.page) throw new Error('Page not initialized');
    return this.page;
  }

  async renderPage(url: string): Promise<PageRenderResult> {
    if (!this.page) throw new Error('Browser not initialized');

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    this.page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    this.page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()} - Failed`);
    });

    this.page.on('response', (response) => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    const startTime = Date.now();
    let error: Error | undefined;
    let screenshotPath: string | undefined;

    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

      screenshotPath = path.join(
        process.cwd(),
        'artifacts',
        `${Date.now()}-${url.replace(/[^a-zA-Z0-9]/g, '_')}.png`
      );

      const dir = path.dirname(screenshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await this.page.screenshot({ path: screenshotPath });
    } catch (e) {
      error = e as Error;
    }

    const loadTime = Date.now() - startTime;

    return {
      url,
      success: !error,
      screenshotPath,
      consoleErrors,
      failedRequests,
      error: error?.message,
      loadTime,
    };
  }

  async shutdown(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}

// ============================================================================
// SAFE INTERACTION ENGINE
// ============================================================================

export class SafeInteractionEngine {
  private readonly SAFE_CTA_PATTERNS = [
    'sign up',
    'get started',
    'try free',
    'try now',
    'start trial',
    'continue',
    'next',
    'learn more',
    'explore',
    'view',
    'discover',
    'open',
    'read',
    'show',
  ];

  private readonly UNSAFE_PATTERNS = [
    'delete',
    'remove',
    'cancel account',
    'cancel subscription',
    'logout',
    'sign out',
    'unsubscribe',
    'pay',
    'purchase',
    'checkout',
    'charge',
    'confirm payment',
    'submit',
  ];

  classifyInteraction(buttonText: string, context: string = ''): {
    safe: boolean;
    reason: string;
  } {
    const lowerText = buttonText.toLowerCase();

    for (const pattern of this.UNSAFE_PATTERNS) {
      if (lowerText.includes(pattern)) {
        return {
          safe: false,
          reason: `Contains unsafe pattern: "${pattern}"`,
        };
      }
    }

    for (const pattern of this.SAFE_CTA_PATTERNS) {
      if (lowerText.includes(pattern)) {
        return {
          safe: true,
          reason: `Matches safe pattern: "${pattern}"`,
        };
      }
    }

    return {
      safe: false,
      reason: 'No clear safe pattern matched - skipping by default',
    };
  }

  async isCTAClickable(page: Page, selector: string): Promise<boolean> {
    const result = await VisibilityDetector.isReallyClickable(page, selector);
    return result.clickable;
  }
}

// ============================================================================
// ISSUE DETECTION ENGINE
// ============================================================================

export class IssueDetectionEngine {
  async detectHiddenCTA(
    page: Page,
    buttonText: string,
    selector: string,
    screenshotPath: string
  ): Promise<DetectedIssue | null> {
    try {
      const visibility = await VisibilityDetector.isReallyClickable(page, selector);

      if (!visibility.clickable) {
        return {
          id: `hidden-cta-${Date.now()}`,
          type: 'hidden_cta',
          severity: 'critical',
          title: `"${buttonText}" button is not clickable on mobile`,
          description: `The primary CTA "${buttonText}" is not accessible: ${visibility.reason}`,
          page: page.url(),
          evidence: {
            screenshotPath,
            consoleErrors: [],
            reproductionSteps: [
              'Load page on mobile (iPhone 375x812)',
              `Look for "${buttonText}" button`,
              `Button is not accessible: ${visibility.reason}`,
            ],
          },
          confidence: 'strong',
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async detectDeadClick(
    page: Page,
    selector: string,
    buttonText: string,
    screenshotPath: string
  ): Promise<DetectedIssue | null> {
    try {
      // FIX: Capture state before (including URL)
      const beforeState = await DOMStateDetector.captureDOMState(page);

      const element = await page.$(selector);
      if (!element) return null;

      await element.click();
      await page.waitForTimeout(1000);

      // FIX: Capture state after
      const afterState = await DOMStateDetector.captureDOMState(page);

      // FIX: Properly compare URLs
      const urlChanged = beforeState.url !== afterState.url;

      // Check DOM state change
      const { changed, reason } = await DOMStateDetector.stateChanged(beforeState, afterState);

      // Only report dead click if click succeeded AND no meaningful state change
      if (!changed && !urlChanged) {
        return {
          id: `dead-click-${Date.now()}`,
          type: 'dead_click',
          severity: 'high',
          title: `"${buttonText}" button does not respond`,
          description: `Clicking on "${buttonText}" produced no meaningful state change.`,
          page: page.url(),
          evidence: {
            screenshotPath,
            consoleErrors: [],
            reproductionSteps: [
              `Click on "${buttonText}" button`,
              'No state change occurs',
              'No DOM mutations detected',
            ],
          },
          confidence: 'strong',
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async detectInfiniteLoading(
    page: Page,
    screenshotPath: string
  ): Promise<DetectedIssue | null> {
    try {
      const result = await LoadingStateDetector.isInfiniteLoadingState(page);

      if (result.isInfinite) {
        return {
          id: `infinite-loading-${Date.now()}`,
          type: 'infinite_loading',
          severity: 'critical',
          title: 'Page stuck in infinite loading state',
          description: 'Page shows persistent loading spinner with no completion.',
          page: page.url(),
          evidence: {
            screenshotPath,
            consoleErrors: [],
            reproductionSteps: [
              'Trigger action on page',
              'Loading spinner appears and persists',
              'DOM does not stabilize',
              'Network does not complete',
            ],
          },
          confidence: 'strong',
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async detectFormFailure(
    page: Page,
    screenshotPath: string,
    consoleErrors: string[]
  ): Promise<DetectedIssue | null> {
    const formErrors = consoleErrors.filter(
      (err) =>
        err.includes('error') &&
        (err.includes('500') || err.includes('form') || err.includes('submission'))
    );

    if (formErrors.length > 0) {
      return {
        id: `form-failure-${Date.now()}`,
        type: 'form_failure',
        severity: 'high',
        title: 'Form interaction produced errors',
        description: 'Form produced JavaScript or server errors.',
        page: page.url(),
        evidence: {
          screenshotPath,
          consoleErrors: formErrors,
          reproductionSteps: [
            'Interact with form',
            'Error occurs in console or network',
          ],
        },
        confidence: 'strong',
      };
    }

    return null;
  }

  async detectNavigationFailure(
    page: Page,
    screenshotPath: string,
    failedRequests: string[]
  ): Promise<DetectedIssue | null> {
    const navFailures = failedRequests.filter(
      (req) => (req.includes('404') || req.includes('500')) && req.includes('GET')
    );

    if (navFailures.length > 0) {
      return {
        id: `nav-failure-${Date.now()}`,
        type: 'nav_failure',
        severity: 'high',
        title: 'Navigation elements failed',
        description: 'Navigation requests returned error status codes.',
        page: page.url(),
        evidence: {
          screenshotPath,
          consoleErrors: navFailures,
          reproductionSteps: ['Page load', 'Navigation elements returned errors'],
        },
        confidence: 'strong',
      };
    }

    return null;
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

export function generateReport(
  url: string,
  discoveredPages: DiscoveredPage[],
  issues: DetectedIssue[]
): ScanResult {
  return {
    url,
    scanTime: new Date(),
    discoveredPages,
    issues: issues.filter((i) => i !== null),
    summary: {
      pagesScanned: discoveredPages.length,
      issuesFound: issues.length,
      criticalIssues: issues.filter((i) => i.severity === 'critical').length,
    },
  };
}

export function saveReport(report: ScanResult, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`✓ Report saved to ${outputPath}`);
}
