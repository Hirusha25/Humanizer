// Word-level diff (LCS) used to highlight what changed in the output.

const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9'’-]*|\s+|[^\sA-Za-z0-9]+/g;

export function tokenize(text) {
  return text.match(TOKEN_RE) || [];
}

const isWord = (t) => /^[A-Za-z0-9]/.test(t);
const norm = (t) => t.toLowerCase().replace(/’/g, "'");

/**
 * Returns the tokens of `after`, each flagged `changed` when it is not part of
 * the longest common word subsequence with `before`.
 */
export function diffWords(before, after) {
  const a = tokenize(before).filter(isWord).map(norm);
  const bTokens = tokenize(after);
  const bWords = [];
  bTokens.forEach((t, i) => { if (isWord(t)) bWords.push({ i, n: norm(t) }); });
  const b = bWords.map((w) => w.n);
  const n = a.length;
  const m = b.length;
  const kept = new Set();
  if (n && m && n * m <= 16_000_000) {
    // LCS table on Int32Array (row-major (n+1)*(m+1))
    const W = m + 1;
    const dp = new Int32Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { kept.add(bWords[j].i); i++; j++; }
      else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
      else j++;
    }
  }
  return bTokens.map((t, i) => ({ text: t, word: isWord(t), changed: isWord(t) && !kept.has(i) }));
}
