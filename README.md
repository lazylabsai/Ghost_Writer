# Ghost Writer

<div align="center">
  <img src="assets/docs/hero_banner.png" width="100%" alt="Ghost Writer hero banner">

  <br>

  [![License](https://img.shields.io/badge/license-PROPRIETARY-red?style=for-the-badge)](LICENSE)
  [![Release](https://img.shields.io/badge/release-v1.0.0-0ea5e9?style=for-the-badge)](https://github.com/lazylabsai/Ghost_Writer/releases)
  [![Platform](https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20arm64-111827?style=for-the-badge)](https://github.com/lazylabsai/Ghost_Writer/releases)
  [![Launch Mode](https://img.shields.io/badge/launch-desktop%20beta-10b981?style=for-the-badge)](https://github.com/lazylabsai/Ghost_Writer/releases)

  Ghost Writer is a powerful, stealth-first desktop assistant for high-fidelity meeting and interview support. Built by LaZy Labs, it combines live transcription, screenshot-aware AI answering, local privacy guarantees, and a completely invisible footprint to give you the ultimate edge in any professional scenario.

  [Releases](https://github.com/lazylabsai/Ghost_Writer/releases) · [Architecture](docs/ARCHITECTURE.md) · [Privacy](docs/PRIVACY.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)
</div>

---

## 🌟 Core Features

- **Ghost Mode (Stealth Overlay)**: A completely transparent, click-through overlay that sits seamlessly over your screen. It is heavily protected against screen-sharing capture (utilizing OS-level display affinity protections).
- **Remote Display Companion**: View live AI answers and transcripts directly on your smartphone via a local WebSocket connection, completely bypassing any risk of desktop screen capture.
- **"What to Answer?" Intelligence (Ctrl+J)**: Instantly generate the perfect response to the last question asked. Ghost Writer intelligently parses the conversation context and your provided resume/job description to formulate natural, authentic answers.
- **Smart Fallback**: Even if a direct question hasn't been asked, pressing "What to Answer?" provides you with an insightful, momentum-building thought based on the last 3 minutes of conversation.
- **Vision-Aware Responses**: Attach screenshots directly to the context stream for architecture diagrams or coding tests. Ghost Writer uses OCR or native multimodal AI to understand the visual context perfectly.
- **Live Coding Copilot**: Offers seamless integration with online coding environments. Ghost Writer instantly parses your active editor's boilerplate, ensuring its generated solutions perfectly match the required structure and automatically providing both brute-force and optimized approaches.
- **Disguise Mode**: Shrink the application UI into an innocent-looking terminal window, a fake system settings popup, or completely hide it with a single keystroke (Ctrl+B).
- **Air-Gapped Privacy**: Run everything completely offline using Local Whisper for transcription and local Ollama models for generation. Your data never leaves your machine unless you explicitly configure a cloud provider.

## 🛠️ Supported Platforms

- **Windows x64** (Optimal compatibility for Ghost Mode screen-share evasion)
- **macOS Apple Silicon** (arm64)
- **Mobile Viewer**: Any modern smartphone browser on the same Wi-Fi network.

---

## 🚀 One-Command Setup (Recommended)

To get started immediately, we provide a single terminal command that automatically clones the repository, installs all dependencies, and builds the application from source. This ensures a clean setup and bypasses OS "unrecognized developer" warnings on fresh machines.

### 🪟 Windows (PowerShell)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/lazylabsai/Ghost_Writer/main/install.ps1 | iex"
```

### 🍎 macOS (Terminal)
```bash
curl -fsSL https://raw.githubusercontent.com/lazylabsai/Ghost_Writer/main/install.sh | bash
```

After the installation completes, simply navigate to your Desktop and launch the app:
```bash
cd ~/Desktop/Ghost_Writer
npm start
```

---

## 🔒 Data And Privacy

We believe your professional data is yours alone. 

- **End-to-End Local Guarantee**: If you enable Full Privacy Mode, Ghost Writer strictly utilizes local system resources (Local Whisper STT and Ollama LLM). No cloud telemetry, no network calls.
- **Secure Credentials**: If you opt into using advanced cloud providers (e.g., OpenAI, Anthropic, Gemini, Groq), your API keys are aggressively encrypted and stored locally using Electron's native `safeStorage`.
- **Zero Telemetry**: We have completely disabled all product telemetry and tracking for the v1.0.0 public launch.

More detail: [Privacy](docs/PRIVACY.md)

## ⌨️ Global Shortcuts

- **Ctrl+J**: Instantly trigger the "What to answer?" feature.
- **Ctrl+B**: Rapidly hide or show the Ghost Overlay.
- **Ctrl+Shift+H**: Activate Disguise Mode (morph the app into a terminal or settings window).

## 🧑‍💻 Manual Development

If you prefer to manually install or contribute to the project:

```bash
# 1. Clone the repository
git clone https://github.com/lazylabsai/Ghost_Writer.git
cd Ghost_Writer

# 2. Install dependencies
npm install

# 3. Build the application
npm run build:desktop

# 4. Start the application
npm start
```

Run test suite:
```bash
npm test
```

## 🤝 Support

- Issues: [GitHub Issues](https://github.com/lazylabsai/Ghost_Writer/issues)
- Troubleshooting Guide: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## 📄 License

This software is proprietary to LaZy Labs. Redistribution and unauthorized commercial reuse are not permitted. See [LICENSE](LICENSE).
