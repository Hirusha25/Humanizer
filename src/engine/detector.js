// Heuristic "AI-likelihood" scorer. It measures the surface signals that public
// detectors are known to weight (burstiness, formal transitions, AI-tell vocabulary,
// contraction rate, em dashes) and combines them into a 0-100 score.
// It is a guide for editing, not a replica of any commercial detector.

import { splitBlocks, splitSentences, wordCount } from './tokenize.js';
import { compiledPhrases } from './dictionaries/phrases.js';
import { FORMAL_OPENER_RE } from './dictionaries/openers.js';
import { CONTRACTIONS, CONTRACTION_PRESENT_RE } from './dictionaries/contractions.js';
import { countWords } from './text.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Map a raw value into 0..1 where `lo` maps to 0 and `hi` maps to 1 (or inverted).
const ramp = (x, lo, hi) => clamp01((x - lo) / (hi - lo));

function allSentences(text) {
  const out = [];
  for (const b of splitBlocks(text)) for (const s of splitSentences(b.text)) if (wordCount(s) > 0) out.push(s);
  return out;
}

export function analyze(text) {
  const words = countWords(text);
  const sentences = allSentences(text);
  const per100 = (n) => (words ? (n / words) * 100 : 0);

  // 1. AI-tell vocabulary density (strong phrases only)
  let tells = 0;
  for (const { re, soft } of compiledPhrases()) {
    if (soft) continue;
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) tells += m.length;
  }
  const tellDensity = per100(tells);

  // 2. Formal transition openers
  const formalOpeners = sentences.filter((s) => FORMAL_OPENER_RE.test(s)).length;
  const openerRatio = sentences.length ? formalOpeners / sentences.length : 0;

  // 3. Burstiness (coefficient of variation of sentence length)
  const lens = sentences.map(wordCount);
  const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const sd = lens.length ? Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length) : 0;
  const cv = mean ? sd / mean : 0;

  // 4. Contractions: present vs. opportunities left uncontracted
  const present = (text.match(CONTRACTION_PRESENT_RE) || []).length;
  let uncontracted = 0;
  for (const [re] of CONTRACTIONS) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) uncontracted += m.length;
  }
  const contractionRatio = present + uncontracted ? present / (present + uncontracted) : 0.5;

  // 5. Punctuation tells
  const emDashes = (text.match(/[—–]|(?<=\w)--(?=\w)|\s--\s/g) || []).length;
  const semicolons = (text.match(/;/g) || []).length;
  const punctDensity = per100(emDashes * 1.5 + semicolons);

  // 6. Average word length (formal register skews long)
  const tokens = text.match(/[A-Za-z]+/g) || [];
  const avgLen = tokens.length ? tokens.reduce((a, w) => a + w.length, 0) / tokens.length : 0;

  // 7. Personal voice: first/second-person pronouns
  const personal = (text.match(/\b(?:I|I'm|I've|I'd|I'll|me|my|mine|we|we're|we've|our|you|you're|you've|your)\b/g) || []).length;
  const personalDensity = per100(personal);

  // 8. Paragraph uniformity
  const paraLens = splitBlocks(text).map((b) => wordCount(b.text)).filter((n) => n > 15);
  let paraCv = 1;
  if (paraLens.length >= 3) {
    const pm = paraLens.reduce((a, b) => a + b, 0) / paraLens.length;
    const psd = Math.sqrt(paraLens.reduce((a, b) => a + (b - pm) ** 2, 0) / paraLens.length);
    paraCv = pm ? psd / pm : 0;
  }

  // 9. Repeated sentence openings (same first word 3+ times)
  const firstWords = sentences.map((s) => (s.match(/^[A-Za-z']+/) || [''])[0].toLowerCase());
  const counts = {};
  for (const w of firstWords) if (w) counts[w] = (counts[w] || 0) + 1;
  const repeatedStarts = Object.values(counts).filter((n) => n >= 3).reduce((a, n) => a + n - 2, 0);
  const repeatRatio = sentences.length ? repeatedStarts / sentences.length : 0;

  // 10. Short sentences: human prose almost always has a few
  const shortFrac = sentences.length ? lens.filter((n) => n <= 8).length / sentences.length : 0;

  const features = [
    { key: 'tells', label: 'AI-tell vocabulary', weight: 0.22, value: ramp(tellDensity, 0, 2.5), detail: `${tells} tell phrase${tells === 1 ? '' : 's'} (${tellDensity.toFixed(1)} per 100 words)` },
    { key: 'burstiness', label: 'Sentence rhythm', weight: 0.17, value: 1 - ramp(cv, 0.2, 0.6), detail: `length variation ${cv.toFixed(2)} (avg ${mean.toFixed(0)} words, ${sentences.length} sentences)` },
    { key: 'openers', label: 'Formal transitions', weight: 0.14, value: ramp(openerRatio, 0, 0.3), detail: `${formalOpeners} of ${sentences.length} sentences open with a formal connector` },
    { key: 'contractions', label: 'Contractions', weight: 0.14, value: 1 - ramp(contractionRatio, 0, 0.6), detail: `${present} used, ${uncontracted} left expanded` },
    { key: 'punctuation', label: 'Em dashes & semicolons', weight: 0.1, value: ramp(punctDensity, 0, 1.2), detail: `${emDashes} dash${emDashes === 1 ? '' : 'es'}, ${semicolons} semicolon${semicolons === 1 ? '' : 's'}` },
    { key: 'register', label: 'Word length', weight: 0.06, value: ramp(avgLen, 4.3, 5.4), detail: `average ${avgLen.toFixed(2)} letters` },
    { key: 'voice', label: 'Personal voice', weight: 0.06, value: 1 - ramp(personalDensity, 0, 3), detail: `${personal} first/second-person words` },
    { key: 'paragraphs', label: 'Paragraph uniformity', weight: 0.03, value: 1 - ramp(paraCv, 0.15, 0.5), detail: paraLens.length >= 3 ? `variation ${paraCv.toFixed(2)} across ${paraLens.length} paragraphs` : 'too few paragraphs to judge' },
    { key: 'repeats', label: 'Repeated openings', weight: 0.03, value: ramp(repeatRatio, 0, 0.3), detail: `${repeatedStarts} repeated sentence starts` },
    { key: 'short', label: 'Short sentences', weight: 0.05, value: 1 - ramp(shortFrac, 0, 0.2), detail: `${Math.round(shortFrac * 100)}% of sentences are 8 words or fewer` },
  ];

  let score = features.reduce((a, f) => a + f.weight * f.value, 0);
  // Very short inputs carry little signal: pull toward the middle.
  if (words < 40) score = 0.5 + (score - 0.5) * (words / 40);
  const pct = Math.round(clamp01(score) * 100);
  const label = pct >= 65 ? 'Likely AI' : pct >= 35 ? 'Mixed' : 'Likely human';
  return { score: pct, label, words, sentences: sentences.length, features };
}
