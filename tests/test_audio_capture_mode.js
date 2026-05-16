const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText;

  const mod = new Module(filePath, module);
  mod.filename = filePath;
  mod.paths = Module._nodeModulePaths(path.dirname(filePath));
  mod._compile(compiled, filePath);
  return mod.exports;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\nExpected: ${expected}\nActual:   ${actual}`);
  }
}

const {
  normalizeAudioCaptureMode,
  shouldCaptureSystemAudio,
  shouldCaptureMicrophoneAudio,
} = loadTsModule(path.join(__dirname, '..', 'electron', 'audio', 'audioCaptureMode.ts'));

console.log('\n=== Audio Capture Mode Regression ===\n');

assertEqual(normalizeAudioCaptureMode('dual-stream'), 'dual-stream', 'Should keep dual-stream mode');
assertEqual(normalizeAudioCaptureMode('system-only'), 'system-only', 'Should keep system-only mode');
assertEqual(normalizeAudioCaptureMode('mic-only'), 'mic-only', 'Should keep mic-only mode');
assertEqual(normalizeAudioCaptureMode('bad-mode'), 'dual-stream', 'Should default unknown mode');
console.log('  OK mode normalization');

assertEqual(shouldCaptureSystemAudio('dual-stream'), true, 'Dual stream should capture system audio');
assertEqual(shouldCaptureMicrophoneAudio('dual-stream'), true, 'Dual stream should capture mic audio');
assertEqual(shouldCaptureSystemAudio('system-only'), true, 'System-only should capture system audio');
assertEqual(shouldCaptureMicrophoneAudio('system-only'), false, 'System-only should not capture mic audio');
assertEqual(shouldCaptureSystemAudio('mic-only'), false, 'Mic-only should not capture system audio');
assertEqual(shouldCaptureMicrophoneAudio('mic-only'), true, 'Mic-only should capture mic audio');
console.log('  OK routing policy');

console.log('\nAudio capture mode tests passed.\n');
