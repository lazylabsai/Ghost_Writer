// electron/llm/IntentClassifier.ts
// Lightweight intent classification for "What should I say?"
// Micro step that runs before answer generation

export type ConversationIntent =
    | 'clarification'      // "Can you explain that?"
    | 'follow_up'          // "What happened next?"
    | 'deep_dive'          // "Tell me more about X"
    | 'behavioral'         // "Give me an example of..."
    | 'example_request'    // "Can you give a concrete example?"
    | 'summary_probe'      // "So to summarize..."
    | 'coding'             // "Write code for X" or implementation questions
    | 'system_design'      // "Design a system for X"
    | 'tradeoff'           // "Compare X vs Y" / "What are the tradeoffs?"
    | 'weakness_strength'  // "What's your biggest weakness?" / "Tell me about a failure"
    | 'technical_concept'  // "What is X?" / "Explain how Y works"
    | 'motivation'         // "Why do you want to work here?" / "Why this role?"
    | 'leadership'         // "How do you lead a team?" / "Tell me about mentoring"
    | 'estimation'         // "How long would it take?" / "How would you estimate?"
    | 'introduction'       // "Tell me about yourself" / "Walk me through your resume"
    | 'project_deep_dive'  // "Tell me about project X on your resume"
    | 'technology_experience' // "What is your experience with React/Kafka?"
    | 'general';           // Default fallback

export interface IntentResult {
    intent: ConversationIntent;
    confidence: number;
    answerShape: string;
}

/**
 * Answer shapes mapped to intents
 * This controls HOW the answer is structured, not just WHAT it says
 */
const INTENT_ANSWER_SHAPES: Record<ConversationIntent, string> = {
    clarification: 'Give a direct, focused 1-2 sentence clarification. No setup, no context-setting.',
    follow_up: 'Continue the narrative naturally. 1-2 sentences. No recap of what was already said.',
    deep_dive: 'Provide a structured but concise explanation. Use concrete specifics, not abstract concepts.',
    behavioral: 'Lead with a specific example or story from your Resume. Use the STAR pattern implicitly (Situation, Task, Action, Result). Focus on measurable outcomes, specific technologies, and business impact. If the Job Description includes company values or leadership principles, naturally align your answer to embody the most relevant value WITHOUT naming it explicitly. Use **bold** for key metrics, technologies, and outcomes so the candidate can spot them at a glance. 3-5 sentences.',
    example_request: 'Provide ONE concrete, detailed example. Make it realistic and specific. Include numbers or metrics if possible.',
    summary_probe: 'Confirm the summary briefly and add one clarifying point if needed.',
    coding: 'If the user provides a multiple-choice question (MCQ), skip the 7 steps: provide the correct answer immediately. If this is a NEW coding problem description, YOU MUST output EXACTLY these 7 markdown headers, in this exact order, without skipping any:\n"### Step 1: Restate the Problem" -> 2-3 sentences paraphrasing the problem out loud to the interviewer. Highlight the key insight.\n"### Step 2: Clarifying Questions" -> 2-3 short, relevant clarifying questions to ask the interviewer before coding.\n"### Step 3: Assumptions" -> 1-2 sentences stating your assumptions (e.g. constraints, inputs, edge cases).\n"### Step 4: Brute Force Approach" -> First, write a 1-2 sentence explanation of what you will say to the interviewer BEFORE coding. Then, write clean, commented code in a markdown block. Then, write a brief line-by-line explanation of the code, and state Time and Space Complexity.\n"### Step 5: Optimized Approach" -> First, write a 1-2 sentence explanation of the key optimization insight to tell the interviewer. Then, write clean, commented code. Then, write a brief line-by-line explanation, and state Time and Space Complexity.\n"### Step 6: Dry Run" -> Trace through the sample inputs step-by-step with variable values.\n"### Step 7: Pythonic Solution" -> Provide a short, built-in solution using Python\'s libraries (bonus).\nAll code must include short inline comments explaining the WHY. Write responses exactly as you would speak to the interviewer in a real interview — conversational, using first-person ("I", "my"), and natural. If this is a FOLLOW-UP coding question or error debugging, skip the 7 steps and answer directly.',
    system_design: 'If and ONLY if the conversation explicitly specifies to design a system "from ground up" or "from scratch", YOU MUST output EXACTLY these 6 markdown headers:\n"### Step 1: Requirements Clarification" -> 3-4 clarifying questions to ask the interviewer.\n"### Step 2: Back-of-Envelope Estimation" -> Quick math estimates for scale (QPS, storage, QPD).\n"### Step 3: High-Level Design" -> Major components and how they connect.\n"### Step 4: Deep Dive" -> Detailed design of 1-2 critical components with data model/schemas and API endpoints.\n"### Step 5: Scaling & Trade-offs" -> How to handle 10x/100x growth (sharding, caching, ACID vs eventual consistency).\n"### Step 6: Bottlenecks & Monitoring" -> Single points of failure and key metrics to monitor.\nIf the prompt does NOT explicitly specify designing "from ground up" or "from scratch" (e.g. they ask about architecture, components, data flow, failures, tradeoffs, or existing designs), DO NOT use the 6 steps. Instead, answer directly based on what is asked, considering the conversation context. All responses must be as humanly as possible, formatted for you to read out loud to the interviewer.',
    tradeoff: 'Acknowledge both sides, state your clear preference with concrete reasoning grounded in real experience. 2-4 sentences.',
    weakness_strength: 'Give a genuine, self-aware answer. For weaknesses: name a real technical growth area, show awareness, and explain how you have improved/prevented it using a concrete experience or system. For strengths: state a key capability and back it with a specific project, company, and metric from your Resume. 3-5 sentences.',
    technical_concept: 'Give a clear, concise definition first, then explain with a concrete real-world example. 2-4 sentences.',
    motivation: 'Show genuine enthusiasm grounded in specifics from the Job Description and company domain. Connect your background and Resume accomplishments to their specific mission, technical challenges, or responsibilities. 2-4 sentences.',
    leadership: 'Lead with a specific leadership or mentoring story. Focus on how you empowered others AND how that translated to customer or business outcomes. Include a concrete example of teaching a concept or unblocking a junior dev. If the JD includes values about trust or ownership, embody them without naming them. Use **bold** for key outcomes and team impact. 3-5 sentences.',
    estimation: 'Break down the estimate into components. State assumptions clearly. Give a range with reasoning. 3-5 sentences.',
    introduction: 'Lead with a structured elevator pitch using the Present-Past-Future model: Current role/focus (1 sentence), most impressive/relevant achievements/experience (1-2 sentences), and why you are excited about this specific company and role (1 sentence). Pull company names, role titles, and technologies directly from your Resume. Keep it under 45 seconds (3-4 sentences total).',
    project_deep_dive: 'Provide a natural, confident walkthrough of the project. Structure: WHAT the project was (1 sentence) → WHY it mattered / business impact (1 sentence) → HOW you built it, including architecture, tech stack, and your specific role (2-3 sentences) → RESULTS and key metrics (1 sentence). Pull all details and metrics from your Resume. 4-6 sentences total.',
    technology_experience: 'State your experience level and how you have used this technology in your roles. Ground it in specific projects and companies from your Resume (e.g., "I used X at Y to build Z"). Mention the scale, benefits, or challenges you solved with it. 2-4 sentences.',
    general: 'Respond naturally based on context. Keep it conversational and direct. Answer the specific question asked.'
};

/**
 * Pattern-based intent detection (fast, no LLM call)
 * For common patterns this is sufficient
 */
function detectIntentByPattern(lastInterviewerTurn: string): IntentResult | null {
    const text = lastInterviewerTurn.toLowerCase().trim();

    // Introduction patterns
    if (/(tell me about yourself|walk me through your background|walk me through your resume|introduce yourself|about your background|about yourself)/i.test(text)) {
        return { intent: 'introduction', confidence: 0.95, answerShape: INTENT_ANSWER_SHAPES.introduction };
    }

    // Project deep dive patterns
    if (/(tell me about a project|tell me about the project|explain your work on|walk me through the architecture of|how did you implement|your role in|project from your resume|project you worked on)/i.test(text)) {
        return { intent: 'project_deep_dive', confidence: 0.95, answerShape: INTENT_ANSWER_SHAPES.project_deep_dive };
    }

    // Clarification patterns
    if (/(can you explain|what do you mean|clarify|could you elaborate on that specific)/i.test(text)) {
        return { intent: 'clarification', confidence: 0.9, answerShape: INTENT_ANSWER_SHAPES.clarification };
    }

    // Coding patterns (Broad detection for programming/implementation)
    if (/(write code|program|implement|function for|algorithm|how to code|setup a .* project|using .* library|debug this|snippet|boilerplate|example of .* in .*|optimize|refactor|best practice for .* code|utility method|component for|logic for)/i.test(text)) {
        return { intent: 'coding', confidence: 0.9, answerShape: INTENT_ANSWER_SHAPES.coding };
    }

    // System design patterns
    if (/(design a|architect|scale|system design|how would you build|high level design|microservice|distributed|load balanc|database schema|api design|design.*system|control plane|data plane|cp.dp|pipeline|workflow|event.driven|cqrs)/i.test(text)) {
        return { intent: 'system_design', confidence: 0.9, answerShape: INTENT_ANSWER_SHAPES.system_design };
    }

    // Follow-up patterns  
    if (/(what happened|then what|and after that|what.s next|how did that go)/i.test(text)) {
        return { intent: 'follow_up', confidence: 0.85, answerShape: INTENT_ANSWER_SHAPES.follow_up };
    }

    // Deep dive patterns
    if (/(tell me more|dive deeper|explain further|walk me through|how does that work)/i.test(text)) {
        return { intent: 'deep_dive', confidence: 0.85, answerShape: INTENT_ANSWER_SHAPES.deep_dive };
    }

    // Weakness / strength / self-awareness patterns (check BEFORE behavioral — "disagree", "conflict" are more specific)
    if (/(weakness|strength|biggest challenge|area.*improve|what.*struggle|difficult.*experience|failure|mistake.*made|learn from|conflict|disagree)/i.test(text)) {
        return { intent: 'weakness_strength', confidence: 0.9, answerShape: INTENT_ANSWER_SHAPES.weakness_strength };
    }

    // Technology experience patterns
    if (/(experience with|have you used|hands-on with|worked with|familiar with|your background in|how much.*experience|your experience with)/i.test(text)) {
        return { intent: 'technology_experience', confidence: 0.9, answerShape: INTENT_ANSWER_SHAPES.technology_experience };
    }

    // Behavioral patterns
    if (/(give me an example|tell me about a time|describe a situation|when have you|share an experience)/i.test(text)) {
        return { intent: 'behavioral', confidence: 0.9, answerShape: INTENT_ANSWER_SHAPES.behavioral };
    }

    // Example request patterns
    if (/(for example|concrete example|specific instance|like what|such as)/i.test(text)) {
        return { intent: 'example_request', confidence: 0.85, answerShape: INTENT_ANSWER_SHAPES.example_request };
    }

    // Summary probe patterns
    if (/(so to summarize|in summary|so basically|so you.re saying|let me make sure)/i.test(text)) {
        return { intent: 'summary_probe', confidence: 0.85, answerShape: INTENT_ANSWER_SHAPES.summary_probe };
    }

    // Tradeoff / comparison patterns
    if (/(tradeoff|trade.off|pros and cons|compare|versus|vs |which.*prefer|which.*choose|advantage|disadvantage|when would you use|difference between)/i.test(text)) {
        return { intent: 'tradeoff', confidence: 0.85, answerShape: INTENT_ANSWER_SHAPES.tradeoff };
    }

    // Motivation / "why" patterns
    if (/(why.*want.*work|why.*interest|why.*role|why.*company|why.*position|what attracts you|what draws you|why.*leave|why.*looking|what motivates)/i.test(text)) {
        return { intent: 'motivation', confidence: 0.9, answerShape: INTENT_ANSWER_SHAPES.motivation };
    }

    // Leadership / mentoring patterns
    if (/(lead.*team|manage.*team|mentor|how do you lead|leadership style|delegate|how.*manage.*people|cross.functional|stakeholder)/i.test(text)) {
        return { intent: 'leadership', confidence: 0.85, answerShape: INTENT_ANSWER_SHAPES.leadership };
    }

    // Estimation patterns
    if (/(how long|estimate|timeline|how.*many.*days|effort|how.*would.*scope|story points|sprint|how.*plan)/i.test(text)) {
        return { intent: 'estimation', confidence: 0.8, answerShape: INTENT_ANSWER_SHAPES.estimation };
    }

    // Technical concept / "explain X" patterns
    if (/(what is|explain|define|how does.*work|what are|describe.*concept|walk me through the concept|principle|paradigm|methodology|approach to)/i.test(text)) {
        return { intent: 'technical_concept', confidence: 0.8, answerShape: INTENT_ANSWER_SHAPES.technical_concept };
    }

    return null; // No clear pattern detected
}

/**
 * Context-aware intent detection
 * Looks at conversation flow, not just the last turn
 */
function detectIntentByContext(
    recentTranscript: string,
    assistantMessageCount: number
): IntentResult {
    // If we've given multiple answers and interviewer is probing, likely follow_up
    if (assistantMessageCount >= 2) {
        // Check if interviewer is drilling down
        const lines = recentTranscript.split('\n');
        const interviewerLines = lines.filter(l => l.includes('[INTERVIEWER'));

        // Short interviewer prompts after long exchanges = follow-up probe
        const lastInterviewerLine = interviewerLines[interviewerLines.length - 1] || '';
        if (lastInterviewerLine.length < 50 && assistantMessageCount >= 2) {
            return { intent: 'follow_up', confidence: 0.7, answerShape: INTENT_ANSWER_SHAPES.follow_up };
        }
    }

    // Default to general
    return { intent: 'general', confidence: 0.5, answerShape: INTENT_ANSWER_SHAPES.general };
}

/**
 * Main intent classification function
 * Combines pattern matching with context awareness
 * Fast enough to run inline (~0-5ms)
 */
export function classifyIntent(
    lastInterviewerTurn: string | null,
    recentTranscript: string,
    assistantMessageCount: number
): IntentResult {
    // Try pattern-based first (high confidence)
    if (lastInterviewerTurn) {
        const patternResult = detectIntentByPattern(lastInterviewerTurn);
        if (patternResult) {
            return patternResult;
        }
    }

    // Fall back to context-based
    return detectIntentByContext(recentTranscript, assistantMessageCount);
}

/**
 * Get answer shape guidance for prompt injection
 */
export function getAnswerShapeGuidance(intent: ConversationIntent): string {
    return INTENT_ANSWER_SHAPES[intent];
}
