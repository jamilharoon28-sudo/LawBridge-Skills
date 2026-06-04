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

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY || "";
}

function getModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
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

function buildPrompt(payload) {
  const packCode = cleanText(payload.packCode, 80);
  const scenario = cleanText(payload.scenario, 200);
  const skill = cleanText(payload.skill, 160);
  const mode = cleanText(payload.mode, 80) || "Ask Anything";
  const message = cleanText(payload.message, 3000);

  const packLabel =
    packCode || scenario || skill
      ? `${packCode ? `Code: ${packCode}\n` : ""}${scenario ? `Scenario: ${scenario}\n` : ""}${skill ? `Skill: ${skill}\n` : ""}`
      : "No specific pack selected. The student is asking about LawBridge practical skills generally.\n";

  return `
Selected LawBridge Student Pack:
${packLabel}

Support mode:
${mode}

Student question:
${message}

Important:
For this first version, you do not yet have the full Student Pack or Tutor Guide text connected. Give helpful educational guidance based only on the pack title, skill area, scenario, and the student's question. Do not pretend you have read exhibits, clauses, emails, logs, tutor notes, or model answers unless they are provided in the student's message.
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
- If the student asks about evidence, explain what types of evidence they should look for, but do not invent document references.
- If you do not have enough pack-specific information, say so honestly and explain what the student should check in the Student Pack.

Tone:
Premium, clear, supportive, practical, and educational.
`;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = getOpenAIKey();

  if (!apiKey) {
    return json(500, {
      error:
        "The LawBridge AI Skills Coach is not connected yet. Add OPENAI_API_KEY in Netlify environment variables.",
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
        max_output_tokens: 900,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return json(response.status, {
        error: "The AI request failed.",
        details: data?.error?.message || "Unknown OpenAI API error.",
      });
    }

    const answer = extractOutputText(data);

    return json(200, {
      success: true,
      answer:
        answer ||
        "I could not generate a response this time. Please try asking again with a clearer question.",
      model: getModel(),
    });
  } catch (error) {
    return json(500, {
      error: "The LawBridge AI Skills Coach could not respond.",
      details: error.message,
    });
  }
}
