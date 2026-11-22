# Corrections progressives de l’API Cloudflare existante

## Périmètre et garanties

Conserver **Cloudflare Workers + D1 + R2** comme backend principal cible, avec l’API existante `https://gie-vipbg-api.sheikhmbaake.workers.dev`. L’application reste hébergée via Lovable ; ce plan ne prévoit aucun déploiement ni nouvelle infrastructure Cloudflare.

- Aucun changement applicatif ou de production avant votre autorisation : cette étape prépare uniquement le plan.
- Aucun compte administrateur recréé, aucun mot de passe existant modifié, aucune donnée ni aucun véhicule supprimé.
- Conserver les matricules existants exactement, notamment `vipbgg-656`, sans renumérotation ; nouveaux matricules séquentiels côté serveur.
- Préserver le design, les champs personnels, la plateforme professionnelle, les dossiers, cartes, CSV et historiques.
- L’authentification cible sera exclusivement celle du Worker. Ne pas construire une nouvelle connexion avec Supabase Auth ni mélanger les deux sessions. L’application actuellement active reste inchangée jusqu’à validation d’un ensemble compatible.
- Les fichiers Worker restent dans leur projet externe ; ne pas remplacer la configuration Lovable.

## Priorité 0 — Autoriser le domaine publié et vérifier les sessions

### CORS
**Fichiers :** `wrangler.jsonc` et `src/index.ts` du Worker existant (fourni sous le nom `index.ts`).

Proposer l’ajout de **`https://screenshot-to-spark-7480.lovable.app`** à `ALLOWED_ORIGINS`, sans retirer les domaines déjà autorisés. Cette modification sera à appliquer au service existant uniquement après autorisation ; aucun déploiement automatique.

Conserver une liste exacte, sans `*`. Vérifier les en-têtes d’origine, de cookies et `Vary: Origin` sur réponses normales, erreurs et OPTIONS. Autoriser uniquement les méthodes/en-têtes utilisés ; conserver les contrôles d’origine et de droits des écritures.

**Validation :** origine Lovable admise, origine inconnue refusée, requêtes GET/POST et erreurs lisibles. Le dernier test connu répondait 204 pour Lovable, mais sans en-têtes d’autorisation.

### Authentification et sessions
**Fichiers Worker :** `src/index.ts`, helpers de session, routes `/api/auth/*`.
**Fichiers applicatifs à adapter après validation :** `src/lib/auth.tsx`, `src/lib/api-client.ts`, `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/changer-mot-de-passe.tsx`, `src/start.ts` si nécessaire après lecture de son middleware.

- Vérifier login, me, logout et change-password sans recalculer les hachages existants.
- Préparer des appels `credentials: "include"`, sans jeton Lovable Cloud envoyé au Worker ; utilisateur et rôles relus depuis `/api/auth/me`.
- Conserver le cookie HttpOnly, Secure et le stockage haché du jeton dans D1. Empêcher la mise en cache des réponses privées.
- Bloquer côté Worker les opérations métier quand le changement initial est obligatoire, en laissant accessibles l’état de session, le changement de mot de passe et la déconnexion.
- Préparer la révocation des autres sessions lors des futurs changements/réinitialisations autorisés, sans modifier les mots de passe actuels.
- Aligner la règle du formulaire et du Worker : mot de passe provisoire choisi ou généré à **six chiffres**, puis remplacement obligatoire ; préserver la règle actuelle d’au moins six caractères pour le remplacement, sans imposer silencieusement les douze caractères du Worker fourni.
- Tester séparément Safari/iPhone et Chrome/Android : le domaine Lovable et `workers.dev` sont intersites ; **la correction CORS seule ne garantit pas les cookies tiers**. Si les navigateurs bloquent la session, présenter une option de domaine de même site ou un relais sécurisé à approuver avant réalisation ; ne pas exposer de jeton pour contourner le blocage.

**Limite :** aucune connexion administrateur réelle vérifiée ; obtenir une session avec votre accord, sans création de compte, réinitialisation ni exposition de secrets.

## Priorité 1 — Corriger les incompatibilités D1 et fiabiliser les membres

**Fichiers :** `src/index.ts` du Worker, schémas de référence `0001_init.sql` / `0002_full_schema.sql`, nouvelle migration D1 incrémentale proposée dans le projet du Worker, tests locaux SQLite/D1.

Ne pas rejouer les scripts d’initialisation. Comparer le schéma installé en lecture seule ; prévoir sauvegarde et contrôle des lignes avant toute migration autorisée.

1. **Date d’adhésion :** ne plus insérer explicitement NULL dans `members.join_date` ; valider une date fournie ou laisser le défaut SQL s’appliquer.
2. **Statuts :** aligner D1 sur `actif`, `inactif`, `suspendu`, en préservant `radie` et les lignes existantes. Si le CHECK nécessite une reconstruction de table, demander une autorisation séparée ; aucune suppression ici.
3. **Rôles :** résoudre l’écart entre les cinq valeurs de `users.role` et les huit de `user_roles`/Worker ; conserver les rôles et accès existants, avec `user_roles` comme autorité.
4. **Plateforme :** le schéma exclut `platform`. Préparer une colonne nullable et les contrats Yango, Heetch, taxi traditionnel, autre ; aucune valeur inventée pour les anciennes lignes.
5. **Matricules :** remplacer MAX + insertion par une allocation D1 atomique pour création/import concurrents ; compteur basé sur l’existant, sans renumérotation ni réutilisation.
6. **Doublons :** préparer normalisation CNI, index de comparaison protégé compatible avec le chiffrement, contrôles téléphone/exception. Inventorier les doublons avant contrainte sans fusion ni suppression.
7. **Création :** garantir la cohérence utilisateur/membre/rôle/dossier/journal et les réponses attendues ; éviter les comptes orphelins.
8. **Historique :** harmoniser les usages de `audit_logs` et `audit_log` sans déplacer ni effacer les journaux.

## Priorité 1 — Retirer le véhicule de la création d’un membre

**Fichiers applicatifs :**
- `src/routes/_authenticated/admin.membres.tsx` : retirer l’objet `vehicle` et les lectures `v_brand`, `v_model`, `v_plate` de l’envoi.
- `src/lib/members.functions.ts` : retirer `vehicle` de `memberSchema` (donc de `MemberInput`), puis le bloc `m.vehicle` / insertion automatique dans `vehicles`.

**Constat précis :** le formulaire lu ne présente déjà plus de champs véhicule visibles, mais l’objet envoyé et le bloc d’insertion restent présents. Le CSV actuellement lu ne demande pas de véhicule. Vérifier aussi les modèles/imports et les appels qui réutilisent le schéma, sans toucher à la table `vehicles`.

Le Worker crée déjà les membres sans véhicule. Conserver tous les champs personnels et accès ; flotte indépendante.

**Tests :** création/import sans écriture flotte, même avec un ancien objet véhicule ; matricules et accès conservés. Pas d’écriture en production sans autorisation.

## Priorité 2 — Compléter les contrats et endpoints manquants

Routes **proposées**, absentes du fichier fourni ; les 404 constatés ne couvrent que les méthodes/chemins testés.

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

**Fichiers applicatifs :** `src/lib/{api-client,members.functions,users.functions,membership.functions}.ts`, `src/routes/_authenticated/{admin.membres,admin.utilisateurs,admin.dossiers,tableau}.tsx`, `src/components/MembershipWorkspace.tsx`. Localiser les consommateurs finances/flotte avant adaptation ; pas de nouvelles pages sans besoin.

## Priorité 2 — Sécuriser les dossiers, fichiers et cartes déjà présents

**Fichiers :** Worker `src/index.ts`, tables dossiers/documents/cartes/paramètres, `src/lib/membership.functions.ts`, `src/routes/carte.$token.tsx` et composants de carte après lecture.

- Préserver les routes dossier/photo/document/vérification ; contrôler propriété, rôle, taille/type et état à chaque action.
- Restreindre les paramètres complets des cartes aux responsables ; les membres ne reçoivent que les dimensions nécessaires à leur photo.
- Exiger la signature et le cachet officiels avant émission, conserver des instantanés immuables et remplacer la carte active atomiquement.
- Vérifier le statut actuel du membre lors du contrôle public, sans CNI ni documents privés.
- Aucun nettoyage ou effacement de fichiers existants dans cette phase.

## Priorité 3 — Vérifier la conservation de toute l’application avant bascule

Autres fonctions absentes du Worker : messages/IA, paramètres GIE, contacts, Bureau, Président, notifications. Inventorier leurs contrats avant remplacement pour ne désactiver aucune fonctionnalité.

**Fichiers à examiner :** `src/lib/messages.functions.ts`, `gie.ts`, `bureau.functions.ts`, `president.functions.ts`, pages publiques et administratives correspondantes. Les contrats supplémentaires seront proposés avant leur implémentation.

### Validation et autorisations
1. Après approbation : corrections et tests locaux, aucune application à la production.
2. Tests concrets : CORS, six chiffres provisoires, droits, matricules/concurrence, doublons, CSV sans véhicule, dates/statuts et accès privés.
3. Vérifier TypeScript, compilation automatique Lovable et tests ciblés ; Worker testé séparément sans déploiement.
4. Parcours authentifiés dans un environnement isolé autorisé, avec lecture de retour : connexion, création, import, rôle, transaction, flotte, document ; Safari/Chrome et petits écrans.
5. Présenter résultats et limites. **Configuration Cloudflare, migration, bascule d’authentification ou publication de production : autorisation distincte obligatoire.**

**À ce stade :** aucun endpoint authentifié validé en conditions réelles ; schéma D1 de production non inspecté ; lecture des paramètres du Worker précédemment refusée faute de permission/portée. Ce plan ne prétend pas que les corrections sont déjà effectuées.