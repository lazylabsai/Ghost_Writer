# Troubleshooting

## Install issues

### One-Command Setup fails

- Ensure you have Node.js (v20+) and Git installed and available in your system PATH.
- Re-run the one-command setup command from the README.
- Check your network connection. If the `npm install` step fails, there might be a proxy or firewall blocking access to the npm registry.

### Application fails to build

- If `npm run build:desktop` fails, make sure your build tools are installed. On Windows, you might need to run `npm install -g windows-build-tools` or install Visual Studio Build Tools if native modules fail to compile.
- Ensure you have enough disk space available.

## Runtime issues

### Full Privacy Mode is enabled but not usable

Full Privacy Mode requires:

- Local Whisper runtime and model configured.
- Ollama running locally.
- At least one local text model pulled in Ollama (e.g., `ollama run qwen2.5:7b`).
- A local vision-capable model if you want screenshot analysis (e.g., `ollama run llava`).

### No cloud responses

- Add and test the relevant provider API key in Settings.
- Confirm Full Privacy Mode is disabled if you want to use cloud providers.
- Review the active model selection in AI Models settings.

### Where is the app installed?

- The one-command setup scripts clone the repository to:
  - Windows: `~\Desktop\Ghost_Writer`
  - macOS: `~/Desktop/Ghost_Writer`
- You must launch it via terminal using `npm start` from inside that directory.

## Remote Display issues

### Mobile viewer says "Not Connection" or "Server Offline"

- Ensure the **Server Status** in Settings > Remote Display is green. 
- Confirm your phone is on the **same Wi-Fi** as your computer.
- Disable any VPN on your phone or computer, as they often block local network discovery.
- Check that your computer's firewall is not blocking port `4004`.

### PIN authentication fails

- Verify the PIN in your PC Settings > Remote Display.
- Enter exactly 4 digits.
- The default PIN is `0000`.

### Mobile view not loading (Not Found)

- Restart Ghost Writer to ensure the server picks up the latest configuration.
- Check the terminal/console for error logs if running from source.

## Logs and support

- Use the app’s support and troubleshooting surfaces first.
- File issues at [GitHub Issues](https://github.com/lazylabsai/Ghost_Writer/issues).
