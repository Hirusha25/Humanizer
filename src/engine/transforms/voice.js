// "Voice" transforms: the small habits of human prose that rule rewrites usually miss.
//  - trailing "though" instead of a leading "However,"
//  - fronted time/context phrases
//  - short fragments split off the end of a sentence
//  - an occasional discourse marker ("Honestly,") once per paragraph
//  - fewer exclamation marks
import { wordCount } from '../tokenize.js';
import { capitalizeFirst, lowercaseFirst } from '../text.js';

const HAS_PLACEHOLDER = //;

function lowerStart(sentence, properNouns) {
  const first = (sentence.match(/^[A-Za-z][A-Za-z'’-]*/) || [''])[0];
  if (first === 'I' || /^I['’]/.test(first) || properNouns.has(first)) return sentence;
  return lowercaseFirst(sentence);
}

/** "However, it still works." -> "It still works, though." */
export function trailingThough(sentence) {
  if (HAS_PLACEHOLDER.test(sentence)) return null;
  const m = sentence.match(/^(?:However|But|Still|That said|Then again|Even so|Nevertheless|Nonetheless|Yet),?\s+([^,;:]{10,140})\.$/);
  if (!m || wordCount(m[1]) > 18) return null;
  return capitalizeFirst(m[1]) + ', though.';
}

const TIME_PHRASE =
  /,? (in (?:most|many|some|several|rare|these|those|such) cases|in recent (?:years|months|decades|times)|in \d{4}|over the (?:past|last|next) (?:few |several |couple of |\w+ )?(?:years|months|weeks|decades|days)|in the long run|in the short term|in the long term|for now|these days|at first|in practice|in theory|over time|nowadays|for the most part|at this point|in general|as a rule|over the years|since \d{4}|by \d{4}|at the moment|right now|today|at the same time|in the meantime|in reality|in the real world|on the whole|in this case|in that case|in both cases|in either case|at the very least|at best|at worst|more often than not|in my experience|on paper|on balance|for the time being|sooner or later|every time|most days|at some point|before long|by now|by then|until now|until then|so far|as of now)\.$/i;

/** "It usually works in practice." -> "In practice, it usually works." */
export function frontTimePhrase(sentence, properNouns) {
  if (HAS_PLACEHOLDER.test(sentence)) return null;
  const m = sentence.match(TIME_PHRASE);
  if (!m) return null;
  const head = sentence.slice(0, m.index);
  if (wordCount(head) < 4 || /[,;:]/.test(head)) return null;
  return capitalizeFirst(m[1]) + ', ' + lowerStart(head, properNouns) + '.';
}

const FRAGMENT_RE =
  /, ((?:especially|particularly|mostly|mainly|at least|even|not to mention|let alone|usually|ideally|if only|if at all|or at least|and not just|but only|though not|but not always|preferably|which is (?:fine|rare|odd|nice|good|bad|a problem|a start|the point|the whole point)|and that matters|and rightly so|and for good reason|for better or worse|whether you like it or not|no matter what|plain and simple|full stop|end of story) [^,]{2,60}|(?:which is (?:fine|rare|odd|nice|good|bad|a problem|a start|the point|the whole point)|and that matters|and rightly so|and for good reason|for better or worse|no matter what|plain and simple|full stop|end of story))\.$/i;

/** "...costs money, especially at scale." -> "...costs money. Especially at scale." */
export function splitFragment(sentence) {
  if (HAS_PLACEHOLDER.test(sentence)) return null;
  const m = sentence.match(FRAGMENT_RE);
  if (!m) return null;
  const head = sentence.slice(0, m.index);
  if (wordCount(head) < 7) return null;
  return [head + '.', capitalizeFirst(m[1]) + '.'];
}

const ASIDES = ['Honestly, ', 'In practice, ', 'Put simply, ', 'Frankly, ', 'Realistically, ', 'To be fair, ', 'Truth be told, ', 'Look, ', 'Here is the thing: ', 'Simply put, ', 'The short version: '];
const NO_ASIDE = /^(?:And|But|So|Also|Plus|Still|Yet|Honestly|Frankly|Look|Here|Which|That said|Then again|Even so|First|Second|Third|Finally|Lastly|For example|Say|Take|Basically|In|On|At|Because|Since|If|When|While|Although|I |We |You |Truth|Put|Simply|The short|One thing|Note|Remember|Keep|Sure|Of course|Clearly|No |Yes)/;

/** Prefix one mid-paragraph sentence with a discourse marker. */
export function addAside(sentence, rng, properNouns) {
  if (HAS_PLACEHOLDER.test(sentence)) return null;
  if (NO_ASIDE.test(sentence) || wordCount(sentence) < 6 || !/[.]$/.test(sentence)) return null;
  const aside = rng.pick(ASIDES);
  return aside + (aside.endsWith(': ') ? lowerStart(sentence, properNouns) : lowerStart(sentence, properNouns));
}

/** "This is great!" (8+ words) -> "This is great." */
export function calmExclamation(sentence) {
  if (!/!$/.test(sentence) || wordCount(sentence) < 8) return null;
  return sentence.replace(/!+$/, '.');
}

/**
 * Apply the voice transforms to a paragraph's sentences.
 * `thoughRate` is applied before openers are rewritten (see index.js); the rest run last.
 */
export function applyVoice(sentences, rng, { frontRate = 0.2, fragmentRate = 0.3, asideRate = 0.08, exclaimRate = 0.6, properNouns = new Set() } = {}) {
  const out = [];
  let fronted = 0;
  let fragments = 0;
  let asides = 0;
  let asideDone = false;
  sentences.forEach((s, i) => {
    let cur = s;
    if (rng.chance(exclaimRate)) { const c = calmExclamation(cur); if (c) cur = c; }
    if (rng.chance(fragmentRate)) {
      const parts = splitFragment(cur);
      if (parts) { out.push(parts[0]); cur = parts[1]; fragments++; }
    }
    if (rng.chance(frontRate)) { const f = frontTimePhrase(cur, properNouns); if (f) { cur = f; fronted++; } }
    if (!asideDone && i > 0 && i < sentences.length && rng.chance(asideRate)) {
      const a = addAside(cur, rng, properNouns);
      if (a) { cur = a; asides++; asideDone = true; }
    }
    out.push(cur);
  });
  return { sentences: out, fronted, fragments, asides };
}
