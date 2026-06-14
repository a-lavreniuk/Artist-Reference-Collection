/**
 * Smoke-test AI model stacks.
 * Usage: node scripts/verify-ai-models.mjs [--user-data <path>]
 */

import { existsSync } from 'fs';
import { mkdir, readdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const LLAMA_CPP_RELEASE = 'b8390';

const LLAMA_RUNTIME_ASSETS = [
  'llama-b8390-bin-win-cpu-x64.zip',
  'llama-b8390-bin-win-cuda-12.4-x64.zip',
  'llama-b8390-bin-macos-arm64.tar.gz',
  'llama-b8390-bin-macos-x64.tar.gz'
];

function githubReleaseAssetUrl(archiveName) {
  return `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_RELEASE}/${archiveName}`;
}

async function verifyRuntimeAssetUrls() {
  const result = { name: 'llama-runtime-assets', ok: true, checks: [] };
  for (const asset of LLAMA_RUNTIME_ASSETS) {
    const url = githubReleaseAssetUrl(asset);
    try {
      const res = await fetch(url, { method: 'HEAD' });
      result.checks.push({ name: asset, ok: res.ok, status: res.status, url });
      if (!res.ok) result.ok = false;
    } catch (err) {
      result.checks.push({
        name: asset,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        url
      });
      result.ok = false;
    }
  }
  return result;
}

const MODEL_CATALOG = {
  light: {
    id: 'clip-vit-base-patch32',
    hfId: 'Xenova/clip-vit-base-patch32',
    stack: 'transformers'
  },
  medium: {
    id: 'qwen3-vl-embedding-2b',
    hfId: 'DevQuasar/Qwen.Qwen3-VL-Embedding-2B-GGUF',
    stack: 'llama-embed',
    files: [
      'Qwen.Qwen3-VL-Embedding-2B.Q4_K_M.gguf',
      'mmproj-Qwen.Qwen3-VL-Embedding-2B.f16.gguf'
    ]
  },
  heavy: {
    id: 'joycaption-beta-one',
    hfId: 'mradermacher/llama-joycaption-beta-one-hf-llava-GGUF',
    stack: 'llama-caption',
    files: [
      'llama-joycaption-beta-one-hf-llava.Q4_K_M.gguf',
      'llama-joycaption-beta-one-llava-mmproj-model-f16.gguf'
    ]
  }
};

function parseArgs(argv) {
  const userDataIdx = argv.indexOf('--user-data');
  const userData =
    userDataIdx >= 0 && argv[userDataIdx + 1]
      ? path.resolve(argv[userDataIdx + 1])
      : path.join(process.env.APPDATA || '', 'artist-reference-collection');
  return { userData };
}

function tensorToVector(tensor) {
  const data = Array.isArray(tensor.data) ? tensor.data[0] : tensor.data;
  return Array.from(data);
}

async function dirHasOnnxFiles(dir) {
  if (!existsSync(dir)) return false;
  const entries = await readdir(dir, { recursive: true });
  return entries.some((name) => String(name).endsWith('.onnx') || String(name).endsWith('.bin'));
}

async function isTransformersInstalled(userData, entry) {
  const dir = path.join(userData, 'models', 'transformers', ...entry.hfId.split('/'));
  return dirHasOnnxFiles(dir);
}

async function isLlamaStackInstalled(userData, entry) {
  const dir = path.join(userData, 'models', 'llama');
  for (const name of entry.files ?? []) {
    const filePath = path.join(dir, name);
    if (!existsSync(filePath)) return false;
    const s = await stat(filePath);
    if (s.size <= 1024 * 1024) return false;
  }
  return (entry.files ?? []).length > 0;
}

async function loadClipEmbedders(hfId, modelsDir) {
  const t = await import('@xenova/transformers');
  const { env, pipeline, AutoTokenizer, CLIPTextModelWithProjection } = t;
  env.cacheDir = path.join(modelsDir, 'transformers');
  env.allowLocalModels = true;
  env.useBrowserCache = false;

  const imagePipe = await pipeline('image-feature-extraction', hfId, { quantized: true });
  const tokenizer = await AutoTokenizer.from_pretrained(hfId);
  const textModel = await CLIPTextModelWithProjection.from_pretrained(hfId, { quantized: true });

  return {
    embedImage: async (imagePath) => {
      const out = await imagePipe(imagePath, { pooling: 'mean', normalize: true });
      return tensorToVector(out);
    },
    embedText: async (text) => {
      const inputs = await tokenizer([`a photo of ${text}`], { padding: true, truncation: true });
      const out = await textModel(inputs);
      return tensorToVector(out.text_embeds);
    }
  };
}

async function makeTestImage(dir) {
  await mkdir(dir, { recursive: true });
  const imgPath = path.join(dir, 'verify-pixel.png');
  if (!existsSync(imgPath)) {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    await import('fs/promises').then((fs) => fs.writeFile(imgPath, png));
  }
  return imgPath;
}

async function verifyLight(modelsDir, testImagePath) {
  const entry = MODEL_CATALOG.light;
  const result = { tier: 'light', label: entry.hfId, ok: false, checks: [] };
  try {
    const embedders = await loadClipEmbedders(entry.hfId, modelsDir);
    const textVec = await embedders.embedText('flowers');
    const imageVec = await embedders.embedImage(testImagePath);
    result.checks.push({ name: 'text-embed', ok: textVec.length > 0, dim: textVec.length });
    result.checks.push({ name: 'image-embed', ok: imageVec.length > 0, dim: imageVec.length });
    result.ok = result.checks.every((c) => c.ok);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

async function verifyLlamaStack(tier, entry, userData) {
  const result = { tier, label: entry.hfId, ok: false, checks: [] };
  const llamaDir = path.join(userData, 'models', 'llama');
  for (const name of entry.files ?? []) {
    const p = path.join(llamaDir, name);
    result.checks.push({ name: `file:${name}`, ok: existsSync(p), path: p });
  }
  try {
    const { getLlama } = await import('node-llama-cpp');
    await getLlama('lastBuild');
    result.checks.push({ name: 'node-llama-cpp', ok: true });
  } catch (err) {
    result.checks.push({
      name: 'node-llama-cpp',
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
  result.ok = result.checks.filter((c) => c.name === 'node-llama-cpp').every((c) => c.ok);
  return result;
}

async function main() {
  const { userData } = parseArgs(process.argv.slice(2));
  const modelsDir = path.join(userData, 'models');
  const cacheDir = path.join(repoRoot, '.cache', 'ai-verify');
  const testImagePath = await makeTestImage(cacheDir);

  console.log('ARC AI model verification');
  console.log('userData:', userData);
  console.log('modelsDir:', modelsDir);
  console.log('');

  const installStatus = {
    light: await isTransformersInstalled(userData, MODEL_CATALOG.light),
    medium: await isLlamaStackInstalled(userData, MODEL_CATALOG.medium),
    heavy: await isLlamaStackInstalled(userData, MODEL_CATALOG.heavy)
  };
  console.log('Installed (detector):', installStatus);
  console.log('');

  const runtimeAssets = await verifyRuntimeAssetUrls();
  console.log('--- llama-runtime catalog ---');
  for (const c of runtimeAssets.checks) {
    console.log(c.ok ? '  OK' : '  FAIL', c.name, c.status ?? c.error ?? '');
  }
  console.log(runtimeAssets.ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  console.log('');

  const results = [];
  results.push(await verifyLight(modelsDir, testImagePath));
  results.push(await verifyLlamaStack('medium', MODEL_CATALOG.medium, userData));
  results.push(await verifyLlamaStack('heavy', MODEL_CATALOG.heavy, userData));

  for (const r of results) {
    console.log(`--- ${r.tier} (${r.label}) ---`);
    if (r.error) console.log('ERROR:', r.error);
    for (const c of r.checks) console.log(c.ok ? '  OK' : '  FAIL', c.name, JSON.stringify(c));
    console.log(r.ok ? 'RESULT: PASS' : 'RESULT: FAIL');
    console.log('');
  }

  const allPass = runtimeAssets.ok && results.every((r) => r.ok);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
