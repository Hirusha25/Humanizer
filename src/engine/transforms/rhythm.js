import { wordCount } from '../tokenize.js';
import { capitalizeFirst, lowercaseFirst } from '../text.js';

const CLAUSE_START = /^(?:it|they|we|this|that|these|those|the|a|an|he|she|i|you|there|some|many|most|our|their|his|her|its|my|your|people|everyone|nobody|no one|others|not|even|what)\b/i;
const HAS_PLACEHOLDER = //;

function keepCapital(word, properNouns) {
  return word === 'I' || /^I['’]/.test(word) || properNouns.has(word);
}

function lowerStart(sentence, properNouns) {
  const first = (sentence.match(/^[A-Za-z][A-Za-z'’-]*/) || [''])[0];
  if (keepCapital(first, properNouns)) return sentence;
  return lowercaseFirst(sentence);
}

/** Try to break a long sentence at a natural clause boundary. */
export function splitLongSentence(sentence, rng, minWords = 22) {
  const total = wordCount(sentence);
  if (total < minWords || !/[.]$/.test(sentence)) return null;
  const re = /, (and|but|so|yet|because|which) /g;
  const candidates = [];
  let m;
  while ((m = re.exec(sentence))) {
    const left = sentence.slice(0, m.index);
    const right = sentence.slice(m.index + m[0].length);
    const lw = wordCount(left);
    const rw = wordCount(right);
    if (lw < 6 || rw < 5) continue;
    const conj = m[1].toLowerCase();
    if (['and', 'but', 'so', 'yet'].includes(conj) && !CLAUSE_START.test(right)) continue;
    if (conj === 'which' && (right.includes(',') || lw < 8)) continue;
    candidates.push({ index: m.index, len: m[0].length, conj, left, right, balance: Math.abs(lw - rw) });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.balance - b.balance);
  const c = candidates[0];
  let lead;
  switch (c.conj) {
    case 'and': lead = rng.pick(['And ', '', '', 'Plus, ']); break;
    case 'but': lead = rng.pick(['But ', 'Still, ', 'Then again, ', 'But ']); break;
    case 'so': lead = rng.pick(['So ', 'That means ', 'Which means ']); break;
    case 'yet': lead = rng.pick(['Yet ', 'Still, ', 'And yet ']); break;
    case 'because': lead = rng.pick(["That's because ", 'The reason is that ', 'This is because ']); break;
    case 'which': lead = rng.pick(['This ', 'That ', 'And this ']); break;
    default: lead = '';
  }
  const left = c.left.replace(/[,;]$/, '') + '.';
  const right = lead ? lead + c.right : capitalizeFirst(c.right);
  return [left, right];
}

/** Join two short neighbouring sentences into one. */
export function mergeShortPair(a, b, rng, properNouns) {
  if (!/[.]$/.test(a) || !/[.!?]$/.test(b)) return null;
  if (wordCount(a) > 9 || wordCount(b) > 9) return null;
  if (HAS_PLACEHOLDER.test(a) || HAS_PLACEHOLDER.test(b)) return null;
  let joiner;
  let rest = b;
  if (/^(?:But|However|Still|Yet)\b,?\s+/i.test(b)) { joiner = ', but '; rest = b.replace(/^\w+,?\s+/, ''); }
  else if (/^(?:So|Therefore|Thus)\b,?\s+/i.test(b)) { joiner = ', so '; rest = b.replace(/^\w+,?\s+/, ''); }
  else if (/^(?:And|Also|Plus)\b,?\s+/i.test(b)) { joiner = ', and '; rest = b.replace(/^\w+,?\s+/, ''); }
  else joiner = rng.pick([', and ', ' and ', ', and ', ', plus ']);
  return a.slice(0, -1) + joiner + lowerStart(rest, properNouns);
}

/** "Because X, Y." <-> "Y because X." for sentence-shape variety. */
export function flipClause(sentence, rng, properNouns) {
  if (HAS_PLACEHOLDER.test(sentence)) return null;
  const front = sentence.match(/^(Because|Since|Although|Even though|While|When|If|Whenever|Once|Unless) ([^,]{8,80}), ([^,]{8,120})\.$/);
  if (front) {
    const [, conj, x, y] = front;
    if (wordCount(x) < 3 || wordCount(y) < 3) return null;
    const c = conj.toLowerCase();
    const sep = ['although', 'even though', 'while'].includes(c) ? ', ' : ' ';
    return capitalizeFirst(y) + sep + c + ' ' + x + '.';
  }
  const back = sentence.match(/^([^,]{8,120}) (because|since|although|even though|when|if|unless) ([^,]{8,80})\.$/);
  if (back && rng.chance(0.5)) {
    const [, y, conj, x] = back;
    if (wordCount(x) < 3 || wordCount(y) < 3) return null;
    return capitalizeFirst(conj) + ' ' + x + ', ' + lowerStart(y, properNouns) + '.';
  }
  return null;
}

export function lengthStats(sentences) {
  const lens = sentences.map(wordCount).filter((n) => n > 0);
  if (!lens.length) return { mean: 0, cv: 0 };
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  return { mean, cv: mean ? Math.sqrt(variance) / mean : 0 };
}

/**
 * Increase burstiness: split long sentences, merge short ones, flip a clause now and then.
 */
export function improveRhythm(sentences, rng, { splitRate = 0.7, mergeRate = 0.5, flipRate = 0.25, splitMin = 22, properNouns = new Set() } = {}) {
  const out = [];
  let splits = 0;
  let merges = 0;
  let flips = 0;
  const monotone = sentences.length >= 3 && lengthStats(sentences).cv < 0.35;

  for (const s of sentences) {
    const wc = wordCount(s);
    if (wc >= splitMin && (wc >= 40 || monotone || rng.chance(splitRate))) {
      const parts = splitLongSentence(s, rng, splitMin);
      if (parts) { out.push(...parts); splits++; continue; }
    }
    out.push(s);
  }

  const merged = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    const b = out[i + 1];
    if (b && (monotone || rng.chance(mergeRate))) {
      const m = mergeShortPair(a, b, rng, properNouns);
      if (m) { merged.push(m); merges++; i++; continue; }
    }
    merged.push(a);
  }

  const flipped = merged.map((s) => {
    if (!rng.chance(flipRate)) return s;
    const f = flipClause(s, rng, properNouns);
    if (f) { flips++; return f; }
    return s;
  });

  return { sentences: flipped, splits, merges, flips };
}
