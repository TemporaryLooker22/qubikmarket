# Qubik

La marketplace 100 % Roblox, avec un scan anti-backdoor automatique sur chaque ressource. Site : [qubikmarket.com](https://qubikmarket.com).

| Dossier | Contenu |
|---|---|
| [`market/`](market/) | Le site de la marketplace (Next.js, Prisma, Stripe) |
| [`scanner/`](scanner/) | Qubik Scanner : l'outil gratuit de détection de backdoors (HTML/JS, sans installation) |

Chaque dossier a son propre README avec les instructions.

> Le scanner est aussi copié dans `market/lib/scanner/`. Quand tu modifies les règles dans `scanner/js/`, recopie les fichiers dans `market/lib/scanner/`.
