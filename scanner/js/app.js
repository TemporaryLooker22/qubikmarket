// Interface de la page : lecture des fichiers déposés et affichage des rapports.
(function () {
  const { scanFile } = window.QubikScanner;

  const VERDICTS = {
    clean: { label: "✓ Propre", text: "Aucun signe de backdoor détecté." },
    suspicious: { label: "⚠ Suspect", text: "Des éléments méritent une vérification manuelle avant d'utiliser ce fichier." },
    dangerous: { label: "✕ Dangereux", text: "Ce fichier contient des signes clairs de backdoor ou de code malveillant. Ne l'utilise pas dans ton jeu." },
  };
  const SEVERITY_LABELS = { critical: "Critique", high: "Élevé", medium: "Moyen", low: "Info" };

  const results = document.getElementById("results");
  const drop = document.getElementById("drop");
  const fileInput = document.getElementById("fileInput");

  // Échappe le texte pour l'afficher sans risque dans la page
  function esc(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Regroupe les détections identiques (même règle, même script)
  function groupFindings(findings) {
    const groups = new Map();
    for (const f of findings) {
      const key = f.ruleId + "|" + f.script;
      if (groups.has(key)) groups.get(key).extra++;
      else groups.set(key, { ...f, extra: 0 });
    }
    return [...groups.values()];
  }

  function renderReport(report) {
    const v = VERDICTS[report.verdict];
    const formatLabel = { binary: "binaire", xml: "XML", text: "script" }[report.format];
    const items = groupFindings(report.findings)
      .map((f) => `
        <li class="finding">
          <div class="finding-top">
            <span class="sev ${f.severity}">${SEVERITY_LABELS[f.severity]}</span>
            <span class="finding-title">${esc(f.title)}</span>
          </div>
          <div class="finding-where">${esc(f.script)}${f.line ? " · ligne " + f.line : ""}${f.extra ? ` · +${f.extra} autre(s)` : ""}</div>
          <p>${esc(f.explain)}</p>
          <pre>${esc(f.snippet)}</pre>
        </li>`)
      .join("");

    return `
      <article class="report">
        <div class="report-head">
          <span class="verdict ${report.verdict}">${v.label}</span>
          <div>
            <div class="report-file">${esc(report.fileName)}</div>
            <div class="report-meta">Format ${formatLabel} · ${report.scriptCount} script(s) · ${report.instanceCount} objet(s) · score de risque ${report.score}</div>
          </div>
        </div>
        <p class="report-summary">${v.text}</p>
        ${items ? `<ul class="findings">${items}</ul>` : ""}
      </article>`;
  }

  function renderError(fileName, message) {
    return `
      <article class="report">
        <div class="report-head">
          <span class="verdict error">Erreur</span>
          <div class="report-file">${esc(fileName)}</div>
        </div>
        <p class="report-summary">Impossible de lire ce fichier : ${esc(message)}</p>
      </article>`;
  }

  function scanBytes(bytes, fileName) {
    try {
      return renderReport(scanFile(bytes, fileName));
    } catch (err) {
      return renderError(fileName, err.message);
    }
  }

  async function handleFiles(files) {
    const html = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      html.push(scanBytes(bytes, file.name));
    }
    results.innerHTML = html.join("");
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Sélection de fichier
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));

  // Glisser-déposer
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    handleFiles(e.dataTransfer.files);
  });

  // Code collé
  document.getElementById("scanCode").addEventListener("click", () => {
    const code = document.getElementById("codeInput").value;
    if (!code.trim()) return;
    results.innerHTML = scanBytes(new TextEncoder().encode(code), "Code collé");
  });

  // Onglets
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        const active = t === tab;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", active);
      });
      document.querySelectorAll(".tab-body").forEach((body) => {
        body.hidden = body.dataset.body !== tab.dataset.tab;
      });
    });
  });
})();
