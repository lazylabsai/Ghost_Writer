import { ChatPayload } from "./providers/ILLMProvider";

export const SCREENSHOT_OCR_FAST_PATH_MIN_CHARS = 40;

type CachedScreenshotContext = {
  latestOcrText?: string;
  latestOcrAt?: number;
  latestOcrImageCount?: number;
  latestUserRequestWithOcr?: string;
  latestAssistantAnswer?: string;
  latestAssistantAnswerAt?: number;
  latestAssistantModel?: string;
  latestCode?: string;
};

export class ScreenshotSessionContext {
  private context: CachedScreenshotContext = {};

  public clear(): void {
    this.context = {};
  }

  public hasUsefulOCRText(ocrText?: string): boolean {
    return (ocrText ?? "").replace(/\s+/g, " ").trim().length >= SCREENSHOT_OCR_FAST_PATH_MIN_CHARS;
  }

  public rememberScreenshotOCR(ocrText: string | undefined, userRequest: string, imageCount: number): void {
    if (!this.hasUsefulOCRText(ocrText)) {
      return;
    }

    this.context.latestOcrText = this.truncate(ocrText, 14000);
    this.context.latestOcrAt = Date.now();
    this.context.latestOcrImageCount = imageCount;
    this.context.latestUserRequestWithOcr = this.truncate(userRequest, 1000);
  }

  public rememberAssistantResponse(response: string, modelId: string): void {
    const normalized = response.trim();
    if (!normalized || this.isLowValueAssistantResponse(normalized)) {
      return;
    }

    this.context.latestAssistantAnswer = this.truncate(normalized, 10000);
    this.context.latestAssistantAnswerAt = Date.now();
    this.context.latestAssistantModel = modelId;

    const latestCode = this.extractLatestCode(normalized);
    if (latestCode) {
      this.context.latestCode = this.truncate(latestCode, 10000);
    }
  }

  public applyPreviousWorkContext(payload: ChatPayload): ChatPayload {
    const previousWorkContext = this.buildPreviousWorkContext(payload.message);
    if (!previousWorkContext) {
      return payload;
    }

    return {
      ...payload,
      context: this.appendContextNote(payload.context, previousWorkContext),
    };
  }

  public buildMessageWithOCR(message: string, ocrText?: string): string {
    const normalizedOCR = ocrText?.trim();
    if (!normalizedOCR) {
      return message;
    }

    const codingInstructions = this.isLikelyCodingScreenshotRequest(message, normalizedOCR)
      ? `\n\nCODING ANSWER FORMAT:
If this OCR contains a programming challenge, answer in Python 3 unless the user explicitly asks for another language.
1. Briefly restate the problem and call out any OCR ambiguity that affects correctness.
2. Provide a brute force idea, code, and time/space complexity.
3. Provide an optimized idea, complete final code, and time/space complexity.
4. Before finalizing, mentally check the sample input/output when visible plus edge cases such as empty/minimum input, duplicates, sorted/reversed input, and boundary constraints.
5. Treat words like subset, subsequence, choose, pick, partition, and day/group carefully: selected items may skip positions unless the statement explicitly says contiguous.
6. Do not use a greedy/LIS/two-pointer shortcut unless it is justified by the actual ordering and transition rules in the OCR. Preserve input order and constraints exactly.
7. For small examples, manually simulate the optimized algorithm on the sample before giving final code.`
      : "";

    const mcqInstructions = !codingInstructions && this.isLikelyMCQScreenshotRequest(message, normalizedOCR)
      ? `\n\nMCQ ANSWER FORMAT:
If this OCR contains a multiple-choice question, respond with:
1. Answer: <letter>. <option text>
2. Reason: 2-4 concise sentences.
3. Eliminate: one short note for each other visible option.
If the OCR is missing the question or options, say what is missing instead of inventing choices.`
      : "";

    return `${message}\n\nSCREENSHOT OCR:\n${normalizedOCR}${codingInstructions}${mcqInstructions}`;
  }

  private appendContextNote(context: string | undefined, note: string): string {
    return context ? `${context}\n\n${note}` : note;
  }

  private truncate(value: string | undefined, maxChars: number): string | undefined {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }

    if (normalized.length <= maxChars) {
      return normalized;
    }

    return `${normalized.slice(0, maxChars)}\n...[truncated]`;
  }

  private isLikelyCodingScreenshotRequest(message: string, ocrText: string): boolean {
    const combined = `${message}\n${ocrText}`;
    return /\b(code|python|python3|java|javascript|typescript|c\+\+|cpp|c#|algorithm|function|class|method|array|string|tree|graph|dynamic programming|dp|constraints|sample input|sample output|time complexity|space complexity|brute force|optimized|optimised|hackerrank|leetcode)\b/i.test(combined);
  }

  private isLikelyMCQScreenshotRequest(message: string, ocrText: string): boolean {
    const combined = `${message}\n${ocrText}`;
    const hasChoiceLabels = /(^|\n|\s)(A|B|C|D|E)[).:]\s+\S/i.test(combined)
      || /(^|\n|\s)(1|2|3|4|5)[).:]\s+\S/i.test(combined);
    const hasQuestionCue = /\b(which|choose|select|following|mcq|multiple choice|true or false|correct answer|option)\b/i.test(combined);
    return hasChoiceLabels && hasQuestionCue;
  }

  private extractLatestCode(response: string): string | undefined {
    const fencedBlocks = Array.from(response.matchAll(/```[a-zA-Z0-9_+#.-]*\s*\n([\s\S]*?)```/g))
      .map(match => match[1]?.trim())
      .filter((block): block is string => !!block);

    if (fencedBlocks.length > 0) {
      return fencedBlocks[fencedBlocks.length - 1];
    }

    const inlineCodeStart = response.search(/\b(def|class|function|public|private|const|let|var|import|from)\b/);
    if (inlineCodeStart === -1) {
      return undefined;
    }

    const candidate = response.slice(inlineCodeStart).trim();
    return candidate.length >= 40 ? candidate : undefined;
  }

  private isLowValueAssistantResponse(response: string): boolean {
    return /^(I apologize|All AI providers failed|No AI providers configured|Image analysis requires|I encountered an error|The AI service is currently overloaded|Authentication failed|Response timed out|Payment Required)/i.test(response.trim());
  }

  private isPreviousWorkRequest(message: string): boolean {
    const normalized = message.trim();
    if (!normalized) {
      return false;
    }

    const explicitPreviousTarget = /\b(previous|last|earlier|above|prior|same|that|it)\b/i.test(normalized);
    const asksForValidation = /\b(validate|verify|check|review|debug|fix|correct|improve|optimi[sz]e|explain|continue|rework|compare)\b/i.test(normalized);
    const targetsWork = /\b(code|solution|answer|approach|ocr|screenshot|problem|question|mcq)\b/i.test(normalized);

    return /validate\s+(the\s+)?(previous|last|above|prior)\s+(code|solution|answer)/i.test(normalized)
      || (explicitPreviousTarget && asksForValidation && targetsWork);
  }

  private buildPreviousWorkContext(message: string): string | undefined {
    if (!this.isPreviousWorkRequest(message)) {
      return undefined;
    }

    const sections: string[] = [];
    if (this.context.latestOcrText) {
      sections.push(`[LATEST SCREENSHOT OCR]
${this.context.latestOcrText}`);
    }

    if (this.context.latestCode) {
      sections.push(`[LATEST GENERATED CODE]
${this.context.latestCode}`);
    }

    if (this.context.latestAssistantAnswer) {
      sections.push(`[LATEST ASSISTANT ANSWER]
${this.context.latestAssistantAnswer}`);
    }

    if (sections.length === 0) {
      return undefined;
    }

    const modelLabel = this.context.latestAssistantModel
      ? ` Last answer model: ${this.context.latestAssistantModel}.`
      : "";

    return `[SESSION MEMORY]
The user is referring to prior work in this same session.${modelLabel} Use this cached OCR/problem context and prior answer before responding.
${sections.join('\n\n')}
[END SESSION MEMORY]

VALIDATION/CONTINUATION RULES:
- If asked to validate code, compare the prior code against the OCR problem statement, constraints, sample I/O, and edge cases.
- Do not assume the previous answer is correct. If it is wrong or incomplete, return corrected code.
- If the OCR/problem statement is missing a critical detail, say exactly what is missing before giving a best-effort answer.`;
  }
}
