const fs = require("fs");
const path = require("path");

const dataDir = path.join(process.cwd(), "src", "content", "progress");

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
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

async function readProgress(studentId) {
  const filePath = path.join(dataDir, `${studentId}.json`);

  if (!fs.existsSync(filePath)) {
    return { studentId, packs: {} };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const progress = JSON.parse(raw);
    return progress;
  } catch (err) {
    console.warn("Failed to read progress file:", err);
    return { studentId, packs: {} };
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const studentId = safeKey(body.studentId || "guest-student");

    const progress = await readProgress(studentId);

    return json(200, { success: true, progress });
  } catch (error) {
    return json(500, { error: error.message || "Failed to load progress." });
  }
};
