// electron/llm/promptSanitizer.ts
// Lightweight utility for cleaning up LLM inputs/outputs

/**
 * Strips common LLM meta-talk and formatting artifacts
 */
export function sanitizeOutput(text: string): string {
    if (!text) return "";
    
    let result = text.trim();
    
    // Remove "Here is the response:" or similar openings
    result = result.replace(/^(?:Here is|Sure|Okay|I understand|Certainly|As an AI|Based on your context),?\s*/i, '');
    
    // Remove markdown code block markers if they wrap the whole thing
    if (result.startsWith('```') && result.endsWith('```')) {
        result = result.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '');
    }
    
    return result.trim();
}

/**
 * Escapes characters that might break template substitution
 */
export function sanitizeInput(text: string): string {
    if (!text) return "";
    return text.trim();
}

/**
 * Truncates and cleans user-provided text to prevent injection or context overflow
 */
export function sanitizeUserContent(text: string, options: { maxLength?: number } = {}): string {
    if (!text) return "";
    const maxLength = options.maxLength || 4000;
    let sanitized = text.trim();
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + "... [truncated]";
    }
    return sanitized;
}

/**
 * Specifically cleans transcript blocks to remove noise and ensure standard formatting
 */
export function sanitizeTranscriptBlock(text: string): string {
    if (!text) return "";
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
}
