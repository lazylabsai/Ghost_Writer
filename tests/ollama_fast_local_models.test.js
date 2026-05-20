const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(projectRoot, "electron", "llm", "providers", "OllamaProvider.ts"), "utf8");

assert(
  source.includes("OLLAMA_FAST_RESPONSE_TEMPERATURE") && source.includes("temperature: OLLAMA_FAST_RESPONSE_TEMPERATURE"),
  "OllamaProvider should use a low default temperature for faster, more deterministic local responses."
);

assert(
  source.includes("shouldDisableThinkingForFastResponse") &&
    source.includes("qwen3.5") &&
    source.includes("gemma4") &&
    source.includes("body.think = false"),
  "OllamaProvider should disable visible thinking mode for local thinking models that otherwise return slow or empty content."
);

const applyCount = (source.match(/applyFastResponseDefaults/g) || []).length;
assert(
  applyCount >= 5,
  "Fast-response defaults should be applied to chat, vision, streaming, and fallback Ollama request bodies."
);

console.log("ollama fast local model regression checks passed");
