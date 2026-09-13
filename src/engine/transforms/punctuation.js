import { wordCount } from '../tokenize.js';

const CLAUSE_START = /^(?:it|they|we|this|that|these|those|the|a|an|he|she|i|you|there|some|many|most|our|their|his|her|its|my|your|people|everyone|nobody|no one|others|what|which|not|even|especially|but|and|so)\b/i;
// "; however, ..." style connectors always introduce an independent clause.
const CONNECTOR_START = /^(?:however|moreover|furthermore|therefore|thus|hence|nevertheless|nonetheless|consequently|otherwise|instead|still|also|then|meanwhile|indeed|in fact|as a result|for example|for instance|on the other hand|in addition|in contrast|that said)\b,?/i;
const BREAK = '';

function tailOf(str) {
  const m = str.match(/^[^.!?]*/);
  return m ? m[0] : '';
}

function headOf(str, offset) {
  const before = str.slice(0, offset);
  const parts = before.split(/[.!?]\s+/);
  return parts[parts.length - 1];
}

/**
 * Em dashes are the single strongest punctuation tell for LLM text.
 * Semicolons are a weaker one. Convert both into commas or sentence breaks.
 */
export function normalizePunctuation(text, rng, { dashToPeriod = 0.3 } = {}) {
  let s = text;
  // "word — word", "word—word", "word -- word"
  s = s.replace(/[ \t]*(?:[—–]|--)[ \t]*(?=[A-Za-z"'“‘(])/g, (m, offset, str) => {
    const after = str.slice(offset + m.length);
    const tail = tailOf(after);
    const head = headOf(str, offset);
    const independent = CLAUSE_START.test(after) && wordCount(tail) >= 5 && wordCount(head) >= 4;
    if (independent && rng.chance(dashToPeriod)) return '.' + BREAK + ' ';
    return ', ';
  });
  // dangling dash before closing punctuation
  s = s.replace(/[ \t]*(?:[—–]|--)[ \t]*(?=[.,;:!?)])/g, '');
  // "; " between two real clauses -> new sentence; otherwise comma
  s = s.replace(/;\s+(?=[A-Za-z"'“‘(])/g, (m, offset, str) => {
    const after = str.slice(offset + m.length);
    const tail = tailOf(after);
    const head = headOf(str, offset);
    if (CONNECTOR_START.test(after)) return '.' + BREAK + ' ';
    if (wordCount(tail) >= 4 && wordCount(head) >= 4 && CLAUSE_START.test(after)) return '.' + BREAK + ' ';
    if (wordCount(tail) >= 6 && wordCount(head) >= 6) return '.' + BREAK + ' ';
    return ', ';
  });
  // capitalise the word following a freshly inserted sentence break
  s = s.replace(/ ([a-z])/g, (m, c) => ' ' + c.toUpperCase()).replace(//g, '');
  return s;
}
