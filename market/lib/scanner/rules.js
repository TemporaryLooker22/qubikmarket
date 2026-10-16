// Règles de détection des backdoors et du code malveillant dans les scripts Roblox (Luau).
//
// Chaque règle a :
//   id       : identifiant unique
//   severity : "critical" | "high" | "medium" | "low"
//   title    : nom court affiché
//   explain  : explication pour l'utilisateur
//   pattern  : expression régulière cherchée dans le code (sans les commentaires)
//   when     : (optionnel) condition supplémentaire sur le code complet
(function (root) {
  const SUSPICIOUS_HOSTS = [
    "pastebin\\.com", "hastebin", "rentry\\.co", "raw\\.githubusercontent\\.com", "gist\\.githubusercontent\\.com",
    "glitch\\.me", "repl\\.co", "replit\\.dev", "ngrok", "000webhost", "herokuapp\\.com", "trycloudflare\\.com",
  ];

  const RULES = [
    {
      id: "require-asset-id",
      severity: "critical",
      title: "Chargement d'un module externe par ID",
      explain: "require() avec un numéro charge un ModuleScript publié sur Roblox par quelqu'un d'autre. C'est la technique de backdoor la plus courante : le code réel est caché ailleurs et peut être modifié à tout moment.",
      // require(123456), require(0x1E240), require(1234 + 5678)... : uniquement des chiffres et des opérateurs
      pattern: /\brequire\s*\(\s*\(?\s*(0x[0-9a-fA-F]+|\d+)[\d\s+\-*\/%^().xXa-fA-F]*\)/g,
    },
    {
      id: "require-tonumber",
      severity: "critical",
      title: "Chargement d'un module externe caché",
      explain: "require(tonumber(...)) transforme un texte en numéro de module pour masquer l'ID chargé. Aucun script légitime n'a besoin de faire ça.",
      pattern: /\brequire\s*\(\s*tonumber\s*\(/g,
    },
    {
      id: "obfuscator-signature",
      severity: "critical",
      title: "Code obfusqué (signature d'obfuscateur)",
      explain: "Le code a été passé dans un outil d'obfuscation connu pour le rendre illisible. Dans un asset vendu, c'est presque toujours un moyen de cacher une backdoor.",
      pattern: /\b(Luraph|IronBrew|Iron\s*Brew|MoonSec|PSU\s*Obfuscat|Prometheus\s*Obfuscat|Luarmor|Obfuscated\s+(with|by|using))\b|wearedevs\.net\/obfuscator/gi,
      scanComments: true,
    },
    {
      id: "loadstring",
      severity: "high",
      title: "Exécution de code dynamique (loadstring)",
      explain: "loadstring() exécute du texte comme du code. Combiné à un téléchargement ou à un RemoteEvent, il permet à un inconnu d'exécuter n'importe quoi sur ton serveur.",
      pattern: /\bloadstring\s*\(/g,
    },
    {
      id: "fenv",
      severity: "high",
      title: "Manipulation de l'environnement (getfenv / setfenv)",
      explain: "getfenv/setfenv permettent d'accéder à des fonctions de façon détournée, par exemple getfenv()['req'..'uire'], pour échapper aux recherches. Très utilisé par les backdoors.",
      pattern: /\b(getfenv|setfenv)\s*\(/g,
    },
    {
      id: "insert-service",
      severity: "high",
      title: "Chargement d'un asset externe (InsertService)",
      explain: "InsertService:LoadAsset() insère dans ton jeu un modèle publié sur Roblox. Il peut contenir n'importe quel script.",
      pattern: /\bLoadAsset(Version)?\s*\(|GetService\s*\(\s*["']InsertService["']\s*\)/g,
    },
    {
      id: "http-get-exploit",
      severity: "high",
      title: "Fonction d'exploit (HttpGet)",
      explain: "game:HttpGet() n'existe pas dans Roblox normal : c'est une fonction d'exécuteurs d'exploits. Sa présence indique un script de triche ou malveillant.",
      pattern: /\bgame\s*:\s*HttpGet(Async)?\s*\(/g,
    },
    {
      id: "discord-webhook",
      severity: "high",
      title: "Envoi de données vers Discord",
      explain: "Le script contient une adresse de webhook Discord. Il peut envoyer des informations sur ton jeu ou tes joueurs à quelqu'un d'autre.",
      pattern: /discord(app)?\.com\/api\/webhooks/gi,
    },
    {
      id: "suspicious-host",
      severity: "high",
      title: "Téléchargement depuis un site suspect",
      explain: "Le script contacte un site souvent utilisé pour héberger du code malveillant (Pastebin, GitHub raw, etc.).",
      pattern: new RegExp("(" + SUSPICIOUS_HOSTS.join("|") + ")", "gi"),
    },
    {
      id: "source-write",
      severity: "high",
      title: "Modification du code d'autres scripts",
      explain: "Écrire dans .Source modifie le code d'autres scripts. C'est le mode de propagation des virus de plugins Roblox.",
      pattern: /(?<!\bself)\.Source\s*=[^=]/g,
      // seulement si le script manipule d'autres scripts (sinon "Source" peut être un simple champ de table)
      when: (code) => /IsA\s*\(\s*["'](Script|LocalScript|ModuleScript|LuaSourceContainer|BaseScript)["']|Instance\.new\s*\(\s*["'](Script|LocalScript|ModuleScript)["']|ClassName\s*==\s*["'](Script|LocalScript|ModuleScript)["']/.test(code),
    },
    {
      id: "hidden-whitespace",
      severity: "high",
      title: "Code caché après des espaces",
      explain: "Une ligne contient du code repoussé très loin à droite par des centaines d'espaces, pour qu'il soit invisible dans l'éditeur.",
      pattern: /\S[ \t]{150,}\S|^[ \t]{150,}\S/gm,
    },
    {
      id: "string-char",
      severity: "high",
      title: "Texte caché (string.char)",
      explain: "Une longue suite de nombres convertie en texte avec string.char(). C'est une technique classique pour cacher un ID ou du code.",
      pattern: /\bstring\.char\s*\(\s*\d+(\s*,\s*\d+){5,}/g,
    },
    {
      id: "escaped-string",
      severity: "medium",
      title: "Texte encodé",
      explain: "Une chaîne écrite entièrement en codes (\\104\\101... ou \\x68\\x65...) pour la rendre illisible.",
      pattern: /(\\\d{2,3}){10,}|(\\x[0-9a-fA-F]{2}){10,}/g,
    },
    {
      id: "long-encoded-blob",
      severity: "medium",
      title: "Gros bloc de données encodées",
      explain: "Une très longue chaîne de type base64 : elle peut contenir du code caché destiné à être décodé puis exécuté.",
      pattern: /["'`][A-Za-z0-9+\/=]{400,}["'`]/g,
    },
    {
      id: "http-service",
      severity: "medium",
      title: "Communication avec un serveur externe",
      explain: "Le script envoie ou reçoit des données sur Internet via HttpService. Ça peut être légitime (statistiques, API), mais vérifie à quelle adresse.",
      // GetAsync seulement sur un objet "Http..." (sinon c'est souvent un DataStore)
      pattern: /\b\w*Http\w*\s*:\s*(GetAsync|PostAsync|RequestAsync)\s*\(|:\s*(PostAsync|RequestAsync)\s*\(/gi,
      when: (code) => /HttpService/.test(code),
    },
    {
      id: "studio-check",
      severity: "medium",
      title: "Comportement différent hors de Studio",
      explain: "Le script vérifie s'il tourne dans Roblox Studio. Certaines backdoors restent inactives pendant tes tests et ne s'activent qu'en jeu publié.",
      pattern: /\bnot\s+[\w.:()"' ]*IsStudio\s*\(\s*\)|IsStudio\s*\(\s*\)\s*(==|~=)\s*(false|true)/g,
    },
    {
      id: "self-relocate",
      severity: "medium",
      title: "Le script se déplace",
      explain: "Le script se déplace vers ServerScriptService ou ailleurs dans le jeu, souvent pour se cacher de l'Explorer.",
      pattern: /\bscript\.Parent\s*=\s*(game\b|workspace\b)|\bscript\.Parent\s*=\s*[^\n]*GetService\s*\(\s*["'](ServerScriptService|ServerStorage|ReplicatedStorage|Lighting)["']/g,
    },
    {
      id: "user-id-check",
      severity: "low",
      title: "Accès réservé à un joueur précis",
      explain: "Le script donne un traitement spécial à un UserId ou un pseudo écrit en dur. Ça peut être un panneau admin légitime, ou un accès caché pour le créateur de l'asset.",
      pattern: /\.UserId\s*==\s*\d{3,}|\b(\w*pla?ye?r\w*|plr|p)\.Name\s*==\s*["'][A-Za-z0-9_]{3,20}["']/gi,
    },
    {
      id: "prompt-purchase",
      severity: "low",
      title: "Propose des achats aux joueurs",
      explain: "Le script ouvre des fenêtres d'achat (gamepass, produit). Vérifie que les IDs t'appartiennent : sinon, l'argent de tes joueurs va à quelqu'un d'autre.",
      pattern: /:\s*Prompt(GamePass|Product|Purchase|Premium|Bundle)?Purchase\s*\(/g,
    },
  ];

  // Noms d'objets typiques des anciens "virus" Roblox
  const VIRUS_NAMES = /^(vaccine|virus|infect(ed|ion)?|spread(er|ify)?|snap\s*reducer|anti[\s_-]*lag|anti[\s_-]*virus|lag[\s_-]*fix|fire\s*spread|ro-?xploit|backdoor)$/i;

  root.QubikRules = { RULES, VIRUS_NAMES };
  if (typeof module !== "undefined") module.exports = root.QubikRules;
})(typeof window !== "undefined" ? window : globalThis);
