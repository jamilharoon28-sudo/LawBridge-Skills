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

function cleanText(value, maxLength = 12000) {
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

function getPackCodeFromEvent(event) {
  if (event.httpMethod === "GET") {
    return event.queryStringParameters?.pack || event.queryStringParameters?.packCode || "";
  }

  try {
    const body = JSON.parse(event.body || "{}");
    return body.pack || body.packCode || "";
  } catch {
    return "";
  }
}

function findPack(packCode) {
  const wanted = normalise(packCode);

  if (!wanted) {
    return null;
  }

  return (
    PACK_KNOWLEDGE.find((pack) => normalise(pack.code) === wanted) ||
    PACK_KNOWLEDGE.find((pack) => normalise(pack.slug) === wanted) ||
    null
  );
}

function fallbackTasks() {
  return [
    {
      id: "task-1",
      title: "Identify the main issue",
      instructions:
        "Explain the main practical issue in the pack. Refer to the relevant facts, documents or exhibits where possible.",
    },
    {
      id: "task-2",
      title: "List the key facts and evidence",
      instructions:
        "Separate confirmed facts, disputed facts, assumptions and missing information.",
    },
    {
      id: "task-3",
      title: "Prepare the required output",
      instructions:
        "Draft the main student output requested by the pack using clear structure and practical reasoning.",
    },
    {
      id: "task-4",
      title: "Identify missing information",
      instructions:
        "List the further documents, facts, dates, clauses or evidence you would request before giving a final view.",
    },
    {
      id: "task-5",
      title: "Write a short reflection",
      instructions:
        "Reflect on what changed your view of the matter and what you would escalate to a supervisor.",
    },
  ];
}

export async function handler(event) {
  if (!["GET", "POST"].includes(event.httpMethod)) {
    return json(405, { error: "Method not allowed." });
  }

  const packCode = getPackCodeFromEvent(event);
  const pack = findPack(packCode);

  if (!pack) {
    return json(404, {
      error: "Pack not found.",
      packCode,
      packsAvailable: PACK_KNOWLEDGE.length,
    });
  }

  const tasks =
    Array.isArray(pack.tasks) && pack.tasks.length > 0 ? pack.tasks : fallbackTasks();

  return json(200, {
    success: true,
    pack: {
      code: pack.code || "",
      slug: pack.slug || "",
      title: pack.title || pack.scenario || "LawBridge simulation pack",
      scenario: pack.scenario || pack.title || "LawBridge simulation pack",
      skill: pack.skill || "Practical Skills",
      skillSlug: pack.skillSlug || "",
      categoryGroup: pack.categoryGroup || "Legal Practice Skills",
      sheetType: pack.sheetType || "Student",
      difficulty: pack.difficulty || "Intermediate",
      summary: pack.summary || "",
      studentLink: pack.studentLink || "",
      tasks,
      studentPreview: cleanText(pack.studentText, 2200),
    },
  });
}
