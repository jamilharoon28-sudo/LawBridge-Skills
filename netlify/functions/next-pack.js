const fs = require("fs");
const path = require("path");

const dataDir = path.join(process.cwd(), "src/content/progress");
const packsDir = path.join(process.cwd(), "src/content/ai-knowledge");

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

// Load all packs
function loadAllPacks() {
  if (!fs.existsSync(packsDir)) return [];
  const files = fs.readdirSync(packsDir).filter((f) => f.endsWith(".md"));
  return files.map((file) => {
    const content = fs.readFileSync(path.join(packsDir, file), "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    let code = "";
    let title = "";
    if (match) {
      const front = match[1];
      code = (front.match(/code:\s*"(.*?)"/) || [])[1] || "";
      title = (front.match(/title:\s*"(.*?)"/) || [])[1] || "";
    }
    return { code, title, file };
  });
}

// Load student progress
function loadProgress(studentId) {
  const filePath = path.join(dataDir, `${studentId}.json`);
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw).packs || {};
  } catch {
    return {};
  }
}

// Recommend next pack
function recommendNextPack(allPacks, progress) {
  // 1. First pick: any Not started
  for (const pack of allPacks) {
    const status = progress[pack.code]?.status || "Not started";
    if (status === "Not started") return pack;
  }
  // 2. Next: pick In progress
  for (const pack of allPacks) {
    const status = progress[pack.code]?.status || "Not started";
    if (status === "In progress") return pack;
  }
  // 3. Default: pick first pack
  return allPacks[0] || null;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const studentId = safeKey(body.studentId || "guest-student");

    const allPacks = loadAllPacks();
    const progress = loadProgress(studentId);

    const nextPack = recommendNextPack(allPacks, progress);

    return json(200, { success: true, nextPack });
  } catch (error) {
    return json(500, { error: error.message || "Failed to compute next pack." });
  }
};
