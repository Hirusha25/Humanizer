import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, maxTokensFor, splitForModel, cleanModelOutput, joinUnits, MODELS, DEFAULT_MODEL } from '../src/engine/model/prompt.js';

test('model list has a valid default', () => {
  assert.ok(MODELS.some((m) => m.id === DEFAULT_MODEL));
});

test('messages carry the system prompt and the paragraph', () => {
  const m = buildMessages('  Some text.  ');
  assert.equal(m[0].role, 'system');
  assert.equal(m[1].content, 'Some text.');
  assert.ok(maxTokensFor('one two three four five') > 48);
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
