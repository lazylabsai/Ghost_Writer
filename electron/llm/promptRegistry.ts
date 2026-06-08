import {
    IMAGE_ANALYSIS_PROMPT,
    UNIVERSAL_ANSWER_PROMPT,
    UNIVERSAL_ASSIST_PROMPT,
    UNIVERSAL_FOLLOWUP_PROMPT,
    UNIVERSAL_FOLLOW_UP_QUESTIONS_PROMPT,
    UNIVERSAL_MEETING_ANSWER_PROMPT,
    UNIVERSAL_RECAP_PROMPT,
    UNIVERSAL_SYSTEM_PROMPT,
    INTERVIEW_WHAT_TO_ANSWER_PROMPT,
    injectUserContext
} from "./prompts/index";
import { PromptMode, PromptSettings, PromptSettingsMap, PROMPT_MODES } from "./promptTypes";
import { CredentialsManager } from "../services/CredentialsManager";

export const DEFAULT_GLOBAL_INTERVIEW_INSTRUCTIONS = `ROLE & PERSONA:
You are Ghost Writer, an elite Technical Interview Copilot. Your expertise, seniority, and domain knowledge must strictly align with the candidate's Resume and the target Job Description provided in the context. Your goal is to guide the candidate to pass this specific interview.

TONE & STYLE:
- Professional, concise, and highly actionable.
- Responses must be easy to read at a glance while speaking. Use bullet points and short sentences.
- Never use robotic fillers (e.g., "Certainly!", "Here is the answer"). Jump straight to the point.

CODING GUIDELINES:
- **CRITICAL**: Only trigger coding guidelines if the round is an active, live coding assessment or algorithm puzzle (e.g. LeetCode, HackerRank, coderpad, or writing an algorithm). Do NOT output code or follow coding/complexity formats for conceptual or behavioral questions, even if they mention bugs, failures, or code snippets.
- Adapt strictly to the platform shown in the screenshot (e.g., HackerRank, LeetCode). Pay close attention to the required I/O format (STDIN/STDOUT vs function return).
- Start by providing 1-2 key clarification questions and assumptions the candidate should state out loud.
- Follow the standard 6-Step structure (Restate, Clarify, Assume, Brute Force, Optimized, Dry Run), but you MUST add a new **Step 7: Pythonic/Built-in Solution**.
- **Step 7: Pythonic/Built-in Solution**: Provide an alternative, short solution using Python's built-in libraries/functions to solve the problem easily in minimal lines.
- Ensure that you explicitly list the Time and Space complexity for BOTH the Brute Force and Optimized approaches.
- Under the Optimized Approach, include a brief "Tradeoffs" section explaining WHY the optimized solution was chosen over the brute force approach.
- Write clean, production-ready solutions (default to Python).
- Always include a short "talk track" script (in quotes) of exactly what the candidate should say out loud to sound analytical and communicative.
- Highlight edge cases the candidate should mention to the interviewer.

BEHAVIORAL/SYSTEM DESIGN:
- For behavioral questions, structure answers using the STAR method (Situation, Task, Action, Result). Focus heavily on the candidate's impact as described in their Resume.
- For system design, adapt the architecture and tradeoffs to match the scale expected in the Job Description. Provide a high-level overview first, then drill into components.

ERROR RECOVERY:
- If a screenshot contains a compilation error, traceback, or failed test case: instantly identify the bug, provide the corrected code snippet, and give a 1-sentence script on what to say out loud to the interviewer to sound analytical and unfazed (e.g., "Ah, I see the issue, I missed an edge case here...").

HUMAN DELIVERY:
- Sound like a real human thinking through a problem, not an AI generating text.
- Use first person: "I decided to use a hashmap because..." NOT "A hashmap is utilized for..."
- Express genuine reasoning: "My initial thought was X, but then I realized Y would be better because..."
- For code: include short inline comments on important lines so the candidate can scan and understand the logic at a glance while explaining.
- Never use eval(), never suggest clever one-liners that sacrifice readability.
- Variable names should be descriptive and self-documenting (freq_map, left_ptr - NOT f, l).
- Use **bold** markdown for key terms, data structures, complexity metrics, component names, and important outcomes so the candidate can quickly spot the critical words while reading aloud.

COMPANY CONTEXT AWARENESS:
- If the Job Description includes company values, leadership principles, or core cultural pillars, weave them naturally into behavioral and system design answers without explicitly naming them. Just embody them.
- If the JD mentions specific architectural patterns (e.g., Control Plane/Data Plane, event-driven, CQRS) or technical requirements, incorporate them into system design responses automatically.
- If the JD mentions a specific domain (healthcare, fintech, e-commerce), use domain-relevant examples - never generic social media examples for a healthcare company.
- Your role is to make every answer feel like it was specifically crafted for THIS company and THIS role based on whatever context is in the JD and Resume.`;

export const DEFAULT_GLOBAL_MEETING_INSTRUCTIONS = `ROLE & PERSONA:
You are an elite Executive Meeting Assistant and Technical Copilot. Your role, technical depth, and strategic focus must align with the provided Project Documentation and Session Agenda in the context.

TONE & STYLE:
- Sharp, attentive, and highly professional.
- Use concise bullet points for scannability.
- Cut the fluff; deliver only high-signal information.

MEETING GUIDELINES:
- Extract and track actionable items, blockers, and critical decisions in real-time.
- If asked to summarize, provide a brief synthesis rather than a chronological transcript.
- When technical topics or code are discussed, act as a technical advisor tailored to the project's domain, offering architectural tradeoffs and best practices.
- Highlight any unresolved questions or action items that the user should bring up before the meeting ends based on the Agenda.`;

export interface PromptTemplateDefinition {
    id: string;
    title: string;
    description: string;
    sessionMode: "interview" | "meeting" | "global";
    prompt: string;
}

const PROMPT_TEMPLATES: Record<PromptMode, PromptTemplateDefinition> = {
    assist: {
        id: "builtin:assist",
        title: "Assist",
        description: "Passive observation and concise situational insight.",
        sessionMode: "global",
        prompt: UNIVERSAL_ASSIST_PROMPT
    },
    answer: {
        id: "builtin:answer",
        title: "Answer",
        description: "Direct spoken answer generation for the current session.",
        sessionMode: "global",
        prompt: UNIVERSAL_ANSWER_PROMPT
    },
    whatToAnswer: {
        id: "builtin:whatToAnswer",
        title: "What To Answer",
        description: "Strategic spoken answer for interview questions.",
        sessionMode: "interview",
        prompt: INTERVIEW_WHAT_TO_ANSWER_PROMPT
    },
    followUpRefinement: {
        id: "builtin:followUpRefinement",
        title: "Follow-Up Refinement",
        description: "Rewrite a previous answer based on direct feedback.",
        sessionMode: "global",
        prompt: UNIVERSAL_FOLLOWUP_PROMPT
    },
    followUpQuestions: {
        id: "builtin:followUpQuestions",
        title: "Follow-Up Questions",
        description: "Generate smart follow-up questions for the current topic.",
        sessionMode: "interview",
        prompt: UNIVERSAL_FOLLOW_UP_QUESTIONS_PROMPT
    },
    recap: {
        id: "builtin:recap",
        title: "Recap",
        description: "Turn a conversation into high-fidelity meeting notes.",
        sessionMode: "global",
        prompt: UNIVERSAL_RECAP_PROMPT
    },
    ragMeeting: {
        id: "builtin:ragMeeting",
        title: "RAG Meeting",
        description: "Answer using meeting-specific retrieval context.",
        sessionMode: "meeting",
        prompt: UNIVERSAL_MEETING_ANSWER_PROMPT
    },
    ragGlobal: {
        id: "builtin:ragGlobal",
        title: "RAG Global",
        description: "Answer using the full knowledge base and stored meeting context.",
        sessionMode: "global",
        prompt: UNIVERSAL_SYSTEM_PROMPT
    },
    imageAnalysis: {
        id: "builtin:imageAnalysis",
        title: "Image Analysis",
        description: "Describe screenshots and visual context precisely.",
        sessionMode: "global",
        prompt: IMAGE_ANALYSIS_PROMPT
    }
};

const DEFAULT_SESSION_MODES: Record<"interview" | "meeting", PromptMode[]> = {
    interview: ["whatToAnswer", "answer", "assist", "followUpRefinement", "followUpQuestions", "recap"],
    meeting: ["answer", "assist", "followUpRefinement", "recap", "ragMeeting", "imageAnalysis"]
};

export function getDefaultPromptTemplates(): Record<PromptMode, PromptTemplateDefinition> {
    return PROMPT_TEMPLATES;
}

export function getPromptModesForSession(sessionMode: "interview" | "meeting"): PromptMode[] {
    return DEFAULT_SESSION_MODES[sessionMode];
}

export function getDefaultPromptSettings(): PromptSettingsMap {
    return PROMPT_MODES.reduce((acc, mode) => {
        acc[mode] = {
            defaultPromptId: PROMPT_TEMPLATES[mode].id,
            extraInstructions: "",
            fullOverride: "",
            enabled: true,
            validation: { isValid: true }
        };
        return acc;
    }, {} as PromptSettingsMap);
}

export function normalizePromptSettings(settings?: Partial<PromptSettingsMap> | null): PromptSettingsMap {
    const defaults = getDefaultPromptSettings();
    if (!settings) {
        return defaults;
    }

    for (const mode of PROMPT_MODES) {
        const current = settings[mode] || {};
        defaults[mode] = {
            ...defaults[mode],
            ...current,
            defaultPromptId: PROMPT_TEMPLATES[mode].id,
            validation: validatePromptSettings({
                ...defaults[mode],
                ...current,
                defaultPromptId: PROMPT_TEMPLATES[mode].id
            })
        };
    }

    return defaults;
}

export function validatePromptSettings(settings: PromptSettings): PromptSettings["validation"] {
    const extraInstructions = settings.extraInstructions?.trim() || "";
    const fullOverride = settings.fullOverride?.trim() || "";

    if (extraInstructions.length > 4000) {
        return { isValid: false, error: "Extra instructions must stay under 4000 characters." };
    }

    if (fullOverride.length > 20000) {
        return { isValid: false, error: "Full overrides must stay under 20000 characters." };
    }

    return { isValid: true };
}

export function buildPromptForMode(params: {
    mode: PromptMode;
    settings?: Partial<PromptSettingsMap> | null;
    resumeText?: string;
    jdText?: string;
    projectKnowledge?: string;
    agendaText?: string;
    sessionMode: "interview" | "meeting";
}): string {
    const normalized = normalizePromptSettings(params.settings);
    const modeSettings = normalized[params.mode];
    const template = PROMPT_TEMPLATES[params.mode];

    const basePrompt = modeSettings.fullOverride?.trim() || template.prompt;
    
    const creds = CredentialsManager.getInstance().getAllCredentials();
    const globalInstructions = params.sessionMode === 'interview' 
        ? (creds.globalInterviewInstructions || DEFAULT_GLOBAL_INTERVIEW_INSTRUCTIONS)
        : (creds.globalMeetingInstructions || DEFAULT_GLOBAL_MEETING_INSTRUCTIONS);

    let finalInstructions = modeSettings.extraInstructions?.trim() || '';
    if (globalInstructions?.trim()) {
        finalInstructions = finalInstructions 
            ? `${globalInstructions.trim()}\n\n${finalInstructions}` 
            : globalInstructions.trim();
    }

    const enrichedPrompt = finalInstructions 
        ? `${basePrompt}\n\n<user_extra_instructions>\n${finalInstructions}\n</user_extra_instructions>`
        : basePrompt;

    return injectUserContext(
        enrichedPrompt,
        params.resumeText || "",
        params.jdText || "",
        params.projectKnowledge || "",
        params.agendaText || "",
        params.sessionMode,
        { includeSourceDisclosure: params.mode !== "recap" }
    );
}
