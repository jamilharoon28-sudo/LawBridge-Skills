import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const possibleSourceRoots = [
  path.join(rootDir, "LawBridge Course Sheets Organised"),
  path.join(rootDir, "course-sheets", "LawBridge Course Sheets Organised"),
];

const publicStudentDir = path.join(rootDir, "public", "resources", "student");
const publicTutorDir = path.join(rootDir, "public", "resources", "tutor");
const contentResourcesDir = path.join(rootDir, "src", "content", "resources");

const skillPrefixes = {
  "Advocacy": "AO",
  "Attendance Notes and Legal Analysis": "AN",
  "Case and Matter Analysis": "CMA",
  "Client Interviewing": "CI",
  "Commercial Legal Analysis": "CLA",
  "Document Review": "DR",
  "Legal Drafting": "LD",
  "Legal Research": "LR",
  "Legal Writing": "LW",
  "Negotiation Preparation": "NP",
  "Business and Financial Awareness": "BFA",
  "Client Care": "CC",
  "Communication Skills": "PC",
  "Professional Communication": "PC",
  "Time Management and Prioritisation": "TMP",
  "Teamwork and Collaboration": "TC",
  "Professional Conduct and Ethics": "PCE",
  "Workplace Readiness": "WR",
  "Networking and Relationship Building": "NRB",
  "Reflective Practice": "RP",
  "Professional Confidence": "PCO",
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function quote(value) {
  return JSON.stringify(String(value || ""));
}

function getSkillFromFilename(filename) {
  return filename.split(" - ")[0]?.trim() || "Practical Skills";
}

function getScenarioFromFilename(filename) {
  return filename
    .replace(/\.docx$/i, "")
    .replace(/\s+-\s+Student Pack$/i, "")
    .replace(/\s+-\s+Tutor Guide$/i, "")
    .split(" - ")
    .slice(1)
    .join(" - ")
    .trim();
}

function getBaseName(filename) {
  return filename
    .replace(/\.docx$/i, "")
    .replace(/\s+-\s+Student Pack$/i, "")
    .replace(/\s+-\s+Tutor Guide$/i, "")
    .trim();
}

function inferDifficulty(packNumber) {
  return packNumber === 1 ? "Foundation" : "Intermediate";
}

function inferSkillSlug(skill) {
  return slugify(skill);
}

function inferPrefix(skill) {
  return skillPrefixes[skill] || skill
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findSourceRoot() {
  for (const sourceRoot of possibleSourceRoots) {
    if (await pathExists(sourceRoot)) {
      return sourceRoot;
    }
  }

  throw new Error(
    [
      "Could not find the course sheets folder.",
      "Put the unzipped folder here:",
      "LawBridge Course Sheets Organised/",
      "or here:",
      "course-sheets/LawBridge Course Sheets Organised/",
    ].join("\n")
  );
}

async function listDocxFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".docx"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function ensureDirs() {
  await fs.mkdir(publicStudentDir, { recursive: true });
  await fs.mkdir(publicTutorDir, { recursive: true });
  await fs.mkdir(contentResourcesDir, { recursive: true });
}

async function copyFileToPublic(sourcePath, targetDir) {
  const filename = path.basename(sourcePath);
  const targetPath = path.join(targetDir, filename);
  await fs.copyFile(sourcePath, targetPath);
  return filename;
}

function buildMarkdown(pack) {
  return `---
title: ${quote(pack.title)}
code: ${quote(pack.code)}
skill: ${quote(pack.skill)}
scenario: ${quote(pack.scenario)}
difficulty: ${quote(pack.difficulty)}
summary: ${quote(pack.summary)}
category: ${quote(pack.categoryGroup)}
type: "Simulation Pack"
categoryGroup: ${quote(pack.categoryGroup)}
sheetType: "student"
skillSlug: ${quote(pack.skillSlug)}
packNumber: ${pack.packNumber}
answerRoute: ${quote(pack.answerRoute)}
studentLink: ${quote(pack.studentLink)}
tutorLink: ${quote(pack.tutorLink)}
downloadLink: ${quote(pack.studentLink)}
link: ${quote(pack.studentLink)}
---

## Student Pack

This LawBridge simulation pack helps students practise ${pack.skill} through the scenario: ${pack.scenario}.

## Tutor Guide

A paired tutor guide exists for internal teaching, review and LawBridge-supported feedback.

## Educational Use

LawBridge resources are provided for educational and training purposes only. They do not constitute legal advice and are not intended as guidance for any particular jurisdiction, legal system, regulator, court, firm policy or client matter. Students should always check the applicable law, rules and professional requirements in the relevant jurisdiction.
`;
}

async function main() {
  const sourceRoot = await findSourceRoot();
  await ensureDirs();

  const groups = [
    {
      categoryGroup: "Legal Practice Skills",
      studentDir: path.join(sourceRoot, "Legal Practice Skills", "Student Sheets"),
      tutorDir: path.join(sourceRoot, "Legal Practice Skills", "Tutor Sheets"),
    },
    {
      categoryGroup: "Professional Skills",
      studentDir: path.join(sourceRoot, "Professional Skills", "Student Sheets"),
      tutorDir: path.join(sourceRoot, "Professional Skills", "Tutor Sheets"),
    },
  ];

  const allPacks = [];

  for (const group of groups) {
    const studentFiles = await listDocxFiles(group.studentDir);
    const tutorFiles = await listDocxFiles(group.tutorDir);

    const tutorMap = new Map();

    for (const tutorFile of tutorFiles) {
      tutorMap.set(getBaseName(path.basename(tutorFile)), tutorFile);
    }

    const skillCounters = new Map();

    for (const studentFile of studentFiles) {
      const studentFilename = path.basename(studentFile);
      const baseName = getBaseName(studentFilename);
      const tutorFile = tutorMap.get(baseName);

      if (!tutorFile) {
        console.warn(`No tutor guide found for: ${studentFilename}`);
        continue;
      }

      const skill = getSkillFromFilename(studentFilename);
      const scenario = getScenarioFromFilename(studentFilename);
      const prefix = inferPrefix(skill);

      const nextNumber = (skillCounters.get(skill) || 0) + 1;
      skillCounters.set(skill, nextNumber);

      const code = `${prefix}-${String(nextNumber).padStart(2, "0")}`;
      const skillSlug = inferSkillSlug(skill);
      const slug = `${code.toLowerCase()}-${slugify(scenario)}`;

      const copiedStudent = await copyFileToPublic(studentFile, publicStudentDir);
      const copiedTutor = await copyFileToPublic(tutorFile, publicTutorDir);

      const pack = {
        code,
        title: `${skill} - ${scenario}`,
        skill,
        scenario,
        difficulty: inferDifficulty(nextNumber),
        summary: `A practical LawBridge ${skill} simulation focused on ${scenario}.`,
        categoryGroup: group.categoryGroup,
        skillSlug,
        packNumber: nextNumber,
        answerRoute: `/answer-pack?pack=${encodeURIComponent(code)}`,
        studentLink: `/resources/student/${copiedStudent}`,
        tutorLink: `/resources/tutor/${copiedTutor}`,
        slug,
      };

      allPacks.push(pack);

      const markdownPath = path.join(contentResourcesDir, `${slug}.md`);
      await fs.writeFile(markdownPath, buildMarkdown(pack), "utf8");
    }
  }

  console.log(`Imported ${allPacks.length} paired LawBridge packs.`);
  console.log(`Copied ${allPacks.length} student sheets.`);
  console.log(`Copied ${allPacks.length} tutor guides.`);
  console.log("Generated markdown entries in src/content/resources.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
