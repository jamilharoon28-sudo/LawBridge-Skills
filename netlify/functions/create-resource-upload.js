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

const ALLOWED_EXTENSIONS = [".docx", ".pdf", ".pptx", ".xlsx"];

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

function getSafeFileName(title, originalFileName) {
  const extension = getFileExtension(originalFileName);
  const slug = slugify(title) || `resource-${Date.now()}`;
  return `${slug}${extension}`;
}

function validatePayload(payload) {
  const title = String(payload.title || "").trim();
  const fileName = String(payload.fileName || "").trim();
  const fileBase64 = String(payload.fileBase64 || "").trim();
  const extension = getFileExtension(fileName);

  if (!title) {
    return "Please enter a resource title.";
  }

  if (!fileName) {
    return "Please upload a resource file.";
  }

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return "Please upload a .docx, .pdf, .pptx or .xlsx file.";
  }

  if (!fileBase64) {
    return "Please upload a file before publishing.";
  }

  return null;
}

async function extractDocxDescription(fileName, buffer) {
  if (!fileName.toLowerCase().endsWith(".docx")) {
    return "";
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    return createExcerpt(result.value || "", 190);
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
  const category = String(payload.category || "Student").trim();
  const type = String(payload.type || "Guide").trim();
  const skill = String(payload.skill || "Legal Skills").trim();
  const difficulty = String(payload.difficulty || "Beginner").trim();
  const fileName = String(payload.fileName || "").trim();
  const base64Payload = getBase64Payload(payload.fileBase64);
  const buffer = Buffer.from(base64Payload, "base64");

  const safeFileName = getSafeFileName(title, fileName);
  const slug = slugify(title) || `resource-${Date.now()}`;

  const uploadedFilePath = `public/uploads/resources/${safeFileName}`;
  const publicDownloadLink = `/uploads/resources/${safeFileName}`;
  const contentPath = `src/content/resources/${slug}.md`;

  const extractedDescription = await extractDocxDescription(fileName, buffer);

  const description =
    String(payload.description || "").trim() ||
    extractedDescription ||
    "A LawBridge resource for practical legal development.";

  const frontmatter = buildFrontmatter({
    title,
    description,
    category,
    type,
    skill,
    difficulty,
    downloadLink: publicDownloadLink,
  });

  const notes = String(payload.notes || "").trim();

  const markdownContent = notes
    ? `${frontmatter}${notes}\n`
    : `${frontmatter}Download this resource using the link provided on the resource card.\n`;

  try {
    await putBase64File({
      ...githubConfig,
      path: uploadedFilePath,
      message: `Upload resource file: ${title}`,
      base64Content: base64Payload,
    });

    await putTextFile({
      ...githubConfig,
      path: contentPath,
      message: `Add resource entry: ${title}`,
      content: markdownContent,
    });
  } catch (error) {
    return json(500, {
      error: "Could not publish the resource to GitHub.",
      details: error.message,
    });
  }

  return json(200, {
    success: true,
    message: "Resource published. Netlify will redeploy the website.",
    slug,
    contentPath,
    uploadedFilePath,
    downloadLink: publicDownloadLink,
    previewPath: "/resources",
  });
}
