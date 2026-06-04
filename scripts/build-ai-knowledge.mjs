import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const resourcesDir = path.join(rootDir, "src", "content", "resources");
const outputPath = path.join(
  rootDir,
  "netlify",
  "functions",
  "_ai-pack-knowledge.js"
);

function cleanText(value, maxLength = 18000) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function parseFrontmatter(markdown) {
  const match = String(markdown || "").match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    return {};
  }

  const fields = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);

    if (!fieldMatch) {
      continue;
    }

    const key = fieldMatch[1];
    const rawValue = fieldMatch[2].trim();

    if (!rawValue) {
      fields[key] = "";
      continue;
    }

    try {
      fields[key] = JSON.parse(rawValue);
    } catch {
      fields[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }

  return fields;
}

function resolvePublicPath(publicLink) {
  const link = String(publicLink || "").trim();

  if (!link) {
    return "";
  }

  if (link.startsWith("/")) {
    return path.join(rootDir, "public", link);
  }

  return path.join(rootDir, "public", link);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function extractDocxText(filePath) {
  if (!filePath || !filePath.toLowerCase().endsWith(".docx")) {
    return "";
  }

  if (!(await pathExists(filePath))) {
    return "";
  }

  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return cleanText(result.value, 18000);
  } catch (error) {
    console.warn(`Could not extract text from ${filePath}: ${error.message}`);
    return "";
  }
}

async function readResourceEntries() {
  if (!(await pathExists(resourcesDir))) {
    return [];
  }

  const files = await fs.readdir(resourcesDir);

  const markdownFiles = files.filter((file) => file.endsWith(".md"));
  const entries = [];

  for (const file of markdownFiles) {
    const filePath = path.join(resourcesDir, file);
    const markdown = await fs.readFile(filePath, "utf8");
    const data = parseFrontmatter(markdown);

    const slug = file.replace(/\.md$/, "");

    const studentLink =
      data.studentLink || data.student || data.downloadLink || "";

    const tutorLink = data.tutorLink || data.tutor || "";

    const studentText = await extractDocxText(resolvePublicPath(studentLink));
    const tutorText = await extractDocxText(resolvePublicPath(tutorLink));

    entries.push({
      slug,
      code: data.code || "",
      title: data.title || "",
      skill: data.skill || "",
      scenario: data.scenario || data.title || "",
      difficulty: data.difficulty || "",
      summary: data.summary || data.description || "",
      studentLink,
      tutorLink,
      studentText,
      tutorText,
    });
  }

  return entries;
}

async function main() {
  const entries = await readResourceEntries();

  const output = `// This file is generated automatically by scripts/build-ai-knowledge.mjs.
// Do not edit manually.

const PACK_KNOWLEDGE = ${JSON.stringify(entries, null, 2)};

export { PACK_KNOWLEDGE };
`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, "utf8");

  console.log(`Built AI knowledge for ${entries.length} resource packs.`);
}

main().catch((error) => {
  console.error("Failed to build AI knowledge:", error);
  process.exit(1);
});
