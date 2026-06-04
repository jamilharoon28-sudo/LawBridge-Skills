import mammoth from "mammoth";
import {
  json,
  requireAdmin,
  getGitHubConfig,
  putTextFile,
  putBase64File,
  slugify,
  buildFrontmatter,
  createExcerpt,
} from "./_github.js";

const ALLOWED_EXTENSIONS = [".docx", ".pdf"];

function getBase64Payload(fileBase64) {
  const raw = String(fileBase64 || "");

  if (raw.includes(",")) {
    return raw.split(",").pop();
  }

  return raw;
}

function getFileExtension(fileName) {
  const match = String(fileName || "").toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function isAllowedFile(fileName) {
  return ALLOWED_EXTENSIONS.includes(getFileExtension(fileName));
}

function getSafeFileName({ code, title, packType, originalFileName }) {
  const extension = getFileExtension(originalFileName);
  const codePart = slugify(code);
  const titlePart = slugify(title);
  const packPart = slugify(packType);

  const baseName = [codePart, titlePart, packPart]
    .filter(Boolean)
    .join("-")
    .slice(0, 120);

  return `${baseName || `resource-${Date.now()}`}${extension}`;
}

function validatePayload(payload) {
  const title = String(payload.title || "").trim();
  const code = String(payload.code || "").trim();
  const skill = String(payload.skill || "").trim();
  const scenario = String(payload.scenario || "").trim();
  const difficulty = String(payload.difficulty || "").trim();

  const studentFileName = String(payload.studentFileName || "").trim();
  const studentFileBase64 = String(payload.studentFileBase64 || "").trim();

  const tutorFileName = String(payload.tutorFileName || "").trim();
  const tutorFileBase64 = String(payload.tutorFileBase64 || "").trim();

  if (!title) {
    return "Please enter a resource title.";
  }

  if (!code) {
    return "Please enter a resource code, for example CI-01 or AO-02.";
  }

  if (!skill) {
    return "Please choose or enter a skill area.";
  }

  if (!scenario) {
    return "Please enter the scenario title.";
  }

  if (!difficulty) {
    return "Please enter the difficulty level.";
  }

  if (!studentFileName || !studentFileBase64) {
    return "Please upload a Student Pack file.";
  }

  if (!isAllowedFile(studentFileName)) {
    return "Please upload the Student Pack as a .docx or .pdf file.";
  }

  if (tutorFileName || tutorFileBase64) {
    if (!tutorFileName || !tutorFileBase64) {
      return "Please upload both the Tutor Guide file name and file content.";
    }

    if (!isAllowedFile(tutorFileName)) {
      return "Please upload the Tutor Guide as a .docx or .pdf file.";
    }
  }

  return null;
}

async function extractDocxSummary(fileName, buffer) {
  if (!fileName.toLowerCase().endsWith(".docx")) {
    return "";
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    return createExcerpt(result.value || "", 220);
  } catch {
    return "";
  }
}

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const adminCheck = requireAdmin(context);

  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const githubConfig = getGitHubConfig();

  if (!githubConfig.ok) {
    return githubConfig.response;
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  const validationError = validatePayload(payload);

  if (validationError) {
    return json(400, { error: validationError });
  }

  const title = String(payload.title || "").trim();
  const code = String(payload.code || "").trim();
  const skill = String(payload.skill || "").trim();
  const scenario = String(payload.scenario || "").trim();
  const difficulty = String(payload.difficulty || "").trim();
  const category = String(payload.category || "Practical Skills").trim();

  const studentFileName = String(payload.studentFileName || "").trim();
  const studentBase64Payload = getBase64Payload(payload.studentFileBase64);
  const studentBuffer = Buffer.from(studentBase64Payload, "base64");

  const tutorFileName = String(payload.tutorFileName || "").trim();
  const tutorBase64Payload = getBase64Payload(payload.tutorFileBase64);

  const slug = slugify(`${code}-${scenario}`) || slugify(title) || `resource-${Date.now()}`;

  const studentSafeFileName = getSafeFileName({
    code,
    title: scenario,
    packType: "student-pack",
    originalFileName: studentFileName,
  });

  const studentUploadPath = `public/uploads/resources/${studentSafeFileName}`;
  const studentPublicLink = `/uploads/resources/${studentSafeFileName}`;

  let tutorUploadPath = "";
  let tutorPublicLink = "";

  if (tutorFileName && tutorBase64Payload) {
    const tutorSafeFileName = getSafeFileName({
      code,
      title: scenario,
      packType: "tutor-guide",
      originalFileName: tutorFileName,
    });

    tutorUploadPath = `public/uploads/resources/${tutorSafeFileName}`;
    tutorPublicLink = `/uploads/resources/${tutorSafeFileName}`;
  }

  const extractedSummary = await extractDocxSummary(studentFileName, studentBuffer);

  const summary =
    String(payload.summary || "").trim() ||
    extractedSummary ||
    "A LawBridge practical skills simulation pack for structured legal skills development.";

  const contentPath = `src/content/resources/${slug}.md`;

  const frontmatter = buildFrontmatter({
    title,
    code,
    skill,
    scenario,
    difficulty,
    summary,
    description: summary,
    category,
    type: "Simulation Pack",
    studentLink: studentPublicLink,
    tutorLink: tutorPublicLink,
    student: studentPublicLink,
    tutor: tutorPublicLink,
    downloadLink: studentPublicLink,
  });

  const markdownContent = `${frontmatter}${summary}\n`;

  try {
    await putBase64File({
      ...githubConfig,
      path: studentUploadPath,
      message: `Upload student pack: ${code} ${scenario}`,
      base64Content: studentBase64Payload,
    });

    if (tutorUploadPath && tutorBase64Payload) {
      await putBase64File({
        ...githubConfig,
        path: tutorUploadPath,
        message: `Upload tutor guide: ${code} ${scenario}`,
        base64Content: tutorBase64Payload,
      });
    }

    await putTextFile({
      ...githubConfig,
      path: contentPath,
      message: `Add resource simulation: ${code} ${scenario}`,
      content: markdownContent,
    });
  } catch (error) {
    return json(500, {
      error: "Could not publish the resource simulation to GitHub.",
      details: error.message,
    });
  }

  return json(200, {
    success: true,
    message: "Resource simulation published. Netlify will redeploy the website.",
    slug,
    contentPath,
    studentUploadPath,
    tutorUploadPath,
    studentLink: studentPublicLink,
    tutorLink: tutorPublicLink,
    previewPath: "/resources",
  });
}
