const ALLOWED_PAGES = new Set([
  "home",
  "about",
  "students",
  "mentors",
  "resources",
  "blog",
  "webinars",
  "workshops",
]);

const SECTION_KEYS = ["problem", "method", "curriculum", "pathways", "cta"];
const CARD_KEYS = ["problem", "method", "curriculum", "pathways"];

function q(value) {
  return JSON.stringify(String(value ?? "").replace(/\r\n/g, "\n").trim());
}

function listItems(items) {
  const cleanItems = Array.isArray(items)
    ? items.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  if (cleanItems.length === 0) {
    return ["  items: []"];
  }

  return ["  items:", ...cleanItems.map((item) => `    - ${q(item)}`)];
}

function writeSection(lines, key, section) {
  lines.push(`    ${key}:`);
  lines.push(`      eyebrow: ${q(section?.eyebrow)}`);
  lines.push(`      heading: ${q(section?.heading)}`);
  lines.push(`      description: ${q(section?.description)}`);
}

function writeCardGroup(lines, key, cards) {
  const cleanCards = Array.isArray(cards) ? cards : [];

  if (cleanCards.length === 0) {
    lines.push(`    ${key}: []`);
    return;
  }

  lines.push(`    ${key}:`);

  cleanCards.forEach((card) => {
    lines.push(`      - title: ${q(card?.title)}`);
    lines.push(`        description: ${q(card?.description)}`);

    if (key === "pathways") {
      lines.push(`        buttonText: ${q(card?.buttonText)}`);
      lines.push(`        buttonLink: ${q(card?.buttonLink)}`);
    }
  });
}

function buildMarkdown(data) {
  const hero = data.hero ?? {};
  const dashboard = data.dashboard ?? {};
  const sections = data.sections ?? {};
  const cards = data.cards ?? {};
  const buttons = data.buttons ?? {};

  const lines = [];

  lines.push("---");
  lines.push(`title: ${q(data.title)}`);
  lines.push("");

  lines.push("hero:");
  lines.push(`  eyebrow: ${q(hero.eyebrow)}`);
  lines.push(`  heading: ${q(hero.heading)}`);
  lines.push(`  description: ${q(hero.description)}`);
  lines.push(`  primaryButtonText: ${q(hero.primaryButtonText)}`);
  lines.push(`  primaryButtonLink: ${q(hero.primaryButtonLink)}`);
  lines.push(`  secondaryButtonText: ${q(hero.secondaryButtonText)}`);
  lines.push(`  secondaryButtonLink: ${q(hero.secondaryButtonLink)}`);
  lines.push(`  tertiaryButtonText: ${q(hero.tertiaryButtonText)}`);
  lines.push(`  tertiaryButtonLink: ${q(hero.tertiaryButtonLink)}`);
  lines.push("");

  if (String(dashboard.heading ?? "").trim()) {
    lines.push("dashboard:");
    lines.push(`  label: ${q(dashboard.label)}`);
    lines.push(`  heading: ${q(dashboard.heading)}`);
    lines.push(`  description: ${q(dashboard.description)}`);
    lines.push(...listItems(dashboard.items));
    lines.push("");
  }

  lines.push("sections:");
  SECTION_KEYS.forEach((key) => {
    writeSection(lines, key, sections[key] ?? {});
  });
  lines.push("");

  lines.push("cards:");
  CARD_KEYS.forEach((key) => {
    writeCardGroup(lines, key, cards[key] ?? []);
  });
  lines.push("");

  lines.push("buttons:");
  lines.push("  cta:");
  lines.push(`    primaryText: ${q(buttons?.cta?.primaryText)}`);
  lines.push(`    primaryLink: ${q(buttons?.cta?.primaryLink)}`);
  lines.push(`    secondaryText: ${q(buttons?.cta?.secondaryText)}`);
  lines.push(`    secondaryLink: ${q(buttons?.cta?.secondaryLink)}`);
  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function getAllowedAdminEmails() {
  return String(process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedAdmin(user) {
  const allowedEmails = getAllowedAdminEmails();
  const userEmail = String(user?.email || "").trim().toLowerCase();

  if (!userEmail || allowedEmails.length === 0) {
    return false;
  }

  return allowedEmails.includes(userEmail);
}

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const user = context.clientContext?.user;

  if (!user) {
    return json(401, {
      error: "Please sign in before publishing changes.",
    });
  }

  if (!isAllowedAdmin(user)) {
    return json(403, {
      error:
        "This signed-in account is not authorised to publish changes. Check that ADMIN_EMAIL in Netlify matches your login email exactly.",
      signedInEmail: user.email || null,
    });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    return json(500, {
      error:
        "Missing GitHub environment variables. Check GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO and GITHUB_BRANCH in Netlify.",
    });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  const page = String(payload.page || "").trim();

  if (!ALLOWED_PAGES.has(page)) {
    return json(400, { error: "This page is not allowed for visual editing." });
  }

  const contentPath = `src/content/pages/${page}.md`;
  const markdown = buildMarkdown(payload.data || {});

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${contentPath}`;

  const githubHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const existingResponse = await fetch(
    `${apiUrl}?ref=${encodeURIComponent(branch)}`,
    {
      headers: githubHeaders,
    }
  );

  if (!existingResponse.ok) {
    const details = await existingResponse.text();

    return json(500, {
      error: "Could not read the current GitHub file.",
      details,
    });
  }

  const existingFile = await existingResponse.json();

  const updateResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: githubHeaders,
    body: JSON.stringify({
      message: `Update ${page} page content from LawBridge admin`,
      content: Buffer.from(markdown, "utf8").toString("base64"),
      sha: existingFile.sha,
      branch,
    }),
  });

  if (!updateResponse.ok) {
    const details = await updateResponse.text();

    return json(500, {
      error: "Could not update the GitHub file.",
      details,
    });
  }

  return json(200, {
    success: true,
    message: "Content updated. Netlify will redeploy the website.",
  });
}
