// Plain-English rewriter. No AI, no API calls. Pure dictionary + sentence shortening.
// Used by the Simplify provider when a user double-clicks any text.

const REPLACEMENTS: [RegExp, string][] = [
  // Tech / web
  [/\bauthentication\b/gi, "login"],
  [/\bauthenticated\b/gi, "logged-in"],
  [/\bauthorize(d|s)?\b/gi, "allow"],
  [/\bcredentials?\b/gi, "login info"],
  [/\bendpoint(s)?\b/gi, "web address"],
  [/\bAPI(s)?\b/g, "data link"],
  [/\bSPA( shell)?\b/gi, "app page"],
  [/\bSSR\b/g, "server page"],
  [/\bDOM\b/g, "page"],
  [/\bviewport\b/gi, "screen"],
  [/\baccessibility\b/gi, "ease of use"],
  [/\bcrawler\b/gi, "scanner"],
  [/\bcrawl(ed|ing)?\b/gi, "scan$1"],
  [/\bdeterministic\b/gi, "exact"],
  [/\bheuristic(s)?\b/gi, "rule$1"],
  [/\bremediation\b/gi, "fix"],
  [/\boptimi[sz]e(d|s)?\b/gi, "speed up"],
  [/\bperformance\b/gi, "speed"],
  [/\blatency\b/gi, "wait time"],
  [/\bthrottl(e|ed|ing)\b/gi, "slow$1 down"],
  [/\binitiali[sz]e(d|s)?\b/gi, "start$1"],
  [/\bconfigur(e|ed|ation)\b/gi, "set up"],
  [/\binstantiate(d|s)?\b/gi, "create"],
  [/\bvalidat(e|ed|ion)\b/gi, "check"],
  [/\bverif(y|ied|ication)\b/gi, "check"],
  [/\bdeploy(ed|ment)?\b/gi, "publish"],
  [/\bproduction\b/gi, "live site"],
  [/\bstaging\b/gi, "test site"],
  [/\brepository\b/gi, "code folder"],
  [/\brepo\b/gi, "code folder"],
  [/\bdependenc(y|ies)\b/gi, "needed package"],
  // QA / scanning
  [/\bregression(s)?\b/gi, "old bug coming back"],
  [/\breproduc(e|tion|ible)\b/gi, "repeat"],
  [/\bevidence\b/gi, "proof"],
  [/\bsever(e|ity)\b/gi, "how bad"],
  [/\bcritical\b/gi, "very bad"],
  [/\bblocker(s)?\b/gi, "stopper$1"],
  [/\bfunctional\b/gi, "working"],
  [/\bnon-functional\b/gi, "not working"],
  // General jargon
  [/\bleverag(e|es|ed|ing)\b/gi, "use"],
  [/\butili[sz]e(d|s)?\b/gi, "use"],
  [/\bfacilitat(e|es|ed|ing)\b/gi, "help"],
  [/\bsubsequently\b/gi, "then"],
  [/\baccordingly\b/gi, "so"],
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bat this point in time\b/gi, "now"],
  [/\bin the event that\b/gi, "if"],
  [/\bprior to\b/gi, "before"],
  [/\bcommence(d|s)?\b/gi, "start"],
  [/\bterminate(d|s)?\b/gi, "end"],
  [/\bdemonstrat(e|es|ed)\b/gi, "show"],
  [/\bnumerous\b/gi, "many"],
  [/\bapproximately\b/gi, "about"],
  [/\badditional\b/gi, "more"],
  [/\binitial\b/gi, "first"],
  [/\bcomprehensive\b/gi, "full"],
  [/\bsignificant\b/gi, "big"],
  [/\boptimal\b/gi, "best"],
  [/\bsubstantial\b/gi, "big"],
  [/\bobjective\b/gi, "goal"],
  [/\bmethodology\b/gi, "method"],
];

export function simplifyText(input: string): string {
  if (!input) return input;
  let out = input;
  for (const [pat, rep] of REPLACEMENTS) out = out.replace(pat, rep);
  // Break very long sentences (>22 words) at commas/semicolons.
  out = out
    .split(/(?<=[.!?])\s+/)
    .map((s) => {
      const words = s.split(/\s+/);
      if (words.length <= 22) return s;
      return s.replace(/[,;]\s+/g, ". ");
    })
    .join(" ");
  return out;
}

export function wasSimplified(original: string, simplified: string): boolean {
  return original.trim() !== simplified.trim();
}
