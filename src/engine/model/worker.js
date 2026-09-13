// Web Worker: loads transformers.js from a CDN, then a small instruction-tuned
// model from the Hugging Face hub (downloaded once, cached by the browser), and
// generates rewrites paragraph by paragraph with token streaming.
const TJS_VERSION = '3.8.1';
const TJS_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TJS_VERSION}/dist/transformers.min.js`;

let tjs = null;
let tokenizer = null;
let model = null;
let loadedId = null;
let loadedDevice = null;
let stopping = null;

const post = (m) => self.postMessage(m);

async function lib() {
  if (tjs) return tjs;
  tjs = await import(/* webpackIgnore: true */ TJS_URL);
  tjs.env.allowLocalModels = false;
  tjs.env.useBrowserCache = true;
  return tjs;
}

async function detectDevice(preferred) {
  if (preferred === 'wasm') return 'wasm';
  try {
    if (self.navigator?.gpu) {
      const adapter = await self.navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    }
  } catch { /* fall through */ }
  return 'wasm';
}

async function load({ modelId, device: preferred }) {
  const t = await lib();
  const device = await detectDevice(preferred);
  if (model && loadedId === modelId && loadedDevice === device) { post({ status: 'ready', device, modelId }); return; }
  if (model) { try { await model.dispose(); } catch { /* ignore */ } model = null; tokenizer = null; }
  const dtype = device === 'webgpu' ? 'q4f16' : 'q4';
  const progress_callback = (x) => post({ status: 'progress', ...x });
  post({ status: 'loading', message: `Downloading ${modelId} (${dtype}, ${device})` });
  tokenizer = await t.AutoTokenizer.from_pretrained(modelId, { progress_callback });
  model = await t.AutoModelForCausalLM.from_pretrained(modelId, { dtype, device, progress_callback });
  post({ status: 'loading', message: 'Warming up the model' });
  const inputs = tokenizer('a');
  await model.generate({ ...inputs, max_new_tokens: 1 });
  loadedId = modelId;
  loadedDevice = device;
  stopping = new t.InterruptableStoppingCriteria();
  post({ status: 'ready', device, modelId, dtype });
}

async function generate({ id, messages, max_new_tokens, temperature = 0.85, top_p = 0.92, repetition_penalty = 1.12 }) {
  const t = await lib();
  if (!model) throw new Error('Model is not loaded');
  stopping.reset();
  const inputs = tokenizer.apply_chat_template(messages, { add_generation_prompt: true, return_dict: true });
  let text = '';
  let tokens = 0;
  let start = 0;
  const streamer = new t.TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => { text += chunk; post({ status: 'token', id, text }); },
    token_callback_function: () => { start ||= performance.now(); tokens++; },
  });
  const { sequences } = await model.generate({
    ...inputs,
    max_new_tokens,
    do_sample: true,
    temperature,
    top_p,
    repetition_penalty,
    streamer,
    stopping_criteria: stopping,
    return_dict_in_generate: true,
  });
  const promptLen = inputs.input_ids.dims.at(-1);
  const decoded = tokenizer.batch_decode(sequences.slice(null, [promptLen, null]), { skip_special_tokens: true })[0];
  const elapsed = start ? (performance.now() - start) / 1000 : 0;
  post({ status: 'done', id, text: decoded ?? text, tokens, tps: elapsed ? tokens / elapsed : 0, interrupted: stopping.interrupted });
}

self.addEventListener('message', async (e) => {
  const { type, ...data } = e.data || {};
  try {
    if (type === 'load') await load(data);
    else if (type === 'generate') await generate(data);
    else if (type === 'interrupt') stopping?.interrupt();
    else if (type === 'dispose') { try { await model?.dispose(); } catch { /* ignore */ } model = null; tokenizer = null; loadedId = null; post({ status: 'disposed' }); }
  } catch (err) {
    post({ status: 'error', id: data.id, message: err?.message || String(err) });
  }
});
