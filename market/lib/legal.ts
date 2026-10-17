// Pages légales : conditions d'utilisation et politique de confidentialité (anglais et français).
// PREMIER JET à faire relire par un juriste avant le lancement réel.
// Les éléments entre crochets [ … ] sont à compléter (nom légal, adresse, email, pays).
import type { Locale } from "./i18n/dictionaries";

export const LEGAL_UPDATED = new Date("2026-10-17");

type LegalDoc = { title: string; body: string };

const TERMS: Record<Locale, LegalDoc> = {
  en: {
    title: "Terms of Service",
    body: `Welcome to Qubik, a marketplace for Roblox resources (scripts, systems, models, maps, interfaces, effects, sounds and animations). These terms apply to everyone who visits qubikmarket.com or creates an account. By creating an account, you accept them.

Qubik is operated by [Legal name], [address], [country] ("Qubik", "we"). Contact: [contact email].

Qubik is an independent service. It is not affiliated with, endorsed or sponsored by Roblox Corporation. "Roblox" is a trademark of Roblox Corporation.

## 1. Your account

- You must be **at least 13 years old** to create an account. If you are under the age of digital consent in your country (for example 15 in France) or under 18, you confirm that a parent or legal guardian has agreed to your use of Qubik, in particular before any purchase.
- The information you provide must be accurate. You are responsible for keeping your password secret and for everything done with your account.
- One person, one account. We may refuse a username that is offensive, misleading or that imitates someone else.

## 2. Buying resources

- Prices are shown in euros, taxes included where applicable. Payments are processed by **Stripe**; Qubik never sees your card details.
- After payment, the resource is available to download immediately from the resource page and from your dashboard.
- **Right of withdrawal:** resources are digital content supplied immediately. By buying, you ask for immediate access and acknowledge that you lose your 14-day right of withdrawal once the download is available, as allowed by EU consumer law.
- If a resource does not work as described or does not match its description, contact us at [contact email]. Refunds are handled case by case [to be completed with the final refund policy].

## 3. What you are allowed to do with a resource

Unless the seller states other terms on the resource page, buying a resource gives you a **personal, non-exclusive, non-transferable licence** to use it in your own Roblox experiences, including commercial ones. You may modify it for that purpose.

You may **not** resell, share, publish or redistribute the resource (as is or modified), for example as a free model, a leak or in another marketplace.

## 4. Selling resources

- You may only publish resources that **you created or have the right to sell**. Publishing someone else's work, leaked or stolen content is forbidden.
- Every file is **automatically scanned** for backdoors and malicious code. Depending on the result, a resource is published immediately, reviewed by a moderator, or rejected. We may remove any resource at any time if it breaks these terms.
- Forbidden content: malware, backdoors, hidden remote code, obfuscated code meant to hide its behaviour, content that breaks the Roblox Terms of Use or Community Standards, illegal, hateful, sexual or violent content, and content that infringes someone's rights.
- Qubik keeps a **4% commission** on each sale. Payouts to sellers [to be completed: payment method, schedule and minimum amount]. To receive payouts for paid resources, you must be at least 18 or act through a parent or legal guardian, and complete the identity checks required by our payment provider.
- You remain the owner of your resources. You grant Qubik a licence to host, display, scan and distribute them to buyers, and to show their images and descriptions to promote the marketplace.

## 5. Acceptable use

You agree not to: break the law; attack, overload or try to bypass the security of Qubik; try to fool the scanner; create fake accounts, fake reviews or fake sales; harass other users; or use Qubik to distribute anything harmful.

## 6. Security scanner

The scanner greatly reduces the risk of backdoors, but **no automated check is perfect**. Qubik does not guarantee that a resource is free of every defect or risk. Always test a resource before using it in a live game.

## 7. Intellectual property and reports

If you believe a resource infringes your rights, send us a report at [contact email] with a link to the resource and proof of your rights. We will review it and remove the resource if needed.

## 8. Suspension and closing an account

We may suspend or close an account that breaks these terms, after warning the user when possible. You can close your account at any time by contacting us. Resources you bought remain available unless they were removed for legal reasons.

## 9. Liability

Qubik provides the marketplace "as is". To the extent allowed by law, Qubik is not liable for indirect damages, loss of profits or data, or for content published by sellers. Nothing in these terms limits your rights as a consumer under the law of your country.

## 10. Changes

We may update these terms. We will announce important changes on the site or by email. The date of the latest version is shown at the top of this page.

## 11. Applicable law

These terms are governed by the law of [country]. In case of dispute, we will first try to find an amicable solution. Consumers may also use the European Online Dispute Resolution platform.`,
  },
  fr: {
    title: "Conditions d'utilisation",
    body: `Bienvenue sur Qubik, une marketplace de ressources Roblox (scripts, systèmes, modèles, maps, interfaces, effets, sons et animations). Ces conditions s'appliquent à toute personne qui visite qubikmarket.com ou crée un compte. En créant un compte, tu les acceptes.

Qubik est édité par [Nom légal], [adresse], [pays] (« Qubik », « nous »). Contact : [email de contact].

Qubik est un service indépendant. Il n'est ni affilié, ni approuvé, ni sponsorisé par Roblox Corporation. « Roblox » est une marque de Roblox Corporation.

## 1. Ton compte

- Tu dois avoir **au moins 13 ans** pour créer un compte. Si tu as moins que l'âge de consentement numérique de ton pays (par exemple 15 ans en France) ou moins de 18 ans, tu confirmes qu'un parent ou ton représentant légal a accepté que tu utilises Qubik, en particulier avant tout achat.
- Les informations que tu donnes doivent être exactes. Tu es responsable de garder ton mot de passe secret et de tout ce qui est fait avec ton compte.
- Une personne, un compte. Nous pouvons refuser un pseudo injurieux, trompeur ou qui imite quelqu'un d'autre.

## 2. Acheter des ressources

- Les prix sont affichés en euros, toutes taxes comprises le cas échéant. Les paiements sont traités par **Stripe** ; Qubik ne voit jamais tes coordonnées bancaires.
- Après le paiement, la ressource est téléchargeable immédiatement depuis sa page et depuis ton espace.
- **Droit de rétractation :** les ressources sont des contenus numériques fournis immédiatement. En achetant, tu demandes un accès immédiat et tu reconnais perdre ton droit de rétractation de 14 jours dès que le téléchargement est disponible, comme le permet le droit européen de la consommation.
- Si une ressource ne fonctionne pas comme décrit ou ne correspond pas à sa description, contacte-nous à [email de contact]. Les remboursements sont étudiés au cas par cas [à compléter avec la politique de remboursement définitive].

## 3. Ce que tu peux faire avec une ressource

Sauf conditions différentes indiquées par le vendeur sur la page de la ressource, l'achat te donne une **licence personnelle, non exclusive et non transférable** pour l'utiliser dans tes propres expériences Roblox, y compris commerciales. Tu peux la modifier dans ce but.

Tu ne peux **pas** revendre, partager, publier ou redistribuer la ressource (telle quelle ou modifiée), par exemple en modèle gratuit, en leak ou sur une autre marketplace.

## 4. Vendre des ressources

- Tu ne peux publier que des ressources **que tu as créées ou que tu as le droit de vendre**. Publier le travail de quelqu'un d'autre, du contenu leaké ou volé est interdit.
- Chaque fichier est **scanné automatiquement** à la recherche de backdoors et de code malveillant. Selon le résultat, la ressource est publiée tout de suite, relue par un modérateur ou refusée. Nous pouvons retirer une ressource à tout moment si elle ne respecte pas ces conditions.
- Contenus interdits : logiciels malveillants, backdoors, code distant caché, code obfusqué pour cacher son fonctionnement, contenus contraires aux Conditions d'utilisation ou aux Standards de la communauté Roblox, contenus illégaux, haineux, sexuels ou violents, et contenus qui portent atteinte aux droits d'autrui.
- Qubik garde une **commission de 4 %** sur chaque vente. Paiement des vendeurs : [à compléter : moyen de paiement, fréquence et montant minimum]. Pour recevoir les gains des ressources payantes, tu dois avoir au moins 18 ans ou passer par un parent ou ton représentant légal, et réussir les vérifications d'identité demandées par notre prestataire de paiement.
- Tu restes propriétaire de tes ressources. Tu accordes à Qubik une licence pour les héberger, les afficher, les scanner et les fournir aux acheteurs, et pour montrer leurs images et descriptions afin de promouvoir la marketplace.

## 5. Bon usage

Tu t'engages à ne pas : enfreindre la loi ; attaquer, surcharger ou contourner la sécurité de Qubik ; essayer de tromper le scanner ; créer de faux comptes, de faux avis ou de fausses ventes ; harceler d'autres utilisateurs ; ni utiliser Qubik pour diffuser quoi que ce soit de nuisible.

## 6. Scanner de sécurité

Le scanner réduit fortement le risque de backdoors, mais **aucune vérification automatique n'est parfaite**. Qubik ne garantit pas qu'une ressource est exempte de tout défaut ou risque. Teste toujours une ressource avant de l'utiliser dans un jeu en ligne.

## 7. Propriété intellectuelle et signalements

Si tu penses qu'une ressource porte atteinte à tes droits, envoie-nous un signalement à [email de contact] avec le lien de la ressource et la preuve de tes droits. Nous l'examinerons et retirerons la ressource si nécessaire.

## 8. Suspension et fermeture de compte

Nous pouvons suspendre ou fermer un compte qui ne respecte pas ces conditions, en prévenant l'utilisateur quand c'est possible. Tu peux fermer ton compte à tout moment en nous contactant. Les ressources achetées restent disponibles, sauf si elles ont été retirées pour des raisons légales.

## 9. Responsabilité

Qubik fournit la marketplace « en l'état ». Dans les limites permises par la loi, Qubik n'est pas responsable des dommages indirects, pertes de bénéfices ou de données, ni des contenus publiés par les vendeurs. Rien dans ces conditions ne limite tes droits de consommateur selon la loi de ton pays.

## 10. Modifications

Nous pouvons mettre à jour ces conditions. Les changements importants seront annoncés sur le site ou par email. La date de la dernière version est indiquée en haut de cette page.

## 11. Droit applicable

Ces conditions sont régies par le droit [du pays]. En cas de litige, nous chercherons d'abord une solution amiable. Les consommateurs peuvent aussi utiliser la plateforme européenne de règlement en ligne des litiges.`,
  },
};

const PRIVACY: Record<Locale, LegalDoc> = {
  en: {
    title: "Privacy Policy",
    body: `This policy explains what personal data Qubik collects, why, and what your rights are. It follows the EU General Data Protection Regulation (GDPR).

**Data controller:** [Legal name], [address], [country]. Contact for any privacy question: [contact email].

## 1. Data we collect

- **Account:** username, email address and password (stored only in encrypted form, we can never read it).
- **Activity:** resources you publish (files, images, descriptions), purchases, downloads, moderation decisions and scan reports.
- **Payments:** handled by Stripe. We receive the payment status and amount, never your card details.
- **Technical data:** IP address and server logs (security and troubleshooting), and two cookies described below.

We do not sell your data and we do not use advertising trackers.

## 2. Why we use it (legal bases)

- To create your account, sell and deliver resources, and pay sellers — **performance of the contract**.
- To keep Qubik secure, scan files, prevent fraud and abuse — **legitimate interest**.
- To keep accounting and tax records — **legal obligation**.
- We will ask for your **consent** before sending marketing emails, if we ever do.

## 3. Cookies

Qubik only uses cookies that are **strictly necessary**:

- \`qubik_session\`: keeps you logged in (secure, unreadable by scripts).
- \`qubik-lang\`: remembers your language (English or French) for one year.

These cookies do not need your consent, which is why there is no cookie banner.

## 4. Who processes your data

We use trusted providers who process data on our behalf:

- **Vercel** (hosting and file storage) — servers in the EU and the United States, covered by the EU Standard Contractual Clauses.
- **Neon** (database) — EU region (Frankfurt).
- **Stripe** (payments).
- **Translation services** (MyMemory or DeepL) — only receive the public descriptions of resources, never your personal data.

## 5. How long we keep it

- Account data: as long as your account is open, then deleted within 30 days of closure, except what we must keep by law.
- Purchase and payment records: 10 years (accounting obligations) [adjust to the law of your country].
- Server logs: up to 12 months.

## 6. Your rights

You can ask to **access**, **correct**, **delete** or **export** your data, **object** to or **restrict** its use, by writing to [contact email]. We answer within one month.

You can also file a complaint with your data protection authority (for example the CNIL in France or the Data Protection Authority in Belgium).

## 7. Young users

Qubik is open from **13 years old**. If you are under the age of digital consent in your country, a parent or legal guardian must agree to your use of Qubik. Parents can contact us at [contact email] to access or delete their child's data.

## 8. Security

Passwords are hashed, connections are encrypted (HTTPS), downloads are only available to buyers, and access to the database is restricted.

## 9. Changes

We may update this policy. The date of the latest version is shown at the top of this page; we will tell you about important changes.`,
  },
  fr: {
    title: "Politique de confidentialité",
    body: `Cette politique explique quelles données personnelles Qubik collecte, pourquoi, et quels sont tes droits. Elle suit le Règlement général sur la protection des données (RGPD).

**Responsable du traitement :** [Nom légal], [adresse], [pays]. Contact pour toute question sur tes données : [email de contact].

## 1. Les données collectées

- **Compte :** pseudo, adresse email et mot de passe (stocké uniquement sous forme chiffrée, nous ne pouvons jamais le lire).
- **Activité :** ressources que tu publies (fichiers, images, descriptions), achats, téléchargements, décisions de modération et rapports de scan.
- **Paiements :** gérés par Stripe. Nous recevons le statut et le montant du paiement, jamais tes coordonnées bancaires.
- **Données techniques :** adresse IP et journaux du serveur (sécurité et résolution de problèmes), et deux cookies décrits plus bas.

Nous ne vendons pas tes données et n'utilisons aucun traceur publicitaire.

## 2. Pourquoi nous les utilisons (bases légales)

- Créer ton compte, vendre et fournir les ressources, payer les vendeurs — **exécution du contrat**.
- Sécuriser Qubik, scanner les fichiers, prévenir la fraude et les abus — **intérêt légitime**.
- Tenir la comptabilité et les obligations fiscales — **obligation légale**.
- Nous te demanderons ton **consentement** avant d'envoyer des emails promotionnels, si nous le faisons un jour.

## 3. Cookies

Qubik n'utilise que des cookies **strictement nécessaires** :

- \`qubik_session\` : te garde connecté (sécurisé, illisible par les scripts).
- \`qubik-lang\` : retient ta langue (anglais ou français) pendant un an.

Ces cookies ne nécessitent pas ton consentement : c'est pour ça qu'il n'y a pas de bandeau cookies.

## 4. Qui traite tes données

Nous faisons appel à des prestataires de confiance qui traitent les données pour notre compte :

- **Vercel** (hébergement et stockage des fichiers) — serveurs dans l'UE et aux États-Unis, encadrés par les clauses contractuelles types de l'UE.
- **Neon** (base de données) — région UE (Francfort).
- **Stripe** (paiements).
- **Services de traduction** (MyMemory ou DeepL) — ne reçoivent que les descriptions publiques des ressources, jamais tes données personnelles.

## 5. Durée de conservation

- Données du compte : tant que ton compte est ouvert, puis supprimées dans les 30 jours après sa fermeture, sauf ce que la loi nous oblige à garder.
- Achats et paiements : 10 ans (obligations comptables) [à adapter selon la loi de ton pays].
- Journaux du serveur : 12 mois maximum.

## 6. Tes droits

Tu peux demander à **accéder**, **corriger**, **supprimer** ou **récupérer** tes données, t'**opposer** à leur utilisation ou la **limiter**, en écrivant à [email de contact]. Nous répondons sous un mois.

Tu peux aussi porter plainte auprès de l'autorité de protection des données (par exemple la CNIL en France ou l'Autorité de protection des données en Belgique).

## 7. Jeunes utilisateurs

Qubik est ouvert à partir de **13 ans**. Si tu as moins que l'âge de consentement numérique de ton pays, un parent ou ton représentant légal doit accepter que tu utilises Qubik. Les parents peuvent nous écrire à [email de contact] pour consulter ou supprimer les données de leur enfant.

## 8. Sécurité

Les mots de passe sont hachés, les connexions sont chiffrées (HTTPS), les téléchargements sont réservés aux acheteurs et l'accès à la base de données est restreint.

## 9. Modifications

Nous pouvons mettre à jour cette politique. La date de la dernière version est indiquée en haut de cette page ; nous t'informerons des changements importants.`,
  },
};

export function getLegal(doc: "terms" | "privacy", locale: Locale) {
  return (doc === "terms" ? TERMS : PRIVACY)[locale];
}
