import { FILLER_SENTENCES } from '../dictionaries/phrases.js';

/** Drop sentences that carry no information ("I hope this helps!"). */
export function dropFillerSentences(sentences) {
  const kept = sentences.filter((s) => !FILLER_SENTENCES.some((re) => re.test(s.trim())));
  if (!kept.length) return { sentences, dropped: 0 };
  return { sentences: kept, dropped: sentences.length - kept.length };
}
