import {
  json,
  requireAdmin,
  getGitHubConfig,
  deleteGitHubFile,
} from "./_github.js";

const COLLECTIONS = {
  blog: {
    label: "blog post",
    folder: "src/content/blog",
  },
  resources: {
    label: "resource",
    folder: "src/content/resources",
  },
  webinars: {
    label: "webinar",
    folder: "src/content/webinars",
  },
  workshops: {
    label: "workshop",
    folder: "src/content/workshops",
  },
};

const ALLOWED_RESOURCE_FILE_FOLDERS = [
  "public/uploads/resources/",
  "public/resources/student/",
  "public/resources/tutor/",
];

function cleanSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9-]/g, "");
}

function cleanTitle(value) {
  return String(value || "").trim() || "content item";
}

function getCollectionConfig(collection) {
  const key = String(collection || "").trim();

  return COLLECTIONS[key] || null;
}

function getContentPath(collectionConfig, slug) {
  return `${collectionConfig.folder}/${slug}.md`;
}

function normaliseAssetPath(value) {
  const path = String(value || "").trim();

  if (!path) {
    return "";
  }

  if (path.startsWith("/uploads/resources/")) {
    return `public${path}`;
  }

  if (path.startsWith("uploads/resources/")) {
    return `public/${path}`;
  }

  if (path.startsWith("/resources/student/")) {
    return `public${path}`;
  }

  if (path.startsWith("resources/student/")) {
    return `public/${path}`;
  }

  if (path.startsWith("/resources/tutor/")) {
    return `public${path}`;
  }

  if (path.startsWith("resources/tutor/")) {
    return `public/${path}`;
  }

  if (
    path.startsWith("public/uploads/resources/") ||
    path.startsWith("public/resources/student/") ||
    path.startsWith("public/resources/tutor/")
  ) {
    return path;
  }

  return "";
}

function isSafeResourceFilePath(path) {
  return ALLOWED_RESOURCE_FILE_FOLDERS.some((folder) => path.startsWith(folder));
}

function getSafeResourceAssetPath(value) {
  const path = normaliseAssetPath(value);

  if (!path) {
    return "";
  }

  if (!isSafeResourceFilePath(path)) {
    return "";
  }

  return path;
}

function getResourceAssetPaths(payload) {
  const possiblePaths = [
    payload.assetPath,
    payload.studentPath,
    payload.tutorPath,
    payload.downloadLink,
    payload.studentLink,
    payload.tutorLink,
    payload.student,
    payload.tutor,
  ];

  const safePaths = possiblePaths
    .map((path) => getSafeResourceAssetPath(path))
    .filter(Boolean);

  return [...new Set(safePaths)];
}

function validatePayload(payload) {
  const collectionConfig = getCollectionConfig(payload.collection);
  const slug = cleanSlug(payload.slug);

  if (!collectionConfig) {
    return "This content collection cannot be deleted from the admin area.";
  }

  if (!slug) {
    return "Missing content slug. The item cannot be deleted safely.";
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

  const collection = String(payload.collection || "").trim();
  const collectionConfig = getCollectionConfig(collection);
  const slug = cleanSlug(payload.slug);
  const title = cleanTitle(payload.title);
  const contentPath = getContentPath(collectionConfig, slug);

  const deleted = [];
  const warnings = [];

  try {
    await deleteGitHubFile({
      ...githubConfig,
      path: contentPath,
      message: `Delete ${collectionConfig.label}: ${title}`,
    });

    deleted.push(contentPath);
  } catch (error) {
    return json(500, {
      error: `Could not delete the ${collectionConfig.label} content file.`,
      details: error.message,
    });
  }

  if (collection === "resources") {
    const assetPaths = getResourceAssetPaths(payload);

    for (const assetPath of assetPaths) {
      try {
        await deleteGitHubFile({
          ...githubConfig,
          path: assetPath,
          message: `Delete resource file: ${title}`,
        });

        deleted.push(assetPath);
      } catch {
        warnings.push(
          `The resource entry was deleted, but this uploaded file could not be deleted: ${assetPath}. It may already have been removed.`
        );
      }
    }
  }

  return json(200, {
    success: true,
    message: `${collectionConfig.label} deleted. Netlify will redeploy the website.`,
    deleted,
    warnings,
  });
}
