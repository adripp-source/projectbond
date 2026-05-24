/**
 * Chatbot Tester — quiet, deterministic, read-only.
 *
 * Detects on-page chatbot/assistant widgets via heuristic DOM markers,
 * sends a small fixed set of SAFE prompts twice each, and records
 * answers for consistency + quality comparison.
 *
 * No AI APIs. No external services. No payments. No real emails.
 * Bias to false negatives: if a chatbot is not confidently detected,
 * we skip silently.
 */

import type { Page, Frame } from 'playwright';

const SAFE_PROMPTS = [
  'What does this company do?',
  'How do I contact support?',
  'What is the pricing?',
  'Can I book a demo?',
  'Where can I sign up?',
];

const CHATBOT_HINT_SELECTORS = [
  '[id*="intercom" i]',
  '[class*="intercom" i]',
  '[id*="drift" i]',
  '[class*="drift" i]',
  '[id*="crisp" i]',
  '[class*="crisp-client" i]',
  '[id*="hubspot" i] [class*="messages" i]',
  '[class*="tawk" i]',
  '[class*="livechat" i]',
  '[id*="chat" i] textarea',
  '[id*="chat" i] input[type="text"]',
  '[aria-label*="chat" i] textarea',
  '[aria-label*="assistant" i] textarea',
  'iframe[title*="chat" i]',
  'iframe[title*="assistant" i]',
  'iframe[src*="intercom" i]',
  'iframe[src*="drift" i]',
  'iframe[src*="crisp" i]',
];

const LAUNCHER_SELECTORS = [
  'button[aria-label*="chat" i]',
  'button[aria-label*="message" i]',
  '[class*="launcher" i]',
  '[class*="chat-bubble" i]',
];

export interface ChatbotAnswer {
  ok: boolean;
  raw: string;
  normalized: string;
  latencyMs: number;
}

export interface ChatbotIssue {
  type:
    | 'no_response'
    | 'empty_response'
    | 'repeated_response'
    | 'inconsistent_response'
    | 'covers_cta'
    | 'too_slow';
  title: string;
  detail: string;
  impact: string;
}

export interface ChatbotTestResult {
  detected: boolean;
  vendor?: string;
  answers: Record<string, ChatbotAnswer>;
  issues: ChatbotIssue[];
}

export class ChatbotTester {
  async testIfPresent(page: Page): Promise<ChatbotTestResult | null> {
    const detection = await this.detect(page);
    if (!detection.detected) return null;

    const result: ChatbotTestResult = {
      detected: true,
      vendor: detection.vendor,
      answers: {},
      issues: [],
    };

    // Check for CTA overlap (chatbot launcher covering primary CTAs)
    try {
      const covers = await this.detectsCtaOverlap(page);
      if (covers) {
        result.issues.push({
          type: 'covers_cta',
          title: 'Chatbot blocks signup/contact CTA on current viewport',
          detail: covers,
          impact: 'Users may not be able to reach a primary action.',
        });
      }
    } catch {
      // ignore
    }

    // Try to open chat (best-effort; non-destructive)
    const opened = await this.tryOpenLauncher(page).catch(() => false);
    if (!opened) {
      // We detected a chatbot but couldn't safely interact; skip prompt phase.
      return result;
    }

    const target = await this.findInputTarget(page);
    if (!target) return result;

    // Send each prompt twice to test consistency
    for (const prompt of SAFE_PROMPTS) {
      const first = await this.sendPromptSafely(page, target, prompt).catch(() => null);
      const second = await this.sendPromptSafely(page, target, prompt).catch(() => null);
      if (!first || !first.ok) {
        result.answers[prompt] = first || {
          ok: false,
          raw: '',
          normalized: '',
          latencyMs: 0,
        };
        result.issues.push({
          type: first ? 'empty_response' : 'no_response',
          title: `Chatbot did not answer: "${prompt}"`,
          detail: 'No response captured within timeout.',
          impact: 'Users cannot get help with basic questions.',
        });
        continue;
      }
      result.answers[prompt] = first;

      if (second && second.ok) {
        if (second.normalized !== first.normalized) {
          result.issues.push({
            type: 'inconsistent_response',
            title: `Chatbot gave inconsistent answer for: "${prompt}"`,
            detail: `First: ${truncate(first.raw)} | Second: ${truncate(second.raw)}`,
            impact: 'Users may receive conflicting information.',
          });
        }
      }

      if (first.latencyMs > 15000) {
        result.issues.push({
          type: 'too_slow',
          title: `Chatbot response slow for: "${prompt}"`,
          detail: `${first.latencyMs}ms`,
          impact: 'Users likely abandon the chat before getting an answer.',
        });
      }
    }

    return result;
  }

  private async detect(page: Page): Promise<{ detected: boolean; vendor?: string }> {
    for (const sel of CHATBOT_HINT_SELECTORS) {
      const found = await page.$(sel).catch(() => null);
      if (found) {
        const vendor =
          sel.match(/intercom|drift|crisp|hubspot|tawk|livechat/i)?.[0] || 'unknown';
        return { detected: true, vendor };
      }
    }
    return { detected: false };
  }

  private async tryOpenLauncher(page: Page): Promise<boolean> {
    for (const sel of LAUNCHER_SELECTORS) {
      const el = await page.$(sel).catch(() => null);
      if (!el) continue;
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;
      await el.click({ timeout: 2000 }).catch(() => null);
      await page.waitForTimeout(800);
      return true;
    }
    return false;
  }

  private async findInputTarget(
    page: Page
  ): Promise<{ frame: Page | Frame; selector: string } | null> {
    const candidates = [
      'textarea[placeholder*="message" i]',
      'textarea[aria-label*="message" i]',
      'input[placeholder*="message" i]',
      'textarea',
      'input[type="text"]',
    ];
    for (const sel of candidates) {
      const el = await page.$(sel).catch(() => null);
      if (el && (await el.isVisible().catch(() => false))) {
        return { frame: page, selector: sel };
      }
    }
    for (const frame of page.frames()) {
      for (const sel of candidates) {
        const el = await frame.$(sel).catch(() => null);
        if (el && (await el.isVisible().catch(() => false))) {
          return { frame, selector: sel };
        }
      }
    }
    return null;
  }

  private async sendPromptSafely(
    page: Page,
    target: { frame: Page | Frame; selector: string },
    prompt: string
  ): Promise<ChatbotAnswer> {
    const start = Date.now();
    const input = await target.frame.$(target.selector);
    if (!input) return { ok: false, raw: '', normalized: '', latencyMs: 0 };

    await input.fill('').catch(() => null);
    await input.type(prompt, { delay: 15 }).catch(() => null);
    await input.press('Enter').catch(() => null);

    // Poll for an answer (up to 15s). Look for the most recent visible bot message.
    const deadline = Date.now() + 15000;
    let lastSnapshot = '';
    while (Date.now() < deadline) {
      await page.waitForTimeout(500);
      const snapshot = await target.frame
        .evaluate(() => {
          const candidates = Array.from(
            document.querySelectorAll<HTMLElement>(
              '[class*="message" i], [class*="bubble" i], [data-author="bot"], [data-role="assistant"]'
            )
          );
          if (candidates.length === 0) return '';
          const tail = candidates.slice(-3).map((el) => (el.innerText || '').trim());
          return tail.join('\n').slice(0, 1200);
        })
        .catch(() => '');
      if (snapshot && snapshot !== lastSnapshot && snapshot.length > 4) {
        // Wait for stability
        await page.waitForTimeout(800);
        const stable = await target.frame
          .evaluate(() => {
            const candidates = Array.from(
              document.querySelectorAll<HTMLElement>(
                '[class*="message" i], [class*="bubble" i], [data-author="bot"], [data-role="assistant"]'
              )
            );
            const tail = candidates.slice(-3).map((el) => (el.innerText || '').trim());
            return tail.join('\n').slice(0, 1200);
          })
          .catch(() => snapshot);
        return {
          ok: stable.length > 0,
          raw: stable,
          normalized: normalizeAnswer(stable, prompt),
          latencyMs: Date.now() - start,
        };
      }
      lastSnapshot = snapshot;
    }
    return { ok: false, raw: lastSnapshot, normalized: '', latencyMs: Date.now() - start };
  }

  private async detectsCtaOverlap(page: Page): Promise<string | null> {
    return page
      .evaluate(() => {
        const launchers = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[class*="launcher" i],[class*="chat-bubble" i],[aria-label*="chat" i]'
          )
        );
        if (launchers.length === 0) return null;
        const ctas = Array.from(
          document.querySelectorAll<HTMLElement>('a, button')
        ).filter((el) =>
          /sign ?up|get started|start|book|contact|buy|subscribe|try/i.test(
            el.textContent || ''
          )
        );
        for (const l of launchers) {
          const lr = l.getBoundingClientRect();
          if (lr.width === 0 || lr.height === 0) continue;
          for (const c of ctas) {
            const cr = c.getBoundingClientRect();
            if (cr.width === 0 || cr.height === 0) continue;
            const overlap =
              lr.left < cr.right &&
              lr.right > cr.left &&
              lr.top < cr.bottom &&
              lr.bottom > cr.top;
            if (overlap) {
              return `Chat widget overlaps CTA "${(c.textContent || '').trim().slice(0, 60)}"`;
            }
          }
        }
        return null;
      })
      .catch(() => null);
  }
}

function normalizeAnswer(text: string, prompt: string): string {
  return text
    .toLowerCase()
    .replace(prompt.toLowerCase(), '')
    .replace(/\s+/g, ' ')
    .replace(/[0-9]{2,}/g, '#')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .slice(0, 400);
}

function truncate(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
