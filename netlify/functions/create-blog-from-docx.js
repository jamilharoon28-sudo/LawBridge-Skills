import mammoth from "mammoth";
import {
  json,
  requireAdmin,
  getGitHubConfig,
  putTextFile,
  slugify,
  buildFrontmatter,
  createExcerpt,
} from "./_github.js";

function cleanHtml(html) {
  return String(html || "")
    .replace(/\r\n/g, "\n")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createSafeDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function removeFileExtension(fileName) {
  return String(fileName || "")
    .replace(/\.[^/.]+$/, "")
    .trim();
}

function getBlogSlug({ title, fileName }) {
  const fromTitle = slugify(title);
  const fromFile = slugify(removeFileExtension(fileName));

  return fromTitle || fromFile || `blog-${Date.now()}`;
}

function getBase64Payload(fileBase64) {
  const raw = String(fileBase64 || "");

  if (raw.includes(",")) {
    return raw.split(",").pop();
  }

  return raw;
}

function validatePayload(payload) {
  const title = String(payload.title || "").trim();
  const fileName = String(payload.fileName || "").trim();
  const fileBase64 = String(payload.fileBase64 || "").trim();

  if (!title) {
    return "Please enter a blog title.";
  }

  if (!fileName.toLowerCase().endsWith(".docx")) {
    return "Please upload a .docx Word document.";
  }

  if (!fileBase64) {
    return "Please upload a Word document before publishing.";
  }

  return null;
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
  const fileName = String(payload.fileName || "").trim();
  const category = String(payload.category || "Careers").trim();
  const author = String(payload.author || "LawBridge").trim();
  const date = createSafeDate(payload.date);
  const base64Payload = getBase64Payload(payload.fileBase64);
  const buffer = Buffer.from(base64Payload, "base64");

  let converted;

  try {
    converted = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => p.subtitle:fresh",
          "p[style-name='Heading 1'] => h2:fresh",
          "p[style-name='Heading 2'] => h3:fresh",
          "p[style-name='Heading 3'] => h4:fresh",
        ],
      }
    );
  } catch (error) {
    return json(400, {
      error:
        "The Word document could not be read. Please make sure it is a valid .docx file.",
      details: error.message,
    });
  }

  const htmlBody = cleanHtml(converted.value);

  if (!htmlBody) {
    return json(400, {
      error:
        "The Word document did not contain readable text. Please upload a document with article content.",
    });
  }

  const description =
    String(payload.description || "").trim() || createExcerpt(htmlBody, 190);

  const slug = getBlogSlug({ title, fileName });
  const contentPath = `src/content/blog/${slug}.md`;

  const frontmatter = buildFrontmatter({
    title,
    description,
    date,
    category,
    author,
  });

  const markdownContent = `${frontmatter}${htmlBody}\n`;

  try {
    await putTextFile({
      ...githubConfig,
      path: contentPath,
      message: `Add blog post: ${title}`,
      content: markdownContent,
    });
  } catch (error) {
    return json(500, {
      error: "Could not publish the blog post to GitHub.",
      details: error.message,
    });
  }

  return json(200, {
    success: true,
    message: "Blog post published. Netlify will redeploy the website.",
    slug,
    contentPath,
    previewPath: `/blog/${slug}`,
    warnings: converted.messages || [],
  });
}
