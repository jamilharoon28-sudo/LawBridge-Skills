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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeYaml(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");
}

async function githubRequest(url, options = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;

  if (!token) {
    throw new Error("Missing GitHub token. Add GITHUB_TOKEN to Netlify environment variables.");
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

    const code = String(body.code || "").trim();
    const title = String(body.title || "").trim();
    const skill = String(body.skill || "").trim();
    const scenario = String(body.scenario || title).trim();
    const difficulty = String(body.difficulty || "Intermediate").trim();
    const summary = String(body.summary || "").trim();
    const studentKnowledge = String(body.studentKnowledge || "").trim();
    const tutorGuidance = String(body.tutorGuidance || "").trim();

    if (!code || !title || !skill || !summary) {
      return json(400, {
        error: "Pack code, title, skill and summary are required.",
      });
    }

    const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;

    const slug = `${slugify(code)}-${slugify(title)}`;
    const filePath = `src/content/ai-knowledge/${slug}.md`;

    const markdown = `---
code: "${escapeYaml(code)}"
title: "${escapeYaml(title)}"
skill: "${escapeYaml(skill)}"
scenario: "${escapeYaml(scenario)}"
difficulty: "${escapeYaml(difficulty)}"
summary: "${escapeYaml(summary)}"
---

# ${title}

## Student Pack Knowledge

${studentKnowledge || "No student pack knowledge added yet."}

## Hidden Tutor Guidance

${tutorGuidance || "No hidden tutor guidance added yet."}
`;

    const encodedPath = filePath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

    const existing = await githubRequest(`${url}?ref=${encodeURIComponent(branch)}`);

    const payload = {
      message: `Add AI knowledge resource: ${code}`,
      content: Buffer.from(markdown, "utf8").toString("base64"),
      branch,
    };

    if (existing.status === 200 && existing.data?.sha) {
      payload.sha = existing.data.sha;
      payload.message = `Update AI knowledge resource: ${code}`;
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
    });
  } catch (error) {
    return json(500, {
      error: error.message || "Failed to create AI knowledge item.",
    });
  }
};
