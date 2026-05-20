const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(projectRoot, "electron", "ipcHandlers.ts"), "utf8");

assert(
  source.includes("mergeRecentTranscriptContext"),
  "Streaming chat IPC should have a dedicated recent-transcript context merger."
);

assert(
  source.includes("[RECENT LIVE TRANSCRIPT]") && source.includes("[END RECENT LIVE TRANSCRIPT]"),
  "Recent transcript context should be injected as a bounded, explicit section."
);

assert(
  source.includes("mergedContext !== context") &&
    source.includes("Merged recent live transcript into gemini-chat-stream context"),
  "Streaming chat should merge recent transcript even when UI chat context already exists."
);

assert(
  !source.includes('if (!context) {\n        try {\n          const autoContext = intelligenceManager.getFormattedContext(100);'),
  "Streaming chat should not skip live transcript injection just because context is already present."
);

console.log("ipc recent transcript context regression checks passed");
