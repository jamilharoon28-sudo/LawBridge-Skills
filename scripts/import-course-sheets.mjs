import fs from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";

const zipPath = "./LawBridge_All_Course_Sheets_Organised(2).zip"; // make sure this matches your ZIP name in the repo root
const rootDir = path.resolve("./"); // repo root
const publicStudentDir = path.join(rootDir, "public/resources/student");
const publicTutorDir = path.join(rootDir, "public/resources/tutor");
const contentResourcesDir = path.join(rootDir, "src/content/resources");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBaseName(filename) {
  return filename
    .replace(/\.docx$/i, "")
    .replace(/\s+-\s+Student Pack$/i, "")
    .replace(/\s+-\s+Tutor Guide$/i, "")
    .trim();
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

async function ensureDirs() {
  await fs.mkdir(publicStudentDir, { recursive: true });
  await fs.mkdir(publicTutorDir, { recursive: true });
  await fs.mkdir(contentResourcesDir, { recursive: true });
}

async function extractZip() {
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: rootDir }))
    .promise();
}

async function copyAndGenerateMarkdown(studentFile, tutorFile, skill, scenario, code, packNumber, categoryGroup) {
  const studentDest = path.join(publicStudentDir, path.basename(studentFile));
  const tutorDest = path.join(publicTutorDir, path.basename(tutorFile));

  await fs.copyFile(studentFile, studentDest);
  await fs.copyFile(tutorFile, tutorDest);

  const slug = `${code.toLowerCase()}-${slugify(scenario)}`;
  const mdPath = path.join(contentResourcesDir, `${slug}.md`);
  const markdown = `---
title: "${skill} - ${scenario}"
code: "${code}"
skill: "${skill}"
scenario: "${scenario}"
difficulty: "${packNumber === 1 ? "Foundation" : "Intermediate"}"
categoryGroup: "${categoryGroup}"
sheetType: "student"
answerRoute: "/answer-pack?pack=${code}"
studentLink: "/resources/student/${path.basename(studentFile)}"
tutorLink: "/resources/tutor/${path.basename(tutorFile)}"
---

## Student Pack

This LawBridge simulation pack helps students practise ${skill} through the scenario: ${scenario}.

## Tutor Guide

A paired tutor guide exists for internal teaching, review and LawBridge-supported feedback.

## Educational Use

LawBridge resources are provided for educational and training purposes only. They do not constitute legal advice and are not intended as guidance for any particular jurisdiction. Students should always check the applicable law, rules and professional requirements in the relevant jurisdiction.
`;
  await fs.writeFile(mdPath, markdown, "utf8");
}

async function main() {
  console.log("Ensuring directories exist...");
  await ensureDirs();

  console.log("Extracting ZIP...");
  await extractZip();

  const categories = ["Legal Practice Skills", "Professional Skills"];

  let allPacks = [];

  for (const category of categories) {
    const studentDir = path.join(rootDir, `LawBridge Course Sheets Organised/${category}/Student Sheets`);
    const tutorDir = path.join(rootDir, `LawBridge Course Sheets Organised/${category}/Tutor Sheets`);

    const studentFiles = (await fs.readdir(studentDir)).filter(f => f.toLowerCase().endsWith(".docx"));
    const tutorFiles = (await fs.readdir(tutorDir)).filter(f => f.toLowerCase().endsWith(".docx"));

    const tutorMap = new Map(tutorFiles.map(f => [getBaseName(f), f]));

    let skillCounters = new Map();

    for (const studentFileName of studentFiles) {
      const baseName = getBaseName(studentFileName);
      const tutorFileName = tutorMap.get(baseName);

      if (!tutorFileName) {
        console.warn(`No tutor guide found for: ${studentFileName}`);
        continue;
      }

      const skill = getSkillFromFilename(studentFileName);
      const scenario = getScenarioFromFilename(studentFileName);

      const count = (skillCounters.get(skill) || 0) + 1;
      skillCounters.set(skill, count);

      const prefix = skill[0].toUpperCase() + skill[1] || "LB";
      const code = `${prefix}-${String(count).padStart(2, "0")}`;

      await copyAndGenerateMarkdown(
        path.join(studentDir, studentFileName),
        path.join(tutorDir, tutorFileName),
        skill,
        scenario,
        code,
        count,
        category
      );

      allPacks.push({ skill, scenario, code });
    }
  }

  console.log(`Imported ${allPacks.length} LawBridge packs.`);
}

main().catch(err => console.error(err));
