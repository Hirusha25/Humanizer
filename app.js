import { humanize, humanizeBest, analyze, alternativesFor, diffWords, MODES } from './src/engine/index.js';
import { LocalModel, deepRewrite, MODELS, DEFAULT_MODEL, supportsWebGPU } from './src/engine/model/client.js';

const $ = (id) => document.getElementById(id);
const els = {
  input: $('input'), output: $('output'), run: $('run'), regen: $('regen'), copy: $('copy'), sample: $('sample'),
  paste: $('paste'), clear: $('clear'), inCount: $('in-count'), outCount: $('out-count'), inScore: $('in-score'),
  outScore: $('out-score'), modes: $('modes'), report: $('report'), reportSummary: $('report-summary'),
  reportBefore: $('report-before'), reportAfter: $('report-after'), highlight: $('highlight'), popover: $('popover'),
  toast: $('toast'), theme: $('theme'), modelPanel: $('model-panel'), modelSelect: $('model-select'), modelMeta: $('model-meta'),
  modelLoad: $('model-load'), modelCancel: $('model-cancel'), modelProgress: $('model-progress'), modelStatus: $('model-status'),
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
  b.addEventListener('click', () => { state.mode = key; store.set('hz-mode', key); syncModes(); if (state.result && !modelBusy) run(); });
  els.modes.appendChild(b);
}
{
  const b = document.createElement('button');
  b.className = 'mode';
  b.type = 'button';
  b.role = 'tab';
  b.dataset.mode = 'deep';
  b.innerHTML = '<strong>Deep rewrite<span class="tag">local model</span></strong><span>Re-writes every paragraph with a small language model running in your browser, then cleans it with the rules. Slower, much more human.</span>';
  b.addEventListener('click', () => { state.mode = 'deep'; store.set('hz-mode', 'deep'); syncModes(); });
  els.modes.appendChild(b);
}
function syncModes() {
  for (const b of els.modes.children) b.setAttribute('aria-selected', String(b.dataset.mode === state.mode));
  els.modelPanel.hidden = state.mode !== 'deep';
  els.run.textContent = state.mode === 'deep' ? 'Deep rewrite' : 'Humanize';
}
syncModes();

// ---------- local model ----------
const model = new LocalModel();
let modelBusy = false;
let cancelFlag = { aborted: false };
for (const m of MODELS) {
  const o = document.createElement('option');
  o.value = m.id;
  o.textContent = `${m.label} (${m.size})`;
  els.modelSelect.appendChild(o);
}
els.modelSelect.value = store.get('hz-model') || DEFAULT_MODEL;
function syncModelMeta() {
  const m = MODELS.find((x) => x.id === els.modelSelect.value);
  const gpu = supportsWebGPU() ? 'WebGPU available' : 'No WebGPU: runs on CPU, slower';
  els.modelMeta.textContent = `${m ? m.note : ''} ${gpu}.`;
  const loaded = model.ready && model.modelId === els.modelSelect.value;
  els.modelLoad.textContent = loaded ? 'Loaded' : 'Download & load';
  els.modelLoad.disabled = loaded || modelBusy;
}
els.modelSelect.addEventListener('change', () => { store.set('hz-model', els.modelSelect.value); syncModelMeta(); });
model.onStatus = (msg) => { els.modelStatus.textContent = msg; };
model.onProgress = (p) => {
  if (p.status === 'progress' && p.total) {
    els.modelProgress.hidden = false;
    els.modelProgress.firstElementChild.style.width = `${Math.round((p.loaded / p.total) * 100)}%`;
    const mb = (n) => (n / 1048576).toFixed(0);
    els.modelStatus.textContent = `Downloading ${p.file || ''} ${mb(p.loaded)} / ${mb(p.total)} MB`;
  } else if (p.status === 'done' || p.status === 'ready') {
    els.modelProgress.hidden = true;
  }
};
async function ensureModel() {
  const id = els.modelSelect.value;
  if (model.ready && model.modelId === id) return true;
  modelBusy = true;
  syncModelMeta();
  els.modelProgress.hidden = false;
  els.modelProgress.firstElementChild.style.width = '0%';
  try {
    await model.load(id);
    els.modelProgress.hidden = true;
    return true;
  } catch (e) {
    console.error(e);
    els.modelProgress.hidden = true;
    const blocked = /fetch|network|Failed|blocked|CORS|Unable to load|404/i.test(e.message);
    els.modelStatus.textContent = blocked
      ? 'Could not download the model files. This needs an internet connection the first time, and the Claude-hosted copy of this app blocks outside downloads. Use the GitHub Pages version or run it locally with npm start.'
      : `Model failed to load: ${e.message}`;
    return false;
  } finally {
    modelBusy = false;
    syncModelMeta();
  }
}
els.modelLoad.addEventListener('click', ensureModel);
els.modelCancel.addEventListener('click', () => { cancelFlag.aborted = true; model.interrupt(); });
syncModelMeta();

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
  if (state.mode === 'deep') { runDeep(text); return; }
  els.run.disabled = true;
  els.run.textContent = 'Humanizing…';
  requestAnimationFrame(() => {
    try {
      const opts = options();
      if (newSeed || state.lastInput !== text || state.seed == null) state.seed = Math.floor(Math.random() * 2 ** 31);
      state.lastInput = text;
      const useBest = $('opt-best').checked && text.length < 20000;
      const res = useBest ? humanizeBest(text, { ...opts, seed: state.seed }, 4) : humanize(text, { ...opts, seed: state.seed });
      finalize(text, res);
    } catch (e) {
      console.error(e);
      toast('Something went wrong: ' + e.message);
    } finally {
      els.run.disabled = false;
      els.run.textContent = 'Humanize';
    }
  });
}

function finalize(text, res, extra = '') {
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
    `AI likelihood ${before.score}% → ${after.score}%. ` + extra +
    `${s.phrasesReplaced + s.openersRewritten} phrases rewritten, ${s.contractions} contractions, ` +
    `${s.synonymsSwapped} word swaps, ${s.sentencesSplit} sentences split, ${s.sentencesMerged} merged, ${s.clausesFlipped} flipped` +
    (s.fillerDropped ? `, ${s.fillerDropped} filler sentence${s.fillerDropped === 1 ? '' : 's'} dropped` : '') + '.';
  els.report.hidden = false;
}

async function runDeep(text) {
  if (modelBusy) return;
  els.run.disabled = true;
  els.run.textContent = 'Loading model…';
  const ok = await ensureModel();
  if (!ok) { els.run.disabled = false; els.run.textContent = 'Deep rewrite'; return; }
  els.run.textContent = 'Rewriting…';
  els.modelCancel.hidden = false;
  cancelFlag = { aborted: false };
  modelBusy = true;
  const opts = options();
  // live preview: one <p> per unit, streamed
  els.output.innerHTML = '';
  const paras = new Map();
  const onUnit = (i, partial, units, done) => {
    let p = paras.get(i);
    if (!p) {
      p = document.createElement('p');
      p.className = 'streaming';
      els.output.appendChild(p);
      paras.set(i, p);
    }
    p.textContent = (units[i].prefix || '') + partial;
    if (done) p.classList.remove('streaming');
    els.output.scrollTop = els.output.scrollHeight;
  };
  try {
    const t0 = performance.now();
    const deep = await deepRewrite(text, model, {
      onUnit,
      signal: cancelFlag,
      fallback: (t) => humanize(t, { ...opts, mode: 'stealth' }).text,
    });
    // Light rules pass on top: removes any tells the model re-introduced, adds contractions.
    const res = humanize(deep.text, { ...opts, mode: 'subtle', synonyms: false, rhythm: false });
    const secs = ((performance.now() - t0) / 1000).toFixed(0);
    const m = MODELS.find((x) => x.id === model.modelId);
    finalize(text, res, `Rewritten by ${m ? m.label : model.modelId} on ${model.device === 'webgpu' ? 'WebGPU' : 'CPU'} in ${secs}s` +
      (deep.tps ? ` (${deep.tps.toFixed(1)} tokens/s)` : '') + `, ${deep.rewrittenUnits} paragraph${deep.rewrittenUnits === 1 ? '' : 's'} by the model` +
      (deep.fallbackUnits ? `, ${deep.fallbackUnits} by rules` : '') +
      (deep.retriedUnits ? `, ${deep.retriedUnits} retried for length` : '') +
      (deep.trimmedUnits ? `, ${deep.trimmedUnits} trimmed` : '') +
      `. Length ${res.stats.inputWords} → ${res.stats.outputWords} words. `);
    els.modelStatus.textContent = `Done. Regenerate for a different rewrite.`;
  } catch (e) {
    console.error(e);
    toast(cancelFlag.aborted ? 'Stopped' : 'Deep rewrite failed: ' + e.message);
    if (!cancelFlag.aborted) els.modelStatus.textContent = `Deep rewrite failed: ${e.message}`;
  } finally {
    modelBusy = false;
    els.modelCancel.hidden = true;
    els.run.disabled = false;
    els.run.textContent = 'Deep rewrite';
    syncModelMeta();
  }
}

els.run.addEventListener('click', () => run(false));
els.regen.addEventListener('click', () => run(true));
els.highlight.addEventListener('change', () => els.output.classList.toggle('hl', els.highlight.checked));
els.sample.addEventListener('click', () => { els.input.value = SAMPLE; onInput(); if (state.mode !== 'deep') run(true); });
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
