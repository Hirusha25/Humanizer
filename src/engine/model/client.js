// Main-thread wrapper around the model worker with a small promise API.
import { buildMessages, maxTokensFor, cleanModelOutput, splitForModel, joinUnits, DEFAULT_MODEL } from './prompt.js';

export { MODELS, DEFAULT_MODEL } from './prompt.js';

export function supportsWebGPU() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

export class LocalModel {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.modelId = null;
    this.device = null;
    this.pending = new Map();
    this.onProgress = null;
    this.onStatus = null;
    this.seq = 0;
  }

  _spawn() {
    if (this.worker) return;
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (e) => this._onMessage(e.data));
    this.worker.addEventListener('error', (e) => this._fail(new Error(e.message || 'Worker crashed')));
  }

  _fail(err) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    if (this.loadPromise) { this.loadPromise.reject(err); this.loadPromise = null; }
  }

  _onMessage(m) {
    switch (m.status) {
      case 'progress': this.onProgress?.(m); break;
      case 'loading': this.onStatus?.(m.message); break;
      case 'ready':
        this.ready = true; this.modelId = m.modelId; this.device = m.device;
        this.onStatus?.(`Ready on ${m.device === 'webgpu' ? 'WebGPU' : 'CPU (WASM)'}`);
        this.loadPromise?.resolve(m); this.loadPromise = null; break;
      case 'token': this.pending.get(m.id)?.onToken?.(m.text); break;
      case 'done': { const p = this.pending.get(m.id); this.pending.delete(m.id); p?.resolve(m); break; }
      case 'error': {
        const err = new Error(m.message);
        if (m.id && this.pending.has(m.id)) { this.pending.get(m.id).reject(err); this.pending.delete(m.id); }
        else this._fail(err);
        break;
      }
      default: break;
    }
  }

  /** Download (once) and initialise a model. Resolves when generation can start. */
  load(modelId = DEFAULT_MODEL, { device = 'auto' } = {}) {
    this._spawn();
    if (this.ready && this.modelId === modelId) return Promise.resolve({ modelId, device: this.device });
    this.ready = false;
    return new Promise((resolve, reject) => {
      this.loadPromise = { resolve, reject };
      this.worker.postMessage({ type: 'load', modelId, device });
    });
  }

  /** Rewrite one paragraph. Resolves with the raw model text (already streamed via onToken). */
  generate(paragraph, { onToken } = {}) {
    if (!this.ready) return Promise.reject(new Error('Model is not loaded'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onToken });
      this.worker.postMessage({ type: 'generate', id, messages: buildMessages(paragraph), max_new_tokens: maxTokensFor(paragraph) });
    });
  }

  interrupt() { this.worker?.postMessage({ type: 'interrupt' }); }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.modelId = null;
    this._fail(new Error('Model disposed'));
  }
}

/**
 * Rewrite a whole document with a loaded model, unit by unit.
 * `onUnit(index, partialText, units)` streams progress; `fallback(text)` is used
 * when the model output is unusable for a unit.
 */
export async function deepRewrite(text, model, { onUnit, fallback = (t) => t, signal } = {}) {
  const units = splitForModel(text);
  const rewritten = [];
  let used = 0;
  let fell = 0;
  let tps = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.kind !== 'rewrite') { rewritten.push(null); continue; }
    if (signal?.aborted) throw new Error('Cancelled');
    const res = await model.generate(u.text, { onToken: (t) => onUnit?.(i, t, units) });
    if (res.tps) tps = res.tps;
    const clean = res.interrupted ? null : cleanModelOutput(res.text, u.text);
    if (clean) { rewritten.push(clean); used++; } else { rewritten.push(fallback(u.text)); fell++; }
    onUnit?.(i, rewritten[i], units, true);
  }
  return { text: joinUnits(units, rewritten), units, rewrittenUnits: used, fallbackUnits: fell, tps };
}
