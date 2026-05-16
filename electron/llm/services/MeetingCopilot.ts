import { LLMHelper } from "../../LLMHelper";
import { CredentialsManager } from "../../services/CredentialsManager";
import { buildPromptForMode } from "../promptRegistry";
import { formatTemporalContextForPrompt, TemporalContext } from "../TemporalContextBuilder";
import { IntentResult } from "../IntentClassifier";
import { ContextDocumentManager } from "../../services/ContextDocumentManager";
import { CostTracker } from "../../utils/costTracker";
import { sanitizeTranscriptBlock, sanitizeUserContent } from "../promptSanitizer";

export class MeetingCopilot {
    private llmHelper: LLMHelper;
    private contextManager: ContextDocumentManager;

    constructor(llmHelper: LLMHelper) {
        this.llmHelper = llmHelper;
        this.contextManager = ContextDocumentManager.getInstance();
    }

    async *generateAnswerStream(
        cleanedTranscript: string,
        temporalContext?: TemporalContext,
        intentResult?: IntentResult,
        imagePath?: string,
        signal?: AbortSignal
    ): AsyncGenerator<string> {
        try {
            const safeTranscript = sanitizeTranscriptBlock(cleanedTranscript);
            let contextParts: string[] = [];

            if (intentResult) {
                contextParts.push(`<intent_and_shape>\nDETECTED INTENT: ${intentResult.intent}\nANSWER SHAPE: ${intentResult.answerShape}\n</intent_and_shape>`);
            }

            if (temporalContext && temporalContext.hasRecentResponses) {
                const history = temporalContext.previousResponses.map((r, i) => `${i + 1}. "${sanitizeUserContent(r, { maxLength: 800 })}"`).join('\n');
                contextParts.push(`PREVIOUS CONTRIBUTIONS:\n${history}`);
            }

            const extraContext = contextParts.join('\n\n');
            const fullMessage = extraContext
                ? `${extraContext}\n\nCONVERSATION:\n${safeTranscript}`
                : safeTranscript;

            const projectKnowledge = this.contextManager.getProjectKnowledgeText();
            const agendaText = this.contextManager.getAgendaText();
            const resumeText = "";
            const jdText = "";

            const creds = CredentialsManager.getInstance();
            const prompt = this.injectTemporalContext(
                buildPromptForMode({
                    mode: 'ragMeeting',
                    settings: creds.getPromptSettings(),
                    resumeText: "",
                    jdText: "",
                    projectKnowledge,
                    agendaText,
                    sessionMode: 'meeting'
                }),
                temporalContext
            );

            const costTracker = CostTracker.getInstance();
            const inputTokens = Math.ceil((fullMessage.length + prompt.length) / 4);
            let fullResponse = "";

            const stream = this.llmHelper.streamChat({
                message: fullMessage,
                imagePath: imagePath,
                systemPrompt: prompt,
                signal
            });

            for await (const chunk of stream) {
                if (signal?.aborted) {
                    break;
                }
                fullResponse += chunk;
                yield chunk;
            }

            const outputTokens = Math.ceil(fullResponse.length / 4);
            const currentModel = this.llmHelper.getCurrentModel();
            const provider = this.llmHelper.getCurrentProvider();
            if (currentModel && provider) {
                costTracker.trackUsage(provider, currentModel, inputTokens, outputTokens).catch(err => {
                    console.error("Failed to track cost:", err);
                });
            }

        } catch (error) {
            console.error("[MeetingCopilot] Stream failed:", error);
            yield "Could you repeat that? I want to make sure I address your question properly.";
        }
    }

    async generateManualAnswer(question: string, context?: string, signal?: AbortSignal): Promise<string> {
        try {
            const projectKnowledge = this.contextManager.getProjectKnowledgeText();
            const agendaText = this.contextManager.getAgendaText();
            const resumeText = "";
            const jdText = "";

            const creds = CredentialsManager.getInstance();
            const prompt = buildPromptForMode({
                mode: 'ragMeeting',
                settings: creds.getPromptSettings(),
                resumeText: "",
                jdText: "",
                projectKnowledge,
                agendaText,
                sessionMode: 'meeting'
            });

            const stream = await this.llmHelper.streamChat({
                message: sanitizeUserContent(question, { maxLength: 4000 }),
                context: context ? sanitizeUserContent(context) : undefined,
                systemPrompt: prompt,
                signal
            });

            let fullResponse = "";
            for await (const chunk of stream) {
                fullResponse += chunk;
            }
            return fullResponse.trim();

        } catch (error) {
            console.error("[MeetingCopilot] Manual generation failed:", error);
            return "";
        }
    }

    private injectTemporalContext(prompt: string, temporalContext?: TemporalContext): string {
        const temporalPrompt = temporalContext ? formatTemporalContextForPrompt(temporalContext) : "";
        if (!temporalPrompt) {
            return prompt.replace("{TEMPORAL_CONTEXT}", "").trim();
        }

        if (prompt.includes("{TEMPORAL_CONTEXT}")) {
            return prompt.replace("{TEMPORAL_CONTEXT}", temporalPrompt);
        }

        return `${prompt}\n\n${temporalPrompt}`.trim();
    }
}
