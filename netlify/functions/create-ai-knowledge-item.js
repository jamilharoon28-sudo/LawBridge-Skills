---
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Add AI Resource | LawBridge Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <style>
      body {
        margin: 0;
        background: #f8f1e4;
        color: #061b31;
        font-family: Inter, system-ui, sans-serif;
      }

      .shell {
        max-width: 900px;
        margin: 0 auto;
        padding: 40px 20px 80px;
      }

      h1 {
        font-family: Georgia, serif;
        font-size: 3rem;
        margin: 0 0 1rem;
      }

      .card {
        background: white;
        border-radius: 28px;
        padding: 28px;
        border: 1px solid rgba(201, 150, 82, 0.3);
        box-shadow: 0 18px 52px rgba(6, 27, 49, 0.09);
      }

      label {
        display: block;
        font-weight: 900;
        margin-top: 1rem;
        margin-bottom: 0.4rem;
      }

      input,
      select,
      textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(6, 27, 49, 0.18);
        border-radius: 16px;
        padding: 0.9rem 1rem;
        font: inherit;
      }

      textarea {
        min-height: 130px;
        resize: vertical;
      }

      .button {
        margin-top: 1.5rem;
        border: 0;
        border-radius: 999px;
        padding: 0.85rem 1.3rem;
        background: linear-gradient(135deg, #e7b65f, #d39b45);
        color: #061b31;
        font-weight: 900;
        cursor: pointer;
      }

      .secondary {
        display: inline-flex;
        margin-top: 1rem;
        color: #061b31;
        font-weight: 900;
        text-decoration: none;
      }

      .message {
        margin-top: 1rem;
        font-weight: 800;
      }
    </style>
  </head>

  <body>
    <main class="shell">
      <a class="secondary" href="/admin">← Back to Admin</a>

      <h1>Add AI Resource</h1>

      <div class="card">
        <form id="aiForm">
          <label>Pack Code</label>
          <input name="code" placeholder="Example: CI-01" required />

          <label>Pack Title</label>
          <input name="title" placeholder="Example: Failed Software Launch" required />

          <label>Skill Area</label>
          <input name="skill" placeholder="Example: Client Interviewing" required />

          <label>Difficulty</label>
          <select name="difficulty">
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>

          <label>Student-Facing Summary</label>
          <textarea name="summary" placeholder="Briefly explain what this pack helps students practise." required></textarea>

          <label>Student Pack Knowledge</label>
          <textarea name="studentKnowledge" placeholder="Paste key content, tasks, scenarios, outcomes, etc."></textarea>

          <label>Hidden Tutor Guidance</label>
          <textarea name="tutorGuidance" placeholder="Paste tutor-only hints, marking guidance, and internal notes."></textarea>

          <button class="button" type="submit">Save AI Resource</button>

          <p id="message" class="message"></p>
        </form>
      </div>
    </main>

    <script>
      const form = document.getElementById("aiForm");
      const message = document.getElementById("message");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        message.textContent = "Saving...";

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
          const response = await fetch("/.netlify/functions/create-ai-knowledge-item", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "Save failed.");
          }

          message.textContent = "AI resource saved. Netlify will redeploy shortly.";
          form.reset();
        } catch (error) {
          message.textContent = error.message;
        }
      });
    </script>
  </body>
</html>
