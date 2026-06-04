import {
  json,
  requireAdmin,
  getGitHubConfig,
  putTextFile,
  slugify,
  buildFrontmatter,
} from "./_github.js";

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

function validatePayload(payload) {
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const link = String(payload.link || "").trim();

  if (!title) {
    return "Please enter a webinar title.";
  }

  if (!description) {
    return "Please enter a short webinar description.";
  }

  if (!link) {
    return "Please enter the webinar link or registration link.";
  }

  return null;
}

function normaliseLink(value) {
  const link = String(value || "").trim();

  if (!link) {
    return "";
  }

  if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("/")) {
    return link;
  }

  return `https://${link}`;
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
  const description = String(payload.description || "").trim();
  const status = String(payload.status || "Open for registration").trim();
  const location = String(payload.location || "Online").trim();
  const speaker = String(payload.speaker || "").trim();
  const link = normaliseLink(payload.link);
  const date = createSafeDate(payload.date);
  const slug = slugify(title) || `webinar-${Date.now()}`;

  const contentPath = `src/content/webinars/${slug}.md`;

  const frontmatter = buildFrontmatter({
    title,
    description,
    date,
    status,
    location,
    speaker,
    link,
    registrationLink: link,
  });

  const details = String(payload.details || "").trim();

  const body = details
    ? `${details}\n\n[Register or join here](${link})\n`
    : `[Register or join here](${link})\n`;

  const markdownContent = `${frontmatter}${body}`;

  try {
    await putTextFile({
      ...githubConfig,
      path: contentPath,
      message: `Add webinar: ${title}`,
      content: markdownContent,
    });
  } catch (error) {
    return json(500, {
      error: "Could not publish the webinar to GitHub.",
      details: error.message,
    });
  }

  return json(200, {
    success: true,
    message: "Webinar published. Netlify will redeploy the website.",
    slug,
    contentPath,
    previewPath: "/webinars",
  });
}
