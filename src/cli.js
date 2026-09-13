#!/usr/bin/env node
// Usage: node src/cli.js [--mode subtle|balanced|stealth] [--seed N] [--best N] [--score] [file]
// Reads a file or stdin, writes humanized text to stdout.
import { readFileSync } from 'node:fs';
import { humanize, humanizeBest, analyze } from './engine/index.js';

const args = process.argv.slice(2);
const opts = { mode: 'balanced' };
let file = null;
let scoreOnly = false;
let best = 0;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--mode' || a === '-m') opts.mode = args[++i];
  else if (a === '--seed' || a === '-s') opts.seed = Number(args[++i]);
  else if (a === '--best' || a === '-b') best = Number(args[++i] || 4);
  else if (a === '--score') scoreOnly = true;
  else if (a === '--no-synonyms') opts.synonyms = false;
  else if (a === '--no-rhythm') opts.rhythm = false;
  else if (a === '--no-contractions') opts.contractions = false;
  else if (a === '--keep-markdown') opts.stripMarkdown = false;
  else if (a === '--help' || a === '-h') {
    console.log(`humanize [options] [file]
  --mode, -m   subtle | balanced | stealth   (default balanced)
  --seed, -s   integer seed for reproducible output
  --best, -b   N   run N seeds and keep the lowest-scoring result
  --score      print the AI-likelihood analysis of the input instead of rewriting
  --no-synonyms --no-rhythm --no-contractions --keep-markdown
Reads stdin when no file is given.`);
    process.exit(0);
  } else file = a;
}

const input = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');

function printAnalysis(label, a) {
  console.error(`${label}: ${a.score}/100 (${a.label}), ${a.words} words, ${a.sentences} sentences`);
  for (const f of a.features) console.error(`  ${f.label.padEnd(24)} ${(f.value * 100).toFixed(0).padStart(3)}%  ${f.detail}`);
}

if (scoreOnly) {
  printAnalysis('AI likelihood', analyze(input));
  process.exit(0);
}

const result = best ? humanizeBest(input, opts, best) : humanize(input, opts);
process.stdout.write(result.text);
if (!result.text.endsWith('\n')) process.stdout.write('\n');
const before = analyze(input);
const after = analyze(result.text);
console.error(`\n[humanizer] mode=${result.mode} seed=${result.seed}  AI-likelihood ${before.score} -> ${after.score}  changed ${result.stats.changedWords}/${result.stats.outputWords} words`);
