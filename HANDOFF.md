# Handoff — Projet Qubik

Ce fichier résume la discussion qui a créé ce projet, pour reprendre le travail en local, avec Claude Code ou seul.
**Pour Claude Code** : lis ce fichier en entier avant de commencer.

---

## 1. Le projet en bref

**Qubik** est une marketplace de ressources **uniquement Roblox** (scripts, modèles, UI, maps, plugins, animations), sur le modèle de BuiltByBit.

**Le problème visé** : chez BuiltByBit, les files de validation des ressources sont énormes et saturées.

**La réponse de Qubik** : un **scanner anti-backdoor automatique**.
- **Scan propre** : la ressource est en ligne **immédiatement**.
- **Scan suspect** : elle passe en modération humaine (seuls ces cas créent une file d'attente).
- **Scan dangereux** : refus automatique, avec le rapport envoyé au vendeur.

**Positionnement à garder en tête** :
- Le concurrent le plus dangereux est le **Creator Store de Roblox**, qui vend maintenant des assets payants directement dans Studio. Il faut se différencier : systèmes complets, place files, services, support, confiance et sécurité.
- Les risques identifiés : public très jeune (paiements, KYC, RGPD), leaks et piratage, problème de l'œuf et de la poule (vendeurs ↔ acheteurs).

## 2. Décisions prises

| Sujet | Décision |
|---|---|
| Nom | **Qubik** (marque), « QubikMarket » pour le domaine |
| Domaine | **qubikmarket.com** (acheté). `bloxbay.eu` aussi en possession, non utilisé |
| Noms écartés | BloxBay (le `.com` est pris), BloxStore (`bloxstore.gg` existe déjà, revente d'objets Roblox), RoMarket (« Ro-Market » existe déjà sur BuiltByBit et sur Roblox) |
| Validation marché | Interviews de vendeurs refusées par l'utilisateur. On construit directement |
| Commission | 10 % |
| Ordre de travail | 1) scanner, 2) MVP de la marketplace, 3) déploiement sur Vercel |

## 3. Profil de l'utilisateur

- **Débutant en développement** : écrire le code, expliquer simplement, en **français**, tutoiement.
- Le code est commenté en **français**. Garder ce style.
- Le dépôt GitHub `TemporaryLooker22/qubikmarket` est **public**. Il est recommandé de le passer en privé, pour que les règles du scanner ne servent pas à le contourner.

## 4. Structure du dépôt

```
qubikmarket/
├── HANDOFF.md        ← ce fichier
├── README.md
├── scanner/          ← Qubik Scanner : outil web autonome (HTML/JS, sans build)
│   ├── index.html    ← double-clic pour l'ouvrir
│   ├── js/lz4.js     ← décompression LZ4 (format binaire Roblox)
│   ├── js/vendor/fzstd.js ← décompression ZSTD (MIT), utilisée par les fichiers Studio récents
│   ├── js/rbxm.js    ← lecteur .rbxm/.rbxl (binaire) et .rbxmx/.rbxlx (XML) → liste des scripts
│   ├── js/rules.js   ← LES RÈGLES DE DÉTECTION (20 règles)
│   ├── js/scanner.js ← moteur : retire les commentaires, applique les règles, combinaisons, score, verdict
│   ├── js/app.js     ← interface de la page
│   └── test/run-tests.js + test/samples/ ← 9 échantillons (piégés et sains)
└── market/           ← la marketplace (Next.js 15.5, App Router, TypeScript, Tailwind v4)
    ├── app/actions.ts        ← TOUTE la logique : inscription, connexion, publication + scan, achat, modération
    ├── app/page.tsx          ← accueil
    ├── app/resources/        ← catalogue (recherche, filtres) et page ressource [slug]
    ├── app/sell/             ← mise en vente
    ├── app/dashboard/        ← espace membre (mes ressources, achats, revenus)
    ├── app/admin/            ← file de modération (ADMIN uniquement)
    ├── app/api/download/[id] ← téléchargement sécurisé (vendeur, admin ou acheteur seulement)
    ├── app/checkout/success/ ← retour Stripe (vérifie le paiement auprès de Stripe)
    ├── lib/auth.ts           ← sessions par cookie JWT signé (jose), bcrypt
    ├── lib/scan.ts           ← adaptateur TypeScript vers lib/scanner/
    ├── lib/scanner/          ← COPIE de scanner/js/ (voir « Pièges » ci-dessous)
    ├── lib/storage.ts        ← Vercel Blob si BLOB_READ_WRITE_TOKEN est défini, sinon dossier storage/uploads
    ├── lib/payments.ts       ← Stripe Checkout, mode démo si pas de clé
    ├── lib/catalog.ts        ← catégories, formats, limite de taille (4 Mo), libellés
    ├── components/           ← ResourceCard, ScanBadge, ScanReportView, formulaires…
    └── prisma/schema.prisma  ← User, Resource, Purchase (PostgreSQL)
```

## 5. Le scanner : ce qu'il détecte

- **Critique** :
  - `require(ID)` en dur, y compris en hexadécimal ou avec des calculs ;
  - `require(tonumber(...))` ;
  - signatures d'obfuscateurs (Luraph, IronBrew, MoonSec…) ;
  - **combinaison** d'une condition cachée (UserId précis, `not IsStudio()`) avec une action dangereuse.
- **Élevé** :
  - `loadstring`, `getfenv`/`setfenv`, InsertService/LoadAsset ;
  - `game:HttpGet` (fonction d'exploit) ;
  - webhooks Discord, hébergeurs suspects (Pastebin, GitHub raw…) ;
  - écriture dans `.Source` (virus de plugin) ;
  - code repoussé par plus de 150 espaces ;
  - `string.char` avec de longues suites de nombres.
- **Moyen** :
  - chaînes encodées en échappements, gros blobs base64 ;
  - appels HttpService ;
  - vérification `IsStudio`, script qui se déplace ;
  - noms d'objets de virus (Vaccine, Infected…) ;
  - ligne de plus de 3 000 caractères.
- **Info** : comparaison de UserId ou de pseudo, `Prompt*Purchase`.

**Calcul du score** : critique 100, élevé 40, moyen 15, info 5. **Chaque règle ne compte qu'une fois.**
- **Dangereux** : au moins une détection critique, ou 80 points et plus.
- **Suspect** : 25 points et plus.
- **Propre** : en dessous.

**Faux positifs mesurés** : sur 1 905 fichiers open source sains (rbx-test-files de Rojo, Knit, Nevermore, RbxUtil, roblox-lua-promise), **1 895 sont jugés propres**. Les 10 autres utilisent vraiment `loadstring`, `getfenv` ou InsertService, ce qui justifie une relecture humaine.

## 6. Ce qui a été testé

- `node scanner/test/run-tests.js` : les 9 tests passent.
- Lecteur de fichiers : 116 fichiers Roblox réels lus, y compris en ZSTD. Les versions binaire et XML d'un même fichier donnent des résultats identiques.
- Test de bout en bout de la marketplace (Playwright), **sur PostgreSQL** :
  - inscription (le premier compte devient ADMIN) ;
  - publications propre, dangereuse et suspecte, avec le bon statut pour chacune ;
  - approbation en modération ;
  - côté acheteur : ressource refusée invisible (404), téléchargement bloqué avant achat (403), achat en mode démo puis téléchargement OK ;
  - affichage mobile sans défilement horizontal.
- `npm run build` passe.
- **Non testé** : Vercel Blob (pas de clé disponible), paiement Stripe réel en mode test.

## 7. État du déploiement

**Pas encore déployé.** L'environnement cloud de la discussion bloquait `api.vercel.com`. Le code est prêt pour Vercel. Étapes à faire sur vercel.com, détaillées aussi dans `market/README.md` :

1. **Add New → Project** et importer `qubikmarket`, avec **Root Directory = `market`**.
2. **Storage** :
   - **Neon (Postgres)**, qui ajoute `DATABASE_URL` et `DATABASE_URL_UNPOOLED` ;
   - **Blob**, qui ajoute `BLOB_READ_WRITE_TOKEN`.
3. **Variables d'environnement** :
   - `SESSION_SECRET` (au moins 32 caractères aléatoires) ;
   - `APP_URL` ;
   - `STRIPE_SECRET_KEY`, facultatif : sans clé, le site reste en mode démo.
4. **Redeploy**. Les migrations sont appliquées au build (`prisma migrate deploy`).
5. **Créer le premier compte**, qui deviendra admin, puis ajouter le domaine `qubikmarket.com`.

Le **scanner** peut être déployé à part, comme second projet Vercel (Root Directory = `scanner`, site statique), par exemple sur `scan.qubikmarket.com`.

## 8. Lancer en local

```bash
# Scanner : rien à installer
open scanner/index.html                  # ou double-clic
node scanner/test/run-tests.js

# Marketplace : il faut PostgreSQL (local, ou une base gratuite sur neon.tech)
cd market
npm install
cp .env.example .env                     # remplir DATABASE_URL, DATABASE_URL_UNPOOLED, SESSION_SECRET
npx prisma migrate dev
npm run dev                              # http://localhost:3000
npx prisma studio                        # pour voir la base de données
```

## 9. Pièges et points d'attention

- **Le scanner existe en deux exemplaires** : `scanner/js/` et `market/lib/scanner/`. Toute modification des règles doit être recopiée de l'un à l'autre. Idée d'amélioration : un package partagé (workspace npm) ou un script de synchronisation.
- Les fichiers du scanner sont des **scripts UMD** (`window.X` dans le navigateur, `module.exports` dans Node). Ils sont chargés par `require` dans `lib/scan.ts`. Ne pas les convertir en modules ES sans adapter les deux usages : la page `index.html` doit continuer à marcher en double-clic (`file://`).
- **Limite de 4 Mo** par fichier, imposée par Vercel (4,5 Mo par requête). Pour aller au-delà, il faut un envoi direct du navigateur vers Blob (`@vercel/blob/client`), puis un scan côté serveur à partir de l'URL.
- Les fichiers sur Blob sont en `access: "public"` avec un suffixe aléatoire. Leur URL n'est jamais exposée, tout passe par `/api/download`.
- **Le premier compte créé devient ADMIN** (`app/actions.ts`, fonction `register`).
- **Stripe** : la confirmation se fait uniquement sur la page de succès. Il n'y a **pas encore de webhook**, et **pas de Stripe Connect** : tout l'argent arrive sur le compte de la plateforme.
- Next.js est **figé en 15.5** et Prisma **en 6.x**, volontairement : Next 16 et Prisma 7 changent des API.
- Ne jamais committer `.env`. Il est déjà dans le `.gitignore`.

## 10. Prochaines étapes, par priorité

1. **Déployer sur Vercel** (section 7) et vérifier qu'une publication fonctionne en ligne, ce qui testera Blob.
2. Passer le dépôt GitHub en **privé**.
3. **Stripe Connect** (payer les vendeurs) et **webhook Stripe** (`checkout.session.completed`).
4. **Images et captures d'écran** des ressources : la vignette actuelle est un simple dégradé par catégorie.
5. Envoi de fichiers de plus de 4 Mo par envoi direct vers Blob.
6. Vérification de l'email et mot de passe oublié.
7. Pages légales : CGV, mentions légales, politique de confidentialité (RGPD). Le public Roblox est très jeune.
8. Avis et notes, profil public des vendeurs.
9. Connexion avec Roblox (OAuth) pour vérifier les comptes.
10. Marketing :
    - mettre le scanner en ligne gratuitement (`scan.qubikmarket.com`) ;
    - créer un bot Discord qui scanne les fichiers postés ;
    - recruter 5 à 10 vendeurs « fondateurs » avec une commission réduite.
