/**
 * Behavior Consistency Scanner — quiet add-on layer.
 *
 * Captures deterministic behavior snapshots of a page and compares
 * the current snapshot against the previous one for the same URL.
 *
 * Reports only meaningful, evidence-backed changes. No AI. No scoring.
 * Bias toward false negatives — when uncertain, do NOT report.
 *
 * Filters out known noise: timestamps, tracking pixels, session tokens,
 * rotating testimonials, random IDs, animation states.
 */

import type { Page } from 'playwright';
import { ChatbotTester, type ChatbotTestResult } from './chatbot-tester';

// ============================================================================
// TYPES
// ============================================================================

export interface ButtonSignature {
  text: string;
  selector: string;
  destination: string | null; // href or data-href if known
  role: string | null;
}

export interface FormSignature {
  selector: string;
  action: string | null;
  method: string | null;
  fields: Array<{ name: string; type: string; required: boolean }>;
}

export interface NetworkSignature {
  method: string;
  urlPattern: string; // normalized: query stripped, IDs masked
  resourceType: string;
  status: number | null;
}

export interface BehaviorSnapshot {
  scanId: string;
  url: string;
  timestamp: string;
  pageTitle: string;
  finalUrl: string; // after redirects
  buttons: ButtonSignature[];
  forms: FormSignature[];
  network: NetworkSignature[];
  redirectChain: string[];
  visibleHeadings: string[];
  consoleErrorSignatures: string[];
  chatbot?: ChatbotTestResult | null;
  contentHash: string;
}

export interface BehaviorChange {
  type:
    | 'button_destination_changed'
    | 'button_removed'
    | 'form_fields_changed'
    | 'form_action_changed'
    | 'redirect_changed'
    | 'network_request_changed'
    | 'heading_removed'
    | 'new_console_errors'
    | 'chatbot_inconsistent_response'
    | 'chatbot_quality_issue';
  title: string;
  evidence: {
    previous: unknown;
    current: unknown;
  };
  impact: string;
  confidence: 'verified' | 'strong';
}

// ============================================================================
// SNAPSHOTTER
// ============================================================================

const NOISE_URL_PATTERNS = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /doubleclick\.net/i,
  /facebook\.com\/tr/i,
  /hotjar\.com/i,
  /segment\.io/i,
  /sentry\.io/i,
  /mixpanel\.com/i,
  /amplitude\.com/i,
];

function normalizeUrlForSignature(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    // Strip query and fragment, mask numeric and uuid segments
    const path = u.pathname
      .split('/')
      .map((seg) => {
        if (/^\d+$/.test(seg)) return ':id';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) {
          return ':uuid';
        }
        if (/^[0-9a-f]{16,}$/i.test(seg)) return ':hash';
        return seg;
      })
      .join('/');
    return `${u.origin}${path}`;
  } catch {
    return rawUrl;
  }
}

function isNoiseRequest(url: string): boolean {
  return NOISE_URL_PATTERNS.some((re) => re.test(url));
}

function normalizeConsoleError(msg: string): string {
  return msg
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\b\d{10,}\b/g, '<num>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .slice(0, 240);
}

export class BehaviorSnapshotter {
  async capturePageBehavior(
    page: Page,
    scanId: string,
    url: string
  ): Promise<BehaviorSnapshot> {
    const network: NetworkSignature[] = [];
    const consoleErrors: string[] = [];
    const redirectChain: string[] = [];

    const onResponse = (response: any) => {
      const reqUrl = response.url();
      if (isNoiseRequest(reqUrl)) return;
      const req = response.request();
      const rt = req.resourceType();
      if (rt !== 'xhr' && rt !== 'fetch' && rt !== 'document') return;
      network.push({
        method: req.method(),
        urlPattern: normalizeUrlForSignature(reqUrl),
        resourceType: rt,
        status: response.status(),
      });
      const chain = req.redirectedFrom();
      if (chain) redirectChain.push(reqUrl);
    };

    const onConsole = (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(normalizeConsoleError(msg.text()));
      }
    };

    page.on('response', onResponse);
    page.on('console', onConsole);

    // Allow late requests to settle briefly without blocking
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      // ignore; networkidle is best-effort
    }

    const pageTitle = await page.title().catch(() => '');
    const finalUrl = page.url();

    // Buttons / links signatures
    const buttons: ButtonSignature[] = await page
      .evaluate(() => {
        const out: any[] = [];
        const els = Array.from(
          document.querySelectorAll<HTMLElement>(
            'a, button, [role="button"], input[type="submit"], input[type="button"]'
          )
        );
        for (const el of els) {
          const text = (el.textContent || (el as HTMLInputElement).value || '')
            .trim()
            .slice(0, 80);
          if (!text) continue;
          let selector = el.tagName.toLowerCase();
          if (el.id) selector += `#${el.id}`;
          else if (el.getAttribute('data-testid')) {
            selector += `[data-testid="${el.getAttribute('data-testid')}"]`;
          }
          const href =
            (el as HTMLAnchorElement).href ||
            el.getAttribute('data-href') ||
            el.getAttribute('formaction') ||
            null;
          out.push({
            text,
            selector,
            destination: href,
            role: el.getAttribute('role'),
          });
        }
        return out;
      })
      .catch(() => []);

    // Normalize destinations
    for (const b of buttons) {
      if (b.destination) b.destination = normalizeUrlForSignature(b.destination);
    }

    // Forms
    const forms: FormSignature[] = await page
      .evaluate(() => {
        const out: any[] = [];
        const fs = Array.from(document.querySelectorAll<HTMLFormElement>('form'));
        for (const f of fs) {
          const selector = f.id ? `form#${f.id}` : `form[action="${f.action || ''}"]`;
          const fields = Array.from(
            f.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
              'input, textarea, select'
            )
          ).map((el) => ({
            name: el.getAttribute('name') || '',
            type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
            required: el.hasAttribute('required'),
          }));
          out.push({
            selector,
            action: f.getAttribute('action'),
            method: (f.getAttribute('method') || 'get').toLowerCase(),
            fields,
          });
        }
        return out;
      })
      .catch(() => []);

    const visibleHeadings: string[] = await page
      .evaluate(() => {
        return Array.from(document.querySelectorAll('h1, h2'))
          .map((h) => (h.textContent || '').trim())
          .filter((t) => t.length > 0)
          .slice(0, 40);
      })
      .catch(() => []);

    // Chatbot probe (read-only detection + safe prompt set)
    let chatbot: ChatbotTestResult | null = null;
    try {
      const tester = new ChatbotTester();
      chatbot = await tester.testIfPresent(page);
    } catch {
      chatbot = null;
    }

    page.off('response', onResponse);
    page.off('console', onConsole);

    // Deterministic content hash of "stable" parts
    const stable = JSON.stringify({
      finalUrl: normalizeUrlForSignature(finalUrl),
      buttons: buttons.map((b) => [b.text, b.destination]),
      forms: forms.map((f) => [f.action, f.method, f.fields]),
      headings: visibleHeadings,
    });
    const contentHash = await hashString(stable);

    return {
      scanId,
      url,
      timestamp: new Date().toISOString(),
      pageTitle,
      finalUrl,
      buttons,
      forms,
      network: dedupeNetwork(network),
      redirectChain,
      visibleHeadings,
      consoleErrorSignatures: Array.from(new Set(consoleErrors)).slice(0, 50),
      chatbot,
      contentHash,
    };
  }
}

async function hashString(s: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);
}

function dedupeNetwork(items: NetworkSignature[]): NetworkSignature[] {
  const seen = new Set<string>();
  const out: NetworkSignature[] = [];
  for (const it of items) {
    const k = `${it.method} ${it.urlPattern} ${it.resourceType}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out.slice(0, 200);
}

// ============================================================================
// COMPARATOR
// ============================================================================

export class BehaviorComparator {
  compareSnapshots(
    previous: BehaviorSnapshot,
    current: BehaviorSnapshot
  ): BehaviorChange[] {
    const changes: BehaviorChange[] = [];

    // 1. Button destinations
    const prevButtons = new Map(
      previous.buttons.filter((b) => b.text).map((b) => [b.text.toLowerCase(), b])
    );
    const currButtons = new Map(
      current.buttons.filter((b) => b.text).map((b) => [b.text.toLowerCase(), b])
    );

    for (const [text, prev] of prevButtons) {
      const curr = currButtons.get(text);
      if (!curr) {
        // Only report removal for CTA-like text (non-noise)
        if (looksLikeCTA(prev.text)) {
          changes.push({
            type: 'button_removed',
            title: `CTA "${prev.text}" no longer present`,
            evidence: { previous: prev, current: null },
            impact: 'Users may no longer find this action.',
            confidence: 'strong',
          });
        }
        continue;
      }
      if (
        prev.destination &&
        curr.destination &&
        prev.destination !== curr.destination
      ) {
        changes.push({
          type: 'button_destination_changed',
          title: `Button "${prev.text}" destination changed`,
          evidence: {
            previous: prev.destination,
            current: curr.destination,
          },
          impact: 'Users may not reach the expected flow.',
          confidence: 'verified',
        });
      }
    }

    // 2. Forms
    const prevForms = new Map(previous.forms.map((f) => [f.selector, f]));
    for (const [sel, prev] of prevForms) {
      const curr = current.forms.find((f) => f.selector === sel);
      if (!curr) continue;
      if ((prev.action || '') !== (curr.action || '')) {
        changes.push({
          type: 'form_action_changed',
          title: `Form action changed (${sel})`,
          evidence: { previous: prev.action, current: curr.action },
          impact: 'Form submissions may go to a different endpoint.',
          confidence: 'verified',
        });
      }
      const prevFields = prev.fields.map((f) => f.name).sort().join(',');
      const currFields = curr.fields.map((f) => f.name).sort().join(',');
      if (prevFields !== currFields) {
        changes.push({
          type: 'form_fields_changed',
          title: `Form fields changed (${sel})`,
          evidence: { previous: prev.fields, current: curr.fields },
          impact: 'Submitted payload structure has changed.',
          confidence: 'verified',
        });
      }
    }

    // 3. Redirect destination
    if (
      normalizeUrlForSignature(previous.finalUrl) !==
      normalizeUrlForSignature(current.finalUrl)
    ) {
      changes.push({
        type: 'redirect_changed',
        title: 'Final landing URL changed',
        evidence: {
          previous: previous.finalUrl,
          current: current.finalUrl,
        },
        impact: 'Entry experience differs from the previous scan.',
        confidence: 'verified',
      });
    }

    // 4. Network signatures: report disappearance of previously-seen XHR/fetch
    const prevNet = new Set(
      previous.network
        .filter((n) => n.resourceType !== 'document')
        .map((n) => `${n.method} ${n.urlPattern}`)
    );
    const currNet = new Set(
      current.network
        .filter((n) => n.resourceType !== 'document')
        .map((n) => `${n.method} ${n.urlPattern}`)
    );
    const removed: string[] = [];
    for (const k of prevNet) if (!currNet.has(k)) removed.push(k);
    if (removed.length > 0 && removed.length <= 10) {
      changes.push({
        type: 'network_request_changed',
        title: 'Previously observed API calls are missing',
        evidence: { previous: removed, current: null },
        impact: 'Data flow to the backend may have changed.',
        confidence: 'strong',
      });
    }

    // 5. Headings
    const prevHeadings = new Set(previous.visibleHeadings);
    const removedHeadings = previous.visibleHeadings.filter(
      (h) => !current.visibleHeadings.includes(h)
    );
    if (removedHeadings.length > 0 && prevHeadings.size > 0) {
      const significant = removedHeadings.filter((h) => h.length > 6);
      if (significant.length > 0) {
        changes.push({
          type: 'heading_removed',
          title: 'Key page headings removed',
          evidence: { previous: significant, current: current.visibleHeadings },
          impact: 'Page content/messaging has changed.',
          confidence: 'strong',
        });
      }
    }

    // 6. New console errors
    const prevErr = new Set(previous.consoleErrorSignatures);
    const newErrors = current.consoleErrorSignatures.filter((e) => !prevErr.has(e));
    if (newErrors.length > 0) {
      changes.push({
        type: 'new_console_errors',
        title: 'New console errors detected since last scan',
        evidence: { previous: previous.consoleErrorSignatures, current: newErrors },
        impact: 'Possible regression in JavaScript runtime behavior.',
        confidence: 'strong',
      });
    }

    // 7. Chatbot quality + consistency
    if (current.chatbot && previous.chatbot) {
      const prevA = previous.chatbot.answers;
      const currA = current.chatbot.answers;
      for (const prompt of Object.keys(currA)) {
        const p = prevA[prompt];
        const c = currA[prompt];
        if (!p || !c) continue;
        if (p.ok && c.ok && p.normalized !== c.normalized) {
          changes.push({
            type: 'chatbot_inconsistent_response',
            title: `Chatbot answer changed for prompt: "${prompt}"`,
            evidence: { previous: p.raw, current: c.raw },
            impact: 'Users may receive inconsistent information.',
            confidence: 'strong',
          });
        }
      }
    }
    if (current.chatbot) {
      for (const issue of current.chatbot.issues) {
        changes.push({
          type: 'chatbot_quality_issue',
          title: issue.title,
          evidence: { previous: null, current: issue.detail },
          impact: issue.impact,
          confidence: 'strong',
        });
      }
    }

    return changes;
  }
}

function looksLikeCTA(text: string): boolean {
  const t = text.toLowerCase();
  return /(sign ?up|log ?in|get started|start|buy|book|contact|subscribe|try|demo|download|register|checkout)/.test(
    t
  );
}

// ============================================================================
// REPORT FORMATTER
// ============================================================================

export function formatBehaviorChangeReport(changes: BehaviorChange[]): string {
  if (changes.length === 0) {
    return '✓ No behavior changes detected since previous scan.';
  }
  const lines: string[] = [];
  lines.push('');
  lines.push('🧭 Behavior Consistency — Changes since last scan:');
  lines.push('─'.repeat(60));
  changes.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.title}  [${c.confidence}]`);
    lines.push(`   Impact: ${c.impact}`);
    lines.push(`   Previous: ${truncate(JSON.stringify(c.evidence.previous))}`);
    lines.push(`   Current:  ${truncate(JSON.stringify(c.evidence.current))}`);
    lines.push('');
  });
  return lines.join('\n');
}

function truncate(s: string, n = 200): string {
  if (!s) return 'n/a';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
