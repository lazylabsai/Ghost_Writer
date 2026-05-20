/**
 * OllamaProvider - Handles all local Ollama model interactions
 * Extracted from LLMHelper.ts for modularity
 */

import { nativeImage } from "electron";
import fs from "fs";
import { exec } from 'child_process';
import { promisify } from 'util';
import { GPUHelper, GPUInfo } from '../../utils/GPUHelper';
import { UNIVERSAL_SYSTEM_PROMPT } from "../prompts";
import { DEFAULT_MAX_OUTPUT_TOKENS, ILLMProvider, ChatPayload, estimateTokens } from "./ILLMProvider";

const execAsync = promisify(exec);
const OLLAMA_CAPABILITY_TIMEOUT_MS = 3000;
const OLLAMA_FAST_RESPONSE_TEMPERATURE = 0.2;
const OLLAMA_VISION_MODEL_HINTS = [
    'llava',
    'minicpm-v',
    'minicpm',
    'moondream',
    'qwen2-vl',
    'qwen3-vl',
    'vl',
    'vision',
    'pixtral',
    'llama-3.2-vision',
    'llama-3-vision',
    'internvl',
    'mistral-medium',
    'qwen3.6',
    'qwen3.5',
    'gemma4',
    'medgemma',
    'nemotron',
    'kimi-k2',
    'glm-ocr',
    'translategemma',
    'gemini',
    'gpt-4o',
    'claude'
];
const OLLAMA_DEDICATED_VISION_MODEL_HINTS = [
    'llava',
    'minicpm-v',
    'minicpm',
    'moondream',
    'qwen2-vl',
    'qwen3-vl',
    'vl',
    'vision',
    'pixtral',
    'llama-3.2-vision',
    'llama-3-vision',
    'internvl',
    'glm-ocr'
];
const OLLAMA_THINKING_MODEL_HINTS = [
    'qwen3.5',
    'qwen3.6',
    'gemma4'
];

export type OllamaVisionModel = {
    name: string;
    isCloud: boolean;
    capabilities: string[];
    size?: number;
};

export function isLikelyVisionModelName(modelName: string): boolean {
    const lower = modelName.toLowerCase();
    return OLLAMA_VISION_MODEL_HINTS.some(hint => lower.includes(hint));
}

function isLikelyDedicatedVisionModelName(modelName: string): boolean {
    const lower = modelName.toLowerCase();
    return OLLAMA_DEDICATED_VISION_MODEL_HINTS.some(hint => lower.includes(hint));
}

export function shouldDisableThinkingForFastResponse(modelName: string): boolean {
    const lower = modelName.toLowerCase();
    return OLLAMA_THINKING_MODEL_HINTS.some(hint => lower.includes(hint));
}

export class OllamaProvider implements ILLMProvider {
    readonly name = "Ollama";
    readonly isVisionCapable = true;
    private gpuInfo: GPUInfo | null = null;
    private initPromise: Promise<void> | null = null;
    private isInitializing: boolean = false;
    private capabilityCache = new Map<string, Promise<OllamaVisionModel | null>>();

    constructor(
        private ollamaUrl: string = "http://localhost:11434",
        private ollamaModel: string = ""
    ) { }

    // =========================================================================
    // Getters / Setters
    // =========================================================================

    public getModel(): string { return this.ollamaModel; }
    public setModel(model: string): void { this.ollamaModel = model; }
    public getUrl(): string { return this.ollamaUrl; }
    public setUrl(url: string): void { this.ollamaUrl = url; }

    // =========================================================================
    // Initialization
    // =========================================================================

    public async initializeGPUAndOllama(): Promise<void> {
        this.gpuInfo = await GPUHelper.detectGPU();
        console.log(`[OllamaProvider] Hardware Detected: ${this.gpuInfo.name} (${this.gpuInfo.vramGB}GB VRAM) - Tier: ${this.gpuInfo.tier}`);
        await this.initializeModel();
    }

    public async initializeModel(): Promise<void> {
        if (this.isInitializing && this.initPromise) return this.initPromise;
        this.isInitializing = true;

        this.initPromise = (async () => {
            try {
                if (!this.gpuInfo) {
                    this.gpuInfo = await GPUHelper.detectGPU();
                    console.log(`[OllamaProvider] Hardware Detected: ${this.gpuInfo.name} (${this.gpuInfo.vramGB}GB VRAM) - Tier: ${this.gpuInfo.tier}`);
                }

                // Fetch detailed model info from Ollama
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                let detailedModels: any[] = [];
                try {
                    const response = await fetch(`${this.ollamaUrl}/api/tags`, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        const data = await response.json();
                        detailedModels = data.models || [];
                    }
                } catch (e) {
                    clearTimeout(timeoutId);
                }

                if (detailedModels.length === 0) {
                    return; // Ollama is unresponsive/empty
                }

                // If user has explicitly selected a model, DO NOT override with hardware detection
                if (this.ollamaModel && this.ollamaModel !== "") {
                    const isSelectedModelInstalled = detailedModels.some(m => m.name === this.ollamaModel);
                    if (isSelectedModelInstalled) {
                        console.log(`[OllamaProvider] Using user-selected Ollama model: ${this.ollamaModel}`);
                        return;
                    } else {
                        console.warn(`[OllamaProvider] User-selected model ${this.ollamaModel} is not installed. Falling back to dynamic allocation.`);
                        this.ollamaModel = "";
                    }
                }

                // Filter out pure embedding/vision models for the main chat responder role
                let chatModels = detailedModels.filter(m => {
                    const lower = m.name.toLowerCase();
                    return !lower.includes('embed') && !lower.includes('nomic');
                });

                if (chatModels.length === 0) {
                    if (detailedModels.length > 0) this.ollamaModel = detailedModels[0].name;
                    return;
                } else {
                    // Dynamic Hardware-Aware Selection
                    const vramBytes = (this.gpuInfo?.vramGB || 4) * 1024 * 1024 * 1024;
                    const maxModelSizeBytes = Math.max(1 * 1024 * 1024 * 1024, vramBytes - (2.5 * 1024 * 1024 * 1024));

                    chatModels.sort((a, b) => b.size - a.size);

                    let selectedModel = chatModels.find(m => m.size <= maxModelSizeBytes);
                    if (!selectedModel) {
                        selectedModel = chatModels[chatModels.length - 1];
                    }

                    this.ollamaModel = selectedModel.name;
                    const sizeGB = (selectedModel.size / 1024 / 1024 / 1024).toFixed(1);
                    console.log(`[OllamaProvider] Smart selection: Auto-assigned ${this.ollamaModel} (${sizeGB} GB) safely inside ${this.gpuInfo?.vramGB}GB VRAM threshold.`);
                }

                // Final fallback
                if (!this.ollamaModel) {
                    const backups = await this.getModels();
                    if (backups.length > 0) {
                        this.ollamaModel = backups[0];
                    } else {
                        return;
                    }
                }

                // Test the selected model works
                try {
                    await this.call("Hello");
                } catch (e) {
                    console.warn(`[OllamaProvider] Initial ping to ${this.ollamaModel} failed.`);
                }
            } catch (error: any) {
                try {
                    const models = await this.getModels();
                    if (models.length > 0) {
                        this.ollamaModel = models[0];
                    }
                } catch (fallbackError: any) { }
            } finally {
                this.isInitializing = false;
            }
        })();
        return this.initPromise;
    }

    public isAvailable(): boolean {
        // We can't do a sync network check here easily, but we know it's "available"
        // as a concept if the URL is set. The actual calls handle the errors.
        return !!this.ollamaUrl;
    }

    public supportsMultimodal(): boolean {
        return true;
    }

    private isCloudModel(model: any): boolean {
        const name = typeof model === "string"
            ? model.toLowerCase()
            : String(model?.name || model?.model || "").toLowerCase();
        if (typeof model === "string") {
            return name.includes(":cloud") || name.includes("-cloud");
        }
        return name.includes(":cloud") || name.includes("-cloud") || !!model?.remote_host || model?.size === 0;
    }

    private normalizeCapabilities(value: unknown): string[] {
        if (!Array.isArray(value)) {
            return [];
        }
        return value
            .filter((item): item is string => typeof item === "string")
            .map(item => item.toLowerCase());
    }

    private async getModelMetadata(modelName: string, tagInfo?: any): Promise<OllamaVisionModel | null> {
        const normalizedName = modelName.trim();
        if (!normalizedName) {
            return null;
        }

        if (!this.capabilityCache.has(normalizedName)) {
            this.capabilityCache.set(normalizedName, (async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), OLLAMA_CAPABILITY_TIMEOUT_MS);
                try {
                    const response = await fetch(`${this.ollamaUrl}/api/show`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: normalizedName, verbose: false }),
                        signal: controller.signal
                    });

                    if (!response.ok) {
                        return null;
                    }

                    const data = await response.json();
                    const capabilities = this.normalizeCapabilities(data.capabilities);
                    return {
                        name: normalizedName,
                        isCloud: this.isCloudModel(tagInfo ?? normalizedName),
                        capabilities,
                        size: typeof tagInfo?.size === "number" ? tagInfo.size : undefined
                    };
                } catch {
                    return null;
                } finally {
                    clearTimeout(timeoutId);
                }
            })());
        }

        return this.capabilityCache.get(normalizedName)!;
    }

    public async modelSupportsVision(modelName: string): Promise<boolean> {
        const metadata = await this.getModelMetadata(modelName);
        if (metadata && metadata.capabilities.length > 0) {
            return metadata.capabilities.includes("vision");
        }
        return isLikelyVisionModelName(modelName);
    }

    private sortVisionModels(models: OllamaVisionModel[], preferCloud: boolean): OllamaVisionModel[] {
        const speedPriority = ['moondream', 'llava', 'qwen:4b', 'qwen:7b', 'qwen2:7b', 'qwen3.5:4b', 'qwen3.5:9b', 'qwen3.6', 'gemma4:e4b', 'gemma4'];
        const getScore = (name: string) => {
            const lower = name.toLowerCase();
            const index = speedPriority.findIndex(p => lower.includes(p));
            return index === -1 ? 100 : index;
        };

        return [...models].sort((a, b) => {
            if (preferCloud) {
                if (a.isCloud && !b.isCloud) return -1;
                if (!a.isCloud && b.isCloud) return 1;
            } else {
                if (a.isCloud && !b.isCloud) return 1;
                if (!a.isCloud && b.isCloud) return -1;
            }

            const scoreDiff = getScore(a.name) - getScore(b.name);
            if (scoreDiff !== 0) return scoreDiff;

            const aSize = a.size ?? Number.MAX_SAFE_INTEGER;
            const bSize = b.size ?? Number.MAX_SAFE_INTEGER;
            return aSize - bSize;
        });
    }

    private async findBestVisionModel(preferCloud: boolean): Promise<OllamaVisionModel | null> {
        const visionModels = await this.getAvailableVisionModels();
        const sorted = this.sortVisionModels(visionModels, preferCloud);
        return sorted[0] ?? null;
    }

    private applyFastResponseDefaults(body: any, modelId: string): void {
        if (shouldDisableThinkingForFastResponse(modelId)) {
            body.think = false;
        }
    }

    /**
     * Finds all installed models that are likely vision-capable, returning metadata about cloud status.
     */
    public async getAvailableVisionModels(): Promise<OllamaVisionModel[]> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.ollamaUrl}/api/tags`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) return [];

            const data = await response.json();
            const rawModels = data.models || [];

            const modelMetadata = await Promise.all(rawModels.map(async (m: any) => {
                const modelName = m.name || m.model;
                if (!modelName) {
                    return null;
                }

                const metadata = await this.getModelMetadata(modelName, m);
                if (metadata && metadata.capabilities.length > 0) {
                    return metadata.capabilities.includes("vision") ? metadata : null;
                }

                if (!isLikelyVisionModelName(modelName)) {
                    return null;
                }

                return {
                    name: modelName,
                    isCloud: this.isCloudModel(m),
                    capabilities: [] as string[],
                    size: typeof m.size === "number" ? m.size : undefined
                };
            }));

            return modelMetadata.filter((m): m is OllamaVisionModel => !!m);
        } catch (error) {
            console.warn("[OllamaProvider] Error detecting vision models:", error);
            return [];
        }
    }

    public async testConnection(): Promise<{ success: boolean; error?: string }> {
        const available = await this.checkAvailable();
        return available ? { success: true } : { success: false, error: "Ollama not reachable" };
    }

    /**
     * Interface implementation for generation
     */
    public async generate(payload: ChatPayload): Promise<string> {
        const systemPrompt = payload.systemPrompt || (payload.options?.skipSystemPrompt ? "" : UNIVERSAL_SYSTEM_PROMPT);
        const fullPrompt = payload.context
            ? `SYSTEM: ${systemPrompt}\nCONTEXT: ${payload.context}\nUSER: ${payload.message}`
            : `SYSTEM: ${systemPrompt}\nUSER: ${payload.message}`;

        return this.callWithModel(this.ollamaModel, fullPrompt, payload.imagePath, payload.imagePaths);
    }

    // =========================================================================
    // Non-Streaming Generation
    // =========================================================================

    /**
     * Call Ollama with a specific model override
     */
    public async callWithModel(modelId: string, prompt: string, imagePath?: string, imagePaths?: string[]): Promise<string> {
        const allPaths = new Set<string>();
        if (imagePath) allPaths.add(imagePath);
        if (imagePaths) {
            for (const p of imagePaths) {
                if (p) allPaths.add(p);
            }
        }

        const promptTokens = estimateTokens(prompt);
        const contextWindow = Math.max(4096, Math.min(8192, promptTokens + (allPaths.size > 0 ? 2048 : 1024)));

        const body: any = {
            model: modelId,
            stream: false,
            options: {
                temperature: OLLAMA_FAST_RESPONSE_TEMPERATURE,
                num_ctx: contextWindow,
            }
        };
        this.applyFastResponseDefaults(body, modelId);

        if (allPaths.size > 0) {
            let isVision = await this.modelSupportsVision(modelId);

            if (!isVision) {
                const visionModel = await this.findBestVisionModel(modelId.toLowerCase().includes('cloud'));
                if (visionModel) {
                    console.log(`[OllamaProvider] Auto-switching to vision model: ${visionModel.name}`);
                    modelId = visionModel.name;
                    isVision = true;
                } else {
                    const error = "Screenshot analysis requires a vision-capable local Ollama model. Install one with `ollama pull llava:7b` or `ollama pull qwen2.5-vl:7b`.";
                    console.warn(`[OllamaProvider] ${error}`);
                    throw new Error(error);
                }
            }

            if (isVision || modelId !== body.model) {
                try {
                    const base64Images: string[] = [];
                    for (const p of allPaths) {
                        const img = nativeImage.createFromPath(p);
                        const resized = img.resize({ width: Math.min(1024, img.getSize().width) });
                        base64Images.push(resized.toJPEG(75).toString('base64'));
                    }

                    body.model = modelId;
                    this.applyFastResponseDefaults(body, modelId);
                    body.messages = [
                        { role: 'system', content: 'You are an AI analyzing a user\'s screen. Provide a concise, helpful response.' },
                        { role: 'user', content: prompt, images: base64Images }
                    ];

                    const resp = await fetch(`${this.ollamaUrl}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });

                    if (resp.ok) {
                        const data = await resp.json();
                        return data.message?.content || data.response || "";
                    } else {
                        console.warn(`[OllamaProvider] /api/chat vision call returned status ${resp.status}. Trying fallback...`);
                    }
                } catch (e) {
                    console.error("[OllamaProvider] Vision call failed:", e);
                }
            }
        }

        // Standardize plain text/fallback calls to attempt /api/chat first for maximum compatibility
        try {
            const chatBody: any = {
                model: modelId,
                stream: false,
                messages: [
                    { role: 'user', content: prompt }
                ],
                options: body.options
            };
            this.applyFastResponseDefaults(chatBody, modelId);

            const resp = await fetch(`${this.ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatBody)
            });

            if (resp.ok) {
                const data = await resp.json();
                return data.message?.content || data.response || "";
            } else {
                console.warn(`[OllamaProvider] /api/chat returned status ${resp.status}. Trying legacy /api/generate fallback...`);
            }
        } catch (e) {
            console.warn("[OllamaProvider] /api/chat call failed, trying /api/generate fallback:", e);
        }

        // Legacy /api/generate fallback
        body.prompt = prompt;
        const resp = await fetch(`${this.ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await resp.json();
        return data.response || "";
    }

    /**
     * Call Ollama with the currently selected model
     */
    public async call(prompt: string, imagePath?: string, imagePaths?: string[]): Promise<string> {
        return this.callWithModel(this.ollamaModel, prompt, imagePath, imagePaths);
    }

    // =========================================================================
    // Streaming Generation
    // =========================================================================

    /**
     * Interface implementation for streaming
     */
    public async * stream(payload: ChatPayload): AsyncGenerator<string, void, unknown> {
        yield* this.streamInternal(
            payload.message,
            payload.context,
            payload.systemPrompt || (payload.options?.skipSystemPrompt ? "" : UNIVERSAL_SYSTEM_PROMPT),
            payload.imagePath,
            payload.imagePaths
        );
    }

    /**
     * Internal implementation for streaming
     */
    private async * streamInternal(
        message: string,
        context?: string,
        systemPrompt: string = UNIVERSAL_SYSTEM_PROMPT,
        imagePath?: string,
        imagePaths?: string[]
    ): AsyncGenerator<string, void, unknown> {
        const allPaths = new Set<string>();
        if (imagePath) allPaths.add(imagePath);
        if (imagePaths) {
            for (const p of imagePaths) {
                if (p) allPaths.add(p);
            }
        }

        const fullPrompt = context
            ? `SYSTEM: ${systemPrompt}\nCONTEXT: ${context}\nUSER: ${message}`
            : `SYSTEM: ${systemPrompt}\nUSER: ${message}`;

        const promptTokens = estimateTokens(fullPrompt);
        const contextWindow = Math.max(4096, Math.min(8192, promptTokens + (allPaths.size > 0 ? 2048 : 1024)));

        try {
            let modelToUse = this.ollamaModel;
            const images: string[] = [];

            if (allPaths.size > 0) {
                const isAlreadyVision = await this.modelSupportsVision(this.ollamaModel);

                if (!isAlreadyVision) {
                    const visionModel = await this.findBestVisionModel(this.ollamaModel.toLowerCase().includes('cloud'));

                    if (visionModel) {
                        console.log(`[OllamaProvider] Switching to vision model for streaming: ${visionModel.name}`);
                        modelToUse = visionModel.name;
                    } else {
                        console.warn(`[OllamaProvider] No vision model found in Ollama.`);
                        yield "Full Privacy Mode requires a vision-capable local Ollama model for screenshot analysis. Run `ollama pull llava:7b` or `ollama pull qwen2.5-vl:7b`.";
                        return;
                    }
                } else {
                    modelToUse = this.ollamaModel;
                }
                for (const p of allPaths) {
                    try {
                        const img = nativeImage.createFromPath(p);
                        const width = Math.max(1, img.getSize().width || 1);
                        const resized = img.resize({ width: Math.min(1024, width) });
                        images.push(resized.toJPEG(75).toString('base64'));
                    } catch (err) {
                        console.error(`[OllamaProvider] Failed to process image ${p}:`, err);
                    }
                }
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.warn(`[OllamaProvider] Ollama stream timed out after 180s`);
            }, 180000);

            let lineBuffer = "";
            try {
                const body: any = {
                    model: modelToUse,
                    stream: true,
                    options: {
                        temperature: OLLAMA_FAST_RESPONSE_TEMPERATURE,
                        num_ctx: contextWindow,
                        num_thread: 8,
                    }
                };
                this.applyFastResponseDefaults(body, modelToUse);

                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: context ? `CONTEXT: ${context}\n\nQUESTION: ${message}` : message }
                ];
                if (images.length > 0) {
                    (messages[1] as any).images = images;
                }
                body.messages = messages;

                let response = await fetch(`${this.ollamaUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });

                let isChatResponse = true;

                if (!response.ok) {
                    console.warn(`[OllamaProvider] Streaming /api/chat failed with status ${response.status}. Trying legacy /api/generate fallback...`);
                    // Fallback to /api/generate
                    const fallbackBody: any = {
                        model: modelToUse,
                        stream: true,
                        prompt: fullPrompt,
                        options: body.options
                    };
                    this.applyFastResponseDefaults(fallbackBody, modelToUse);
                    response = await fetch(`${this.ollamaUrl}/api/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(fallbackBody),
                        signal: controller.signal
                    });
                    isChatResponse = false;
                }

                if (!response.ok) {
                    let errorMessage = `Ollama returned HTTP status ${response.status}`;
                    try {
                        const txt = await response.text();
                        const errorJson = JSON.parse(txt);
                        if (errorJson.error) {
                            errorMessage = errorJson.error;
                        }
                    } catch {}
                    throw new Error(errorMessage);
                }

                if (!response.body) throw new Error("No response body from Ollama");

                // @ts-ignore
                for await (const chunk of response.body) {
                    lineBuffer += new TextDecoder().decode(chunk);

                    const lines = lineBuffer.split('\n');
                    lineBuffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        try {
                            const json = JSON.parse(trimmed);
                            const content = isChatResponse ? json.message?.content : json.response;
                            if (content) yield content;
                            if (json.done) {
                                clearTimeout(timeoutId);
                                return;
                            }
                        } catch { }
                    }
                }
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                yield "\n\nResponse timed out. Try a shorter question or a smaller model.";
            } else {
                console.error("[OllamaProvider] Stream error:", error);
                yield `\n\nError: ${error.message}`;
            }
        }
    }

    // =========================================================================
    // Utility Methods
    // =========================================================================

    public async checkAvailable(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${this.ollamaUrl}/api/tags`, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            return false;
        }
    }

    public async getModels(): Promise<string[]> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(`${this.ollamaUrl}/api/tags`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Failed to fetch models');

            const data = await response.json();
            return data.models?.map((model: any) => model.name) || [];
        } catch (error) {
            clearTimeout(timeoutId);
            console.warn("[OllamaProvider] Error fetching Ollama models:", error);
            return [];
        }
    }

    public async forceRestart(): Promise<boolean> {
        try {
            const platform = process.platform;
            if (platform === 'win32') {
                await execAsync('taskkill /F /IM ollama.exe').catch(() => { });
                await new Promise(r => setTimeout(r, 1000));
                execAsync('start "" "ollama" serve').catch(() => { });
            } else if (platform === 'darwin') {
                await execAsync('pkill -9 ollama').catch(() => { });
                await new Promise(r => setTimeout(r, 1000));
                execAsync('open -a Ollama').catch(() => { });
            } else {
                await execAsync('pkill -9 ollama').catch(() => { });
                await new Promise(r => setTimeout(r, 1000));
                execAsync('ollama serve &').catch(() => { });
            }

            // Wait for restart
            for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 500));
                if (await this.checkAvailable()) {
                    console.log(`[OllamaProvider] Ollama restarted successfully after ${(i + 1) * 500}ms`);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error("[OllamaProvider] Failed to restart Ollama:", error);
            return false;
        }
    }

    /**
     * Background pre-load for Ollama models to warm up VRAM
     */
    public async preloadModel(modelId: string): Promise<void> {
        if (!modelId) return;
        console.log(`[OllamaProvider] Pre-loading model: ${modelId}`);

        try {
            await fetch(`${this.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelId,
                    prompt: "",
                    stream: false
                })
            });
            console.log(`[OllamaProvider] Model pre-loaded successfully: ${modelId}`);
        } catch (error) {
            console.warn(`[OllamaProvider] Pre-load failed for ${modelId}:`, error);
        }
    }

    /**
     * Generate summary with Ollama, preferring text-only models over vision models
     */
    public async generateSummary(
        systemPrompt: string,
        context: string,
        withTimeout: <T>(promise: Promise<T>, ms: number, name: string) => Promise<T>,
        processResponse: (text: string) => string
    ): Promise<string> {
        try {
            let modelToUse = this.ollamaModel;
            const isVisionModel = isLikelyDedicatedVisionModelName(this.ollamaModel);

            if (isVisionModel) {
                console.log(`[OllamaProvider] Selected model ${this.ollamaModel} is Vision-heavy. Searching for faster text-only summary model...`);
                const available = await this.getModels();
                const fastModel = available.find(m => {
                    const low = m.toLowerCase();
                    return (low.includes('llama3.1') || low.includes('llama3.2') || low.includes('qwen2.5') || low.includes('mistral')) && !low.includes('vl');
                });

                if (fastModel) {
                    console.log(`[OllamaProvider] Switching to ${fastModel} for faster local summarization.`);
                    modelToUse = fastModel;
                }
            }

            const response = (await withTimeout(
                this.callWithModel(modelToUse, `${systemPrompt}\n\nCONTEXT:\n${context}`),
                300000,
                "Ollama Summary"
            )) as string;

            if (response && response.trim().length > 0) {
                console.log(`[OllamaProvider] ✅ Ollama summary generated successfully.`);
                return processResponse(response);
            }
        } catch (e: any) {
            console.warn(`[OllamaProvider] ⚠️ Ollama summary failed: ${e.message}`);
        }

        throw new Error("Failed to generate summary after all fallback attempts.");
    }
}
