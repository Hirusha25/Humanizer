import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, maxTokensFor, splitForModel, cleanModelOutput, joinUnits, lengthBounds, lengthStatus, trimToWords, dropUnfinishedSentence, MODELS, DEFAULT_MODEL } from '../src/engine/model/prompt.js';

test('model list has a valid default', () => {
  assert.ok(MODELS.some((m) => m.id === DEFAULT_MODEL));
});

test('messages carry the system prompt and the paragraph', () => {
  const m = buildMessages('  Some text here now.  ');
  assert.equal(m[0].role, 'system');
  assert.ok(m[1].content.startsWith('Some text here now.'));
  assert.match(m[1].content, /4 words/);
  assert.match(buildMessages('a b c d e', { strict: true })[1].content, /previous attempt/);
  assert.equal(maxTokensFor('one two three four five'), 32);
});

test('splitForModel keeps code, headings and short lines, rewrites prose and list items', () => {
  const src = '# Title\n\nThis is a paragraph with enough words to be rewritten by the model.\n\n```\ncode here\n```\n\n- A list item that also has quite a few words in it.\n- Short.';
  const units = splitForModel(src);
  assert.deepEqual(units.map((u) => u.kind), ['keep', 'rewrite', 'keep', 'keep', 'keep', 'rewrite', 'keep']);
  assert.equal(units[5].prefix, '- ');
  assert.equal(joinUnits(units, units.map(() => null)), src);
});

test('cleanModelOutput strips lead-ins, quotes and notes, and rejects junk', () => {
  const original = 'The committee reviewed the budget and approved three of the five proposals after a long debate.';
  assert.equal(cleanModelOutput('Here is the rewritten paragraph:\n\n"After a long debate, the committee looked over the budget and signed off on three of the five proposals."\n\nNote: I kept all the facts.', original),
    'After a long debate, the committee looked over the budget and signed off on three of the five proposals.');
  assert.equal(cleanModelOutput("I'm sorry, as an AI language model I cannot rewrite this.", original), null);
  assert.equal(cleanModelOutput('Too short.', original), null);
  assert.equal(cleanModelOutput(original, original), null);
  assert.equal(cleanModelOutput('The team met — briefly — and left.', 'The team met briefly and then left.'), 'The team met, briefly, and left.');
});

test('length band, status, trimming and unfinished-sentence handling', () => {
  const original = Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ') + '.';
  assert.deepEqual(lengthBounds(original), { words: 50, min: 40, max: 60 });
  assert.equal(lengthStatus(Array(45).fill('x').join(' '), original), 'ok');
  assert.equal(lengthStatus(Array(30).fill('x').join(' '), original), 'short');
  assert.equal(lengthStatus(Array(90).fill('x').join(' '), original), 'long');
  const long = 'One two three four. Five six seven eight. Nine ten eleven twelve thirteen.';
  assert.equal(trimToWords(long, 9), 'One two three four. Five six seven eight.');
  assert.equal(dropUnfinishedSentence('It works well. It also runs on the'), 'It works well.');
  assert.equal(dropUnfinishedSentence('It works well.'), 'It works well.');
  assert.equal(cleanModelOutput('The team met on Monday and agreed on the plan. Then they went to the', 'On Monday the team got together and signed off on the plan.'), 'The team met on Monday and agreed on the plan.');
});
