import {
  json,
  requireAdmin,
  getGitHubConfig,
  putTextFile,
  slugify,
  buildFrontmatter,
} from "./_github.js";

const originalResources = [
  {
    code: "CI-01",
    skill: "Client Interviewing",
    scenario: "Failed Software Launch",
    difficulty: "Foundation to Guided Practice",
    summary: "Plan and structure a client interview for a failed software launch dispute.",
    student: "/resources/student/Client Interviewing - Failed Software Launch - Student Pack.docx",
    tutor: "/resources/tutor/Client Interviewing - Failed Software Launch - Tutor Guide.docx",
  },
  {
    code: "CI-02",
    skill: "Client Interviewing",
    scenario: "Dismissal After Raising Concern",
    difficulty: "Foundation to Guided Practice",
    summary: "Prepare a careful client interview after dismissal linked to a workplace concern.",
    student: "/resources/student/Client Interviewing - Dismissal After Raising Concern - Student Pack.docx",
    tutor: "/resources/tutor/Client Interviewing - Dismissal After Raising Concern - Tutor Guide.docx",
  },
  {
    code: "AN-01",
    skill: "Attendance Notes and Legal Analysis",
    scenario: "Cyberattack After Client Interview",
    difficulty: "Intermediate",
    summary: "Turn a cyber incident interview into an attendance note and analysis.",
    student: "/resources/student/Attendance Notes and Legal Analysis - Cyberattack After Client Interview - Student Pack.docx",
    tutor: "/resources/tutor/Attendance Notes and Legal Analysis - Cyberattack After Client Interview - Tutor Guide.docx",
  },
  {
    code: "AN-02",
    skill: "Attendance Notes and Legal Analysis",
    scenario: "Contract Dispute Missing Evidence",
    difficulty: "Foundation to Intermediate",
    summary: "Analyse a contract dispute where key documents and evidence are incomplete.",
    student: "/resources/student/Attendance Notes and Legal Analysis - Contract Dispute Missing Evidence - Student Pack.docx",
    tutor: "/resources/tutor/Attendance Notes and Legal Analysis - Contract Dispute Missing Evidence - Tutor Guide.docx",
  },
  {
    code: "LW-01",
    skill: "Legal Writing",
    scenario: "AI Tool Dispute Advice Email",
    difficulty: "Intermediate",
    summary: "Draft a practical client advice email following an AI-generated content dispute.",
    student: "/resources/student/Legal Writing - AI Tool Dispute Advice Email - Student Pack.docx",
    tutor: "/resources/tutor/Legal Writing - AI Tool Dispute Advice Email - Tutor Guide.docx",
  },
  {
    code: "LW-02",
    skill: "Legal Writing",
    scenario: "Service Failure Complaint Response",
    difficulty: "Foundation to Intermediate",
    summary: "Write a professional response to a service failure complaint without over-admitting liability.",
    student: "/resources/student/Legal Writing - Service Failure Complaint Response - Student Pack.docx",
    tutor: "/resources/tutor/Legal Writing - Service Failure Complaint Response - Tutor Guide.docx",
  },
  {
    code: "LD-01",
    skill: "Legal Drafting",
    scenario: "Limitation of Liability Clause",
    difficulty: "Intermediate",
    summary: "Redraft and explain a limitation of liability clause in a technology services agreement.",
    student: "/resources/student/Legal Drafting - Limitation of Liability Clause - Student Pack.docx",
    tutor: "/resources/tutor/Legal Drafting - Limitation of Liability Clause - Tutor Guide.docx",
  },
  {
    code: "LD-02",
    skill: "Legal Drafting",
    scenario: "AI Ownership Clause",
    difficulty: "Intermediate",
    summary: "Draft contract wording dealing with AI outputs, ownership, review and responsibility.",
    student: "/resources/student/Legal Drafting - AI Ownership Clause - Student Pack.docx",
    tutor: "/resources/tutor/Legal Drafting - AI Ownership Clause - Tutor Guide.docx",
  },
  {
    code: "AO-01",
    skill: "Advocacy and Oral Presentation",
    scenario: "Technology Payment Dispute",
    difficulty: "Intermediate",
    summary: "Prepare a short oral submission in a digital delivery and payment dispute.",
    student: "/resources/student/Advocacy - Technology Payment Dispute - Student Pack.docx",
    tutor: "/resources/tutor/Advocacy - Technology Payment Dispute - Tutor Guide.docx",
  },
  {
    code: "AO-02",
    skill: "Advocacy and Oral Presentation",
    scenario: "Business Interruption Insurance Dispute",
    difficulty: "Intermediate to Advanced",
    summary: "Prepare oral arguments in a cyber insurance business interruption dispute.",
    student: "/resources/student/Advocacy - Business Interruption Insurance Dispute - Student Pack.docx",
    tutor: "/resources/tutor/Advocacy - Business Interruption Insurance Dispute - Tutor Guide.docx",
  },
  {
    code: "LR-01",
    skill: "Legal Research",
    scenario: "Data Breach Reporting Duties",
    difficulty: "Foundation to Intermediate",
    summary: "Frame research questions and preliminary findings for data breach reporting duties.",
    student: "/resources/student/Legal Research - Data Breach Reporting Duties - Student Pack.docx",
    tutor: "/resources/tutor/Legal Research - Data Breach Reporting Duties - Tutor Guide.docx",
  },
  {
    code: "LR-02",
    skill: "Legal Research",
    scenario: "Digital Payments Market Entry",
    difficulty: "Intermediate",
    summary: "Research regulatory issues for a digital payments business entering a new market.",
    student: "/resources/student/Legal Research - Digital Payments Market Entry - Student Pack.docx",
    tutor: "/resources/tutor/Legal Research - Digital Payments Market Entry - Tutor Guide.docx",
  },
  {
    code: "CMA-01",
    skill: "Case and Matter Analysis",
    scenario: "Tech Company Acquisition Red Flags",
    difficulty: "Intermediate to Advanced",
    summary: "Analyse due diligence risks in a technology company acquisition.",
    student: "/resources/student/Case and Matter Analysis - Tech Company Acquisition Red Flags - Student Pack.docx",
    tutor: "/resources/tutor/Case and Matter Analysis - Tech Company Acquisition Red Flags - Tutor Guide.docx",
  },
  {
    code: "CMA-02",
    skill: "Case and Matter Analysis",
    scenario: "Blockchain Payment Dispute",
    difficulty: "Intermediate to Advanced",
    summary: "Analyse evidence, risk and strategy in a smart contract payment dispute.",
    student: "/resources/student/Case and Matter Analysis - Blockchain Payment Dispute - Student Pack.docx",
    tutor: "/resources/tutor/Case and Matter Analysis - Blockchain Payment Dispute - Tutor Guide.docx",
  },
];

function buildResourceMarkdown(resource) {
  const title = `${resource.code} | ${resource.scenario}`;

  const frontmatter = buildFrontmatter({
    title,
    code: resource.code,
    skill: resource.skill,
    scenario: resource.scenario,
    difficulty: resource.difficulty,
    summary: resource.summary,
    description: resource.summary,
    category: "Practical Skills",
    type: "Simulation Pack",
    studentLink: resource.student,
    tutorLink: resource.tutor,
    student: resource.student,
    tutor: resource.tutor,
    downloadLink: resource.student,
  });

  return `${frontmatter}${resource.summary}\n`;
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

  const imported = [];
  const failed = [];

  for (const resource of originalResources) {
    const slug = slugify(`${resource.code}-${resource.scenario}`);
    const path = `src/content/resources/${slug}.md`;

    try {
      await putTextFile({
        ...githubConfig,
        path,
        message: `Import original resource: ${resource.code} ${resource.scenario}`,
        content: buildResourceMarkdown(resource),
      });

      imported.push({
        code: resource.code,
        scenario: resource.scenario,
        path,
      });
    } catch (error) {
      failed.push({
        code: resource.code,
        scenario: resource.scenario,
        error: error.message,
      });
    }
  }

  if (failed.length > 0) {
    return json(500, {
      error: "Some original resources could not be imported.",
      imported,
      failed,
    });
  }

  return json(200, {
    success: true,
    message: "Original resources imported into Content Studio. Netlify will redeploy the website.",
    imported,
  });
}
