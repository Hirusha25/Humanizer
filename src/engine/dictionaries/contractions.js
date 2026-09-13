// Contraction rules, in the order they should be applied (negations first so
// "it is not" becomes "it isn't" rather than "it's not" twice).
// Each entry: [regex, replacement]. Replacement keeps the casing of the first word.

const PAST_PARTICIPLE =
  '(?=\\s+(?:\\w+(?:ed|en)\\b|been|done|seen|gone|made|had|got|gotten|taken|given|come|become|known|found|grown|shown|written|built|put|set|left|lost|met|kept|felt|sent|spent|brought|bought|thought|taught|caught|held|led|read|said|told|sold|stood|understood|won|begun|run|drawn|driven|eaten|fallen|forgotten|hidden|ridden|risen|spoken|stolen|woken|worn|broken|chosen|frozen|never|already|always|just|also|not|yet|recently|finally|probably|seen|been))';

export const CONTRACTIONS = [
  [/\b(do) not\b/gi, "$1n't"],
  [/\b(does) not\b/gi, "$1n't"],
  [/\b(did) not\b/gi, "$1n't"],
  [/\bcan ?not\b/gi, "can't"],
  [/\b(is) not\b/gi, "$1n't"],
  [/\b(are) not\b/gi, "$1n't"],
  [/\b(was) not\b/gi, "$1n't"],
  [/\b(were) not\b/gi, "$1n't"],
  [/\b(has) not\b/gi, "$1n't"],
  [/\b(have) not\b/gi, "$1n't"],
  [/\b(had) not\b/gi, "$1n't"],
  [/\b(would) not\b/gi, "$1n't"],
  [/\b(should) not\b/gi, "$1n't"],
  [/\b(could) not\b/gi, "$1n't"],
  [/\bwill not\b/gi, "won't"],
  [/\b(it) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(that) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(there) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(here) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(what) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(who) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(where) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(how) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(he) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(she) is\b(?=\s+[\w"'“(])/gi, "$1's"],
  [/\b(we) are\b(?=\s+[\w"'“(])/gi, "$1're"],
  [/\b(they) are\b(?=\s+[\w"'“(])/gi, "$1're"],
  [/\b(you) are\b(?=\s+[\w"'“(])/gi, "$1're"],
  [/\bI am\b(?=\s+[\w"'“(])/g, "I'm"],
  [new RegExp('\\bI have' + PAST_PARTICIPLE, 'g'), "I've"],
  [new RegExp('\\b(we) have' + PAST_PARTICIPLE, 'gi'), "$1've"],
  [new RegExp('\\b(they) have' + PAST_PARTICIPLE, 'gi'), "$1've"],
  [new RegExp('\\b(you) have' + PAST_PARTICIPLE, 'gi'), "$1've"],
  [new RegExp('\\b(he) has' + PAST_PARTICIPLE, 'gi'), "$1's"],
  [new RegExp('\\b(she) has' + PAST_PARTICIPLE, 'gi'), "$1's"],
  [new RegExp('\\b(it) has' + PAST_PARTICIPLE, 'gi'), "$1's"],
  [/\bI will\b/g, "I'll"],
  [/\b(you|we|they|he|she|it) will\b/gi, "$1'll"],
  [/\bI would\b(?=\s+\w)/g, "I'd"],
  [/\b(you|we|they|he|she) would\b(?=\s+\w)/gi, "$1'd"],
  [new RegExp('\\b(could|would|should|might|must) have' + PAST_PARTICIPLE, 'gi'), "$1've"],
];

/** Regex used by the scorer to count contractions that already exist in a text. */
export const CONTRACTION_PRESENT_RE = /\b\w+(?:n't|'re|'ve|'ll|'d|'m)\b|\b(?:it|that|there|here|what|who|where|how|he|she|let)'s\b/gi;
