// Lightweight input sanitization helpers.
// We strip HTML tags and dangerous chars from any free-text user input
// to prevent stored XSS (e.g. a project named "<script>alert(1)</script>").

export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")     // strip tags
    .replace(/[<>]/g, "")        // belt-and-suspenders
    .replace(/javascript:/gi, "") // neutralize js: URLs
    .replace(/on\w+\s*=/gi, "")  // strip inline event handlers
    .trim();
}

export function sanitizeText(input: string, maxLen = 200): string {
  return stripHtml(input).slice(0, maxLen);
}

export function sanitizeUrl(input: string): string {
  const cleaned = stripHtml(input).slice(0, 500);
  // Only allow http/https schemes
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(cleaned)) return `https://${cleaned}`;
  return "";
}
