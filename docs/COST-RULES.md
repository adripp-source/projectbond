# ProjectBond — Cost & Infrastructure Rules

## CRITICAL: Before Using ANY External Service

**Every external tool, API, or service must be evaluated:**

1. **Is it free?** (Free tier, open-source, self-hosted)
2. **If not free: Can we build it ourselves?**
3. **If we can't build it: Talk to me first**

Do NOT:
- Add paid APIs
- Add usage-priced services
- Add cloud services with recurring costs
- Add proprietary infrastructure
- Assume "we'll deal with costs later"

---

## Services We're Building Ourselves

### Browser Execution
- ❌ Browserbase (paid)
- ❌ BrowserStack (paid)
- ✓ Playwright (free, self-hosted)

### Network Capture
- ❌ Paid proxy networks
- ✓ Playwright network interception (free)

### Screenshots/Video
- ❌ External screenshot APIs
- ✓ Playwright screenshots (free)
- ✓ ffmpeg for video encoding (free, open-source)

### Storage
- ❌ AWS S3 (if we need to scale)
- ✓ Local filesystem (MVP)
- ✓ Self-hosted S3-compatible (later: MinIO)

### Database
- ❌ Managed PostgreSQL (costs scale)
- ✓ Self-hosted PostgreSQL in Docker (MVP)
- ✓ VPS PostgreSQL (later: Digital Ocean $5-12/month)

### Job Queue
- ❌ Paid queuing services
- ✓ BullMQ + Redis (free, self-hosted)

### Monitoring
- ❌ DataDog, New Relic, Sentry (paid)
- ✓ Application logging (free)
- ✓ Self-hosted monitoring (later: Prometheus)

---

## Services We're Using (Free/Open-Source)

### Development
- Node.js (free)
- TypeScript (free)
- Express/Fastify (free)
- Next.js (free)
- Playwright (free)
- Docker (free)
- Redis (free)
- PostgreSQL (free)
- Tailwind (free)
- Shadcn (free)

### Infrastructure
- GitHub (free for public repos)
- Docker Hub (free tier)
- Linux VPS (starting cost ~$5-20/month)

---

## Services We'll NEVER Use

- ❌ OpenAI / Anthropic / Gemini (for analysis)
- ❌ Paid screenshot APIs
- ❌ Paid security scanning
- ❌ Paid SEO tools
- ❌ Paid performance APIs
- ❌ Browserbase / BrightData (browser/proxy)
- ❌ DataForSEO
- ❌ Any usage-priced service

---

## Before Adding Any New Dependency

Ask:

1. **What does it do?**
2. **Is there a free/open-source alternative?**
3. **Can we build it ourselves?**
4. **What's the cost if we scale to 100 scans/day?**
5. **If cost > $0/month, did we discuss this?**

If the answer to #5 is "no", don't add it.

---

## Cost Targets

### MVP (Single VPS)
- Infrastructure: ~$10-20/month
- Storage: <10GB local
- Scaling: Single machine, sequential scanning

### Phase 2+ (If Scaling)
- Infrastructure: ~$50-100/month (multiple VPS)
- Storage: S3-compatible (MinIO self-hosted or Backblaze B2 ~$6/month)
- Scaling: Distributed workers, parallel scanning

### Never
- Recurring "per-scan" charges
- Usage-based billing
- Proprietary infrastructure lock-in

---

## If We Need Something Expensive

**Process:**

1. Copilot identifies the need
2. Copilot evaluates free alternatives
3. Copilot documents why it's needed
4. Copilot talks to user FIRST
5. User decides (yes/no/build-it-ourselves)
6. Then implement

Don't assume. Don't add costs silently.

---

## Open-Source Alternatives We Know

| Need | Paid | Free Alternative |
|------|------|-------------------|
| Browser automation | Browserbase | Playwright ✓ |
| Screenshots | Screenshot APIs | Playwright ✓ |
| Video recording | Services | ffmpeg ✓ |
| Job queue | AWS SQS | BullMQ + Redis ✓ |
| Object storage | AWS S3 | MinIO ✓ |
| Monitoring | DataDog | Prometheus ✓ |
| Log aggregation | ELK/Splunk | ELK Stack (self-hosted) ✓ |
| CI/CD | CircleCI | GitHub Actions ✓ |
| Database | Managed PG | Self-hosted PG ✓ |
| Container registry | Docker Hub Pro | GitHub Container Registry ✓ |

All marked ✓ = we use these.

---

## Rule

If it costs money beyond basic hosting:

# Tell me first.

No exceptions.
