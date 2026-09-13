import { synonymIndex, isBlocked } from '../dictionaries/synonyms.js';
import { matchCase } from '../text.js';

const TOKEN_RE = /[A-Za-z][A-Za-z'’-]*/g;

/**
 * Swap everyday words for near-synonyms at a given rate. Skips proper nouns,
 * protected placeholders, contractions and blocked contexts.
 */
export function swapSynonyms(sentence, rng, { rate = 0.3, properNouns = new Set() } = {}) {
  const index = synonymIndex();
  const tokens = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(sentence))) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  let out = '';
  let cursor = 0;
  let count = 0;
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const prevChar = sentence[t.start - 1] || '';
    const isFirst = i === 0;
    const lower = t.text.toLowerCase();
    let key = null;
    let span = t;
    let alts = null;

    const skip =
      prevChar === '' ||
      /['’]/.test(t.text) ||
      (!isFirst && /^[A-Z]/.test(t.text)) ||
      properNouns.has(t.text);

    if (!skip) {
      const next = tokens[i + 1];
      if (next && sentence.slice(t.end, next.start) === ' ') {
        const two = `${lower} ${next.text.toLowerCase()}`;
        if (index.has(two) && !isBlocked(two, sentence)) {
          key = two;
          span = { text: sentence.slice(t.start, next.end), start: t.start, end: next.end };
          alts = index.get(two);
        }
      }
      if (!key && index.has(lower) && !isBlocked(lower, sentence)) {
        key = lower;
        alts = index.get(lower);
      }
    }

    if (key && rng.chance(rate)) {
      const alt = rng.pick(alts);
      out += sentence.slice(cursor, span.start) + matchCase(span.text, alt);
      cursor = span.end;
      count++;
      i += key.includes(' ') ? 2 : 1;
      continue;
    }
    i++;
  }
  out += sentence.slice(cursor);
  return { sentence: out, count };
}

/** Alternatives for a single word or two-word phrase, for the click-to-swap UI. */
export function alternativesFor(word) {
  const index = synonymIndex();
  const lower = word.toLowerCase().replace(/[^a-z' -]/g, '');
  const alts = index.get(lower) || [];
  return alts.map((a) => matchCase(word, a));
}
