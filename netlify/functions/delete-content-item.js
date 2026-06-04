---
import BaseLayout from "../../../../layouts/BaseLayout.astro";
import { getCollection } from "astro:content";

export function getStaticPaths() {
  const pages = [
    {
      slug: "blog",
      collection: "blog",
      label: "Blog Posts",
      singular: "blog post",
      addPath: "/admin/content/blog/new",
      previewPath: "/blog",
    },
    {
      slug: "resources",
      collection: "resources",
      label: "Resources",
      singular: "resource",
      addPath: "/admin/content/resources/new",
      previewPath: "/resources",
    },
    {
      slug: "webinars",
      collection: "webinars",
      label: "Webinars",
      singular: "webinar",
      addPath: "/admin/content/webinars/new",
      previewPath: "/webinars",
    },
    {
      slug: "workshops",
      collection: "workshops",
      label: "Workshops",
      singular: "workshop",
      addPath: "/admin/content/workshops/new",
      previewPath: "/workshops",
    },
  ];

  return pages.map((page) => ({
    params: { collection: page.slug },
    props: { pageMeta: page },
  }));
}

const { pageMeta } = Astro.props;

const entries = await getCollection(pageMeta.collection);

const sortedEntries = entries.sort((a, b) => {
  const aTime = a.data.date ? new Date(a.data.date).getTime() : 0;
  const bTime = b.data.date ? new Date(b.data.date).getTime() : 0;
  return bTime - aTime;
});

function formatDate(dateValue) {
  if (!dateValue) {
    return "No date set";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "No date set";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDescription(entry) {
  return (
    entry.data.summary ||
    entry.data.description ||
    entry.data.scenario ||
    "No description has been added for this item."
  );
}

function getItemPreviewPath(entry) {
  if (pageMeta.slug === "blog") {
    return `/blog/${entry.slug}`;
  }

  return pageMeta.previewPath;
}

function getMetaTags(entry) {
  const tags = [];

  if (entry.data.code) tags.push(entry.data.code);
  if (entry.data.category) tags.push(entry.data.category);
  if (entry.data.status) tags.push(entry.data.status);
  if (entry.data.type) tags.push(entry.data.type);
  if (entry.data.skill) tags.push(entry.data.skill);
  if (entry.data.difficulty) tags.push(entry.data.difficulty);
  if (entry.data.location) tags.push(entry.data.location);

  return tags;
}

function getStudentPath(entry) {
  return entry.data.studentLink || entry.data.student || entry.data.downloadLink || "";
}

function getTutorPath(entry) {
  return entry.data.tutorLink || entry.data.tutor || "";
}
---

<BaseLayout title={`Manage ${pageMeta.label} | LawBridge Admin`}>
  <section class="manage-shell">
    <div class="container">
      <div class="manage-topbar">
        <a href="/admin" class="manage-button dark">← Back to Admin</a>

        <div class="manage-topbar-actions">
          <a href={pageMeta.previewPath} class="manage-button light" target="_blank">
            Preview Live Page
          </a>
          <a href={pageMeta.addPath} class="manage-button primary">
            Add New {pageMeta.singular}
          </a>
        </div>
      </div>

      <header class="manage-hero">
        <div>
          <p class="manage-eyebrow">LawBridge Content Studio</p>
          <h1>Manage {pageMeta.label}</h1>
          <p>
            Review, preview and delete published {pageMeta.label.toLowerCase()} from the LawBridge admin area.
          </p>
        </div>

        <aside class="manage-guide">
          <h2>Content actions</h2>
          <ol>
            <li>Preview the live page before deleting.</li>
            <li>Delete only test or outdated items.</li>
            <li>Resource deletion removes Student Pack and Tutor Guide uploads.</li>
            <li>Netlify redeploys after deletion.</li>
          </ol>
        </aside>
      </header>

      <div id="manage-status" class="manage-status">
        {sortedEntries.length > 0
          ? `${sortedEntries.length} ${pageMeta.label.toLowerCase()} found.`
          : `No ${pageMeta.label.toLowerCase()} found.`}
      </div>

      {sortedEntries.length > 0 ? (
        <section class="manage-grid" aria-label={`Manage ${pageMeta.label}`}>
          {sortedEntries.map((entry) => (
            <article
              class="manage-card"
              data-content-card
              data-collection={pageMeta.slug}
              data-slug={entry.slug}
              data-title={entry.data.title}
              data-asset-path={entry.data.downloadLink ?? ""}
              data-student-path={getStudentPath(entry)}
              data-tutor-path={getTutorPath(entry)}
            >
              <div>
                <div class="manage-card-top">
                  <span class="manage-card-type">{pageMeta.singular}</span>
                  <span class="manage-card-date">{formatDate(entry.data.date)}</span>
                </div>

                <h2>{entry.data.title}</h2>
                <p>{getDescription(entry)}</p>

                <div class="manage-tags">
                  {getMetaTags(entry).map((tag) => (
                    <span>{tag}</span>
                  ))}
                </div>

                {pageMeta.slug === "resources" && (
                  <div class="manage-resource-files">
                    <span>{getStudentPath(entry) ? "Student Pack attached" : "No Student Pack"}</span>
                    <span>{getTutorPath(entry) ? "Tutor Guide attached" : "No Tutor Guide"}</span>
                  </div>
                )}
              </div>

              <div class="manage-actions">
                <a href={getItemPreviewPath(entry)} class="manage-button light" target="_blank">
                  Preview
                </a>

                <button type="button" class="manage-button danger" data-delete-content>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section class="empty-state">
          <p class="manage-eyebrow">No content yet</p>
          <h2>No {pageMeta.label.toLowerCase()} have been published.</h2>
          <p>
            Use the Content Studio to add a new {pageMeta.singular}. Once published, it will appear here.
          </p>
          <a href={pageMeta.addPath} class="manage-button primary">
            Add New {pageMeta.singular}
          </a>
        </section>
      )}
    </div>
  </section>

  <div id="delete-modal" class="delete-modal" hidden>
    <div class="delete-card">
      <p class="manage-eyebrow">Confirm deletion</p>
      <h2 id="delete-title">Delete this item?</h2>
      <p id="delete-message">
        This will remove the content file from GitHub. Netlify will redeploy and the item will disappear from the live website.
      </p>

      <div class="delete-actions">
        <button id="confirm-delete" type="button" class="manage-button danger">
          Yes, delete it
        </button>
        <button id="cancel-delete" type="button" class="manage-button light">
          Cancel
        </button>
      </div>
    </div>
  </div>

  <style is:inline>
    .manage-shell {
      min-height: 100vh;
      padding: 2rem 0 4rem;
      background:
        radial-gradient(circle at top right, rgba(231, 182, 95, 0.18), transparent 32%),
        linear-gradient(180deg, #f8f1e4 0%, #fbf7ef 100%);
      color: #061b31;
    }

    .manage-topbar {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      margin-bottom: 2rem;
    }

    .manage-topbar-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .manage-button {
      border: 0;
      min-height: 44px;
      padding: 0.75rem 1.05rem;
      border-radius: 999px;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.92rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      text-align: center;
    }

    .manage-button:hover {
      transform: translateY(-2px);
    }

    .manage-button.primary {
      background: linear-gradient(135deg, #e7b65f, #d39b45);
      color: #061b31;
      box-shadow: 0 12px 28px rgba(211, 155, 69, 0.22);
    }

    .manage-button.dark {
      background: #061b31;
      color: #ffffff;
    }

    .manage-button.light {
      background: #ffffff;
      color: #061b31;
      border: 1px solid rgba(201, 150, 82, 0.32);
    }

    .manage-button.danger {
      background: #7f1d1d;
      color: #ffffff;
    }

    .manage-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.8fr) minmax(320px, 0.8fr);
      gap: 1.5rem;
      align-items: stretch;
      padding: clamp(1.5rem, 4vw, 3rem);
      border-radius: 34px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(201, 150, 82, 0.3);
      box-shadow: 0 28px 90px rgba(6, 27, 49, 0.12);
    }

    .manage-eyebrow {
      margin: 0 0 0.7rem;
      color: #b37b32;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.78rem;
    }

    .manage-hero h1 {
      max-width: 920px;
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(2.8rem, 6vw, 5.6rem);
      line-height: 0.95;
      letter-spacing: -0.045em;
      color: #061b31;
      overflow-wrap: anywhere;
      hyphens: auto;
    }

    .manage-hero p:not(.manage-eyebrow) {
      max-width: 780px;
      margin: 1rem 0 0;
      color: #334155;
      line-height: 1.7;
      font-size: 1.08rem;
    }

    .manage-guide {
      padding: 1.3rem;
      border-radius: 24px;
      background: #061b31;
      color: #ffffff;
    }

    .manage-guide h2 {
      margin: 0 0 1rem;
      color: #ffffff;
      font-family: Georgia, "Times New Roman", serif;
    }

    .manage-guide ol {
      margin: 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 0.65rem;
      color: rgba(255, 255, 255, 0.86);
      line-height: 1.5;
    }

    .manage-status {
      margin-top: 1.5rem;
      padding: 1rem 1.15rem;
      border-radius: 20px;
      background: #061b31;
      color: #ffffff;
      font-weight: 900;
      box-shadow: 0 18px 52px rgba(6, 27, 49, 0.12);
    }

    .manage-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .manage-card {
      min-height: 300px;
      padding: 1.25rem;
      border-radius: 26px;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(201, 150, 82, 0.28);
      box-shadow: 0 18px 52px rgba(6, 27, 49, 0.09);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1.2rem;
      overflow: hidden;
    }

    .manage-card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .manage-card-type,
    .manage-card-date,
    .manage-tags span,
    .manage-resource-files span {
      display: inline-flex;
      max-width: 100%;
      padding: 0.42rem 0.7rem;
      border-radius: 999px;
      background: rgba(211, 155, 69, 0.13);
      color: #061b31;
      font-weight: 900;
      font-size: 0.78rem;
      overflow-wrap: anywhere;
    }

    .manage-card-date {
      background: rgba(6, 27, 49, 0.06);
      color: #334155;
    }

    .manage-card h2 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(1.6rem, 2.5vw, 2.2rem);
      line-height: 1.05;
      color: #061b31;
      overflow-wrap: anywhere;
      hyphens: auto;
    }

    .manage-card p {
      margin: 0.85rem 0 0;
      color: #334155;
      line-height: 1.65;
      overflow-wrap: anywhere;
    }

    .manage-tags,
    .manage-resource-files {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 1rem;
    }

    .manage-resource-files span {
      background: rgba(6, 27, 49, 0.06);
      color: #334155;
    }

    .manage-actions {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
    }

    .empty-state {
      margin-top: 1.5rem;
      padding: 2rem;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(201, 150, 82, 0.28);
      box-shadow: 0 18px 52px rgba(6, 27, 49, 0.09);
    }

    .empty-state h2 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: #061b31;
      font-size: clamp(2rem, 4vw, 3rem);
    }

    .empty-state p {
      color: #334155;
      line-height: 1.65;
      max-width: 760px;
    }

    .delete-modal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      background: rgba(6, 27, 49, 0.58);
      backdrop-filter: blur(10px);
    }

    .delete-modal[hidden] {
      display: none;
    }

    .delete-card {
      width: min(620px, 100%);
      padding: 2rem;
      border-radius: 28px;
      background: #fbf7ef;
      border: 1px solid rgba(201, 150, 82, 0.32);
      box-shadow: 0 30px 90px rgba(6, 27, 49, 0.25);
      color: #061b31;
    }

    .delete-card h2 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(2rem, 4vw, 3rem);
      color: #061b31;
      overflow-wrap: anywhere;
    }

    .delete-card p:not(.manage-eyebrow) {
      color: #334155;
      line-height: 1.65;
    }

    .delete-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-top: 1.4rem;
    }

    @media (max-width: 1180px) {
      .manage-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .manage-hero {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .manage-topbar,
      .manage-topbar-actions,
      .manage-actions,
      .delete-actions {
        align-items: flex-start;
        flex-direction: column;
      }

      .manage-grid {
        grid-template-columns: 1fr;
      }

      .manage-button {
        width: 100%;
      }
    }
  </style>

  <script>
    const statusBox = document.getElementById("manage-status");
    const deleteModal = document.getElementById("delete-modal");
    const deleteTitle = document.getElementById("delete-title");
    const deleteMessage = document.getElementById("delete-message");
    const confirmDelete = document.getElementById("confirm-delete");
    const cancelDelete = document.getElementById("cancel-delete");

    let selectedCard = null;

    function setStatus(message) {
      if (statusBox) {
        statusBox.textContent = message;
      }
    }

    function openDeleteModal(card) {
      selectedCard = card;
      const title = card.dataset.title || "this item";
      const collection = card.dataset.collection;

      if (deleteTitle) {
        deleteTitle.textContent = `Delete “${title}”?`;
      }

      if (deleteMessage) {
        deleteMessage.textContent =
          collection === "resources"
            ? "This will delete the resource entry and any uploaded Student Pack or Tutor Guide files from GitHub. Netlify will redeploy afterwards."
            : "This will remove the content file from GitHub. Netlify will redeploy and the item will disappear from the live website.";
      }

      if (deleteModal) {
        deleteModal.hidden = false;
      }
    }

    function closeDeleteModal() {
      selectedCard = null;

      if (deleteModal) {
        deleteModal.hidden = true;
      }
    }

    document.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-content]");

      if (!deleteButton) {
        return;
      }

      const card = deleteButton.closest("[data-content-card]");

      if (!card) {
        return;
      }

      openDeleteModal(card);
    });

    if (cancelDelete) {
      cancelDelete.addEventListener("click", closeDeleteModal);
    }

    if (confirmDelete) {
      confirmDelete.addEventListener("click", async () => {
        if (!selectedCard) {
          return;
        }

        try {
          if (!window.netlifyIdentity) {
            setStatus("Netlify Identity is not loaded.");
            return;
          }

          const user = window.netlifyIdentity.currentUser();

          if (!user) {
            setStatus("Please log in before deleting.");
            window.netlifyIdentity.open("login");
            return;
          }

          const collection = selectedCard.dataset.collection;
          const slug = selectedCard.dataset.slug;
          const title = selectedCard.dataset.title;
          const assetPath = selectedCard.dataset.assetPath;
          const studentPath = selectedCard.dataset.studentPath;
          const tutorPath = selectedCard.dataset.tutorPath;

          confirmDelete.disabled = true;
          confirmDelete.textContent = "Deleting...";
          setStatus(`Deleting “${title}”...`);

          const token = await user.jwt();

          const response = await fetch("/.netlify/functions/delete-content-item", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              collection,
              slug,
              title,
              assetPath,
              studentPath,
              tutorPath,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "Could not delete this item.");
          }

          selectedCard.remove();
          closeDeleteModal();

          setStatus(
            `Deleted “${title}”. Netlify will redeploy and update the live website.`
          );
        } catch (error) {
          setStatus(error.message || "Something went wrong.");
        } finally {
          confirmDelete.disabled = false;
          confirmDelete.textContent = "Yes, delete it";
        }
      });
    }
  </script>
</BaseLayout>
