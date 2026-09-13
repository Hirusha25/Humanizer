import { test } from 'node:test';
import assert from 'node:assert/strict';
import { humanize, humanizeBest, analyze, MODES } from '../src/engine/index.js';

const AI_TEXT = `In today's fast-paced digital landscape, businesses must leverage cutting-edge technology to stay competitive. It is important to note that artificial intelligence plays a crucial role in this transformation. Furthermore, companies that embrace innovation are able to streamline their operations and enhance customer experiences — ultimately fostering long-term growth.

However, it is essential to navigate the complexities of implementation carefully. Organizations should conduct a comprehensive assessment of their existing infrastructure; moreover, they need to ensure that stakeholders are aligned with the strategic vision. Additionally, a robust framework for data governance is paramount. In conclusion, the journey toward digital transformation is not only a technological endeavor but also a cultural one.`;

const HUMAN_TEXT = `Honestly, I didn't expect the new router to make much difference. It did. My video calls stopped dropping, and the kids stopped yelling about lag. Setup took ten minutes, most of which was me hunting for the old password on a sticky note. Would I buy it again? Probably, though the price still stings a bit.`;

test('same seed gives same output, different seed differs', () => {
  const a = humanize(AI_TEXT, { seed: 42 });
  const b = humanize(AI_TEXT, { seed: 42 });
  const c = humanize(AI_TEXT, { seed: 43 });
  assert.equal(a.text, b.text);
  assert.notEqual(a.text, c.text);
});

test('output scores lower than input on AI-sounding text in every mode', () => {
  const before = analyze(AI_TEXT).score;
  for (const mode of Object.keys(MODES)) {
    const after = analyze(humanize(AI_TEXT, { mode, seed: 7 }).text).score;
    assert.ok(after < before - 20, `${mode}: ${before} -> ${after}`);
  }
});

test('human text scores low and AI text scores high', () => {
  assert.ok(analyze(HUMAN_TEXT).score < 35);
  assert.ok(analyze(AI_TEXT).score > 65);
});

test('no em dashes, placeholders or doubled spaces in output', () => {
  const out = humanize(AI_TEXT, { seed: 3, mode: 'stealth' }).text;
  assert.ok(!/[—–]/.test(out));
  assert.ok(!/[]/.test(out));
  assert.ok(!/  /.test(out));
  assert.ok(!/ [,.]/.test(out));
});

test('urls, code, emails and quotes are preserved verbatim', () => {
  const src = 'Visit https://example.com/utilize?x=1 or email utilize@example.com. Run `utilize --now` first. She said "we must utilize every synergy" and left.';
  const out = humanize(src, { seed: 1, mode: 'stealth' }).text;
  assert.ok(out.includes('https://example.com/utilize?x=1'));
  assert.ok(out.includes('utilize@example.com'));
  assert.ok(out.includes('`utilize --now`'));
  assert.ok(out.includes('"we must utilize every synergy"'));
});

test('quotes can be rewritten when keepQuotes is false', () => {
  const src = 'She said "we must utilize every synergy" and left.';
  const out = humanize(src, { seed: 1, keepQuotes: false }).text;
  assert.ok(!/utilize/.test(out));
});

test('paragraphs and list markers survive', () => {
  const src = 'Intro line here.\n\n- Utilize the first item.\n- Leverage the second item.\n\n1. Delve into step one.\n2. Step two.';
  const out = humanize(src, { seed: 5 }).text;
  assert.equal(out.split('\n\n').length, 3);
  assert.ok(/^- /m.test(out));
  assert.ok(/^1\. /m.test(out) && /^2\. /m.test(out));
  assert.ok(!/utilize|leverage|delve/i.test(out));
});

test('markdown is stripped by default and kept on request', () => {
  const src = '## Heading\n\nSome **bold** text that we utilize.';
  assert.ok(!/##|\*\*/.test(humanize(src, { seed: 1 }).text));
  assert.ok(/\*\*/.test(humanize(src, { seed: 1, stripMarkdown: false }).text));
});

test('empty and tiny inputs are safe', () => {
  assert.equal(humanize('').text, '');
  assert.equal(humanize('   ').text, '   ');
  assert.ok(humanize('Hi.').text.length > 0);
});

test('humanizeBest returns a scored result', () => {
  const r = humanizeBest(AI_TEXT, { seed: 9 }, 3);
  assert.ok(typeof r.score === 'number');
  assert.ok(r.text.length > 100);
});

test('stats are populated', () => {
  const r = humanize(AI_TEXT, { seed: 11 });
  assert.ok(r.stats.phrasesReplaced > 5);
  assert.ok(r.stats.changedWords > 10);
  assert.equal(r.stats.inputWords, analyze(AI_TEXT).words);
});

test('does not mangle ordinary human text much', () => {
  const r = humanize(HUMAN_TEXT, { seed: 2, mode: 'subtle' });
  assert.ok(r.stats.changedWords / r.stats.inputWords < 0.25, `changed ${r.stats.changedWords}`);
});
