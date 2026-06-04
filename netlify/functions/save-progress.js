const fs = require("fs");
const path = require("path");

const dataPath = path.join(process.cwd(), "src", "content", "progress.json");

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function readProgress() {
  try {
    if (!fs.existsSync(dataPath)) return {};
    const raw = fs.readFileSync(dataPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeProgress(progress) {
  fs.writeFileSync(dataPath, JSON.stringify(progress, null, 2), "utf8");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON." });
  }

  const { studentId, packCode, status } = payload;

  if (!studentId || !packCode || !status) {
    return json(400, { error: "Missing required fields: studentId, packCode, status" });
  }

  const progress = await readProgress();

  if (!progress[studentId]) progress[studentId] = {};
  progress[studentId][packCode] = status;

  await writeProgress(progress);

  return json(200, { success: true, progress: progress[studentId] });
};
