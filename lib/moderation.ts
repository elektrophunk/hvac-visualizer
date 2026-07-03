// Free keyword prescreen for obviously abusive prompt text. This is a fast
// first line only — the real gate is the Claude vision content_flag (schema
// v2.1) in the worker, which sees prompt + image together before any fal call.
// Patterns use word boundaries and stay unambiguous to avoid false positives
// on legitimate HVAC prompts.
const BLOCKED_PATTERNS: RegExp[] = [
  /\b(nud(?:e|ity)|naked|nsfw|porn\w*|erotic\w*|topless|undress\w*|hentai|xxx)\b/i,
  /\b(sexual|sexy|seductive|lingerie|bikini)\b/i,
  /\b(gore|behead\w*|dismember\w*|mutilat\w*|corpse|blood\s*bath)\b/i,
  /\b(csam|child\s*(?:porn|abuse))\b/i,
];

export type PrescreenResult = { ok: true } | { ok: false; reason: string };

export function prescreenPrompt(prompt: string): PrescreenResult {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        ok: false,
        reason:
          "This request can't be processed. Describe HVAC equipment to place in your site photo.",
      };
    }
  }
  return { ok: true };
}
