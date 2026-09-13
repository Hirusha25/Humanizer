import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';
import { trailingThough, frontTimePhrase, splitFragment, addAside, calmExclamation, applyVoice } from '../src/engine/transforms/voice.js';

test('leading However becomes a trailing though', () => {
  assert.equal(trailingThough('However, the tool still works fine for small teams.'), 'The tool still works fine for small teams, though.');
  assert.equal(trailingThough('However, it works, and that is what matters.'), null);
});

test('time phrases move to the front', () => {
  assert.equal(frontTimePhrase('Most teams skip this step in practice.', new Set()), 'In practice, most teams skip this step.');
  assert.equal(frontTimePhrase('Paris was much quieter than usual in 2020.', new Set(['Paris'])), 'In 2020, Paris was much quieter than usual.');
  assert.equal(frontTimePhrase('It depends on the weather.', new Set()), null);
});

test('trailing qualifiers become fragments', () => {
  assert.deepEqual(splitFragment('Running your own servers costs real money, especially at scale.'), ['Running your own servers costs real money.', 'Especially at scale.']);
  assert.equal(splitFragment('Short one, especially now.'), null);
});

test('asides are added once and only mid-paragraph', () => {
  const rng = createRng(3);
  const r = applyVoice(['First sentence here with enough words.', 'The second sentence also has enough words in it.', 'And a third one that has plenty of words.'], rng, { asideRate: 1, frontRate: 0, fragmentRate: 0, exclaimRate: 0 });
  assert.equal(r.asides, 1);
  assert.ok(!/^(Honestly|In practice|Put simply|Frankly|Realistically|To be fair|Truth be told|Look|Here is the thing|Simply put|The short version)/.test(r.sentences[0]));
  assert.equal(addAside('And this starts with a conjunction already.', rng, new Set()), null);
});

test('long exclamations calm down', () => {
  assert.equal(calmExclamation('This is the best thing that has ever happened to us!'), 'This is the best thing that has ever happened to us.');
  assert.equal(calmExclamation('Wow!'), null);
});
