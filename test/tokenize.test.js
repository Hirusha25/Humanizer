import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, splitBlocks, splitLinePrefix, collectProperNouns } from '../src/engine/tokenize.js';

test('splits plain sentences', () => {
  assert.deepEqual(splitSentences('One. Two! Three? Four.'), ['One.', 'Two!', 'Three?', 'Four.']);
});

test('does not split on abbreviations, initials or decimals', () => {
  const s = 'Dr. Smith met J. K. Rowling at 3.5 p.m. on Jan. 5. They talked, e.g. about books. It was fun.';
  assert.deepEqual(splitSentences(s), [
    'Dr. Smith met J. K. Rowling at 3.5 p.m. on Jan. 5.',
    'They talked, e.g. about books.',
    'It was fun.',
  ]);
});

test('handles closing quotes and parentheses after terminal punctuation', () => {
  assert.deepEqual(splitSentences('He said "go." Then (she left.) Done.'), ['He said "go."', 'Then (she left.)', 'Done.']);
});

test('splitBlocks round-trips text exactly', () => {
  const text = 'a\n\nb\nc\n\n\nd';
  assert.equal(splitBlocks(text).map((b) => b.text + b.sep).join(''), text);
});

test('splitLinePrefix keeps list markers', () => {
  assert.deepEqual(splitLinePrefix('- item one'), { prefix: '- ', body: 'item one' });
  assert.deepEqual(splitLinePrefix('2. second'), { prefix: '2. ', body: 'second' });
  assert.deepEqual(splitLinePrefix('plain'), { prefix: '', body: 'plain' });
});

test('collectProperNouns finds mid-sentence capitals only', () => {
  const set = collectProperNouns('The team met Alice in Paris. Bob was late.');
  assert.ok(set.has('Alice') && set.has('Paris'));
  assert.ok(!set.has('The') && !set.has('Bob'));
});
