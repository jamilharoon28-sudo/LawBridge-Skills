function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function getAllowedAdminEmails() {
  return String(process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedAdmin(user) {
  const allowedEmails = getAllowedAdminEmails();
  const userEmail = String(user?.email || "").trim().toLowerCase();

  if (!userEmail || allowedEmails.length === 0) {
    return false;
  }

  return allowedEmails.includes(userEmail);
}

function requireAdmin(context) {
  const user = context.clientContext?.user;

  if (!user) {
    return {
      ok: false,
      response: json(401, {
        error: "Please sign in before making changes.",
      }),
    };
  }

  if (!isAllowedAdmin(user)) {
    return {
      ok: false,
      response: json(403, {
        error:
          "This signed-in account is not authorised to make changes. Check that ADMIN_EMAIL in Netlify matches your login email exactly.",
        signedInEmail: user.email || null,
      }),
    };
  }

  return {
    ok: true,
    user,
  };
}

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    return {
      ok: false,
      response: json(500, {
        error:
          "Missing GitHub environment variables. Check GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO and GITHUB_BRANCH in Netlify.",
      }),
    };
  }

  return {
    ok: true,
    token,
    owner,
    repo,
    branch,
  };
}

function getGitHubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function normalisePath(path) {
  return String(path || "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .trim();
}

async function getExistingFileSha({ token, owner, repo, branch, path }) {
  const cleanPath = normalisePath(path);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

  const response = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: getGitHubHeaders(token),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not read existing GitHub file: ${details}`);
  }

  const existingFile = await response.json();
  return existingFile.sha || null;
}

async function putGitHubFile({
  token,
  owner,
  repo,
  branch,
  path,
  message,
  base64Content,
}) {
  const cleanPath = normalisePath(path);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
  const sha = await getExistingFileSha({
    token,
    owner,
    repo,
    branch,
    path: cleanPath,
  });

  const body = {
    message,
    content: base64Content,
    branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: getGitHubHeaders(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not update GitHub file: ${details}`);
  }

  return response.json();
}

async function deleteGitHubFile({
  token,
  owner,
  repo,
  branch,
  path,
  message,
}) {
  const cleanPath = normalisePath(path);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
  const sha = await getExistingFileSha({
    token,
    owner,
    repo,
    branch,
    path: cleanPath,
  });

  if (!sha) {
    throw new Error("The file could not be found in GitHub.");
  }

  const response = await fetch(apiUrl, {
    method: "DELETE",
    headers: getGitHubHeaders(token),
    body: JSON.stringify({
      message,
      sha,
      branch,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not delete GitHub file: ${details}`);
  }

  return response.json();
}

async function putTextFile({
  token,
  owner,
  repo,
  branch,
  path,
  message,
  content,
}) {
  return putGitHubFile({
    token,
    owner,
    repo,
    branch,
    path,
    message,
    base64Content: Buffer.from(String(content || ""), "utf8").toString("base64"),
  });
}

async function putBase64File({
  token,
  owner,
  repo,
  branch,
  path,
  message,
  base64Content,
}) {
  return putGitHubFile({
    token,
    owner,
    repo,
    branch,
    path,
    message,
    base64Content,
  });
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeFrontmatterValue(value) {
  return JSON.stringify(String(value ?? "").replace(/\r\n/g, "\n").trim());
}

function buildFrontmatter(fields) {
  const lines = ["---"];

  Object.entries(fields || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      value.forEach((item) => {
        lines.push(`  - ${escapeFrontmatterValue(item)}`);
      });
      return;
    }

    lines.push(`${key}: ${escapeFrontmatterValue(value)}`);
  });

  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createExcerpt(value, maxLength = 180) {
  const clean = stripHtml(value);

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength).trim()}...`;
}

export {
  json,
  requireAdmin,
  getGitHubConfig,
  putTextFile,
  putBase64File,
  deleteGitHubFile,
  slugify,
  buildFrontmatter,
  createExcerpt,
};
