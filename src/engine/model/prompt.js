// Pure helpers for the local-model ("Deep rewrite") mode. No browser APIs here,
// so everything in this file is unit-tested in Node.
import { splitBlocks, splitLinePrefix, wordCount } from '../tokenize.js';

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
  'Reply with only the rewritten paragraph. No introduction, no notes, no quotation marks around it.',
].join(' ');

export function buildMessages(paragraph) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: paragraph.trim() },
  ];
}

/** Generation budget for one paragraph. */
export function maxTokensFor(paragraph) {
  return Math.min(1024, Math.round(wordCount(paragraph) * 2.2) + 48);
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
  if (!s || REFUSAL.test(s)) return null;
  const want = wordCount(original);
  const got = wordCount(s);
  if (want >= 8 && (got < want * 0.5 || got > want * 2.2)) return null;
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
