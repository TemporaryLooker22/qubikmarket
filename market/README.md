# Qubik — Marketplace Roblox (MVP)

Marketplace de ressources Roblox (scripts, modèles, UI, maps, plugins…), avec un **scan anti-backdoor automatique** à chaque publication.

- **Scan propre** : la ressource est en ligne immédiatement, sans file d'attente.
- **Scan à vérifier** : elle passe par la page Modération.
- **Scan dangereux** : refus automatique, avec le rapport envoyé au vendeur.

## Mettre en ligne sur Vercel

1. Sur https://vercel.com, connecte-toi avec GitHub, puis **Add New → Project** et importe le dépôt `qubikmarket`.
2. **Root Directory** : choisis `market`, puis clique sur **Deploy**. Le premier déploiement échouera, c'est normal : la base de données n'existe pas encore.
3. Dans le projet Vercel, onglet **Storage** :
   - **Create Database → Neon (Postgres)** : ça ajoute `DATABASE_URL` et `DATABASE_URL_UNPOOLED` ;
   - **Create → Blob** : ça ajoute `BLOB_READ_WRITE_TOKEN`.
4. **Settings → Environment Variables**, ajoute :
   - `SESSION_SECRET` : une longue chaîne aléatoire (par exemple sur https://generate-secret.vercel.app/32) ;
   - `APP_URL` : l'adresse du site (ex. `https://qubikmarket.vercel.app`, puis `https://qubikmarket.com`).
5. **Deployments → Redeploy**. Les tables sont créées automatiquement pendant le build (`prisma migrate deploy`).
6. Crée ton compte en premier sur le site en ligne : c'est lui qui sera administrateur.
7. Pour ton domaine : **Settings → Domains → qubikmarket.com**, puis suis les instructions DNS chez ton registrar.

## Lancer le site sur ton ordinateur

Il faut [Node.js](https://nodejs.org) (version 20 ou plus) et une base PostgreSQL. Le plus simple est de créer une base gratuite sur https://neon.tech et de copier ses adresses dans `.env`.

```bash
npm install                     # installe les dépendances (une seule fois)
cp .env.example .env            # crée la configuration, puis remplis-la
npx prisma migrate dev          # crée les tables
npm run dev                     # lance le site
```

Ouvre ensuite http://localhost:3000.

> **Le premier compte créé devient administrateur** : il a accès à la page Modération.

## Paiements

- **Mode démo** (par défaut, `STRIPE_SECRET_KEY` vide) : les achats sont simulés, aucun argent n'est débité.
- **Mode test Stripe** : crée un compte sur https://stripe.com, copie ta clé de test `sk_test_...` dans `.env`, puis paie avec la carte de test `4242 4242 4242 4242`.

## Organisation

| Dossier / fichier | Rôle |
|---|---|
| `app/page.tsx` | Page d'accueil |
| `app/resources/` | Catalogue et page d'une ressource |
| `app/sell/` | Formulaire de mise en vente |
| `app/dashboard/` | Espace membre : mes ressources, mes achats, revenus |
| `app/admin/` | File de modération |
| `app/actions.ts` | **Toute la logique** : inscription, connexion, publication, achat, modération |
| `app/api/download/` | Téléchargement sécurisé (réservé aux acheteurs) |
| `lib/scanner/` | Le scanner anti-backdoor (copie de Qubik Scanner) |
| `lib/auth.ts` | Sessions et connexion |
| `lib/payments.ts` | Stripe |
| `prisma/schema.prisma` | Structure de la base de données |
| `components/` | Éléments d'interface réutilisables |

Pour voir le contenu de la base de données : `npx prisma studio`.

## Ce qui manque avant un vrai lancement

1. **Paiement des vendeurs** avec Stripe Connect : pour l'instant, tout l'argent arrive sur le compte de la plateforme.
2. **Webhook Stripe**, pour confirmer un paiement même si l'acheteur ferme la page.
3. **Fichiers de plus de 4 Mo** : envoi direct du navigateur vers Vercel Blob (Vercel limite les requêtes à 4,5 Mo).
4. **Images et captures d'écran** des ressources.
5. **Vérification de l'email** et **mot de passe oublié**.
6. **Avis et notes** des acheteurs.
7. **Pages légales** : CGV, mentions légales, politique de confidentialité (RGPD).
8. **Connexion avec Roblox** (OAuth), pour vérifier les comptes.
