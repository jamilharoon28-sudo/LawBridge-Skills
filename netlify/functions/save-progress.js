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
    const packCode = String(body.packCode || "").trim();
    const packTitle = String(body.packTitle || "").trim();
    const skill = String(body.skill || "").trim();
    const status = String(body.status || "In progress").trim();
    const mode = String(body.mode || "").trim();

    if (!packCode) {
      return json(400, { error: "Missing packCode." });
    }

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
      updatedAt: new Date().toISOString(),
      packs: {},
    };

    if (existing.status === 200 && existing.data?.content) {
      const decoded = Buffer.from(existing.data.content, "base64").toString("utf8");
      progress = JSON.parse(decoded);
    }

    progress.studentId = studentId;
    progress.updatedAt = new Date().toISOString();
    progress.packs = progress.packs || {};

    progress.packs[packCode] = {
      packCode,
      packTitle,
      skill,
      status,
      mode,
      updatedAt: new Date().toISOString(),
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
