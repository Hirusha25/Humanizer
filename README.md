# Humanizer

An offline, rule-based **AI text humanizer** in the spirit of StealthWriter. Paste text that sounds like a language model wrote it and get a rewrite that reads like a person did. No API keys, no accounts, no network calls: the whole engine is plain JavaScript that runs in the browser or from the command line.

## Features

- **Three strengths**: Subtle, Balanced, Stealth.
- **Kills AI tells**: 300+ phrases and words that LLMs over-use ("delve", "tapestry", "it is important to note that", "in today's fast-paced world", "leverage", "robust") are swapped for plain alternatives. Another 300 formal-but-ordinary words are softened with mode-dependent probability.
- **Punctuation**: em dashes and semicolons (the strongest punctuation tells) become commas or full stops.
- **Rhythm**: long sentences are split at clause boundaries, short ones are joined, leading clauses are flipped, so sentence length varies the way human writing does ("burstiness").
- **Contractions** and near-synonym swaps make word choice less predictable, which is what perplexity-based detectors measure.
- **Voice**: a leading "However," can become a trailing "…, though."; time phrases move to the front ("In practice, …"); trailing qualifiers become fragments ("Especially at scale."); one sentence per paragraph may get a discourse marker ("Honestly, …"); long exclamations calm down.
- **Direct phrasing**: "allows users to" becomes "lets users", "it is recommended that" becomes "you should", "the implementation of" becomes "rolling out", "one should" becomes "you should", and so on.
- **No repeated connectors**: each replacement opener is used at most once per paragraph.
- **Filler removal**: "Certainly!", "I hope this helps!", "As an AI language model" are dropped.
- **Safe zones**: URLs, emails, code, `@handles`, `#tags`, and quoted text are never touched. Proper nouns are not swapped. List markers and paragraphs are preserved. Markdown decoration is stripped (optional).
- **Built-in AI-likelihood score** with a per-signal breakdown, shown before and after.
- **Click any word** in the result to swap it for an alternative, or type your own.
- **Regenerate** for a different rewrite of the same text; **best-of-4** picks the lowest-scoring attempt automatically.
- Deterministic: same input + same seed = same output.

## Deep rewrite (local language model)

The fourth mode, **Deep rewrite**, does what a rule engine cannot: it re-generates every paragraph with a small instruction-tuned language model running inside the browser tab via [transformers.js](https://github.com/huggingface/transformers.js), then runs the rules on top to strip any tells the model re-introduces. There is still no API and no account: the model weights are downloaded once from the Hugging Face hub (270 MB to 1.1 GB depending on the model you pick), cached by the browser, and everything after that runs on your machine.

| Model | Download | Notes |
| --- | --- | --- |
| SmolLM2 360M Instruct | ≈ 270 MB | Fastest; usable on CPU |
| Qwen2.5 0.5B Instruct (default) | ≈ 330 MB | Best balance |
| Llama 3.2 1B Instruct | ≈ 800 MB | Better rewrites; needs WebGPU |
| SmolLM2 1.7B Instruct | ≈ 1.1 GB | Best quality; needs WebGPU and 4 GB+ free memory |

WebGPU (Chrome, Edge, recent Safari) makes generation 5 to 20 times faster than the CPU fallback. Paragraphs stream into the output pane as they are written; **Stop** interrupts. If a paragraph comes back unusable (refusal, echo, wrong length) it falls back to the Stealth rules for that paragraph. The Claude-hosted artifact copy cannot download models because of its content-security policy; use the GitHub Pages site or `npm start`.

These are general-purpose small models, not models fine-tuned against detectors. They produce genuinely re-written text with fresh sentence structures and word choices, which is what perplexity-based detectors respond to, but no verdict is guaranteed. Read the output: small models occasionally drop or garble a detail.

## Run it

```bash
npm start            # http://localhost:3000
npm test             # node --test
```

Or just open `index.html` through any static server (the page uses ES modules, so it needs `http://`, not `file://`).

### Command line

```bash
node src/cli.js --mode stealth --seed 42 input.txt > output.txt
cat input.txt | node src/cli.js --best 6
node src/cli.js --score input.txt          # only print the AI-likelihood analysis
```

Options: `--mode subtle|balanced|stealth`, `--seed N`, `--best N`, `--score`, `--no-synonyms`, `--no-rhythm`, `--no-contractions`, `--keep-markdown`.

### As a library

```js
import { humanize, humanizeBest, analyze, alternativesFor } from './src/engine/index.js';

const { text, stats, seed } = humanize(input, { mode: 'balanced', seed: 42 });
const report = analyze(text); // { score: 0-100, label, features: [...] }
```

## How the score works

`analyze()` combines the surface signals that public detectors are known to weigh:

| Signal | What it measures |
| --- | --- |
| AI-tell vocabulary | density of known LLM phrases per 100 words |
| Sentence rhythm | coefficient of variation of sentence length |
| Formal transitions | share of sentences opening with "However,", "Furthermore,", "In conclusion," … |
| Contractions | contractions used vs. left expanded |
| Em dashes & semicolons | density per 100 words |
| Word length, personal voice, paragraph uniformity, repeated openings | minor signals |

It is a guide for editing, **not** a replica of GPTZero, Turnitin, Originality.ai or any other detector.

### What to expect from real detectors

Commercial detectors score how *predictable* each word is to a language model. A rule-based rewrite cannot compute that, so it works indirectly: it removes the phrases those models find most predictable, breaks up uniform sentence shapes, and swaps in less expected words. That reliably lowers scores but does not guarantee a "human" verdict, especially on short, generic or highly formal text. Things that help:

- Use **Stealth** and turn on **best of 4**; press **Regenerate** a few times and keep the version your detector likes.
- Click flagged words in the result to swap them, or type your own replacement.
- Add something only you could write: a concrete example, an opinion, a number, a first-person sentence. Detectors weigh specificity heavily and no tool can invent it for you.
- Longer, more specific input humanizes better than short boilerplate.

Tools such as StealthWriter or Undetectable use large models fine-tuned against detectors; matching them offline would need a local paraphrase model (for example via transformers.js), which this project deliberately does not ship. Always read the output: it changes wording, and you are responsible for the meaning.

## Project layout

```
index.html, styles.css, app.js     browser UI (no build step)
server.js                          tiny static server for `npm start`
src/cli.js                         command-line interface
src/engine/index.js                humanize(), humanizeBest(), MODES
src/engine/detector.js             analyze(): AI-likelihood heuristic
src/engine/tokenize.js             paragraph / sentence / list-prefix splitting
src/engine/text.js                 protected spans, casing, a/an repair, tidy
src/engine/diff.js                 word-level diff for change highlighting
src/engine/dictionaries/           phrases, openers, contractions, synonyms
src/engine/transforms/             one pass per file: markdown, punctuation, filler,
                                   openers, phrases, contractions, synonyms, rhythm, voice
src/engine/model/                  Deep rewrite: prompt.js (pure helpers), worker.js (transformers.js
                                   in a Web Worker), client.js (promise API + deepRewrite loop)
test/                              node --test suites
```

## Extending it

- Add an AI tell: append `['pattern', ['alternative', ...]]` to `src/engine/dictionaries/phrases.js`. Patterns are case-insensitive regex sources wrapped in word boundaries; `''` deletes the phrase; `$1` inserts a capture group. Entries after the `---soft---` marker are only applied with the mode's probability.
- Add a sentence opener: `src/engine/dictionaries/openers.js`.
- Add interchangeable words: `src/engine/dictionaries/synonyms.js` (`SYNONYM_GROUPS`), and use `CONTEXT_BLOCKS` to stop a swap in idioms ("hard drive", "Big Apple").
- Tune a mode: `MODES` in `src/engine/index.js`.

## License

MIT
