// Paragraph, line and sentence segmentation that survives round-tripping.

const ABBREVIATIONS = new Set([
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'st.', 'mt.', 'ft.', 'vs.', 'etc.', 'e.g.', 'i.e.',
  'inc.', 'ltd.', 'co.', 'corp.', 'no.', 'fig.', 'vol.', 'approx.', 'dept.', 'est.', 'u.s.', 'u.k.',
  'a.m.', 'p.m.', 'jan.', 'feb.', 'mar.', 'apr.', 'jun.', 'jul.', 'aug.', 'sep.', 'sept.', 'oct.', 'nov.', 'dec.',
  'gen.', 'col.', 'lt.', 'sgt.', 'capt.', 'cmdr.', 'ph.d.', 'b.a.', 'm.a.', 'b.sc.', 'm.sc.', 'ave.', 'blvd.',
]);

/** Split text into lines, keeping the exact separators so we can re-join losslessly. */
export function splitBlocks(text) {
  const parts = text.split(/(\r?\n(?:[ \t]*\r?\n)*)/);
  const blocks = [];
  for (let i = 0; i < parts.length; i += 2) {
    blocks.push({ text: parts[i], sep: parts[i + 1] ?? '' });
  }
  return blocks;
}

/** Detect list markers / blockquote prefixes so we only rewrite the item text. */
export function splitLinePrefix(line) {
  const m = line.match(/^(\s*(?:[-*•+]|\d+[.)]|[a-z][.)]|>)\s+)/i);
  if (m) return { prefix: m[1], body: line.slice(m[1].length) };
  const lead = line.match(/^\s*/)[0];
  return { prefix: lead, body: line.slice(lead.length) };
}

/** Sentence splitter with abbreviation awareness. Sentences are returned trimmed. */
export function splitSentences(paragraph) {
  const out = [];
  let start = 0;
  const re = /[.!?]+["'”’)\]]*\s+/g;
  let m;
  while ((m = re.exec(paragraph))) {
    const end = m.index + m[0].length;
    const before = paragraph.slice(start, m.index);
    const lastWord = (before.match(/(\S+)$/) || ['', ''])[1];
    const next = paragraph.slice(end, end + 1);
    if (m[0].startsWith('.')) {
      const lw = lastWord.toLowerCase();
      if (ABBREVIATIONS.has(lw + '.')) continue;
      if (/^[A-Z]$/.test(lastWord)) continue; // initials: "J. K. Rowling"
      if (/^[a-z]/.test(next)) continue; // ". word" is almost never a boundary
      if (/^\d+$/.test(lastWord) && /^\d/.test(next)) continue;
    }
    if (next === '') break;
    out.push(paragraph.slice(start, end).trim());
    start = end;
  }
  const rest = paragraph.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

export function wordCount(sentence) {
  const m = sentence.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g);
  return m ? m.length : 0;
}

/** Words that appear capitalised somewhere other than sentence start: likely proper nouns. */
export function collectProperNouns(text) {
  const set = new Set();
  for (const block of splitBlocks(text)) {
    for (const sentence of splitSentences(block.text)) {
      const words = sentence.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
      for (let i = 1; i < words.length; i++) {
        if (/^[A-Z]/.test(words[i]) && words[i] !== 'I') set.add(words[i]);
      }
    }
  }
  return set;
}
