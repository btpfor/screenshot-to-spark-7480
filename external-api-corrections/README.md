# Corrections préparées pour l’API Cloudflare existante

Ce dossier sert de référence isolée. Il n’est pas importé par l’application et n’a été ni déployé, ni appliqué à la base D1 ou au stockage R2 de production.

## Contenu
- `src/index.ts` : copie corrigée du Worker fourni (CORS Lovable, sessions, mots de passe à six chiffres, statuts, plateforme, CNI, matricules, cartes).
- `src/extra-routes.ts` : routes membres, CSV, rôles, transactions, véhicules, documents privés et médias officiels.
- `sql/0003_preparation.sql` : migration additive proposée, sans suppression ni réécriture des lignes existantes.
- `tests/worker.test.ts` : 16 essais avec D1/R2 locaux et comptes fictifs.

## Avant toute activation
1. Inspecter le schéma D1 réel en lecture seule et faire une sauvegarde.
2. Confirmer qu’au moins un super administrateur existe ; ne pas utiliser `/api/setup-admin`.
3. Revoir puis appliquer la migration uniquement avec une autorisation distincte.
4. Déployer manuellement le Worker après validation. Les cookies entre le domaine Lovable et `workers.dev` doivent être essayés sur Safari/iPhone et Chrome/Android.

Le moteur local supporte la date de compatibilité `2026-08-06`; la date réelle `2026-11-18` reste à vérifier avec l’outil officiel du projet Cloudflare.