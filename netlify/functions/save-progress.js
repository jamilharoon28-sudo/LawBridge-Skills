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

function cleanText(value) {
  return String(value || "").trim();
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function removeEmptyFields(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    })
  );
}

async function githubRequest(url, options = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;

  if (!token) {
    throw new Error("Missing GitHub token.");
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

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const studentId = safeKey(body.studentId || "guest-student");
    const packCode = cleanText(body.packCode);
    const now = new Date().toISOString();

    if (!packCode) {
      return json(400, { error: "Missing packCode." });
    }

    const status = cleanText(body.status || "In progress");
    const mode = cleanText(body.mode || "");
    const packTitle = cleanText(body.packTitle);
    const skill = cleanText(body.skill);
    const category = cleanText(body.category || body.categoryGroup);
    const difficulty = cleanText(body.difficulty);
    const answerRoute = cleanText(body.answerRoute || `/answer-pack?pack=${encodeURIComponent(packCode)}`);

    const answers = Array.isArray(body.answers) ? body.answers : [];
    const answerCount = cleanNumber(body.answerCount || answers.length);
    const answeredCount =
      body.answeredCount !== undefined
        ? cleanNumber(body.answeredCount)
        : answers.filter((item) => cleanText(item?.answer).length > 0).length;

    const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;

    const filePath = `src/content/progress/${studentId}.json`;
    const encodedPath = filePath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

    const existing = await githubRequest(`${url}?ref=${encodeURIComponent(branch)}`);

    let progress = {
      studentId,
      updatedAt: now,
      latestPackCode: packCode,
      packs: {},
    };

    if (existing.status === 200 && existing.data?.content) {
      const decoded = Buffer.from(existing.data.content, "base64").toString("utf8");
      progress = JSON.parse(decoded);
    }

    progress.studentId = studentId;
    progress.updatedAt = now;
    progress.latestPackCode = packCode;
    progress.packs = progress.packs || {};

    const previousPack = progress.packs[packCode] || {};

    const timestampFields = {};

    if (status === "In progress") {
      timestampFields.lastOpenedAt = previousPack.lastOpenedAt || now;
      timestampFields.draftSavedAt = now;
    }

    if (status === "Submitted for AI Check") {
      timestampFields.submittedAt = now;
    }

    if (status === "Completed") {
      timestampFields.completedAt = now;
    }

    const nextPackRecord = removeEmptyFields({
      ...previousPack,
      packCode,
      packTitle: packTitle || previousPack.packTitle,
      skill: skill || previousPack.skill,
      category: category || previousPack.category,
      categoryGroup: category || previousPack.categoryGroup,
      difficulty: difficulty || previousPack.difficulty,
      answerRoute: answerRoute || previousPack.answerRoute,
      mode: mode || previousPack.mode,
      status,
      answerCount: answerCount || previousPack.answerCount,
      answeredCount: answeredCount || previousPack.answeredCount,
      feedbackSummary: body.feedbackSummary || previousPack.feedbackSummary,
      updatedAt: now,
      ...timestampFields,
    });

    progress.packs[packCode] = nextPackRecord;

    const allPacks = Object.values(progress.packs);

    progress.summary = {
      totalStarted: allPacks.length,
      inProgress: allPacks.filter((pack) => pack.status === "In progress").length,
      submittedForAiCheck: allPacks.filter((pack) => pack.status === "Submitted for AI Check").length,
      completed: allPacks.filter((pack) => pack.status === "Completed").length,
      latestPackCode: packCode,
      latestStatus: status,
      updatedAt: now,
    };

    const payload = {
      message: `Update progress for ${studentId}`,
      content: Buffer.from(JSON.stringify(progress, null, 2), "utf8").toString("base64"),
      branch,
    };

    if (existing.status === 200 && existing.data?.sha) {
      payload.sha = existing.data.sha;
    }

    await githubRequest(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return json(200, {
      success: true,
      path: filePath,
      progress,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "Failed to save progress.",
    });
  }
};
