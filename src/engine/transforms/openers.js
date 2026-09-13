import { OPENERS } from '../dictionaries/openers.js';
import { capitalizeFirst, tidy } from '../text.js';

/** Replace or drop a formal transition at the start of a sentence. */
export function rewriteOpener(sentence, rng, rate = 1, used = new Set()) {
  for (const [re, alts] of OPENERS) {
    if (!re.test(sentence)) continue;
    if (!rng.chance(rate)) return { sentence, changed: false };
    const fresh = alts.filter((a) => !used.has(a));
    const alt = fresh.length ? rng.pick(fresh) : '';
    if (alt) used.add(alt);
    let out = sentence.replace(re, alt);
    out = capitalizeFirst(tidy(out));
    return { sentence: out, changed: out !== sentence };
  }
  return { sentence, changed: false };
}
