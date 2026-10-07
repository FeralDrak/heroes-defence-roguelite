# ⚔️ Heroes Defence — L'Arène des Damnés

Jeu de survie en arène en **3D vue du dessus**, jouable **dans le navigateur**, en **solo** ou en
**coopération en ligne (jusqu'à 4 joueurs)**, avec une forte composante **roguelite** :
des vagues de monstres de plus en plus féroces, des boss, du butin à la Diablo, des talents à choisir à
chaque niveau, et une progression par **succès** qui débloque petit à petit le contenu.

> Le jeu est volontairement **très difficile**. Esquivez les zones rouges, construisez votre héros, et
> recommencez : chaque partie fait progresser votre profil.

---

## Démarrage rapide

Prérequis : [Node.js](https://nodejs.org) **18 ou plus récent**.

```bash
npm install
npm start
```

Ouvrez ensuite **http://localhost:3000** dans Chrome, Edge ou Firefox.

La console du serveur affiche aussi les adresses du PC sur le réseau local (ex. `http://192.168.1.20:3000`).

---

## Jouer avec des amis

Le principe : **vous lancez le serveur sur votre PC**, vous créez une partie depuis le menu
(« Héberger une partie »), puis vous envoyez le **lien d'invitation** affiché dans le salon. La simulation
tourne dans **votre** navigateur (celui de l'hôte) ; le serveur ne fait que relayer les messages.

> 💡 **L'hôte joue sur `http://localhost:3000`** : c'est là que ses profils sont sauvegardés
> (les profils sont stockés dans le navigateur, par adresse). Ce sont les amis qui utilisent
> l'adresse réseau / Internet.

### Option 1 — Même réseau local (Wi-Fi / box commune)

Envoyez l'adresse « Réseau » affichée par le serveur. Le lien d'invitation du salon l'utilise
automatiquement. Si Windows le demande, autorisez Node.js dans le pare-feu (réseaux privés).

### Option 2 — Amis sur Internet : `npm run share` (le plus simple, sans toucher à la box)

Installez une seule fois [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
(gratuit, aucun compte nécessaire) :

```bash
winget install --id Cloudflare.cloudflared
```

Puis, à la place de `npm start` :

```bash
npm run share
```

Le serveur démarre **et** ouvre un tunnel temporaire. La console affiche une adresse du type
`https://quelque-chose.trycloudflare.com` : jouez vous-même sur `http://localhost:3000`, créez la partie,
et le **lien d'invitation du salon utilise automatiquement l'adresse publique**. L'adresse change à chaque
lancement (attendez une dizaine de secondes qu'elle réponde).

Avec un autre outil de tunnel ([ngrok](https://ngrok.com) : `ngrok http 3000`, ou `cloudflared` lancé à la main),
cliquez sur **« ✎ Adresse »** dans le salon et collez l'URL publique, ou fournissez-la au démarrage :

```bash
# PowerShell
$env:PUBLIC_URL="https://quelque-chose.trycloudflare.com"; npm start
```

### Option 3 — Redirection de port

Redirigez le port **TCP 3000** de votre box vers votre PC, puis partagez `http://VOTRE-IP-PUBLIQUE:3000`
(le port peut être changé avec la variable d'environnement `PORT`).

### Option 4 — Hébergement en ligne

Le projet est un simple serveur Node (HTTP + WebSocket) : il se déploie tel quel sur Render, Railway,
Fly.io, un VPS… (`npm install` puis `npm start`, port fourni par la variable `PORT`). Jouez alors depuis
l'adresse du déploiement.

### Déroulement d'une partie à plusieurs

- Les amis ouvrent le lien (ou « Rejoindre une partie » + code à 4 caractères, ou la liste des parties ouvertes).
- Chacun choisit son héros parmi les classes **débloquées sur le profil de l'hôte**, puis se met prêt.
- L'hôte choisit la difficulté et l'arène, et lance la partie.
- Un joueur déconnecté peut revenir (même onglet / rechargement de page) : il retrouve son héros.
  En son absence, son héros est mis à l'abri (invisible et invulnérable) et les vagues s'adaptent au
  nombre de joueurs présents. Un ami arrivé en retard peut rejoindre une partie en cours depuis le salon.

---

## Règles

- **30 vagues**, un **boss toutes les 5 vagues** (Roi des Os, Matriarche Arachnide, Colosse de Pierre,
  Liche Éternelle, Seigneur Infernal, puis le Dévoreur à la vague 30). Après la victoire : **mode infini**.
- **Entre les vagues** : boutique, inventaire, talents. Dès qu'un joueur appuie sur **« Prêt » (G)**,
  un compte à rebours de **30 secondes** démarre ; si **tous** les joueurs sont prêts, la vague démarre
  dans **3 secondes**.
- Chaque monstre tué donne **or et expérience à toute l'équipe**, de façon équitable.
- **Montée de niveau** : une icône « ⬆ X choix de talent » apparaît ; on choisit **entre les vagues** un bonus
  parmi 3 (classe + généraux), avec une **rareté aléatoire** (Commun → Légendaire).
- **Butin** à la Diablo : Commun, Magique, Rare, **Légendaire** (pouvoir spécial aléatoire) et **Unique**
  (objet nommé au pouvoir qui modifie le gameplay). Le butin au sol est partagé : **jetez un objet**
  (clic droit dans l'inventaire) pour le donner à un allié.
- **Coffres** pendant/après les vagues (maintenir F) ; les coffres **maudits** déclenchent une embuscade.
- Un héros à terre peut être **ranimé** par un allié (maintenir F à côté). Tous les héros reviennent à la
  fin de la vague. Si toute l'équipe tombe : défaite.

## Commandes (modifiables dans Paramètres)

| Action | Touche |
|---|---|
| Se déplacer | Z Q S D (AZERTY) / W A S D (QWERTY) — positions physiques |
| Viser | Souris |
| Attaque principale | Clic gauche (maintenir) |
| Compétence secondaire | Clic droit |
| Compétences | A / E (AZERTY) — Q / E (QWERTY) |
| Ultime | R |
| Esquive | Espace |
| Ramasser / coffre / ranimer | F |
| Potion | & (touche 1) |
| Prêt (lancer la vague) | G |
| Inventaire / Boutique / Talents / Succès | I / B / T / J |
| Afficher le butin au sol | Alt |
| Discussion | Entrée |
| Menu | Échap |

---

## Contenu

- **8 classes** : Guerrier, Archère, Mage, Invocateur, Ingénieur, Paladin, Assassine, Démoniste
  (6 compétences chacune).
- **127 objets uniques**, **36 aspects légendaires**, **164 talents** (29 généraux + ~17 par classe).
- **15 types de monstres** (+ invocations de boss), 14 affixes d'élites, **6 boss** avec phases et attaques
  télégraphiées.
- **6 difficultés** (Normal → Tourment III) et **3 arènes** (dont la Forge Infernale et ses éruptions).
- **131 succès** (grille consultable avec conditions précises, progression et récompenses).

### Profils et déverrouillages

- Un **nouveau profil** démarre avec **75 % du contenu verrouillé** (classes, uniques, aspects, certains
  talents, difficultés, arènes). Chaque succès débloque un ou plusieurs éléments, disponibles dès la
  partie suivante.
- En multijoueur, **seul le profil de l'hôte progresse**, mais **tout ce que fait n'importe quel joueur**
  compte pour ses succès.
- Les profils sont sauvegardés dans le navigateur (localStorage). Utilisez **Exporter / Importer** depuis
  l'écran de choix du profil pour les sauvegarder ou les transférer.

---

## Développement

```bash
npm run share   # serveur + tunnel Cloudflare pour inviter des amis sur Internet
npm run dev     # serveur avec rechargement automatique
npm test        # cohérence du contenu (déverrouillages, talents, protocole réseau)
npm run sim     # simulation sans affichage avec des bots : node tests/headless-sim.js [classe|all|mix] [vagueMax] [joueurs] [difficulté] [god]
```

Lancement rapide pour tester : `http://localhost:3000/?quick=solo&cls=mage` (dernier profil utilisé).

### Architecture

```
server/server.js        Serveur HTTP statique + relais WebSocket (salons, codes d'invitation)
public/js/core/         Simulation partagée (aucune dépendance au DOM, testable dans Node)
  data/                 Classes, compétences, talents, objets, uniques, aspects, monstres, boss, succès…
  sim/                  Moteur : combat, IA des monstres/boss/invocations, vagues, butin, actions
  net/                  Protocole binaire des instantanés + états des joueurs
public/js/net/          Session hôte (fait tourner la simulation à 30 Hz) et session client
public/js/game/         Monde côté client (interpolation), contrôleur (prédiction du déplacement)
public/js/render/       Rendu Three.js (instanciation des monstres, effets, zones, overlay 2D)
public/js/ui/           Menus, salon, HUD, inventaire, boutique, talents, succès
public/js/audio/        Sons et musique générés procéduralement (WebAudio)
```

- L'hôte fait autorité : il simule le monde à **30 Hz** et diffuse des instantanés binaires à 15 Hz.
- Chaque joueur fait autorité sur **son propre déplacement** (réactivité), l'hôte valide tout le reste.
- Aucun asset externe : modèles 3D, textures, sons et musique sont générés par le code.
