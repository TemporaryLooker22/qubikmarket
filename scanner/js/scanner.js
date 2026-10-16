// Moteur du scanner : applique les règles à chaque script et calcule un verdict.
(function (root) {
  const { RULES, VIRUS_NAMES } = root.QubikRules || require("./rules.js");
  const { readRobloxFile } = root.QubikRbxm || require("./rbxm.js");

  const SEVERITY_POINTS = { critical: 100, high: 40, medium: 15, low: 5 };
  const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

  // Remplace les commentaires Lua par des espaces (en gardant les retours à la ligne),
  // pour ne pas signaler un "require(123)" écrit dans un commentaire.
  // Les chaînes de caractères sont conservées, car les URLs et IDs suspects s'y trouvent.
  function stripComments(code) {
    const out = code.split("");
    const blank = (from, to) => {
      for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
    };
    // Repère un crochet long "[[", "[=[", "[==[" ... et renvoie la fin correspondante
    const longBracketAt = (pos) => {
      const m = /^\[(=*)\[/.exec(code.slice(pos, pos + 20));
      return m ? { open: m[0].length, close: "]" + m[1] + "]" } : null;
    };

    let i = 0;
    while (i < code.length) {
      const c = code[i];

      if (c === "-" && code[i + 1] === "-") {
        const lb = longBracketAt(i + 2);
        let end;
        if (lb) {
          const close = code.indexOf(lb.close, i + 2 + lb.open);
          end = close === -1 ? code.length : close + lb.close.length;
        } else {
          end = code.indexOf("\n", i);
          if (end === -1) end = code.length;
        }
        blank(i, end);
        i = end;
      } else if (c === '"' || c === "'" || c === "`") {
        i++;
        while (i < code.length && code[i] !== c && code[i] !== "\n") i += code[i] === "\\" ? 2 : 1;
        i++;
      } else if (c === "[") {
        const lb = longBracketAt(i);
        if (lb) {
          const close = code.indexOf(lb.close, i + lb.open);
          i = close === -1 ? code.length : close + lb.close.length;
        } else i++;
      } else i++;
    }
    return out.join("");
  }

  function lineAt(code, index) {
    let line = 1;
    for (let k = 0; k < index; k++) if (code.charCodeAt(k) === 10) line++;
    return line;
  }

  function snippetAt(code, index) {
    const start = code.lastIndexOf("\n", index) + 1;
    let end = code.indexOf("\n", index);
    if (end === -1) end = code.length;
    const line = code.slice(start, end);
    // On centre l'extrait sur la zone détectée si la ligne est très longue
    const col = index - start;
    if (line.length <= 160) return line.trim();
    const from = Math.max(0, col - 60);
    return (from > 0 ? "…" : "") + line.slice(from, from + 160).trim() + "…";
  }

  // Analyse le code d'un seul script
  function scanSource(code, scriptPath) {
    const cleaned = stripComments(code);
    const findings = [];

    for (const rule of RULES) {
      const target = rule.scanComments ? code : cleaned;
      if (rule.when && !rule.when(cleaned)) continue;

      rule.pattern.lastIndex = 0;
      let match;
      let count = 0;
      while ((match = rule.pattern.exec(target)) && count < 20) {
        if (match[0].length === 0) { rule.pattern.lastIndex++; continue; }
        count++;
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          title: rule.title,
          explain: rule.explain,
          script: scriptPath,
          line: lineAt(code, match.index),
          snippet: snippetAt(code, match.index),
        });
      }
    }

    // Ligne gigantesque : typique du code obfusqué
    const lines = cleaned.split("\n");
    const longest = lines.reduce((max, l, idx) => (l.length > max.len ? { len: l.length, idx } : max), { len: 0, idx: 0 });
    if (longest.len > 3000) {
      findings.push({
        ruleId: "huge-line",
        severity: "medium",
        title: "Ligne de code anormalement longue",
        explain: `Une ligne fait ${longest.len} caractères. Un code normal ne ressemble jamais à ça : c'est souvent du code obfusqué ou compacté pour être illisible.`,
        script: scriptPath,
        line: longest.idx + 1,
        snippet: snippetAt(code, code.split("\n").slice(0, longest.idx).join("\n").length + (longest.idx ? 1 : 0)),
      });
    }

    // Combinaison : une condition cachée (joueur précis, hors Studio) + une action dangereuse
    // dans le même script = schéma classique de backdoor
    const trigger = findings.find((f) => f.ruleId === "user-id-check" || f.ruleId === "studio-check");
    const danger = findings.find((f) => f.severity === "high" || f.severity === "critical");
    if (trigger && danger) {
      findings.push({
        ruleId: "hidden-trigger-combo",
        severity: "critical",
        title: "Action dangereuse déclenchée sous condition cachée",
        explain: `Ce script combine « ${trigger.title} » et « ${danger.title} ». Une action risquée qui ne s'active que pour une personne précise ou seulement en jeu publié est la signature typique d'une backdoor.`,
        script: scriptPath,
        line: trigger.line,
        snippet: trigger.snippet,
      });
    }

    return findings;
  }

  function computeVerdict(findings) {
    // Chaque règle ne compte qu'une fois : 20 détections de la même règle = 1 seul problème
    const perRule = {};
    for (const f of findings) perRule[f.ruleId] = SEVERITY_POINTS[f.severity];
    const score = Object.values(perRule).reduce((a, b) => a + b, 0);
    const hasCritical = findings.some((f) => f.severity === "critical");

    let verdict = "clean";
    if (hasCritical || score >= 80) verdict = "dangerous";
    else if (score >= 25) verdict = "suspicious";
    return { score, verdict };
  }

  // Analyse un fichier complet (octets) et renvoie un rapport
  function scanFile(bytes, fileName) {
    const file = readRobloxFile(bytes, fileName);
    const findings = [];

    for (const s of file.scripts) findings.push(...scanSource(s.source, s.path));

    for (const inst of file.instances) {
      if (VIRUS_NAMES.test(inst.name.trim())) {
        findings.push({
          ruleId: "virus-name",
          severity: "medium",
          title: "Nom d'objet typique d'un virus",
          explain: `Un objet s'appelle "${inst.name}". Ce nom est souvent utilisé par les anciens virus Roblox qui se répandent dans les jeux.`,
          script: inst.path,
          line: null,
          snippet: `${inst.className} "${inst.name}"`,
        });
      }
    }

    findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    return {
      fileName,
      format: file.format,
      instanceCount: file.instances.length,
      scriptCount: file.scripts.length,
      findings,
      ...computeVerdict(findings),
    };
  }

  root.QubikScanner = { scanFile, scanSource, stripComments, computeVerdict };
  if (typeof module !== "undefined") module.exports = root.QubikScanner;
})(typeof window !== "undefined" ? window : globalThis);
