import "server-only";

// Fournisseurs d'IA utilisés ensemble par la file d'analyse (voir lib/ai/run.ts) : chacun analyse
// une ressource à son rythme, et si l'un est saturé ou en panne, les autres continuent.
// Tous sont compatibles OpenAI (POST /chat/completions) et utilisables sans clé.
//
// - OVH : gpt-oss-120b, hébergé en Europe. Sans clé : 2 requêtes par minute ; avec OVH_AI_KEY : 400 par minute.
// - Pollinations : gpt-oss-20b (servi par OVH), sans clé : 1 réponse toutes les 30 s par adresse IP.
// - LLM7 : gpt-oss-20b, sans clé : petit quota de texte par jour (quelques analyses), puis il demande d'attendre
//   jusqu'au lendemain ; LLM7_TOKEN facultatif pour plus.
// - OpenRouter : « openrouter/free » choisit un modèle gratuit disponible. Clé gratuite obligatoire
//   (OPENROUTER_API_KEY, sinon il n'est pas utilisé) : 20 requêtes par minute, 50 par jour
//   (1 000 par jour une fois 10 $ de crédits achetés).
//
// QUBIK_AI_PROVIDERS choisit lesquels utiliser (par défaut « ovh,pollinations,llm7,openrouter »).

export type ProviderId = "ovh" | "pollinations" | "llm7" | "openrouter";

export type Provider = {
  id: ProviderId;
  name: string; // affiché dans la modération
  url: string; // adresse complète de /chat/completions
  model: string;
  key?: string;
  strictSchema: boolean; // format JSON imposé par schéma (sinon « json_object » + forme décrite dans la consigne)
  gapMs: number; // temps minimum entre deux analyses de ce fournisseur
  headers?: Record<string, string>;
  needsKey?: boolean; // pas utilisé tant que sa clé n'est pas configurée
};

const ovhKey = () => process.env.OVH_AI_KEY || undefined;

const ALL: Record<ProviderId, () => Provider> = {
  ovh: () => ({
    id: "ovh",
    name: "OVHcloud",
    url: `${process.env.OVH_AI_BASE_URL ?? "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1"}/chat/completions`,
    model: process.env.QUBIK_AI_MODEL ?? "gpt-oss-120b",
    key: ovhKey(),
    strictSchema: true,
    gapMs: ovhKey() ? 0 : 31_000,
  }),
  pollinations: () => ({
    id: "pollinations",
    name: "Pollinations",
    url: "https://text.pollinations.ai/openai",
    model: process.env.POLLINATIONS_MODEL ?? "openai-fast",
    strictSchema: false,
    gapMs: 31_000,
  }),
  llm7: () => ({
    id: "llm7",
    name: "LLM7",
    url: "https://api.llm7.io/v1/chat/completions",
    model: process.env.LLM7_MODEL ?? "gpt-oss:20b",
    key: process.env.LLM7_TOKEN || undefined,
    strictSchema: false,
    gapMs: process.env.LLM7_TOKEN ? 5_000 : 61_000,
  }),
  openrouter: () => ({
    id: "openrouter",
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
    key: process.env.OPENROUTER_API_KEY || undefined,
    strictSchema: false,
    gapMs: 3_100,
    // Identifie Qubik auprès d'OpenRouter (recommandé par leur documentation)
    headers: { "HTTP-Referer": "https://qubikmarket.com", "X-Title": "Qubik" },
    needsKey: true,
  }),
};

export function activeProviders(): Provider[] {
  const wanted = (process.env.QUBIK_AI_PROVIDERS ?? "ovh,pollinations,llm7,openrouter").split(",").map((s) => s.trim());
  const list = wanted
    .filter((id): id is ProviderId => id in ALL)
    .map((id) => ALL[id]())
    .filter((p) => !p.needsKey || p.key);
  return list.length ? list : [ALL.ovh()];
}

export const providerName = (id: string | undefined) => (id && id in ALL ? ALL[id as ProviderId]().name : null);
