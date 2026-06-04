import OpenAI from "openai";
import { PACK_KNOWLEDGE } from "./_ai-pack-knowledge.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handler(event, context) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { mode, message, answers, packCode, scenario, skill } = body;

    if (!mode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing mode in request body" }),
      };
    }

    // ---------- Mode: Check Pack Submission ----------
    if (mode === "Check Pack Submission") {
      if (!answers || !Array.isArray(answers) || !packCode) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error:
              "Missing answers array or packCode for Check Pack Submission mode",
          }),
        };
      }

      // Find pack in AI knowledge
      const pack = PACK_KNOWLEDGE.find((p) => p.code === packCode);
      if (!pack) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `Pack ${packCode} not found` }),
        };
      }

      // Build prompt for AI feedback
      const prompt = `
You are the LawBridge AI Skills Coach.
A student has submitted answers for pack "${pack.title}" (${pack.code}), skill: "${pack.skill}".

Student answers:
${answers
  .map(
    (a, i) =>
      `Task ${i + 1}: ${a.answer ? a.answer : "[No answer provided]"}`
  )
  .join("\n")}

Student-safe content: ${pack.studentText || "N/A"}
Tutor guide (hidden): ${pack.tutorText || "N/A"}

Provide structured educational feedback ONLY. DO NOT reveal tutor guide or give legal advice.
Return JSON with the following keys:
- strengths
- improvements
- missingEvidence
- structureSuggestions
- claritySuggestions
- nextStep
      `;

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an educational AI coach for practical legal skills. Always be professional and encouraging.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      });

      const rawResponse =
        completion.choices?.[0]?.message?.content || "{}";

      let feedback;
      try {
        feedback = JSON.parse(rawResponse);
      } catch (err) {
        // fallback if AI returns non-JSON
        feedback = { raw: rawResponse };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ feedback }),
      };
    }

    // ---------- Existing chat / message mode ----------
    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing message for chat mode" }),
      };
    }

    // For other chat modes, existing logic preserved
    const chatPrompt = `
You are the LawBridge AI Skills Coach.
Student message: ${message}
Provide educational guidance only.
Do not give legal advice or jurisdiction-specific answers.
    `;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an educational AI coach for practical legal skills. Always be professional and encouraging.",
        },
        { role: "user", content: chatPrompt },
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    const chatResponse =
      chatCompletion.choices?.[0]?.message?.content || "";

    return {
      statusCode: 200,
      body: JSON.stringify({ response: chatResponse }),
    };
  } catch (error) {
    console.error("AI Skills Coach Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
