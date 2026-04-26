// Lightweight client-side URL normalizer + "did you mean?" suggestions.
// No network calls — pure heuristics so it stays instant.

const COMMON_TLDS = ["com", "org", "net", "io", "co", "app", "dev", "ai", "xyz", "lovable.app"];
const COMMON_PREFIXES = ["", "www."];

export interface UrlSuggestion {
  url: string;
  reason: string;
}

export function normalizeUrl(input: string): string {
  let v = input.trim();
  if (!v) return v;
  // Strip whitespace inside
  v = v.replace(/\s+/g, "");
  // Add scheme if missing
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

export function isProbablyValidUrl(input: string): boolean {
  try {
    const u = new URL(normalizeUrl(input));
    // Must have a dot in the host (not just "localhost"-style for prod scans)
    return u.hostname.includes(".") && !u.hostname.endsWith(".");
  } catch {
    return false;
  }
}

export function suggestUrls(input: string): UrlSuggestion[] {
  const cleaned = input.trim().replace(/\s+/g, "").replace(/^https?:\/\//i, "");
  if (!cleaned) return [];

  const out: UrlSuggestion[] = [];
  const seen = new Set<string>();
  const push = (url: string, reason: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ url, reason });
    }
  };

  // Fix common typos in the scheme/separator
  const stripped = cleaned
    .replace(/^htt?ps?[:;]?\/?\/?/, "")
    .replace(/[,;]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  // If they typed something like "projectbond.lovable.app" — already valid, just normalize
  if (/\.[a-z]{2,}/i.test(stripped)) {
    push(`https://${stripped}`, "Add https://");
    push(`https://www.${stripped}`, "Add www.");
    return out.slice(0, 4);
  }

  // No TLD detected — suggest common ones
  const base = stripped.split("/")[0];
  for (const prefix of COMMON_PREFIXES) {
    for (const tld of COMMON_TLDS) {
      push(`https://${prefix}${base}.${tld}`, `Try .${tld}`);
      if (out.length >= 5) return out;
    }
  }
  return out.slice(0, 5);
}
