import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';
import { applyContractions } from '../src/engine/transforms/contractions.js';
import { rewritePhrases } from '../src/engine/transforms/phrases.js';
import { rewriteOpener } from '../src/engine/transforms/openers.js';
import { normalizePunctuation } from '../src/engine/transforms/punctuation.js';
import { splitLongSentence, mergeShortPair, flipClause, improveRhythm } from '../src/engine/transforms/rhythm.js';
import { stripMarkdown } from '../src/engine/transforms/markdown.js';
import { swapSynonyms, alternativesFor } from '../src/engine/transforms/synonyms.js';
import { dropFillerSentences } from '../src/engine/transforms/filler.js';

const rng = () => createRng(1);

test('contractions apply with casing preserved', () => {
  const r = applyContractions('It is clear that we do not know. I am sure they will not go. Do not worry.', rng(), 1);
  assert.equal(r.sentence, "It's clear that we don't know. I'm sure they won't go. Don't worry.");
});

test('contractions avoid awkward cases', () => {
  const r = applyContractions('Take it as it is. They have a dog. You could have a point.', rng(), 1);
  assert.equal(r.sentence, 'Take it as it is. They have a dog. You could have a point.');
});

test('AI-tell phrases are always replaced', () => {
  const r = rewritePhrases('We should utilize the tool to delve into a myriad of options.', rng(), { softRate: 0 });
  assert.ok(!/utilize|delve|myriad/i.test(r.sentence), r.sentence);
  assert.ok(r.count >= 3);
});

test('deleted lead-in phrases leave a capitalised sentence', () => {
  const rng0 = { chance: () => true, pick: (a) => a[0], next: () => 0, int: () => 0 };
  const r = rewritePhrases('It is important to note that cats sleep a lot.', rng0, { softRate: 1 });
  assert.equal(r.sentence, 'Cats sleep a lot.');
});

test('openers are rewritten', () => {
  const r = rewriteOpener('However, the plan failed.', rng(), 1);
  assert.ok(!/^However/.test(r.sentence));
  assert.ok(/^[A-Z]/.test(r.sentence));
  assert.ok(/the plan failed\.$/.test(r.sentence));
});

test('em dashes and semicolons are removed', () => {
  const r = normalizePunctuation('The tool works — it really does; the team loves it — mostly.', rng());
  assert.ok(!/[—;]/.test(r), r);
  assert.ok(/The tool works, it really does/.test(r) || /The tool works\. It really does/.test(r));
});

test('semicolon between clauses becomes a capitalised new sentence', () => {
  const r = normalizePunctuation('We tried the first option for a while; the second option worked much better in practice.', rng());
  assert.equal(r, 'We tried the first option for a while. The second option worked much better in practice.');
});

test('long sentences split at clause boundaries', () => {
  const s = 'The new system processes every request in under a second on average, and it also keeps a complete audit trail of every change that was made by every user.';
  const parts = splitLongSentence(s, rng());
  assert.ok(parts && parts.length === 2, JSON.stringify(parts));
  assert.ok(parts[0].endsWith('.'));
  assert.ok(/^[A-Z]/.test(parts[1]));
});

test('short sentences merge with lowercase join', () => {
  const m = mergeShortPair('The cat sat.', 'It purred loudly.', rng(), new Set());
  assert.match(m, /^The cat sat(,)? (and|plus) it purred loudly\.$/);
  const keep = mergeShortPair('The cat sat.', 'Paris was quiet.', rng(), new Set(['Paris']));
  assert.match(keep, /Paris was quiet\.$/);
});

test('clause flip keeps meaning and capitalisation', () => {
  const f = flipClause('Because the roads were icy that morning, we decided to stay at home.', rng(), new Set());
  assert.equal(f, 'We decided to stay at home because the roads were icy that morning.');
});

test('improveRhythm returns sentences and counts', () => {
  const sentences = ['This is short.', 'So is this.', 'This one is a longer sentence that keeps going for quite a while, and it has a second clause that could easily stand on its own.'];
  const r = improveRhythm(sentences, rng(), { splitRate: 1, mergeRate: 1, flipRate: 0 });
  assert.ok(r.sentences.length >= 2);
  assert.equal(r.sentences.join(' ').replace(/[^a-z]/gi, '').length > 0, true);
});

test('stripMarkdown removes decoration only', () => {
  assert.equal(stripMarkdown('## Title\n\n**Bold** and *it* and [link](http://x.y) here\n---\n> quote'), 'Title\n\nBold and it and link here\n\nquote');
});

test('synonyms skip proper nouns and blocked contexts', () => {
  const always = { chance: () => true, pick: (a) => a[0], next: () => 0, int: () => 0 };
  const idiom = swapSynonyms('The Big Apple is a big city.', always, { rate: 1 });
  assert.equal(idiom.sentence, 'The Big Apple is a big city.'); // whole sentence blocked by the idiom
  const r = swapSynonyms('Alice found a big house and a hard drive.', always, { rate: 1, properNouns: new Set(['Alice']) });
  assert.ok(/^Alice/.test(r.sentence));
  assert.ok(/large house/.test(r.sentence), r.sentence);
  assert.ok(/hard drive/.test(r.sentence), r.sentence);
});

test('alternativesFor keeps casing', () => {
  const alts = alternativesFor('Important');
  assert.ok(alts.length > 0);
  assert.ok(alts.every((a) => /^[A-Z]/.test(a)));
});

test('filler sentences are dropped', () => {
  const r = dropFillerSentences(['Certainly! Here is the plan.', 'The plan has three steps.', 'I hope this helps!']);
  assert.deepEqual(r.sentences, ['The plan has three steps.']);
  assert.equal(r.dropped, 2);
});
