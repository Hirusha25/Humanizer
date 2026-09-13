import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixArticles, matchCase, protect, restore, tidy, capitalizeFirst } from '../src/engine/text.js';

test('fixArticles repairs a/an after substitutions', () => {
  assert.equal(fixArticles('a important step and an big one'), 'an important step and a big one');
  assert.equal(fixArticles('an user, a hour, a unique case, an honest man'), 'a user, an hour, a unique case, an honest man');
  assert.equal(fixArticles('A apple. An pear.'), 'An apple. A pear.');
  assert.equal(fixArticles('she got an A in math'), 'she got an A in math');
});

test('matchCase copies casing', () => {
  assert.equal(matchCase('Utilize', 'use'), 'Use');
  assert.equal(matchCase('UTILIZE', 'use'), 'USE');
  assert.equal(matchCase('utilize', 'use'), 'use');
});

test('protect/restore keeps urls, code, emails and quotes intact', () => {
  const src = 'See https://example.com/a?b=c and `utilize()` or mail me@x.io. He said "we must utilize it" ok.';
  const { text, spans } = protect(src);
  assert.ok(!text.includes('https://'));
  assert.ok(!text.includes('utilize()'));
  assert.ok(!text.includes('me@x.io'));
  assert.ok(!text.includes('we must utilize it'));
  assert.equal(restore(text, spans), src);
});

test('tidy cleans spacing artefacts', () => {
  assert.equal(tidy('  Hello ,  world ,, again .'), 'Hello, world, again.');
  assert.equal(capitalizeFirst('"quoted start'), '"Quoted start');
});
