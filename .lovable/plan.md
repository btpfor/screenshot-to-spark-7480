# Corrections progressives de l’API Cloudflare existante

## Périmètre et garanties

Conserver **Cloudflare Workers + D1 + R2** comme backend principal cible, avec l’API existante `https://gie-vipbg-api.sheikhmbaake.workers.dev`. L’application reste hébergée via Lovable ; ce plan ne prévoit aucun déploiement ni nouvelle infrastructure Cloudflare.

- Aucun changement applicatif ou de production avant votre autorisation : cette étape prépare uniquement le plan.
- Aucun compte administrateur recréé, aucun mot de passe existant modifié, aucune donnée ni aucun véhicule supprimé.
- Conserver les matricules existants exactement, notamment `vipbgg-656`, sans renumérotation ; nouveaux matricules séquentiels côté serveur.
- Préserver le design, les champs personnels, la plateforme professionnelle, les dossiers, cartes, CSV et historiques.
- L’authentification cible sera exclusivement celle du Worker. Ne pas construire une nouvelle connexion avec Supabase Auth ni mélanger les deux sessions. L’application actuellement active reste inchangée jusqu’à validation d’un ensemble compatible.
- Les fichiers Worker fournis sont des références externes : ne pas copier leur `package.json` ou leur configuration Wrangler dans l’application Lovable.

## Priorité 0 — Autoriser le domaine publié et vérifier les sessions

### CORS
**Fichiers :** `wrangler.jsonc` et `src/index.ts` du Worker existant (fourni sous le nom `index.ts`).

Proposer l’ajout de **`https://screenshot-to-spark-7480.lovable.app`** à `ALLOWED_ORIGINS`, sans retirer les domaines déjà autorisés. Cette modification sera à appliquer au service existant uniquement après autorisation ; aucun déploiement automatique.

Conserver une liste d’origines exacte, sans `*` avec les cookies. Vérifier `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true` et `Vary: Origin` sur les réponses normales, erreurs et prévols OPTIONS. Étendre méthodes/en-têtes seulement à ceux effectivement utilisés par les nouvelles routes. Conserver le contrôle d’origine des écritures : CORS ne remplace pas les droits ni la protection contre les requêtes indésirables.

**Validation :** origine Lovable admise, origine inconnue refusée, requêtes GET/POST et erreurs lisibles. Le dernier test connu répondait 204 pour Lovable, mais sans en-têtes d’autorisation.

### Authentification et sessions
**Fichiers Worker :** `src/index.ts`, helpers de session, routes `/api/auth/*`.
**Fichiers applicatifs à adapter après validation :** `src/lib/auth.tsx`, `src/lib/api-client.ts`, `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/changer-mot-de-passe.tsx`, `src/start.ts` si nécessaire après lecture de son middleware.

- Vérifier les corps et réponses de login, me, logout et change-password ; conserver la vérification des hachages existants sans les recalculer.
- Préparer des appels `credentials: "include"`, sans jeton Lovable Cloud envoyé au Worker ; utilisateur et rôles relus depuis `/api/auth/me`.
- Conserver le cookie HttpOnly, Secure et le stockage haché du jeton dans D1. Empêcher la mise en cache des réponses privées.
- Bloquer côté Worker les opérations métier quand le changement initial est obligatoire, en laissant accessibles l’état de session, le changement de mot de passe et la déconnexion.
- Préparer la révocation des autres sessions lors des futurs changements/réinitialisations explicitement demandés ; cette préparation ne change aucun mot de passe actuel.
- Aligner la règle du formulaire et du Worker : mot de passe provisoire choisi ou généré à **six chiffres**, puis remplacement obligatoire ; préserver la règle actuelle d’au moins six caractères pour le remplacement, sans imposer silencieusement les douze caractères du Worker fourni.
- Tester séparément Safari/iPhone et Chrome/Android : le domaine Lovable et `workers.dev` sont intersites ; **la correction CORS seule ne garantit pas les cookies tiers**. Si les navigateurs bloquent la session, présenter une option de domaine de même site ou un relais sécurisé à approuver avant réalisation ; ne pas exposer de jeton pour contourner le blocage.

**Limite actuelle :** aucune connexion administrateur réelle à cette API n’a été vérifiée. Les essais authentifiés nécessiteront une session obtenue avec votre accord, sans recréer de compte, sans réinitialiser de mot de passe et sans communiquer les secrets dans le code ou le rapport.

## Priorité 1 — Corriger les incompatibilités D1 et fiabiliser les membres

**Fichiers :** `src/index.ts` du Worker, schémas de référence `0001_init.sql` / `0002_full_schema.sql`, nouvelle migration D1 incrémentale proposée dans le projet du Worker, tests locaux SQLite/D1.

Ne pas rejouer les deux scripts d’initialisation. Comparer d’abord leurs définitions au schéma réellement installé, en lecture seule. Préparer une sauvegarde et un contrôle des lignes avant toute migration autorisée.

1. **Date d’adhésion :** ne plus insérer explicitement NULL dans `members.join_date` ; valider une date fournie ou laisser le défaut SQL s’appliquer.
2. **Statuts :** préserver `actif`, `inactif`, `suspendu` dans l’application et le statut historique `radie` du schéma ; préparer un alignement de la contrainte D1 sans convertir les lignes existantes. Si SQLite impose une reconstruction de table pour le CHECK, soumettre cette opération séparément ; aucune suppression de table dans cette phase.
3. **Rôles :** `users.role` autorise cinq valeurs dans `0001_init.sql`, alors que le Worker et `user_roles` en déclarent huit. Définir une source d’autorité cohérente dans `user_roles`, avec compatibilité des anciens comptes, sans réattribuer leurs rôles ni changer leur connexion.
4. **Plateforme :** `0002_full_schema.sql` exclut explicitement `platform`. Préparer une colonne nullable et sa prise en charge par les contrats Worker afin de conserver Yango, Heetch, taxi traditionnel et autre pour les futures saisies ; ne pas inventer de valeur pour les anciennes lignes.
5. **Matricules :** remplacer la lecture du maximum suivie d’une insertion par une allocation atomique adaptée à D1, protégée contre les créations/imports concurrents. Initialiser le compteur à partir des identifiants existants sans les modifier ni réutiliser un numéro attribué.
6. **Doublons :** normaliser la CNI et préparer un index de comparaison protégé compatible avec son chiffrement. Détecter les doublons existants en lecture seule avant toute contrainte ; ne pas les fusionner ni les supprimer. Reproduire les contrôles de téléphone et l’exception autorisée.
7. **Création atomique :** garantir la cohérence utilisateur/membre/rôle/dossier/journal, éviter les comptes orphelins et figer les contrats de réponse attendus par l’interface.
8. **Historique :** rapprocher les usages de `audit_logs` et `audit_log`, tous deux présents dans les scripts, sans effacer ni déplacer les journaux existants.

## Priorité 1 — Retirer le véhicule de la création d’un membre

**Fichiers applicatifs :**
- `src/routes/_authenticated/admin.membres.tsx` : retirer l’objet `vehicle` et les lectures `v_brand`, `v_model`, `v_plate` de l’envoi.
- `src/lib/members.functions.ts` : retirer `vehicle` de `memberSchema` (donc de `MemberInput`), puis le bloc `m.vehicle` / insertion automatique dans `vehicles`.

**Constat précis :** le formulaire lu ne présente déjà plus de champs véhicule visibles, mais l’objet envoyé et le bloc d’insertion restent présents. Le CSV actuellement lu ne demande pas de véhicule. Vérifier aussi les modèles/imports et les appels qui réutilisent le schéma, sans toucher à la table `vehicles`.

Le Worker fourni crée déjà les membres sans véhicule : préserver cette séparation dans son contrat. Conserver prénom, nom, téléphone, adresse, CNI, naissance, adhésion, permis/validité, photo, statut, plateforme et accès membre. La flotte reste un module indépendant.

**Tests :** création et import sans véhicule ; aucune écriture dans la flotte, même si un ancien client envoie un objet véhicule ; matricules, mot de passe provisoire et changement initial conservés. Aucun test d’écriture en production sans autorisation distincte.

## Priorité 2 — Compléter les contrats et endpoints manquants

Les routes suivantes sont **proposées**, non déjà disponibles ni validées. Leur absence est constatée dans le fichier fourni ; les 404 connus concernent seulement les méthodes/chemins effectivement testés.

| Module | Endpoints à préparer | Garanties |
| --- | --- | --- |
| Membres | `GET /api/membres/:id`, `PATCH /api/membres/:id` | Consultation personnelle ou responsable autorisé ; modification administrative complète sans modifier le matricule/login |
| CSV | `POST /api/membres/import`, `GET /api/membres/export` | Validation ligne par ligne, doublons, matricules atomiques, résultats détaillés, journal ; aucun véhicule requis ; accès réservé |
| Personnel et rôles | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id/roles` | Super administrateur uniquement pour les rôles ; huit rôles ; impossibilité de retirer le dernier super administrateur ; ne pas recréer l’administrateur existant |
| Transactions | `GET /api/transactions`, `POST /api/transactions`, `PATCH /api/transactions/:id` | Permissions financières actuelles, validation montant FCFA et type, justificatifs privés, historique et totaux cohérents |
| Véhicules | `GET /api/vehicles`, `POST /api/vehicles`, `PATCH /api/vehicles/:id` | Gestion indépendante, permissions du parc, lien membre facultatif selon le contrat ; aucune création automatique avec un membre |
| Documents | `GET /api/membres/:id/documents`, `GET /api/documents/:id/content` | Propriétaire ou responsable autorisé à chaque lecture, R2 privé, pas de chemin public ni accès par identifiant deviné |
| Signature/cachet | `POST /api/membership/settings/media` | Téléversement institutionnel autorisé, validation fichier et stockage privé ; ne pas inventer de signature/cachet |

**Fichiers Worker :** `src/index.ts`, helpers de validation/autorisation, schéma D1 incrémental si nécessaire ; conserver les bindings DB/FILES existants.

**Fichiers applicatifs :** `src/lib/api-client.ts`, `src/lib/members.functions.ts`, `src/lib/users.functions.ts`, `src/lib/membership.functions.ts`, `src/routes/_authenticated/admin.membres.tsx`, `admin.utilisateurs.tsx`, `admin.dossiers.tsx`, `tableau.tsx`, `src/components/MembershipWorkspace.tsx` après confirmation de son chemin. Localiser les consommateurs finances/flotte avant adaptation ; ne pas ajouter de nouvelles pages sans besoin constaté.

## Priorité 2 — Sécuriser les dossiers, fichiers et cartes déjà présents

**Fichiers :** Worker `src/index.ts`, tables dossiers/documents/cartes/paramètres, `src/lib/membership.functions.ts`, `src/routes/carte.$token.tsx` et composants de carte après lecture.

- Préserver les endpoints existants de dossier, photo, document et vérification publique ; valider propriété, rôle, taille/type et état du dossier pour chaque action.
- Restreindre les paramètres complets des cartes aux responsables ; les membres ne reçoivent que les dimensions nécessaires à leur photo.
- Exiger la signature et le cachet officiels avant émission, conserver des instantanés immuables et remplacer la carte active atomiquement.
- Vérifier le statut actuel du membre lors du contrôle public, sans CNI ni documents privés.
- Aucun nettoyage ou effacement de fichiers existants dans cette phase.

## Priorité 3 — Vérifier la conservation de toute l’application avant bascule

Les fonctions suivantes restent également absentes du Worker fourni : messages et réponses IA, paramètres GIE, contacts, Bureau, Président et notifications. Les inventorier avec leurs consommateurs avant de remplacer les accès actuels ; ne pas faire une bascule qui désactive ces fonctionnalités.

**Fichiers à examiner :** `src/lib/messages.functions.ts`, `gie.ts`, `bureau.functions.ts`, `president.functions.ts`, pages publiques et administratives correspondantes. Les contrats supplémentaires seront proposés avant leur implémentation.

### Validation et autorisations
1. Après approbation du plan : préparer les corrections locales et tests, sans les appliquer à l’API/D1/R2 de production.
2. Tester les règles concrètes : origine autorisée/refusée, six chiffres provisoires, droits par rôle, matricule existant préservé, allocation concurrente, doublons CNI, CSV sans véhicule, dates/statuts et accès privés.
3. Vérifier TypeScript et la compilation automatique du projet Lovable ; exécuter les tests ciblés. Vérifier le Worker séparément avec ses outils/tests, sans commande de déploiement.
4. Tester les parcours authentifiés dans un environnement isolé autorisé, avec lecture de retour : connexion, création, import, rôle, transaction, véhicule indépendant et document privé ; vérifier Safari/Chrome et petits écrans sans refonte visuelle.
5. Présenter les différences, résultats et limites restantes. **Toute migration de production, changement de configuration Cloudflare, bascule d’authentification ou publication nécessite votre autorisation distincte.**

**À ce stade :** aucun endpoint authentifié validé en conditions réelles ; schéma D1 de production non inspecté ; lecture des paramètres du Worker précédemment refusée faute de permission/portée. Ce plan ne prétend pas que les corrections sont déjà effectuées.