/**
 * Binary assertion functions for evaluating generated SME skill outputs.
 * Each takes an output string and returns boolean. Skill-aware assertions
 * accept optional skillContent to validate against the skill's reference data.
 */

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract article titles from a skill's Topic Tree section.
 * Returns titles trimmed and lowercased for fuzzy matching.
 */
export function extractTopicTreeTitles(skillContent: string): string[] {
  const treeMatch = skillContent.match(/## Topic Tree\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!treeMatch) return [];

  return treeMatch[1]
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

// ── Grounding Assertions ─────────────────────────────────────────────

/**
 * Must reference a specific article title from the skill's Topic Tree,
 * or a valid SF documentation URL. The skill's local docs are the
 * primary source -- outputs should cite titles that exist in the tree.
 */
export function citesSource(output: string, skillContent?: string): boolean {
  // Check for SF documentation URLs (always valid)
  const urlPatterns = [
    /https:\/\/help\.salesforce\.com/,
    /https:\/\/developer\.salesforce\.com/,
    /https:\/\/trailhead\.salesforce\.com/,
  ];
  if (urlPatterns.some((p) => p.test(output))) return true;

  // Check for Topic Tree title references if skill content provided
  if (skillContent) {
    const titles = extractTopicTreeTitles(skillContent);
    if (titles.length > 0) {
      const outputLower = output.toLowerCase();
      // Match if the output contains any topic tree title (4+ chars to avoid false positives)
      return titles.some(
        (title) => title.length >= 4 && outputLower.includes(title.toLowerCase()),
      );
    }
  }

  // Fallback: check for explicit citation patterns
  const citationPatterns = [
    /Source:\s*\[/i,
    /Salesforce Help:\s*.+/i,
    /See\s+"[^"]{10,}"/,
    /article\s+"[^"]{10,}"/i,
  ];
  return citationPatterns.some((p) => p.test(output));
}

/**
 * If URLs are present, they must be from approved SF domains only.
 */
export function noHallucinatedUrls(output: string): boolean {
  const urlPattern = /https?:\/\/[^\s)>\]]+/g;
  const urls = output.match(urlPattern);
  if (!urls) return true; // no URLs is fine

  const allowedDomains = [
    'help.salesforce.com',
    'developer.salesforce.com',
    'trailhead.salesforce.com',
  ];

  return urls.every((url) => {
    try {
      const hostname = new URL(url).hostname;
      return allowedDomains.some(
        (d) => hostname === d || hostname.endsWith('.' + d),
      );
    } catch {
      return false; // malformed URL counts as hallucinated
    }
  });
}

/**
 * Should not contain fabricated SF object names.
 */
export function admitsWhenUncovered(output: string): boolean {
  const fabricatedObjects = [
    'CommerceCloudManager',
    'B2BStoreConfig',
    'StoreAdminService',
    'CommerceCartEngine',
    'B2BCommerceController',
    'StoreConfigurationManager',
    'CommerceCloudService',
    'B2BStoreManager',
    'CommerceAdminPortal',
    'StoreSetupWizard',
  ];
  const lower = output.toLowerCase();
  return !fabricatedObjects.some((obj) => lower.includes(obj.toLowerCase()));
}

// ── Structural Assertions ────────────────────────────────────────────

/**
 * Answers over 100 words must have headers, numbered steps, or bullet structure.
 */
export function hasStructuredAnswer(output: string): boolean {
  const wordCount = output.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 100) return true; // short answers get a pass

  const structurePatterns = [
    /^#{1,6}\s+/m, // markdown headers
    /^\d+\.\s+/m, // numbered steps
    /^[-*]\s+/m, // bullet points
    /^\s*[-*]\s+/m, // indented bullets
    /\*\*[^*]+\*\*/m, // bold text (structural emphasis)
  ];
  return structurePatterns.some((p) => p.test(output));
}

/**
 * Between 50-2000 words.
 */
export function withinReasonableLength(output: string): boolean {
  const wordCount = output.split(/\s+/).filter(Boolean).length;
  return wordCount >= 50 && wordCount <= 2000;
}

/**
 * Must NOT contain generic AI filler phrases.
 */
export function noGenericFiller(output: string): boolean {
  const fillerPhrases = [
    'as an ai language model',
    "i don't have access to real-time",
    'please consult the official documentation',
    "i'd recommend reaching out to salesforce support",
    'it depends on your specific use case',
    'as a large language model',
    'i cannot access external',
    'i was trained on data up to',
  ];
  const lower = output.toLowerCase();
  return !fillerPhrases.some((phrase) => lower.includes(phrase));
}

// ── Domain Assertions ────────────────────────────────────────────────

/**
 * When discussing buyers at length (3+ mentions), must use proper terms
 * like "Buyer Group" or "Buyer Account", not just generic "buyer".
 */
export function usesCorrectSfTerminology(output: string): boolean {
  const buyerMentions = (output.match(/\bbuyer\b/gi) || []).length;
  if (buyerMentions < 3) return true; // not discussing buyers at length

  const properTerms = [
    /Buyer\s+Group/i,
    /Buyer\s+Account/i,
    /Buyer\s+Manager/i,
    /Buyer\s+Profile/i,
    /Buyer\s+User/i,
  ];
  return properTerms.some((p) => p.test(output));
}

/**
 * Substantive answers (80+ words) must reference at least one actual
 * SF Commerce term.
 */
export function mentionsRelevantObjects(output: string): boolean {
  const wordCount = output.split(/\s+/).filter(Boolean).length;
  if (wordCount < 80) return true; // short answers get a pass

  const commerceTerms = [
    /\bB2B\b/,
    /\bB2C\b/,
    /\bD2C\b/,
    /Commerce\s+Store/i,
    /Experience\s+Builder/i,
    /Buyer\s+Group/i,
    /Entitlement/i,
    /\bCatalog\b/i,
    /Product\s+Categ/i,
    /Commerce\s+Search/i,
    /\bEinstein\b/i,
    /\bLWR\b/,
    /\bAura\b/i,
    /Permission\s+Set/i,
    /\bCart\b/i,
    /\bCheckout\b/i,
    /\bOrder\b/i,
    /\bPromotion/i,
    /Price\s+Book/i,
    /Revenue\s+Cloud/i,
    /\bCMS\b/,
    /\bStorefront\b/i,
    /Commerce\s+App/i,
    /\bSetup\b/i,
  ];
  return commerceTerms.some((p) => p.test(output));
}

/**
 * Must contain step indicators: numbered steps, navigation verbs, etc.
 */
export function includesActionableSteps(output: string): boolean {
  const stepIndicators = [
    /^\d+\.\s+/m, // numbered steps
    /Navigate\s+to/i,
    /\bClick\b/i,
    /Go\s+to\s+Setup/i,
    /\bEnable\b/i,
    /\bSelect\b/i,
    /In\s+Setup/i,
    /In\s+Commerce/i,
    /In\s+Experience\s+Builder/i,
    /\bStep\s+\d/i,
  ];
  return stepIndicators.some((p) => p.test(output));
}

// ── Aggregate Functions ──────────────────────────────────────────────

export function runAllAssertions(
  output: string,
  skillContent?: string,
): Record<string, boolean> {
  return {
    citesSource: citesSource(output, skillContent),
    noHallucinatedUrls: noHallucinatedUrls(output),
    admitsWhenUncovered: admitsWhenUncovered(output),
    hasStructuredAnswer: hasStructuredAnswer(output),
    withinReasonableLength: withinReasonableLength(output),
    noGenericFiller: noGenericFiller(output),
    usesCorrectSfTerminology: usesCorrectSfTerminology(output),
    mentionsRelevantObjects: mentionsRelevantObjects(output),
    includesActionableSteps: includesActionableSteps(output),
  };
}

export function allPass(output: string, skillContent?: string): boolean {
  const results = runAllAssertions(output, skillContent);
  return Object.values(results).every(Boolean);
}
