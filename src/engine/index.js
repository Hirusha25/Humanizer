// Humanizer engine: rule-based rewriting that runs entirely offline.
//
//   import { humanize, analyze } from './src/engine/index.js';
//   const { text, stats } = humanize(input, { mode: 'balanced', seed: 42 });

import { createRng } from './rng.js';
import { protect, restore, fixArticles, tidy, capitalizeFirst, countWords } from './text.js';
import { splitBlocks, splitLinePrefix, splitSentences, collectProperNouns } from './tokenize.js';
import { stripMarkdown } from './transforms/markdown.js';
import { normalizePunctuation } from './transforms/punctuation.js';
import { dropFillerSentences } from './transforms/filler.js';
import { rewriteOpener } from './transforms/openers.js';
import { rewritePhrases } from './transforms/phrases.js';
import { applyContractions } from './transforms/contractions.js';
import { swapSynonyms, alternativesFor } from './transforms/synonyms.js';
import { improveRhythm } from './transforms/rhythm.js';
import { analyze } from './detector.js';
import { diffWords } from './diff.js';

export { analyze, alternativesFor, diffWords };

export const MODES = {
  subtle: {
    label: 'Subtle',
    description: 'Light touch. Removes AI-tell phrases and em dashes, adds some contractions. Keeps your wording.',
    openerRate: 0.7, softPhraseRate: 0.35, contractionRate: 0.45, synonymRate: 0.1,
    flipRate: 0.12, splitRate: 0.5, mergeRate: 0.3, dashToPeriod: 0.3,
  },
  balanced: {
    label: 'Balanced',
    description: 'The default. Rewrites formal vocabulary, varies sentence length, contracts most verbs.',
    openerRate: 0.9, softPhraseRate: 0.6, contractionRate: 0.75, synonymRate: 0.25,
    flipRate: 0.25, splitRate: 0.7, mergeRate: 0.5, dashToPeriod: 0.3,
  },
  stealth: {
    label: 'Stealth',
    description: 'Aggressive. Maximum rewording and restructuring. Proofread the result.',
    openerRate: 1, softPhraseRate: 0.85, contractionRate: 0.95, synonymRate: 0.45,
    flipRate: 0.4, splitRate: 0.85, mergeRate: 0.65, dashToPeriod: 0.35,
  },
};

const DEFAULTS = {
  mode: 'balanced',
  seed: undefined,
  stripMarkdown: true,
  keepQuotes: true,
  dropFiller: true,
  contractions: true,
  synonyms: true,
  rhythm: true,
};

function processSentences(sentences, rng, cfg, opts, stats, properNouns) {
  let list = sentences;
  if (opts.dropFiller) {
    const r = dropFillerSentences(list);
    stats.fillerDropped += r.dropped;
    list = r.sentences;
  }
  list = list.map((s) => {
    let out = s;
    const o = rewriteOpener(out, rng, cfg.openerRate);
    if (o.changed) stats.openersRewritten++;
    out = o.sentence;
    const p = rewritePhrases(out, rng, { softRate: cfg.softPhraseRate });
    stats.phrasesReplaced += p.count;
    out = p.sentence;
    return out;
  });
  if (opts.rhythm) {
    const r = improveRhythm(list, rng, { splitRate: cfg.splitRate, mergeRate: cfg.mergeRate, flipRate: cfg.flipRate, properNouns });
    stats.sentencesSplit += r.splits;
    stats.sentencesMerged += r.merges;
    stats.clausesFlipped += r.flips;
    list = r.sentences;
  }
  list = list.map((s) => {
    let out = s;
    if (opts.contractions) {
      const c = applyContractions(out, rng, cfg.contractionRate);
      stats.contractions += c.count;
      out = c.sentence;
    }
    if (opts.synonyms) {
      const sy = swapSynonyms(out, rng, { rate: cfg.synonymRate, properNouns });
      stats.synonymsSwapped += sy.count;
      out = sy.sentence;
    }
    return capitalizeFirst(tidy(fixArticles(out)));
  });
  return list;
}

/**
 * Rewrite `input` so it reads like a person wrote it.
 * @param {string} input
 * @param {object} [options]
 * @param {'subtle'|'balanced'|'stealth'} [options.mode]
 * @param {number|string} [options.seed] - same seed + same input = same output
 * @returns {{text: string, stats: object, seed: number|string, mode: string}}
 */
export function humanize(input, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const cfg = MODES[opts.mode] || MODES.balanced;
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = createRng(seed);
  const stats = {
    inputWords: countWords(input || ''),
    outputWords: 0,
    changedWords: 0,
    openersRewritten: 0,
    phrasesReplaced: 0,
    contractions: 0,
    synonymsSwapped: 0,
    sentencesSplit: 0,
    sentencesMerged: 0,
    clausesFlipped: 0,
    fillerDropped: 0,
  };
  if (!input || !input.trim()) return { text: input || '', stats, seed, mode: opts.mode };

  let { text, spans } = protect(input.replace(/\r\n/g, '\n'), { keepQuotes: opts.keepQuotes });
  if (opts.stripMarkdown) text = stripMarkdown(text);
  const properNouns = collectProperNouns(text);

  const blocks = splitBlocks(text);
  const outBlocks = blocks.map(({ text: line, sep }) => {
    if (!line.trim()) return line + sep;
    const { prefix, body } = splitLinePrefix(line);
    let para = normalizePunctuation(body, rng, { dashToPeriod: cfg.dashToPeriod });
    const sentences = splitSentences(para);
    const rewritten = processSentences(sentences, rng, cfg, opts, stats, properNouns);
    return prefix + rewritten.join(' ') + sep;
  });

  let output = restore(outBlocks.join(''), spans);
  output = output.replace(/[ \t]+\n/g, '\n');
  stats.outputWords = countWords(output);
  stats.changedWords = diffWords(input, output).filter((t) => t.changed).length;
  return { text: output, stats, seed, mode: opts.mode };
}

/** Run humanize several times with different seeds and keep the lowest-scoring result. */
export function humanizeBest(input, options = {}, tries = 4) {
  let best = null;
  const baseSeed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  for (let i = 0; i < tries; i++) {
    const seed = typeof baseSeed === 'number' ? baseSeed + i * 7919 : `${baseSeed}-${i}`;
    const r = humanize(input, { ...options, seed });
    const score = analyze(r.text).score;
    // Lowest score wins; within a few points prefer the attempt that changed more.
    const better = !best || score < best.score - 3 || (score <= best.score + 3 && r.stats.changedWords > best.stats.changedWords);
    if (better) best = { ...r, score };
  }
  return best;
}
