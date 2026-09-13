import { compiledPhrases } from '../dictionaries/phrases.js';
import { matchCase, capitalizeFirst, tidy } from '../text.js';

/**
 * Replace AI-tell phrases (always) and formal vocabulary (with probability softRate).
 * Returns the rewritten sentence and how many substitutions were made.
 */
export function rewritePhrases(sentence, rng, { softRate = 0.6 } = {}) {
  let count = 0;
  let out = sentence;
  for (const { re, alts, soft } of compiledPhrases()) {
    re.lastIndex = 0;
    if (!re.test(out)) continue;
    re.lastIndex = 0;
    out = out.replace(re, (...args) => {
      const m = args[0];
      const groups = args.slice(1, -2);
      if (soft && !rng.chance(softRate)) return m;
      let alt = rng.pick(alts);
      alt = alt.replace(/\$(\d)/g, (_, i) => groups[Number(i) - 1] ?? '');
      count++;
      return matchCase(m, alt);
    });
  }
  if (count) out = capitalizeFirst(tidy(out));
  return { sentence: out, count };
}
