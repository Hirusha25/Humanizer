import { CONTRACTIONS } from '../dictionaries/contractions.js';
import { matchCase } from '../text.js';

/** Apply contractions with probability `rate` per opportunity. */
export function applyContractions(sentence, rng, rate = 0.8) {
  let count = 0;
  let out = sentence;
  for (const [re, rep] of CONTRACTIONS) {
    re.lastIndex = 0;
    out = out.replace(re, (...args) => {
      const m = args[0];
      if (!rng.chance(rate)) return m;
      const groups = args.slice(1, -2);
      let r = rep.replace(/\$(\d)/g, (_, i) => groups[Number(i) - 1] ?? '');
      if (!/\$\d/.test(rep)) r = matchCase(m, r);
      count++;
      return r;
    });
  }
  return { sentence: out, count };
}
