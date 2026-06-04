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

    if (existing.status === 404 || !existing.data?.content) {
      return json(200, {
        success: true,
        progress: {
          studentId,
          updatedAt: null,
          packs: {},
        },
      });
    }

    const decoded = Buffer.from(existing.data.content, "base64").toString("utf8");
    const progress = JSON.parse(decoded);

    return json(200, {
      success: true,
      progress,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "Failed to load progress.",
    });
  }
};
