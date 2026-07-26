/**
 * Caps for llama-server context / parallelism.
 * Model train ctx (131k–262k) must never be used — KV cache would need tens of GB.
 */
export const LLAMA_CTX_SIZE_EMBED = 8192;
export const LLAMA_CTX_SIZE_CHAT = 16384;
export const LLAMA_PARALLEL_SLOTS = 1;

/** Qwen-VL grounding / VL-Embedding: llama.cpp recommends ≥1024 image tokens. */
export const LLAMA_IMAGE_MIN_TOKENS = 1024;
