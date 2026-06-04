import { PACK_KNOWLEDGE } from "./_ai-pack-knowledge.js";

const DEFAULT_OWNER = "jamilharoon28-sudo";
const DEFAULT_REPO = "LawBridge-Skills";
const DEFAULT_BRANCH = "main";

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

function getCompletionPercent(progressEntry) {
  const answeredCount = Number(progressEntry?.answeredCount || 0);
  const answerCount = Number(progressEntry?.answerCount || 0);

  if (!answerCount || answerCount <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((answeredCount / answerCount) * 100));
}

function cleanPack(pack, progressEntry = {}) {
  const code = pack.code || "";

  return {
    code,
    title: pack.scenario || pack.title || "LawBridge simulation pack",
    skill: pack.skill || "Practical Skills",
    difficulty: pack.difficulty || "Intermediate",
    summary: pack.summary || "",
    slug: pack.slug || "",
    status: normaliseStatus(progressEntry.status),
    answeredCount: Number(progressEntry.answeredCount || 0),
    answerCount: Number(progressEntry.answerCount || pack.tasks?.length || 0),
    completionPercent: getCompletionPercent({
      answeredCount: progressEntry.answeredCount || 0,
      answerCount: progressEntry.answerCount || pack.tasks?.length || 0,
    }),
    answerRoute:
      progressEntry.answerRoute ||
      `/answer-pack?pack=${encodeURIComponent(code)}`,
  };
}

async function githubRequest(url, options = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;

  if (!token) {
    return {
      status: 404,
      data: {},
    };
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok && response.status !== 404) {
    throw new Error(data.message || `GitHub request failed with status ${response.status}`);
  }

  return {
    status: response.status,
    data,
  };
}

async function loadProgress(studentId) {
  const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;

  const filePath = `src/content/progress/${safeKey(studentId || "guest-student")}.json`;
  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;

  const existing = await githubRequest(url);

  if (existing.status !== 200 || !existing.data?.content) {
    return {
      studentId,
      packs: {},
      summary: {},
    };
  }

  const decoded = Buffer.from(existing.data.content, "base64").toString("utf8");
  return JSON.parse(decoded);
}

function recommendNextPack(allPacks, progress) {
  const packs = Array.isArray(allPacks) ? allPacks : [];
  const progressPacks = progress?.packs || progress || {};

  const cleanPacks = packs
    .filter((pack) => pack?.code || pack?.title || pack?.scenario)
    .map((pack) => {
      const code = pack.code || "";
      return cleanPack(pack, progressPacks[code] || {});
    });

  const inProgressPacks = cleanPacks
    .filter((pack) => normaliseStatus(pack.status) === "In progress")
    .sort((a, b) => b.completionPercent - a.completionPercent);

  if (inProgressPacks.length > 0) {
    return inProgressPacks[0];
  }

  const submittedPacks = cleanPacks
    .filter((pack) => normaliseStatus(pack.status) === "Submitted for AI Check")
    .sort((a, b) => b.completionPercent - a.completionPercent);

  if (submittedPacks.length > 0) {
    return submittedPacks[0];
  }

  const notStartedPack = cleanPacks.find(
    (pack) => normaliseStatus(pack.status) === "Not started"
  );

  if (notStartedPack) {
    return notStartedPack;
  }

  const incompletePack = cleanPacks.find(
    (pack) => normaliseStatus(pack.status) !== "Completed"
  );

  if (incompletePack) {
    return incompletePack;
  }

  return cleanPacks[0] || null;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const studentId = safeKey(body.studentId || "guest-student");

    const progress = body.progress || (await loadProgress(studentId));
    const nextPack = recommendNextPack(PACK_KNOWLEDGE, progress);

    return json(200, {
      success: true,
      nextPack,
      packsAvailable: PACK_KNOWLEDGE.length,
      progressSummary: progress.summary || {},
    });
  } catch (error) {
    return json(500, {
      error: error.message || "Failed to compute next pack.",
    });
  }
}
