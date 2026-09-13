// Pure helpers for the local-model ("Deep rewrite") mode. No browser APIs here,
// so everything in this file is unit-tested in Node.
import { splitBlocks, splitLinePrefix, splitSentences, wordCount } from '../tokenize.js';

/** Models known to ship ONNX weights that run in transformers.js. Sizes are the q4 download. */
export const MODELS = [
  { id: 'HuggingFaceTB/SmolLM2-360M-Instruct', label: 'Small · SmolLM2 360M', size: '≈ 270 MB', note: 'Fastest. Works on CPU (WASM) too.' },
  { id: 'onnx-community/Qwen2.5-0.5B-Instruct', label: 'Standard · Qwen2.5 0.5B', size: '≈ 330 MB', note: 'Best balance of speed and quality. Recommended.' },
  { id: 'onnx-community/Llama-3.2-1B-Instruct-ONNX', label: 'Large · Llama 3.2 1B', size: '≈ 800 MB', note: 'Better rewrites. Needs WebGPU (Chrome or Edge).' },
  { id: 'HuggingFaceTB/SmolLM2-1.7B-Instruct', label: 'XL · SmolLM2 1.7B', size: '≈ 1.1 GB', note: 'Best quality. Needs WebGPU and 4 GB+ of free memory.' },
];
export const DEFAULT_MODEL = MODELS[1].id;

export const SYSTEM_PROMPT = [
  'You are a skilled human editor. Rewrite the paragraph the user gives you so it reads like a thoughtful person wrote it in their own words.',
  'Keep every fact, name, number, quotation and claim exactly. Do not add new facts, opinions or examples. Keep roughly the same length.',
  'Style: mix short and long sentences; use everyday words and contractions; prefer active voice; you may reorder ideas and merge or split sentences;',
  'avoid words like delve, leverage, utilize, tapestry, robust, crucial, furthermore, moreover, additionally, in conclusion; never use em dashes, bullet points, headings or lists.',
  'Do not add personal experience, sources, opinions or commentary that is not in the original.',
  'Reply with only the rewritten paragraph. No introduction, no notes, no comments about length or about the rewrite, no quotation marks around it.',
].join(' ');

/** Acceptable output length: within 20% of the original word count. */
export const LENGTH_TOLERANCE = 0.2;
export function lengthBounds(original) {
  const w = wordCount(original);
  return { words: w, min: Math.max(1, Math.ceil(w * (1 - LENGTH_TOLERANCE))), max: Math.max(2, Math.floor(w * (1 + LENGTH_TOLERANCE))) };
}

export function buildMessages(paragraph, { strict = false } = {}) {
  const { words, min, max } = lengthBounds(paragraph);
  const target = `The paragraph is ${words} words. Your rewrite must be between ${min} and ${max} words: same length, not longer.`;
  const user = strict
    ? `${paragraph.trim()}\n\n${target} Keep every fact. Output only the paragraph itself, with no comments.`
    : `${paragraph.trim()}\n\n(${target})`;
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

/** Generation budget for one paragraph: about 1.6 tokens per source word, so output cannot double. */
export function maxTokensFor(paragraph) {
  return Math.min(1024, Math.round(wordCount(paragraph) * 1.6) + 24);
}

/** 'ok' | 'short' | 'long' relative to the original. */
export function lengthStatus(text, original) {
  const { min, max } = lengthBounds(original);
  const got = wordCount(text);
  if (got < min) return 'short';
  if (got > max) return 'long';
  return 'ok';
}

/** Cut text down to at most `maxWords`, preferring a sentence boundary. */
export function trimToWords(text, maxWords) {
  const tokens = text.match(/\S+\s*/g) || [];
  if (tokens.length <= maxWords) return text.trim();
  const head = tokens.slice(0, maxWords).join('');
  const lastEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '), head.search(/[.!?]["”)]?\s*$/));
  if (lastEnd > head.length * 0.5) return head.slice(0, lastEnd + 1).trim();
  return head.trim().replace(/[,;:]?$/, '.');
}

/** Drop a trailing unfinished sentence (from a hard token cap). */
export function dropUnfinishedSentence(text) {
  const s = text.trim();
  if (/[.!?]["”')\]]*$/.test(s)) return s;
  const idx = Math.max(s.lastIndexOf('. '), s.lastIndexOf('? '), s.lastIndexOf('! '));
  if (idx <= 0) return s;
  const kept = s.slice(0, idx + 1);
  return wordCount(kept) >= wordCount(s) * 0.3 ? kept : s;
}

/**
 * Break the input into units. Prose paragraphs and list items are rewritten;
 * code, headings and very short lines are kept as they are.
 */
export function splitForModel(text) {
  const units = [];
  let inFence = false;
  for (const { text: line, sep } of splitBlocks(text.replace(/\r\n/g, '\n'))) {
    if (/^\s*```/.test(line)) { inFence = !inFence; units.push({ kind: 'keep', prefix: '', text: line, sep }); continue; }
    if (inFence || !line.trim()) { units.push({ kind: 'keep', prefix: '', text: line, sep }); continue; }
    const { prefix, body } = splitLinePrefix(line);
    const isHeading = /^\s{0,3}#{1,6}\s/.test(line);
    if (isHeading || wordCount(body) < 8) { units.push({ kind: 'keep', prefix: '', text: line, sep }); continue; }
    units.push({ kind: 'rewrite', prefix, text: body, sep });
  }
  return units;
}

const REFUSAL = /\b(as an ai|i cannot|i can't|i'm sorry|i am sorry|language model)\b/i;
// Sentences in which the model talks about the rewrite instead of doing it.
const META = /\b(?:my (?:initial|previous|first|earlier|revised|new|final) (?:response|attempt|answer|rewrite|version|reply|draft)|(?:this|the|my|your) (?:rewrite|rewritten|revised|paraphrased|edited|new|final) (?:paragraph|text|version|response|draft)?\s*(?:is|has|was|contains|keeps|stays|comes|meets|maintains|preserves|includes|falls|now)|i (?:have|'ve) (?:kept|rewritten|rephrased|shortened|trimmed|reduced|maintained|preserved|made|ensured|tried|aimed|removed|changed|condensed)|i (?:kept|rewrote|rephrased|shortened|trimmed|reduced|maintained|preserved|ensured|tried|aimed|removed|condensed|made sure)|word count|words? (?:long|limit|count|total|target|range)|too long|too short|extra characters|characters? (?:long|count|limit)|as requested|as instructed|as asked|here (?:is|'s) (?:the|a|my|your)|(?:original|given|provided|source) (?:paragraph|text|passage)|same length|length (?:requirement|target|limit|band|constraint)|(?:between|within) \d+ and \d+ words|\b\d+ words\b|rewritten paragraph|the paragraph (?:above|below)|note that i|let me know if)\b/i;

function contentWords(text) {
  return (text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []);
}

/** Drop sentences that comment on the rewrite and share little vocabulary with the original. */
export function stripMetaCommentary(text, original) {
  const vocab = new Set(contentWords(original));
  const keepBlocks = [];
  for (const block of text.split(/\n+/)) {
    const kept = splitSentences(block).filter((sentence) => {
      if (!META.test(sentence)) return true;
      const words = contentWords(sentence);
      const overlap = words.length ? words.filter((w) => vocab.has(w)).length / words.length : 0;
      return overlap >= 0.5;
    });
    if (kept.length) keepBlocks.push(kept.join(' '));
  }
  return keepBlocks.join(original.includes('\n') ? '\n' : ' ');
}
const LEAD_IN = /^(?:(?:sure|certainly|of course|okay|here(?:'s| is)[^\n:]*|rewritten (?:paragraph|text|version)|revised (?:paragraph|text|version)|paraphrased? (?:paragraph|text|version)|output|answer)\s*[:.!-]?\s*)+/i;
const TRAIL_NOTE = /\n+\s*(?:note|notes|explanation|changes made|i (?:kept|changed|made))\b[\s\S]*$/i;

/**
 * Normalise raw model output. Returns null when the output is unusable
 * (refusal, far too short or long, empty), so the caller can fall back.
 */
export function cleanModelOutput(raw, original) {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/^<\|[^|]*\|>/g, '').trim();
  s = s.replace(TRAIL_NOTE, '').trim();
  s = s.replace(LEAD_IN, '').trim();
  s = s.replace(/^["“]([\s\S]+)["”]$/, '$1').trim();
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^\s*[-*•]\s+/gm, '');
  s = s.replace(/\s*[—–]\s*/g, ', ').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  s = dropUnfinishedSentence(s);
  s = stripMetaCommentary(s, original);
  if (!s || REFUSAL.test(s)) return null;
  const want = wordCount(original);
  const got = wordCount(s);
  if (want >= 8 && (got < want * 0.4 || got > want * 2.5)) return null;
  // The model sometimes echoes the input unchanged.
  if (s.replace(/\W+/g, '').toLowerCase() === original.replace(/\W+/g, '').toLowerCase()) return null;
  return s;
}

/** Re-join rewritten units into a document. */
export function joinUnits(units, rewritten) {
  return units.map((u, i) => {
    if (u.kind !== 'rewrite') return u.text + u.sep;
    const r = rewritten[i];
    return u.prefix + (r ?? u.text) + u.sep;
  }).join('');
}
