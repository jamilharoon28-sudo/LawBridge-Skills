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

function safeKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseStatus(value) {
  return String(value || "Not started").trim();
}

function recommendNextPack(allPacks, progress) {
  const packs = Array.isArray(allPacks) ? allPacks : [];
  const progressPacks = progress?.packs || progress || {};

  const cleanPacks = packs
    .filter((pack) => pack?.code || pack?.title || pack?.scenario)
    .map((pack) => ({
      code: pack.code || "",
      title: pack.scenario || pack.title || "LawBridge simulation pack",
      skill: pack.skill || "Practical Skills",
      difficulty: pack.difficulty || "Intermediate",
      summary: pack.summary || "",
      slug: pack.slug || "",
    }));

  for (const pack of cleanPacks) {
    const status = normaliseStatus(progressPacks[pack.code]?.status);
    if (status === "Not started") {
      return pack;
    }
  }

  for (const pack of cleanPacks) {
    const status = normaliseStatus(progressPacks[pack.code]?.status);
    if (status === "In progress") {
      return pack;
    }
  }

  return cleanPacks[0] || null;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    safeKey(body.studentId || "guest-student");

    const nextPack = recommendNextPack(PACK_KNOWLEDGE, {});

    return json(200, {
      success: true,
      nextPack,
      packsAvailable: PACK_KNOWLEDGE.length,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "Failed to compute next pack.",
    });
  }
}
