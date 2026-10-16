# Qubik Scanner

Scanner gratuit de backdoors pour les fichiers Roblox. C'est la première brique de **Qubik** (qubikmarket.com).

Il analyse les fichiers `.rbxm`, `.rbxmx`, `.rbxl`, `.rbxlx`, `.lua` et `.luau`, ou du code collé.
Tout se passe **dans le navigateur** : aucun fichier n'est envoyé sur Internet.

## L'utiliser

Double-clique sur `index.html` : la page s'ouvre dans ton navigateur. Aucune installation n'est nécessaire.

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page web |
| `css/style.css` | Le design (thème clair et sombre) |
| `js/app.js` | L'interface : dépôt de fichiers, affichage des rapports |
| `js/scanner.js` | Le moteur : applique les règles et calcule le verdict |
| `js/rules.js` | **Les règles de détection** (c'est ici qu'on en ajoute) |
| `js/rbxm.js` | La lecture des fichiers Roblox, binaires et XML |
| `js/lz4.js` | La décompression LZ4 (format binaire Roblox) |
| `js/vendor/fzstd.js` | La décompression ZSTD (bibliothèque externe, licence MIT) |
| `test/` | Les tests automatiques et des exemples de scripts piégés |

## Lancer les tests

Il faut [Node.js](https://nodejs.org) :

```
node test/run-tests.js
```

## Ajouter une règle

Ouvre `js/rules.js` et ajoute un objet dans la liste `RULES` :

```js
{
  id: "mon-id",
  severity: "high",          // critical, high, medium ou low
  title: "Nom court",
  explain: "Explication pour l'utilisateur",
  pattern: /ce_qu_on_cherche/g,
},
```

Ensuite, ajoute un exemple dans `test/samples/` et la ligne correspondante dans `test/run-tests.js`.

## Calcul du verdict

Chaque règle détectée rapporte des points : critique 100, élevé 40, moyen 15, info 5. Une même règle ne compte qu'une fois.

- **Dangereux** : au moins une détection critique, ou 80 points et plus.
- **Suspect** : 25 points et plus.
- **Propre** : en dessous.

## Mettre en ligne gratuitement

Avec **Cloudflare Pages** (gratuit) :
1. Crée un compte sur https://pages.cloudflare.com.
2. Choisis « Upload assets » et dépose le dossier `qubik-scanner`.
3. Dans « Custom domains », ajoute `scan.qubikmarket.com`.
