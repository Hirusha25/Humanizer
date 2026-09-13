import { humanize, humanizeBest, analyze, alternativesFor, diffWords, MODES } from './src/engine/index.js';

const $ = (id) => document.getElementById(id);
const els = {
  input: $('input'), output: $('output'), run: $('run'), regen: $('regen'), copy: $('copy'), sample: $('sample'),
  paste: $('paste'), clear: $('clear'), inCount: $('in-count'), outCount: $('out-count'), inScore: $('in-score'),
  outScore: $('out-score'), modes: $('modes'), report: $('report'), reportSummary: $('report-summary'),
  reportBefore: $('report-before'), reportAfter: $('report-after'), highlight: $('highlight'), popover: $('popover'),
  toast: $('toast'), theme: $('theme'),
};

const SAMPLE = `In today's fast-paced digital landscape, businesses must leverage cutting-edge technology to stay competitive. It is important to note that artificial intelligence plays a crucial role in this transformation. Furthermore, companies that embrace innovation are able to streamline their operations and enhance customer experiences — ultimately fostering long-term growth.

However, it is essential to navigate the complexities of implementation carefully. Organizations should conduct a comprehensive assessment of their existing infrastructure; moreover, they need to ensure that stakeholders are aligned with the strategic vision. Additionally, a robust framework for data governance is paramount. In conclusion, the journey toward digital transformation is not only a technological endeavor but also a cultural one, and it requires a holistic approach that encompasses people, processes, and technology.`;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const state = { mode: store.get('hz-mode') || 'balanced', seed: null, lastInput: '', result: null };

// ---------- theme ----------
const savedTheme = store.get('hz-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
const currentTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
const syncThemeIcon = () => { els.theme.textContent = currentTheme() === 'light' ? '☾' : '☀'; };
syncThemeIcon();
els.theme.addEventListener('click', () => {
  const next = currentTheme() === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  store.set('hz-theme', next);
  syncThemeIcon();
});

// ---------- modes ----------
for (const [key, m] of Object.entries(MODES)) {
  const b = document.createElement('button');
  b.className = 'mode';
  b.type = 'button';
  b.role = 'tab';
  b.dataset.mode = key;
  b.innerHTML = `<strong>${m.label}</strong><span>${m.description}</span>`;
  b.addEventListener('click', () => { state.mode = key; store.set('hz-mode', key); syncModes(); if (state.result) run(); });
  els.modes.appendChild(b);
}
function syncModes() {
  for (const b of els.modes.children) b.setAttribute('aria-selected', String(b.dataset.mode === state.mode));
}
syncModes();

// ---------- helpers ----------
const options = () => ({
  mode: state.mode,
  contractions: $('opt-contractions').checked,
  synonyms: $('opt-synonyms').checked,
  rhythm: $('opt-rhythm').checked,
  dropFiller: $('opt-filler').checked,
  stripMarkdown: $('opt-markdown').checked,
  keepQuotes: $('opt-quotes').checked,
});

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { els.toast.hidden = true; }, 1800);
}

function scoreClass(score) { return score >= 65 ? 'bad' : score >= 35 ? 'warn' : 'ok'; }

function renderScore(el, text) {
  if (!text.trim()) { el.innerHTML = ''; el.className = 'score'; return null; }
  const a = analyze(text);
  el.className = `score ${scoreClass(a.score)}`;
  el.innerHTML = `<span class="lbl">${a.score}% AI</span><div class="bar"><i style="width:${a.score}%"></i></div><span class="muted">${a.label}</span>`;
  return a;
}

function renderFeatures(el, a) {
  el.innerHTML = a.features.map((f) => {
    const pct = Math.round(f.value * 100);
    const cls = pct >= 65 ? '' : pct >= 35 ? 'warn' : 'ok';
    return `<div class="feature"><span class="name">${f.label}</span><div class="track"><i class="${cls}" style="width:${pct}%"></i></div><span class="val">${pct}%</span><span class="detail">${f.detail}</span></div>`;
  }).join('');
}

function wordsLabel(n) { return `${n} word${n === 1 ? '' : 's'}`; }

function outputText() {
  return [...els.output.querySelectorAll('p')].map((p) => p.textContent).join('\n\n');
}

function renderOutput(before, after) {
  const paragraphs = after.split(/\n+/);
  const frag = document.createDocumentFragment();
  const beforeParas = before.split(/\n+/);
  // Diff paragraph by paragraph when counts line up, otherwise whole text.
  const sameShape = paragraphs.length === beforeParas.length;
  const tokensAll = sameShape ? null : diffWords(before, after);
  let cursor = 0;
  paragraphs.forEach((para, pi) => {
    if (!para.trim()) return;
    const p = document.createElement('p');
    let tokens;
    if (sameShape) tokens = diffWords(beforeParas[pi], para);
    else {
      // consume tokens from the global diff until we cover this paragraph's text
      tokens = [];
      let covered = '';
      while (cursor < tokensAll.length && covered.length < para.length) {
        const t = tokensAll[cursor++];
        if (/^\s+$/.test(t.text) && covered === '') continue;
        if (/\n/.test(t.text)) { break; }
        tokens.push(t);
        covered += t.text;
      }
    }
    for (const t of tokens) {
      if (t.word) {
        const s = document.createElement('span');
        s.className = 'w' + (t.changed ? ' changed' : '');
        s.textContent = t.text;
        p.appendChild(s);
      } else p.appendChild(document.createTextNode(t.text));
    }
    frag.appendChild(p);
  });
  els.output.innerHTML = '';
  els.output.appendChild(frag);
  els.output.classList.toggle('hl', els.highlight.checked);
}

// ---------- main action ----------
function run(newSeed = false) {
  const text = els.input.value;
  if (!text.trim()) { toast('Paste some text first'); return; }
  els.run.disabled = true;
  els.run.textContent = 'Humanizing…';
  requestAnimationFrame(() => {
    try {
      const opts = options();
      if (newSeed || state.lastInput !== text || state.seed == null) state.seed = Math.floor(Math.random() * 2 ** 31);
      state.lastInput = text;
      const useBest = $('opt-best').checked && text.length < 20000;
      const res = useBest ? humanizeBest(text, { ...opts, seed: state.seed }, 4) : humanize(text, { ...opts, seed: state.seed });
      state.result = res;
      renderOutput(text, res.text);
      const before = analyze(text);
      const after = analyze(res.text);
      renderScore(els.inScore, text);
      renderScore(els.outScore, res.text);
      els.outCount.textContent = wordsLabel(res.stats.outputWords) + ` · ${res.stats.changedWords} changed`;
      renderFeatures(els.reportBefore, before);
      renderFeatures(els.reportAfter, after);
      const s = res.stats;
      els.reportSummary.textContent =
        `AI likelihood ${before.score}% → ${after.score}%. ` +
        `${s.phrasesReplaced + s.openersRewritten} phrases rewritten, ${s.contractions} contractions, ` +
        `${s.synonymsSwapped} word swaps, ${s.sentencesSplit} sentences split, ${s.sentencesMerged} merged, ${s.clausesFlipped} flipped` +
        (s.fillerDropped ? `, ${s.fillerDropped} filler sentence${s.fillerDropped === 1 ? '' : 's'} dropped` : '') + '.';
      els.report.hidden = false;
    } catch (e) {
      console.error(e);
      toast('Something went wrong: ' + e.message);
    } finally {
      els.run.disabled = false;
      els.run.textContent = 'Humanize';
    }
  });
}

els.run.addEventListener('click', () => run(false));
els.regen.addEventListener('click', () => run(true));
els.highlight.addEventListener('change', () => els.output.classList.toggle('hl', els.highlight.checked));
els.sample.addEventListener('click', () => { els.input.value = SAMPLE; onInput(); run(true); });
els.clear.addEventListener('click', () => { els.input.value = ''; onInput(); els.output.innerHTML = '<p class="placeholder">Your rewrite appears here. Click any word in the result to swap it for an alternative.</p>'; els.outScore.innerHTML = ''; els.outCount.textContent = ''; els.report.hidden = true; state.result = null; });
els.paste.addEventListener('click', async () => {
  try { els.input.value = await navigator.clipboard.readText(); onInput(); }
  catch { toast('Clipboard access was blocked. Use Ctrl+V instead.'); els.input.focus(); }
});
els.copy.addEventListener('click', async () => {
  const t = outputText();
  if (!t.trim()) return toast('Nothing to copy yet');
  try { await navigator.clipboard.writeText(t); toast('Copied'); }
  catch { toast('Copy failed'); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run(false);
});

let inputTimer;
function onInput() {
  els.inCount.textContent = wordsLabel((els.input.value.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []).length);
  clearTimeout(inputTimer);
  inputTimer = setTimeout(() => renderScore(els.inScore, els.input.value), 250);
}
els.input.addEventListener('input', onInput);
onInput();

// ---------- click-to-swap ----------
let activeSpan = null;
function closePopover() { els.popover.hidden = true; activeSpan = null; }
els.output.addEventListener('click', (e) => {
  const span = e.target.closest('.w');
  if (!span) return closePopover();
  e.stopPropagation();
  const word = span.textContent;
  const alts = alternativesFor(word);
  activeSpan = span;
  const pop = els.popover;
  pop.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'head';
  head.textContent = alts.length ? 'Swap for' : 'No suggestions';
  pop.appendChild(head);
  for (const a of alts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a;
    b.addEventListener('click', () => applySwap(a));
    pop.appendChild(b);
  }
  const inp = document.createElement('input');
  inp.placeholder = 'Type a replacement…';
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && inp.value.trim()) applySwap(inp.value.trim()); if (ev.key === 'Escape') closePopover(); });
  pop.appendChild(inp);
  pop.hidden = false;
  const r = span.getBoundingClientRect();
  const top = r.bottom + window.scrollY + 6;
  let left = r.left + window.scrollX;
  pop.style.top = `${top}px`;
  pop.style.left = `${Math.min(left, window.scrollX + window.innerWidth - pop.offsetWidth - 12)}px`;
  inp.focus({ preventScroll: true });
});
function applySwap(text) {
  if (!activeSpan) return;
  activeSpan.textContent = text;
  activeSpan.classList.add('changed');
  closePopover();
  const t = outputText();
  renderScore(els.outScore, t);
  els.outCount.textContent = wordsLabel((t.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []).length) + ' · edited';
}
document.addEventListener('click', (e) => { if (!els.popover.contains(e.target)) closePopover(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(); });
