/**
 * Caps for llama-server context / parallelism.
 * Model train ctx (131k–262k) must never be used — KV cache would need tens of GB.
 */
export const LLAMA_CTX_SIZE_EMBED = 4096;
export const LLAMA_CTX_SIZE_CHAT = 8192;
export const LLAMA_PARALLEL_SLOTS = 1;

/** Qwen-VL: keep image tokens bounded so vision encode stays on GPU. */
export const LLAMA_IMAGE_MIN_TOKENS = 256;
export const LLAMA_IMAGE_MAX_TOKENS = 1024;

/** MiB free target for --fit so mmproj compute buffer fits on GPU (not CPU). */
export const LLAMA_FIT_TARGET_MIB = 2048;
