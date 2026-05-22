# ProjectBond — MVP Implementation Focus

## The Core Problem We're Solving

User has a website. Users are getting stuck or confused.

**ProjectBond finds where they get stuck. With proof.**

That's it.

---

## What Workflow Failure Actually Looks Like

### Success State
- Form submitted successfully
- User advanced to next step
- Payment went through
- Confirmation appeared
- Modal closed properly
- Navigation worked

### Failure State
- Button click did nothing
- Form validation silently failed
- Infinite loading spinner
- Page crash / blank screen
- Redirect loop
- Network error
- Element missing entirely

### Confusion State (The Real Value)
- Multiple conflicting CTAs
- "Continue" button is hidden
- Navigation dead-end
- No clear next step
- Mobile layout hides action
- Form field disabled with no explanation
- Overlay blocks interaction

**Confusion state detection = the moat.**

---

## Current Goal

NOT: Complete MVP in X weeks.

NOT: Multiple devices, browsers, languages.

NOT: Scalability, distribution, performance.

## Goal:

# Find one undeniable workflow-breaking issue automatically with proof.

That's the milestone.

When ProjectBond can do THIS:

```
User: "Here's my site. Find workflow problems."

ProjectBond runs.

ProjectBond: "Your signup button is hidden on mobile Safari behind a sticky header. Here's the screenshot."

User: "Oh shit. We didn't know. Let's fix it."
```

THAT is success.

---

## What "Discovery" Really Means (MVP Version)

NOT: Complex route graphing.

YES: Simple extraction of important pages:

```javascript
// What we extract from homepage:
{
  url: "https://example.com",
  title: "...",
  primaryCTA: {
    text: "Sign Up",
    selector: "button.cta-primary",
    href: "/signup"
  },
  navigationLinks: [
    { text: "Features", href: "/features" },
    { text: "Pricing", href: "/pricing" },
    { text: "Contact", href: "/contact" }
  ],
  forms: [
    { id: "contact-form", fields: ["email", "message"] }
  ]
}
```

Not a graph. Not complex. Just: **What's important on this page?**

---

## Playwright Runner (MVP)

One browser. Mobile only to start.

```typescript
// Pseudocode
async function testPage(url: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone 12
    userAgent: "iPhone 12 Safari"
  });
  
  const page = await context.newPage();
  
  // Capture network + console BEFORE loading
  const beforeErrors = [];
  page.on('console', msg => beforeErrors.push(msg.text()));
  
  // Load page
  await page.goto(url);
  
  // Take screenshot
  const beforeScreenshot = await page.screenshot();
  
  // Find primary CTA
  const cta = await page.$('button.cta-primary, a.cta-primary');
  
  if (!cta) {
    return {
      status: 'failed',
      reason: 'Primary CTA not found',
      screenshot: beforeScreenshot
    };
  }
  
  // Check if CTA is visible
  const isVisible = await page.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0 && rect.height > 0;
  }, cta);
  
  if (!isVisible) {
    return {
      status: 'failed',
      reason: 'CTA is off-screen or hidden',
      screenshot: beforeScreenshot
    };
  }
  
  // Click it
  try {
    await cta.click();
    await page.waitForNavigation({ timeout: 5000 });
  } catch (e) {
    return {
      status: 'failed',
      reason: `Click failed: ${e.message}`,
      screenshot: beforeScreenshot,
      consoleErrors: beforeErrors
    };
  }
  
  const afterScreenshot = await page.screenshot();
  
  return {
    status: 'success',
    beforeScreenshot,
    afterScreenshot,
    consoleErrors: beforeErrors
  };
}
```

That's it.

No concurrency. No worker pools. Just: **Does clicking the CTA work?**

---

## Safe Interaction Engine (MVP)

NOT: Complex classifier.

YES: Simple whitelist of safe actions:

```typescript
const SAFE_CTA_TEXTS = [
  'Sign Up',
  'Get Started',
  'Try Free',
  'Continue',
  'Next',
  'Learn More',
  'View',
  'Explore',
  'Download',
  'Start Trial',
  'Get Free Account'
];

const DESTRUCTIVE_PATTERNS = [
  'Delete',
  'Remove',
  'Cancel Account',
  'Unsubscribe',
  'Logout'
];

function isSafeToClick(buttonText: string): boolean {
  if (DESTRUCTIVE_PATTERNS.some(p => buttonText.includes(p))) {
    return false;
  }
  return SAFE_CTA_TEXTS.some(s => buttonText.includes(s));
}
```

That's the entire classifier.

---

## Issue Detection (MVP)

The hard part: What constitutes a real issue?

```typescript
interface DetectedIssue {
  type: 'hidden_cta' | 'dead_click' | 'infinite_load' | 'crash' | 'form_fail' | 'confusion';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence: {
    screenshot: Buffer;
    consoleErrors?: string[];
    reproductionSteps: string[];
  };
}

// Examples of what we detect:

// 1. Hidden CTA
{
  type: 'hidden_cta',
  severity: 'critical',
  description: 'Signup CTA is off-screen on mobile',
  evidence: {
    screenshot: [...],
    reproductionSteps: [
      'Visit site on iPhone 12',
      'Scroll to signup section',
      "Notice: 'Sign Up' button is below fold, blocked by sticky header"
    ]
  }
}

// 2. Dead Click
{
  type: 'dead_click',
  severity: 'critical',
  description: 'Continue button does not advance workflow',
  evidence: {
    screenshot: [...],
    consoleErrors: ['Uncaught TypeError: Cannot read property...'],
    reproductionSteps: [
      'Click Continue button',
      'Page does not advance',
      'Console shows JavaScript error'
    ]
  }
}

// 3. Confusion State
{
  type: 'confusion',
  severity: 'high',
  description: 'Multiple conflicting CTAs with unclear purpose',
  evidence: {
    screenshot: [...],
    reproductionSteps: [
      'User sees 3 blue buttons',
      'None have clear labels',
      '"Learn More" vs "Get Started" vs "View Plans" unclear'
    ]
  }
}

// 4. Infinite Loading
{
  type: 'infinite_load',
  severity: 'critical',
  description: 'Page never finishes loading after form submission',
  evidence: {
    screenshot: [...],
    reproductionSteps: [
      'Fill contact form',
      'Click Submit',
      'Spinner appears and never stops (30+ seconds)'
    ]
  }
}
```

---

## JSON Report (MVP)

```json
{
  "url": "https://example.com",
  "scanTime": "2025-05-23T10:30:00Z",
  "issues": [
    {
      "id": "issue-1",
      "title": "Signup CTA hidden on mobile Safari",
      "severity": "critical",
      "type": "hidden_cta",
      "workflow": "signup",
      "device": "iPhone 12 (375x812)",
      "browser": "Chromium (mobile emulation)",
      "description": "The 'Sign Up' button is positioned below the viewport on mobile Safari and is blocked by a sticky header. Users cannot access it without scrolling past relevant content.",
      "reproductionSteps": [
        "Visit https://example.com on iPhone 12",
        "Scroll to the signup section",
        "Observe: 'Sign Up' button is off-screen, hidden by sticky navigation"
      ],
      "evidence": {
        "beforeScreenshot": "artifacts/issue-1-before.png",
        "afterScreenshot": "artifacts/issue-1-after.png",
        "consoleErrors": []
      },
      "recommendation": "Adjust mobile layout so primary CTA is visible without scrolling past hero section"
    },
    {
      "id": "issue-2",
      "title": "Contact form silently fails on submit",
      "severity": "high",
      "type": "form_fail",
      "workflow": "contact",
      "device": "iPhone 12",
      "browser": "Chromium (mobile emulation)",
      "description": "User fills contact form and clicks Submit. Page shows no confirmation or error. Form submission failed silently.",
      "reproductionSteps": [
        "Visit https://example.com/contact on mobile",
        "Fill email and message fields",
        "Click Submit button",
        "Notice: No confirmation message appears"
      ],
      "evidence": {
        "beforeScreenshot": "artifacts/issue-2-before.png",
        "afterScreenshot": "artifacts/issue-2-after.png",
        "consoleErrors": [
          "Failed to fetch: 500 Internal Server Error on POST /api/contact"
        ]
      },
      "recommendation": "Add error handling and user feedback on form submission failure"
    }
  ],
  "summary": {
    "totalIssues": 2,
    "critical": 1,
    "high": 1,
    "medium": 0,
    "low": 0,
    "workflowsCovered": ["signup", "contact"]
  }
}
```

---

## What's NOT in MVP

- ❌ Distributed workers
- ❌ Job queues
- ❌ Replay systems
- ❌ Multiple browsers
- ❌ Multiple devices
- ❌ Multiple languages
- ❌ Source intelligence
- ❌ Performance analysis
- ❌ Infrastructure scanning
- ❌ Priority engine
- ❌ Dashboard
- ❌ AI anything
- ❌ Timeline estimates

---

## The Hard Problems (Why We Don't Estimate)

These are deceptively complex:

### 1. Workflow Detection is Harder Than It Looks
- How do we know what counts as a "workflow"?
- How do we distinguish primary flow from secondary navigation?
- How do we handle nested workflows?
- How do we know when a workflow is complete vs stuck?

### 2. Safe Interaction Logic is Harder Than It Looks
- How do we distinguish "Continue" (safe) from "Skip" (might be safe)?
- How do we detect form fields that are actually inputs vs styling?
- How do we know when a page is still loading vs permanently broken?
- How do we avoid false positives on "click did nothing"?

### 3. Confusion-State Detection is Harder Than It Looks
- How do we measure if a UX is confusing without being overly subjective?
- How do we detect conflicting CTAs vs legitimate multiple options?
- How do we know if something is "hidden" vs intentionally off-screen?
- How do we validate our confusion detection on real sites?

These problems require:
- Real-world testing
- Iteration
- Feedback loops
- Refinement

Not estimates.

---

## Current Milestone

Build until ProjectBond can:

```
Input: https://example.com
↓
Auto-discover: primary CTA on homepage
↓
Auto-test: click CTA on mobile Safari
↓
Auto-detect: if CTA is hidden or if click fails
↓
Auto-report: with screenshot + reproduction steps
↓
Output: One undeniable workflow issue
```

That's the milestone.

When that works reliably on 3-5 real production sites, we have proven the core concept.

Then we iterate.

Then we expand.

---

## Success Definition

When someone runs:

```bash
npm run scan https://example.com
```

And sees:

```
✓ Found 1 critical issue: Signup button hidden on mobile
  Screenshot: artifacts/signup-hidden.png
  Steps: Visit on iPhone 12 → Scroll to form section → Button off-screen
```

And they say:

**"We had no idea. This is incredibly valuable."**

That's success.

Not features.
Not scale.
Not architecture.

Just: **Undeniable usefulness.**
