import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const resourcesDir = path.join(rootDir, "src", "content", "resources");
const aiKnowledgeDir = path.join(rootDir, "src", "content", "ai-knowledge");

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

function removeFrontmatter(markdown) {
  return String(markdown || "").replace(/^---\n[\s\S]*?\n---/, "").trim();
}

function extractSection(markdownBody, heading) {
  const text = String(markdownBody || "");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex = new RegExp(
    `##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
    "i"
  );

  const match = text.match(regex);

  return cleanText(match?.[1] || "", 18000);
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
    console.warn(`Could not extract DOCX text from ${filePath}: ${error.message}`);
    return "";
  }
}

async function extractPdfText(filePath) {
  if (!filePath || !filePath.toLowerCase().endsWith(".pdf")) {
    return "";
  }

  if (!(await pathExists(filePath))) {
    return "";
  }

  try {
    const buffer = await fs.readFile(filePath);
    const result = await pdfParse(buffer);
    return cleanText(result.text, 18000);
  } catch (error) {
    console.warn(`Could not extract PDF text from ${filePath}: ${error.message}`);
    return "";
  }
}

async function extractPackText(publicLink) {
  const filePath = resolvePublicPath(publicLink);

  if (!filePath) {
    return "";
  }

  if (filePath.toLowerCase().endsWith(".docx")) {
    return extractDocxText(filePath);
  }

  if (filePath.toLowerCase().endsWith(".pdf")) {
    return extractPdfText(filePath);
  }

  return "";
}

function inferCategoryGroup(skill) {
  const normalised = String(skill || "").toLowerCase();

  const professionalSkills = [
    "client care",
    "professional communication",
    "time management",
    "prioritisation",
    "teamwork",
    "collaboration",
    "professional conduct",
    "ethics",
    "business and financial awareness",
    "workplace readiness",
    "networking",
    "relationship",
    "reflective practice",
    "professional confidence",
  ];

  return professionalSkills.some((item) => normalised.includes(item))
    ? "Professional Skills"
    : "Legal Practice Skills";
}

function inferSkillSlug(skill) {
  return String(skill || "practical-skills")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractNumberedTaskLines(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const match = line.match(/^(\d{1,2})[\.\)]\s+(.+)$/);
      if (!match) {
        return null;
      }

      return {
        number: Number(match[1]),
        text: match[2].trim(),
      };
    })
    .filter(Boolean);
}

function extractTasksFromStudentText(studentText) {
  const text = String(studentText || "");

  const practiceSectionMatch =
    text.match(/Detailed Practice Tasks\s*([\s\S]*?)(?=Working Method|Exhibit Index|Clause and Fact Extraction Grid|Final Student Submission Checklist|Reflection Questions|$)/i) ||
    text.match(/Student Practice Tasks\s*([\s\S]*?)(?=Required Submission Bundle|Detailed Practice Tasks|Working Method|Exhibit Index|Final Student Submission Checklist|$)/i);

  const sourceText = practiceSectionMatch?.[1] || text;
  const numberedTasks = extractNumberedTaskLines(sourceText).slice(0, 12);

  if (numberedTasks.length > 0) {
    return numberedTasks.map((task) => ({
      id: `task-${task.number}`,
      title: task.text,
      instructions:
        "Write your answer in plain English. Use the pack evidence, identify any missing information, and avoid unsupported conclusions.",
    }));
  }

  return [
    {
      id: "task-1",
      title: "Identify the main issue",
      instructions:
        "Explain the main practical issue in the pack. Refer to the relevant facts, documents or exhibits where possible.",
    },
    {
      id: "task-2",
      title: "List the key facts and evidence",
      instructions:
        "Separate confirmed facts, disputed facts, assumptions and missing information.",
    },
    {
      id: "task-3",
      title: "Prepare the required output",
      instructions:
        "Draft the main student output requested by the pack using clear structure and practical reasoning.",
    },
    {
      id: "task-4",
      title: "Identify missing information",
      instructions:
        "List the further documents, facts, dates, clauses or evidence you would request before giving a final view.",
    },
    {
      id: "task-5",
      title: "Write a short reflection",
      instructions:
        "Reflect on what changed your view of the matter and what you would escalate to a supervisor.",
    },
  ];
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
      data.studentLink ||
      data.student ||
      data.studentPack ||
      data.downloadLink ||
      data.file ||
      "";

    const tutorLink =
      data.tutorLink ||
      data.tutor ||
      data.tutorGuide ||
      "";

    const studentText = await extractPackText(studentLink);
    const tutorText = await extractPackText(tutorLink);
    const skill = data.skill || "Practical Skills";
    const categoryGroup = data.categoryGroup || inferCategoryGroup(skill);

    entries.push({
      source: "resources",
      slug,
      code: data.code || "",
      title: data.title || "",
      skill,
      skillSlug: data.skillSlug || inferSkillSlug(skill),
      categoryGroup,
      sheetType: data.sheetType || "Student",
      scenario: data.scenario || data.title || "",
      difficulty: data.difficulty || "",
      summary: data.summary || data.description || "",
      studentLink,
      tutorLink,
      studentText,
      tutorText,
      tasks: extractTasksFromStudentText(studentText),
      studentTextSource: studentLink.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : studentLink.toLowerCase().endsWith(".docx")
          ? "docx"
          : "",
      tutorTextSource: tutorLink.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : tutorLink.toLowerCase().endsWith(".docx")
          ? "docx"
          : "",
    });
  }

  return entries;
}

async function readAiKnowledgeEntries() {
  if (!(await pathExists(aiKnowledgeDir))) {
    return [];
  }

  const files = await fs.readdir(aiKnowledgeDir);
  const markdownFiles = files.filter(
    (file) => file.endsWith(".md") && !file.startsWith(".")
  );

  const entries = [];

  for (const file of markdownFiles) {
    const filePath = path.join(aiKnowledgeDir, file);
    const markdown = await fs.readFile(filePath, "utf8");
    const data = parseFrontmatter(markdown);
    const body = removeFrontmatter(markdown);

    const slug = file.replace(/\.md$/, "");

    const studentText =
      extractSection(body, "Student Pack Knowledge") ||
      extractSection(body, "Student Knowledge") ||
      "";

    const tutorText =
      extractSection(body, "Hidden Tutor Guidance") ||
      extractSection(body, "Tutor Guidance") ||
      "";

    const skill = data.skill || "Practical Skills";
    const categoryGroup = data.categoryGroup || inferCategoryGroup(skill);

    entries.push({
      source: "ai-knowledge",
      slug,
      code: data.code || "",
      title: data.title || "",
      skill,
      skillSlug: data.skillSlug || inferSkillSlug(skill),
      categoryGroup,
      sheetType: data.sheetType || "Student",
      scenario: data.scenario || data.title || "",
      difficulty: data.difficulty || "",
      summary: data.summary || data.description || "",
      studentLink: "",
      tutorLink: "",
      studentText,
      tutorText,
      tasks: extractTasksFromStudentText(studentText),
      studentTextSource: "markdown",
      tutorTextSource: "markdown",
    });
  }

  return entries;
}

function mergeEntries(resourceEntries, aiKnowledgeEntries) {
  const merged = new Map();

  for (const entry of resourceEntries) {
    const key = entry.code || entry.slug;
    merged.set(key, entry);
  }

  for (const entry of aiKnowledgeEntries) {
    const key = entry.code || entry.slug;
    const existing = merged.get(key);

    merged.set(key, {
      ...(existing || {}),
      ...entry,
      studentText: entry.studentText || existing?.studentText || "",
      tutorText: entry.tutorText || existing?.tutorText || "",
      tasks:
        Array.isArray(entry.tasks) && entry.tasks.length > 0
          ? entry.tasks
          : existing?.tasks || [],
      source: existing ? `${existing.source}+ai-knowledge` : "ai-knowledge",
    });
  }

  return [...merged.values()];
}

async function main() {
  const resourceEntries = await readResourceEntries();
  const aiKnowledgeEntries = await readAiKnowledgeEntries();

  const entries = mergeEntries(resourceEntries, aiKnowledgeEntries);

  const output = `// This file is generated automatically by scripts/build-ai-knowledge.mjs.
// Do not edit manually.

const PACK_KNOWLEDGE = ${JSON.stringify(entries, null, 2)};

export { PACK_KNOWLEDGE };
`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, "utf8");

  console.log(
    `Built AI knowledge for ${entries.length} packs. ` +
      `Resources: ${resourceEntries.length}. ` +
      `AI knowledge files: ${aiKnowledgeEntries.length}.`
  );
}

main().catch((error) => {
  console.error("Failed to build AI knowledge:", error);
  process.exit(1);
});
