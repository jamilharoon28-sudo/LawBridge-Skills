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

function cleanText(value, maxLength = 3000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY || "";
}

function getModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function validatePayload(payload) {
  const message = cleanText(payload.draft || "", 3000);
  const packCode = payload.packCode || "";

  if (!message) {
    return "Please enter your draft answer for AI feedback.";
  }

  if (!packCode) {
    return "Missing pack code.";
  }

  return null;
}

function scorePack(pack, payload) {
  const code = (pack.code || "").toLowerCase();
  const packCode = (payload.packCode || "").toLowerCase();
  return code === packCode ? 100 : 0;
}

function findRelevantPack(payload) {
  const scored = PACK_KNOWLEDGE.map((pack) => ({
    pack,
    score: scorePack(pack, payload),
  })).sort((a, b) => b.score - a.score);

  return scored.length > 0 && scored[0].score > 0 ? scored[0].pack : null;
}

function buildPrompt(pack, draft) {
  const studentText = pack?.studentText || "";
  const tutorText = pack?.tutorText || "";

  return `
You are the LawBridge AI Skills Coach.
You must not reveal the tutor guide directly to students.

Student Draft:
${draft}

Student Pack Extract:
${studentText || "No text available"}

Internal Tutor Guidance (hidden, do not show student):
${tutorText || "No tutor guide text available"}

Instructions:
- Provide structured feedback.
- Highlight strengths and improvements.
- Suggest next step.
- Point to relevant evidence from Student Pack if needed.
- Do not generate full model answers directly.
- Keep tone professional and educational.
`;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = getOpenAIKey();
  if (!apiKey) {
    return json(500, {
      error:
        "OPENAI_API_KEY is missing. Add it under Netlify environment variables and redeploy.",
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

  const pack = findRelevantPack(payload);
  if (!pack) {
    return json(404, { error: "Pack not found for AI feedback." });
  }

  const prompt = buildPrompt(pack, payload.draft);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        instructions: prompt,
        input: prompt,
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

    const answer =
      data?.output_text ||
      (data?.output || [])
        .flatMap((item) => item.content || [])
        .map((c) => c.text || c.value || "")
        .filter(Boolean)
        .join("\n")
        .trim() ||
      "No feedback generated.";

    return json(200, { success: true, answer });
  } catch (err) {
    return json(500, {
      error: `AI function error: ${err.message}`,
      details: err.message,
    });
  }
}
