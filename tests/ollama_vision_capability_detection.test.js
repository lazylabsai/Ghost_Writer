const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(projectRoot, "electron", "llm", "providers", "OllamaProvider.ts"), "utf8");

assert(
  source.includes("/api/show") && source.includes("capabilities.includes(\"vision\")"),
  "OllamaProvider should use Ollama capability metadata to detect vision models."
);

assert(
  source.includes("qwen3.6") && source.includes("gemma4") && source.includes("nemotron"),
  "Vision fallback hints should include current multimodal Ollama model families."
);

assert(
  !source.match(/qwen3-coder['"]/),
  "qwen3-coder should not be hard-coded as a vision model."
);

assert(
  source.includes("Prefer local Ollama vision models") || source.includes("a.isCloud && !b.isCloud"),
  "Ollama vision model selection should avoid defaulting to cloud vision when local vision models are available."
);

console.log("ollama vision capability detection regression checks passed");
