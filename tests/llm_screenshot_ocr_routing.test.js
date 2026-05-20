const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const llmHelperSource = fs.readFileSync(path.join(projectRoot, "electron", "LLMHelper.ts"), "utf8");
const screenshotContextSource = fs.readFileSync(path.join(projectRoot, "electron", "llm", "ScreenshotSessionContext.ts"), "utf8");

assert(
  screenshotContextSource.includes("SCREENSHOT_OCR_FAST_PATH_MIN_CHARS"),
  "ScreenshotSessionContext should define an OCR sufficiency threshold for screenshot fast path routing."
);

assert(
  screenshotContextSource.includes("CODING ANSWER FORMAT"),
  "Screenshot OCR prompts should request the coding-answer format for likely programming challenges."
);

assert(
  screenshotContextSource.includes("MCQ ANSWER FORMAT"),
  "Screenshot OCR prompts should request an MCQ answer format when choices are detected."
);

assert(
  screenshotContextSource.includes("mentally check the sample input/output") &&
    screenshotContextSource.includes("selected items may skip positions") &&
    screenshotContextSource.includes("Do not use a greedy/LIS/two-pointer shortcut"),
  "Coding OCR prompt should include correctness checks that reduce brittle algorithm choices."
);

assert(
  llmHelperSource.includes("SCREENSHOT_VISION_PROXY_TIMEOUT_MS") && llmHelperSource.includes("Screenshot vision analysis"),
  "Vision proxy analysis should have a bounded timeout."
);

const strippedImageReferences = llmHelperSource.match(/finalPayload\.imagePaths = undefined;/g) || [];
assert(
  strippedImageReferences.length >= 3,
  "Text-only screenshot routes should strip image paths after OCR, vision success, and vision failure."
);

assert(
  llmHelperSource.includes("OCR fast path: using extracted text"),
  "Readable OCR should skip vision proxy for text-only models."
);

console.log("llm screenshot OCR routing regression checks passed");
