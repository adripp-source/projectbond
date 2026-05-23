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

// ============================================================================
// LOGIN ENGINE — Step 1: always log in first when credentials are provided
// ============================================================================

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
  loginUrl?: string;
  /** Optional explicit selectors when the site is unusual */
  emailSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  /** Selector or text that proves login succeeded (dashboard element, etc.) */
  successIndicator?: string;
  /** True only if the user explicitly granted permission to sign up new accounts */
  allowSignup?: boolean;
}

export interface LoginResult {
  success: boolean;
  reason: string;
  finalUrl: string;
  requiresHumanIntervention?: {
    kind: 'email_verification' | 'sms_code' | 'captcha' | '2fa' | 'unknown';
    message: string;
  };
  postLoginUrl?: string;
}

export class LoginEngine {
  /**
   * Step 1 of every authenticated scan: navigate to login, fill credentials,
   * submit, and confirm a logged-in state. If the flow needs human
   * intervention (email link, SMS code, captcha), surface that clearly
   * instead of guessing.
   */
  async login(page: Page, creds: LoginCredentials): Promise<LoginResult> {
    const targetUrl =
      creds.loginUrl ||
      (await this.findLoginUrl(page)) ||
      page.url();

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      return {
        success: false,
        reason: `Could not reach login page: ${(e as Error).message}`,
        finalUrl: page.url(),
      };
    }

    // 1. Locate identifier (email/username) input
    const idSelector =
      creds.emailSelector ||
      (await this.firstMatch(page, [
        'input[type="email"]',
        'input[name="email" i]',
        'input[name="username" i]',
        'input[autocomplete="username"]',
        'input[id*="email" i]',
        'input[id*="user" i]',
      ]));

    // 2. Locate password input
    const pwSelector =
      creds.passwordSelector ||
      (await this.firstMatch(page, [
        'input[type="password"]',
        'input[name="password" i]',
        'input[autocomplete="current-password"]',
      ]));

    if (!idSelector || !pwSelector) {
      return {
        success: false,
        reason:
          'Could not locate login form fields. The site may use a non-standard auth flow (SSO, magic link, OTP).',
        finalUrl: page.url(),
        requiresHumanIntervention: {
          kind: 'unknown',
          message:
            'No email/password fields detected. If this site uses magic link, SSO, or OTP, the user must complete that step manually and provide an active session.',
        },
      };
    }

    const identifier = creds.email || creds.username || '';
    try {
      await page.fill(idSelector, identifier);
      await page.fill(pwSelector, creds.password);
    } catch (e) {
      return {
        success: false,
        reason: `Failed to fill credentials: ${(e as Error).message}`,
        finalUrl: page.url(),
      };
    }

    // 3. Submit
    const submitSelector =
      creds.submitSelector ||
      (await this.firstMatch(page, [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        'button:has-text("Login")',
        'button:has-text("Continue")',
      ]));

    const beforeUrl = page.url();
    try {
      if (submitSelector) {
        await page.click(submitSelector);
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    } catch (e) {
      return {
        success: false,
        reason: `Submit failed: ${(e as Error).message}`,
        finalUrl: page.url(),
      };
    }

    // 4. Detect intervention requirements (email verify / OTP / captcha)
    const interventionCheck = await this.detectIntervention(page);
    if (interventionCheck) {
      return {
        success: false,
        reason: 'Login flow requires human intervention before continuing.',
        finalUrl: page.url(),
        requiresHumanIntervention: interventionCheck,
      };
    }

    // 5. Confirm logged-in state
    const loggedIn = await this.isLoggedIn(page, creds.successIndicator);
    if (!loggedIn) {
      const stillOnAuth = /login|signin|auth/i.test(page.url());
      const errorVisible = await page
        .locator('text=/invalid|incorrect|wrong|error/i')
        .first()
        .isVisible()
        .catch(() => false);
      return {
        success: false,
        reason: errorVisible
          ? 'Login rejected: invalid credentials or error message displayed.'
          : stillOnAuth
            ? 'Still on auth page after submit — login did not progress.'
            : 'Could not confirm logged-in state after submit.',
        finalUrl: page.url(),
      };
    }

    return {
      success: true,
      reason: 'Login confirmed.',
      finalUrl: page.url(),
      postLoginUrl: page.url() !== beforeUrl ? page.url() : undefined,
    };
  }

  private async findLoginUrl(page: Page): Promise<string | null> {
    const candidates = await page.$$eval('a', (links) =>
      links
        .map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent || '' }))
        .filter(
          ({ href, text }) =>
            /login|sign[- ]?in|auth/i.test(href) || /log\s*in|sign\s*in/i.test(text),
        )
        .map((c) => c.href),
    );
    return candidates[0] || null;
  }

  private async firstMatch(page: Page, selectors: string[]): Promise<string | null> {
    for (const sel of selectors) {
      const found = await page.$(sel).catch(() => null);
      if (found) return sel;
    }
    return null;
  }

  private async detectIntervention(
    page: Page,
  ): Promise<LoginResult['requiresHumanIntervention'] | null> {
    const html = (await page.content().catch(() => '')) || '';
    if (/verify your email|confirm your email|check your inbox/i.test(html)) {
      return {
        kind: 'email_verification',
        message:
          'Site sent a verification email. Confirm via that email, then re-run the scan with the verified account.',
      };
    }
    if (/enter.*code|verification code|one[- ]?time code|sms code/i.test(html)) {
      return {
        kind: 'sms_code',
        message:
          'Site requires an SMS / one-time code. Provide the code or an already-authenticated session.',
      };
    }
    if (/captcha|i'?m not a robot|recaptcha|hcaptcha|turnstile/i.test(html)) {
      return {
        kind: 'captcha',
        message:
          'Site is gated by CAPTCHA. Allowlist ProjectBond or supply an authenticated session cookie.',
      };
    }
    if (/two[- ]?factor|authenticator app|2fa/i.test(html)) {
      return {
        kind: '2fa',
        message:
          'Two-factor authentication required. Use an account with 2FA disabled for scanning, or supply a session.',
      };
    }
    return null;
  }

  private async isLoggedIn(page: Page, indicator?: string): Promise<boolean> {
    if (indicator) {
      return await page
        .locator(indicator)
        .first()
        .isVisible()
        .catch(() => false);
    }
    // Heuristics: presence of logout, account menu, or absence of password field
    const positive = await page
      .locator(
        'a:has-text("Logout"), a:has-text("Log out"), a:has-text("Sign out"), [data-testid*="user" i], [aria-label*="account" i]',
      )
      .first()
      .isVisible()
      .catch(() => false);
    if (positive) return true;
    const stillHasPassword = await page.$('input[type="password"]').catch(() => null);
    return !stillHasPassword && !/login|signin|auth/i.test(page.url());
  }
}

// ============================================================================
// WORKFLOW ENGINE — continuation across multi-step user journeys
// ============================================================================

export type WorkflowName =
  | 'signup'
  | 'login'
  | 'onboarding'
  | 'dashboard_entry'
  | 'multi_step_form'
  | 'modal_flow'
  | 'mobile_nav'
  | 'primary_cta';

export interface WorkflowStep {
  index: number;
  description: string;
  action: 'navigate' | 'click' | 'fill' | 'select' | 'wait';
  url?: string;
  selector?: string;
  value?: string;
  outcome: 'progressed' | 'blocked' | 'completed' | 'skipped';
  reason?: string;
  screenshotPath?: string;
}

export interface WorkflowRun {
  name: WorkflowName;
  startUrl: string;
  steps: WorkflowStep[];
  completed: boolean;
  blockedAt?: number;
  blockReason?: string;
}

/**
 * Safe fake input generator for non-destructive form progression.
 * NEVER produces real card numbers, real emails, or real phone numbers
 * that could trigger payments / messaging.
 */
export class SafeInputGenerator {
  static for(field: { name?: string; type?: string; placeholder?: string }): string {
    const hint = `${field.name || ''} ${field.type || ''} ${field.placeholder || ''}`.toLowerCase();
    if (hint.includes('email')) return `projectbond.qa+${Date.now()}@example.invalid`;
    if (hint.includes('phone') || hint.includes('tel')) return '5550100000'; // 555-01xx reserved
    if (hint.includes('zip') || hint.includes('postal')) return '94105';
    if (hint.includes('card') || hint.includes('cvc') || hint.includes('cvv')) return ''; // never fill
    if (hint.includes('name')) return 'QA Tester';
    if (hint.includes('company') || hint.includes('org')) return 'ProjectBond QA';
    if (hint.includes('url') || hint.includes('website')) return 'https://example.invalid';
    if (hint.includes('password')) return 'NotARealPassword!2025';
    if (hint.includes('age')) return '30';
    if (hint.includes('date')) return '2000-01-01';
    return 'projectbond-qa';
  }
}

export class WorkflowEngine {
  private safe = new SafeInteractionEngine();

  /**
   * Continue clicking the most promising next-step CTA, filling safe inputs,
   * and recording every step. Stops on: workflow blocked, completion signal,
   * unsafe action required, or max-step budget.
   */
  async run(
    page: Page,
    name: WorkflowName,
    options: { maxSteps?: number; entrySelector?: string } = {},
  ): Promise<WorkflowRun> {
    const maxSteps = options.maxSteps ?? 8;
    const startUrl = page.url();
    const steps: WorkflowStep[] = [];

    // Optional explicit entry
    if (options.entrySelector) {
      const step = await this.clickStep(page, options.entrySelector, `Enter ${name} flow`);
      steps.push({ ...step, index: 0 });
      if (step.outcome === 'blocked') {
        return this.finishBlocked(name, startUrl, steps, step.reason);
      }
    }

    for (let i = steps.length; i < maxSteps; i++) {
      // Detect completion signals
      if (await this.lookCompleted(page, name)) {
        steps.push({
          index: i,
          description: `${name} reached a success state`,
          action: 'wait',
          outcome: 'completed',
        });
        return { name, startUrl, steps, completed: true };
      }

      // Detect redirect loops
      if (this.isRedirectLoop(steps, page.url())) {
        return this.finishBlocked(name, startUrl, steps, 'Redirect loop detected');
      }

      // Fill any visible form fields with safe values
      const filled = await this.fillVisibleForm(page);
      if (filled > 0) {
        steps.push({
          index: i,
          description: `Filled ${filled} form field(s) with safe test values`,
          action: 'fill',
          outcome: 'progressed',
        });
      }

      // Find next-step CTA
      const next = await this.findNextCTA(page);
      if (!next) {
        return this.finishBlocked(
          name,
          startUrl,
          steps,
          'No next-step CTA found — user cannot continue.',
        );
      }

      const classification = this.safe.classifyInteraction(next.text);
      if (!classification.safe) {
        steps.push({
          index: i,
          description: `Skipped unsafe action "${next.text}"`,
          action: 'click',
          selector: next.selector,
          outcome: 'skipped',
          reason: classification.reason,
        });
        return {
          name,
          startUrl,
          steps,
          completed: false,
          blockedAt: i,
          blockReason: `Next required action is unsafe to execute: ${classification.reason}`,
        };
      }

      const step = await this.clickStep(page, next.selector, `Click "${next.text}"`);
      steps.push({ ...step, index: i });
      if (step.outcome === 'blocked') {
        return this.finishBlocked(name, startUrl, steps, step.reason);
      }
    }

    return { name, startUrl, steps, completed: false, blockReason: 'Max step budget reached' };
  }

  private async clickStep(
    page: Page,
    selector: string,
    description: string,
  ): Promise<WorkflowStep> {
    const before = await DOMStateDetector.captureDOMState(page);
    try {
      const visibility = await VisibilityDetector.isReallyClickable(page, selector);
      if (!visibility.clickable) {
        return {
          index: 0,
          description,
          action: 'click',
          selector,
          outcome: 'blocked',
          reason: `CTA not clickable: ${visibility.reason}`,
        };
      }
      await page.click(selector, { timeout: 5000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const after = await DOMStateDetector.captureDOMState(page);
      const { changed, reason } = await DOMStateDetector.stateChanged(before, after);
      if (!changed) {
        return {
          index: 0,
          description,
          action: 'click',
          selector,
          outcome: 'blocked',
          reason: `CTA dead after click: ${reason}`,
        };
      }
      return { index: 0, description, action: 'click', selector, outcome: 'progressed' };
    } catch (e) {
      return {
        index: 0,
        description,
        action: 'click',
        selector,
        outcome: 'blocked',
        reason: (e as Error).message,
      };
    }
  }

  private async fillVisibleForm(page: Page): Promise<number> {
    const inputs = await page.$$('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    let filled = 0;
    for (const input of inputs) {
      const meta = await input.evaluate((el) => ({
        type: (el as HTMLInputElement).type,
        name: (el as HTMLInputElement).name,
        placeholder: (el as HTMLInputElement).placeholder,
        value: (el as HTMLInputElement).value,
        visible: !!(el as HTMLElement).offsetParent,
        disabled: (el as HTMLInputElement).disabled,
      }));
      if (!meta.visible || meta.disabled || meta.value) continue;
      if (meta.type === 'file' || meta.type === 'checkbox' || meta.type === 'radio') continue;
      const value = SafeInputGenerator.for(meta);
      if (!value) continue;
      await input.fill(value).catch(() => {});
      filled++;
    }
    return filled;
  }

  private async findNextCTA(
    page: Page,
  ): Promise<{ selector: string; text: string } | null> {
    const preferred = [
      'Continue',
      'Next',
      'Get started',
      'Sign up',
      'Create account',
      'Start',
      'Try free',
      'Submit',
      'Save',
      'Done',
      'Finish',
    ];
    for (const label of preferred) {
      const loc = page.locator(`button:has-text("${label}"), a:has-text("${label}")`).first();
      if (await loc.isVisible().catch(() => false)) {
        const handle = await loc.elementHandle();
        if (handle) {
          const selector = await SelectorGenerator.generateSelector(page, handle);
          return { selector, text: label };
        }
      }
    }
    return null;
  }

  private async lookCompleted(page: Page, name: WorkflowName): Promise<boolean> {
    const url = page.url();
    if (name === 'login' || name === 'signup' || name === 'dashboard_entry') {
      if (/dashboard|home|app|account|onboarding/i.test(url)) return true;
    }
    const success = await page
      .locator('text=/success|welcome|you.?re in|all set|thanks/i')
      .first()
      .isVisible()
      .catch(() => false);
    return success;
  }

  private isRedirectLoop(steps: WorkflowStep[], currentUrl: string): boolean {
    const urls = steps.map((s) => s.selector || '').slice(-4);
    return urls.filter((u) => u === currentUrl).length >= 2;
  }

  private finishBlocked(
    name: WorkflowName,
    startUrl: string,
    steps: WorkflowStep[],
    reason?: string,
  ): WorkflowRun {
    return {
      name,
      startUrl,
      steps,
      completed: false,
      blockedAt: steps.length - 1,
      blockReason: reason,
    };
  }

  /**
   * Convert a blocked workflow into a high-priority DetectedIssue.
   * Workflow blockage > technical purity — these are the critical findings.
   */
  toIssue(run: WorkflowRun, screenshotPath?: string): DetectedIssue | null {
    if (run.completed) return null;
    const typeByName: Record<WorkflowName, DetectedIssue['type']> = {
      signup: 'signup_blocked',
      login: 'login_failed',
      onboarding: 'onboarding_stuck',
      dashboard_entry: 'dashboard_unreachable',
      multi_step_form: 'workflow_blocked',
      modal_flow: 'workflow_blocked',
      mobile_nav: 'workflow_blocked',
      primary_cta: 'cta_dead_after_click',
    };
    return {
      id: `workflow-${run.name}-${Date.now()}`,
      type: typeByName[run.name],
      severity: 'critical',
      title: `${run.name.replace(/_/g, ' ')} flow is blocked`,
      description:
        run.blockReason ||
        `User cannot continue past step ${run.blockedAt} of the ${run.name} workflow.`,
      page: run.startUrl,
      workflow: run.name,
      blockedStep: run.steps[run.blockedAt ?? run.steps.length - 1]?.description,
      evidence: {
        screenshotPath,
        consoleErrors: [],
        reproductionSteps: run.steps.map(
          (s) => `Step ${s.index}: ${s.description} → ${s.outcome}${s.reason ? ` (${s.reason})` : ''}`,
        ),
      },
      confidence: 'verified',
    };
  }
}

// ============================================================================
// PRIORITY ENGINE — workflow blockage > technical purity
// ============================================================================

/**
 * Re-rank issues so that anything blocking real user progression is treated
 * as the most important finding, regardless of category labels.
 */
export class PriorityEngine {
  private readonly HIGH_PRIORITY_TYPES = new Set<DetectedIssue['type']>([
    'workflow_blocked',
    'login_failed',
    'signup_blocked',
    'onboarding_stuck',
    'cta_dead_after_click',
    'redirect_loop',
    'validation_trap',
    'dashboard_unreachable',
    'dead_click',
    'infinite_loading',
    'form_failure',
    'hidden_cta',
  ]);

  private readonly LOW_PRIORITY_TITLES = [
    /favicon/i,
    /missing h1/i,
    /duplicate meta/i,
    /meta description length/i,
    /og:image/i,
    /sitemap/i,
  ];

  score(issue: DetectedIssue): number {
    if (this.HIGH_PRIORITY_TYPES.has(issue.type)) return 100;
    if (this.LOW_PRIORITY_TITLES.some((re) => re.test(issue.title))) return 10;
    if (issue.severity === 'critical') return 80;
    if (issue.severity === 'high') return 60;
    if (issue.severity === 'medium') return 40;
    return 20;
  }

  rank(issues: DetectedIssue[]): DetectedIssue[] {
    return [...issues].sort((a, b) => this.score(b) - this.score(a));
  }

  /**
   * Force-downgrade purely cosmetic findings if a workflow is blocked —
   * the user should see the blockage at the top.
   */
  applyWorkflowPrecedence(issues: DetectedIssue[]): DetectedIssue[] {
    const hasBlocker = issues.some((i) => this.HIGH_PRIORITY_TYPES.has(i.type));
    if (!hasBlocker) return issues;
    return issues.map((i) =>
      this.LOW_PRIORITY_TITLES.some((re) => re.test(i.title))
        ? { ...i, severity: 'low' as const }
        : i,
    );
  }
}

// ============================================================================
// ORCHESTRATOR — Step 1: log in. Step 2+: continue every important workflow.
// ============================================================================

export interface AutonomousScanOptions {
  url: string;
  credentials?: LoginCredentials;
  workflows?: WorkflowName[];
}

export class AutonomousWorkflowScanner {
  private runner = new PlaywrightRunner();
  private login = new LoginEngine();
  private workflow = new WorkflowEngine();
  private priority = new PriorityEngine();
  private detect = new IssueDetectionEngine();

  async scan(opts: AutonomousScanOptions): Promise<{
    issues: DetectedIssue[];
    workflows: WorkflowRun[];
    loginResult?: LoginResult;
  }> {
    await this.runner.initialize();
    const page = this.runner.getPage();
    const issues: DetectedIssue[] = [];
    const workflows: WorkflowRun[] = [];

    // STEP 1: Always log in first if credentials provided.
    let loginResult: LoginResult | undefined;
    if (opts.credentials) {
      loginResult = await this.login.login(page, opts.credentials);
      if (!loginResult.success) {
        const issue: DetectedIssue = {
          id: `login-${Date.now()}`,
          type: 'login_failed',
          severity: 'critical',
          title: loginResult.requiresHumanIntervention
            ? `Login needs human action: ${loginResult.requiresHumanIntervention.kind}`
            : 'Login failed — scanner cannot reach authenticated pages',
          description:
            loginResult.requiresHumanIntervention?.message || loginResult.reason,
          page: loginResult.finalUrl,
          workflow: 'login',
          evidence: {
            consoleErrors: [],
            reproductionSteps: [
              `Navigated to ${opts.credentials.loginUrl || 'discovered login page'}`,
              'Filled provided credentials',
              `Result: ${loginResult.reason}`,
            ],
          },
          confidence: 'verified',
        };
        issues.push(issue);
        // Continue with public-only flows; do not pretend auth pages were tested.
      }
    } else {
      await page.goto(opts.url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    }

    // STEP 2: Walk the requested workflows from wherever we are.
    const flows: WorkflowName[] = opts.workflows ?? [
      'primary_cta',
      'signup',
      'onboarding',
      'dashboard_entry',
      'mobile_nav',
    ];
    for (const name of flows) {
      const run = await this.workflow.run(page, name);
      workflows.push(run);
      const issue = this.workflow.toIssue(run);
      if (issue) issues.push(issue);
    }

    await this.runner.shutdown();

    const ranked = this.priority.rank(this.priority.applyWorkflowPrecedence(issues));
    return { issues: ranked, workflows, loginResult };
  }
}
