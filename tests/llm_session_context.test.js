const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const llmHelperSource = fs.readFileSync(path.join(projectRoot, "electron", "LLMHelper.ts"), "utf8");
const screenshotContextSource = fs.readFileSync(path.join(projectRoot, "electron", "llm", "ScreenshotSessionContext.ts"), "utf8");
const ipcSource = fs.readFileSync(path.join(projectRoot, "electron", "ipcHandlers.ts"), "utf8");
const interfaceSource = fs.readFileSync(path.join(projectRoot, "src", "components", "GhostWriterInterface.tsx"), "utf8");
const mainSource = fs.readFileSync(path.join(projectRoot, "electron", "main.ts"), "utf8");

assert(
  llmHelperSource.includes("ScreenshotSessionContext") &&
    screenshotContextSource.includes("CachedScreenshotContext") &&
    screenshotContextSource.includes("latestOcrText") &&
    screenshotContextSource.includes("latestCode"),
  "ScreenshotSessionContext should keep latest OCR and generated code in a session cache owned by LLMHelper."
);

assert(
  llmHelperSource.includes("screenshotSessionContext.rememberScreenshotOCR") &&
    llmHelperSource.includes("screenshotSessionContext.rememberAssistantResponse") &&
    screenshotContextSource.includes("rememberScreenshotOCR") &&
    screenshotContextSource.includes("rememberAssistantResponse"),
  "LLMHelper should update session cache from OCR extraction and assistant responses."
);

assert(
  screenshotContextSource.includes("isLowValueAssistantResponse") && screenshotContextSource.includes("Response timed out"),
  "ScreenshotSessionContext should avoid overwriting useful session memory with timeout/error fallback responses."
);

assert(
  screenshotContextSource.includes("validate\\s+(the\\s+)?(previous|last|above|prior)\\s+(code|solution|answer)") &&
    screenshotContextSource.includes("[SESSION MEMORY]") &&
    screenshotContextSource.includes("[LATEST GENERATED CODE]"),
  "Previous-code validation requests should receive cached OCR and generated code."
);

assert(
  ipcSource.includes("clear-llm-session-context") &&
    interfaceSource.includes("clear-llm-session-context") &&
    mainSource.includes("clearSessionContext()"),
  "Session context should be cleared when the UI chat or app session resets."
);

console.log("llm session context regression checks passed");
