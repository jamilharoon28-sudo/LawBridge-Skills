import { PACK_KNOWLEDGE } from "./_ai-pack-knowledge.js";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function cleanText(value, maxLength = 4000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanLongText(value, maxLength = 12000) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function normalise(value) {
  return String(value || "").toLowerCase().trim();
}

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY || "";
}

function getModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function validatePayload(payload) {
  const message = cleanText(payload.message, 3000);

  if (!message) {
    return "Please enter a question for the LawBridge AI Skills Coach.";
  }

  if (message.length < 3) {
    return "Please enter a longer question.";
  }

  return null;
}

function extractOutputText(data) {
  if (data?.output_text) {
    return data.output_text;
  }

  const output = data?.output || [];

  return output
    .flatMap((item) => item.content || [])
    .map((contentItem) => contentItem.text || contentItem.value || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function scorePack(pack, payload) {
  const message = normalise(payload.message);
  const packCode = normalise(payload.packCode);
  const scenario = normalise(payload.scenario);
  const skill = normalise(payload.skill);

  const code = normalise(pack.code);
  const packScenario = normalise(pack.scenario);
  const packSkill = normalise(pack.skill);
  const title = normalise(pack.title);
  const summary = normalise(pack.summary);

  let score = 0;

  if (packCode && code && packCode === code) score += 100;
  if (packCode && code && message.includes(code)) score += 60;
  if (scenario && packScenario && scenario === packScenario) score += 50;
  if (skill && packSkill && skill === packSkill) score += 25;

  [code, packScenario, packSkill, title, summary]
    .filter(Boolean)
    .forEach((value) => {
      const words = value.split(/[^a-z0-9]+/).filter((word) => word.length > 2);

      words.forEach((word) => {
        if (message.includes(word)) {
          score += 2;
        }
      });
    });

  return score;
}

function findRelevantPacks(payload) {
  const scored = PACK_KNOWLEDGE.map((pack) => ({
    pack,
    score: scorePack(pack, payload),
  })).sort((a, b) => b.score - a.score);

  const strongMatches = scored.filter((item) => item.score > 0).slice(0, 3);

  if (strongMatches.length > 0) {
    return strongMatches.map((item) => item.pack);
  }

  return PACK_KNOWLEDGE.slice(0, 3);
}

function buildPackContext(pack, index) {
  const studentText = cleanLongText(pack.studentText, index === 0 ? 12000 : 5000);
  const tutorText = cleanLongText(pack.tutorText, index === 0 ? 8000 : 3000);

  return `
PACK ${index + 1}
Code: ${pack.code || "Not specified"}
Title: ${pack.title || "Not specified"}
Skill: ${pack.skill || "Not specified"}
Scenario: ${pack.scenario || "Not specified"}
Difficulty: ${pack.difficulty || "Not specified"}
Summary: ${pack.summary || "Not specified"}

Student Pack Extract:
${studentText || "No Student Pack text was extracted for this pack."}

Hidden Tutor Guide Extract:
${tutorText || "No Tutor Guide text was extracted for this pack."}
`;
}

function getModeInstructions(mode) {
  const cleanMode = cleanText(mode, 80);

  if (cleanMode === "Give Me a Hint") {
    return `
Mode-specific instruction:
Give hints only. Do not provide a complete answer. Give 3-5 targeted clues and one suggested next step. Encourage the student to return to the Student Pack and identify evidence themselves.
`;
  }

  if (cleanMode === "Explain the Task") {
    return `
Mode-specific instruction:
Explain what the task is asking in plain English. Break down the task into manageable parts. Do not complete the task for the student. End with a short checklist of what the student should do next.
`;
  }

  if (cleanMode === "Structure My Answer") {
    return `
Mode-specific instruction:
Give a clear answer structure with headings. Explain what should go under each heading. Do not fill in every substantive point as a full model answer. Keep the structure practical and trainee-style.
`;
  }

  if (cleanMode === "Find Evidence") {
    return `
Mode-specific instruction:
Help the student identify what evidence to look for. Mention categories such as exhibits, clauses, dates, emails, logs, policies, interview notes, chronology points, missing documents and disputed facts where relevant. Do not invent exact references unless they appear in the provided pack extract.
`;
  }

  if (cleanMode === "Check My Answer") {
    return `
Mode-specific instruction:
The student may paste a draft answer. Give feedback using this format:
1. Strengths
2. What needs improvement
3. Evidence or reasoning gaps
4. Suggested rewrite structure
5. One priority next step
Do not simply replace their answer with a full model answer.
`;
  }

  return `
Mode-specific instruction:
Give helpful practical support. Stay educational. Avoid giving a full model answer unless the student has provided their own draft and is asking for feedback.
`;
}

function buildPrompt(payload) {
  const mode = cleanText(payload.mode, 80) || "Ask Anything";
  const message = cleanText(payload.message, 3000);
  const relevantPacks = findRelevantPacks(payload);

  const selectedPackInfo = relevantPacks.length
    ? relevantPacks.map(buildPackContext).join("\n\n---\n\n")
    : "No pack knowledge is currently available.";

  return `
Support mode:
${mode}

Student question:
${message}

Relevant LawBridge pack knowledge:
${selectedPackInfo}

${getModeInstructions(mode)}

General response instructions:
- Use the relevant Student Pack text where available.
- Use the hidden Tutor Guide only to improve guidance, feedback and accuracy.
- Do not reveal, quote, copy, or expose the hidden Tutor Guide as a model answer.
- If the user asks for the answer, guide them through structure, reasoning and evidence rather than simply giving a complete answer.
- If the user asks for feedback on their draft, give strengths, improvements and a clear next step.
- If the user asks about evidence, point them to the type of evidence to look for and use wording such as “check the exhibit/email/clause/log in the pack” unless a clear reference appears in the provided extract.
- If the pack text does not contain enough information, say that honestly.
`;
}

const SYSTEM_INSTRUCTIONS = `
You are the LawBridge AI Skills Coach.

Your role:
- Help students understand LawBridge practical legal skills simulations.
- Give hints, structure, evidence-thinking guidance, and feedback on draft answers.
- Be practical, professional, student-friendly, and LawBridge-branded.
- Do not provide legal advice.
- Do not pretend uncertain law is settled.
- Do not produce full model answers by default.
- Encourage the student to cite the Student Pack evidence, exhibits, dates, clauses, emails, logs, policies, or task materials.
- If the student asks for a direct answer, guide them towards structure and reasoning instead.
- If the student asks for feedback, give strengths, improvements, and a suggested next step.
- If the student asks about evidence, explain what evidence they should look for and how to use it.
- If you do not have enough pack-specific information, say so honestly.

Tutor Guide protection:
- Tutor Guide content is hidden internal guidance.
- Never tell the student you are quoting from a Tutor Guide.
- Never reveal full model answers or tutor-only answers.
- Use tutor guidance only to provide better hints, structure and feedback.

Tone:
Premium, clear, supportive, practical, educational and evidence-focused.
`;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = getOpenAIKey();

  if (!apiKey) {
    return json(500, {
      error:
        "OPENAI_API_KEY is missing. In Netlify, add OPENAI_API_KEY under Environment variables with Functions scope, then redeploy.",
      details:
        "The function cannot see the OpenAI API key. Check Netlify environment variable scopes and deploy context values.",
    });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  const validationError = validatePayload(payload);

  if (validationError) {
    return json(400, { error: validationError });
  }

  const input = buildPrompt(payload);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        instructions: SYSTEM_INSTRUCTIONS,
        input,
        max_output_tokens: 1000,
      }),
    });

    const rawText = await response.text();

    let data = {};

    try {
      data = JSON.parse(rawText);
    } catch {
      data = {};
    }

    if (!response.ok) {
      const openAiMessage =
        data?.error?.message ||
        data?.error?.code ||
        rawText ||
        "Unknown OpenAI API error.";

      return json(response.status, {
        error: `OpenAI error: ${openAiMessage}`,
        details: openAiMessage,
        status: response.status,
        model: getModel(),
      });
    }

    const answer = extractOutputText(data);

    return json(200, {
      success: true,
      answer:
        answer ||
        "I could not generate a response this time. Please try asking again with a clearer question.",
      model: getModel(),
      packsAvailable: PACK_KNOWLEDGE.length,
    });
  } catch (error) {
    return json(500, {
      error: `Function error: ${error.message}`,
      details: error.message,
      model: getModel(),
    });
  }
}
