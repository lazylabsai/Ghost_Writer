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
  const originalRequire = mod.require.bind(mod);
  mod.require = (request) => {
    if (request === '../utils/GPUHelper') {
      return {
        GPUHelper: {
          detectGPU: async () => ({ name: 'test', vramGB: 0, isNvidia: false, tier: 'low' }),
        },
      };
    }
    return originalRequire(request);
  };
  mod._compile(compiled, filePath);
  return mod.exports;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\nExpected: ${expected}\nActual:   ${actual}`);
  }
}

const { cleanLocalWhisperServerResponse } = loadTsModule(
  path.join(__dirname, '..', 'electron', 'audio', 'LocalWhisperSTT.ts')
);

console.log('\n=== Local Whisper Response Filter Regression ===\n');

assertEqual(
  cleanLocalWhisperServerResponse({
    duration: 2.72,
    text: '(speaker ?) And I personally find it\n',
    segments: [
      {
        text: ' And I personally find it',
        start: 0,
        end: 2.7,
        avg_logprob: -0.08,
        no_speech_prob: 0.0001,
        words: [
          { word: 'And', probability: 0.41 },
          { word: 'I', probability: 0.94 },
          { word: 'personally', probability: 0.98 },
          { word: 'find', probability: 0.95 },
          { word: 'it', probability: 0.95 },
        ],
      },
    ],
  }),
  'And I personally find it',
  'Should keep normal local Whisper server segments'
);
console.log('  OK normal segment preserved');

assertEqual(
  cleanLocalWhisperServerResponse({
    duration: 1.5,
    text: '(speaker ?) S_P_ three W_T_ is well.\n',
    segments: [
      {
        text: ' S_P_ three W_T_ is well.',
        start: 0,
        end: 1.48,
        avg_logprob: -0.35,
        no_speech_prob: 0.0001,
        words: [
          { word: 'S', probability: 0.53 },
          { word: '_', probability: 0.99 },
          { word: 'P', probability: 0.27 },
          { word: 'three', probability: 0.7 },
          { word: 'W', probability: 0.4 },
          { word: '_', probability: 0.99 },
        ],
      },
    ],
  }),
  '',
  'Should drop underscore-token hallucination artifacts'
);
console.log('  OK underscore artifact dropped');

assertEqual(
  cleanLocalWhisperServerResponse({
    duration: 1.5,
    text: '(speaker ?) better E_W_D_ okay,\n',
    segments: [
      {
        text: ' better E_W_D_ okay,',
        start: 0,
        end: 30,
        avg_logprob: -0.47,
        no_speech_prob: 0.0004,
        words: [
          { word: 'better', probability: 0.37 },
          { word: 'E', probability: 0.39 },
          { word: '_', probability: 0.99 },
        ],
      },
    ],
  }),
  '',
  'Should drop impossible timestamp hallucinations'
);
console.log('  OK impossible timestamp segment dropped');

assertEqual(
  cleanLocalWhisperServerResponse({
    duration: 1.5,
    text: '(speaker ?) what.\n',
    segments: [
      {
        text: ' what.',
        start: 0,
        end: 1.1,
        avg_logprob: -0.02,
        no_speech_prob: 0.00003,
        words: [
          { word: 'what', probability: 0.99 },
        ],
      },
    ],
  }),
  'what.',
  'Should keep confident short speech'
);
console.log('  OK confident short speech preserved');

assertEqual(
  cleanLocalWhisperServerResponse({
    duration: 1.5,
    text: '(speaker ?) as your.\n',
    segments: [
      {
        text: ' as your.',
        start: 0,
        end: 0.84,
        avg_logprob: -0.48,
        no_speech_prob: 0.0004,
        words: [
          { word: 'as', probability: 0.99 },
          { word: 'your', probability: 1.0 },
          { word: '.', probability: 0.09 },
        ],
      },
    ],
  }),
  'as your.',
  'Should ignore punctuation probability when scoring short speech'
);
console.log('  OK punctuation probability ignored');

console.log('\nLocal Whisper response filter regression checks passed\n');
