// Shared string helpers: protected spans, case handling, article agreement, tidying.

export const PLACEHOLDER_RE = /\uE000x(\d+)\uE001/g;

const PROTECT_PATTERNS = [
  /```[\s\S]*?```/g, // fenced code
  /`[^`\n]+`/g, // inline code
  /https?:\/\/[^\s<>()"']+/g, // urls
  /\bwww\.[^\s<>()"']+/g,
  /[\w.+-]+@[\w-]+\.[\w.]+/g, // emails
  /(?<![\w])[@#][A-Za-z_]\w{1,}/g, // @handles, #tags
];

/** Replace spans that must never be rewritten with opaque placeholders. */
export function protect(text, { keepQuotes = true } = {}) {
  const spans = [];
  const patterns = [...PROTECT_PATTERNS];
  if (keepQuotes) patterns.push(/"[^"\n]{2,400}"/g, /“[^”\n]{2,400}”/g);
  let out = text;
  for (const re of patterns) {
    out = out.replace(re, (m) => {
      spans.push(m);
      return `\uE000x${spans.length - 1}\uE001`;
    });
  }
  return { text: out, spans };
}

export function restore(text, spans) {
  return text.replace(PLACEHOLDER_RE, (_, i) => spans[Number(i)]);
}

export function isPlaceholder(word) {
  return /^\uE000x\d+\uE001$/.test(word);
}

export function capitalizeFirst(s) {
  return s.replace(/^([\s"'“‘(\[]*)([a-z])/, (m, pre, c) => pre + c.toUpperCase());
}

export function lowercaseFirst(s) {
  return s.replace(/^([\s"'“‘(\[]*)([A-Z])/, (m, pre, c) => pre + c.toLowerCase());
}

/** Copy the casing pattern of `src` onto `rep`. */
export function matchCase(src, rep) {
  if (!rep) return rep;
  if (src.length > 1 && src === src.toUpperCase() && /[A-Z]/.test(src)) return rep.toUpperCase();
  if (/^[A-Z]/.test(src)) return rep[0].toUpperCase() + rep.slice(1);
  return rep;
}

// Words that start with a vowel letter but a consonant sound (take "a").
const VOWEL_LETTER_CONSONANT_SOUND =
  /^(one|once|uni[a-z]*|use[a-z]*|usual[a-z]*|utili[a-z]*|utensil|utopia[a-z]*|euro[a-z]*|eulog[a-z]*|ewe|ukulele|uranium|url|us\b|u\.s)/i;
// Words that start with a consonant letter but a vowel sound (take "an").
const CONSONANT_LETTER_VOWEL_SOUND =
  /^(hour[a-z]*|honest[a-z]*|hono[u]?r[a-z]*|heir[a-z]*|herb[a-z]*|html|http|sql|xml|fbi|mba|mri|nba|nfl|rss|sms|lcd|led|f|h|l|m|n|r|s|x)$/i;

function wantsAn(word) {
  if (/^[aeiou]/i.test(word)) return !VOWEL_LETTER_CONSONANT_SOUND.test(word);
  return CONSONANT_LETTER_VOWEL_SOUND.test(word);
}

/** Repair "a"/"an" after word substitutions. Only touches lowercase or sentence-initial articles. */
export function fixArticles(s) {
  return s
    .replace(/\b(a|an) (?=([A-Za-z][\w'-]*))/g, (m, art, word) => (wantsAn(word) ? 'an ' : 'a '))
    .replace(/(^|[.!?]\s+)(A|An) (?=([A-Za-z][\w'-]*))/g, (m, pre, art, word) => pre + (wantsAn(word) ? 'An ' : 'A '));
}

/** Clean up spacing and punctuation artefacts left by substitutions. */
export function tidy(s) {
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/([,;:])\1+/g, '$1')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/([.!?])\s*,/g, '$1')
    .replace(/^[\s,;:]+/, '')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

export const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;

export function countWords(text) {
  const m = text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g);
  return m ? m.length : 0;
}
