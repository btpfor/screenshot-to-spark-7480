# Correction du logo officiel
- [ ] Diagnostiquer les URL, vérifier le vrai logo sur les pages publiques et privées et aux huit largeurs, conserver le design et les données.

# Navigation au clavier et petites largeurs
- [x] Corriger Échap, le retour du focus, les menus fermés encore accessibles au clavier et les libellés des menus/dialogues sans changer leur apparence ; sélection des rôles annoncée et tableau de permissions accessible au clavier.
- [x] Vérifier les 13 pages existantes et fenêtres ajout/import/personnel/message aux huit largeurs : aucun débordement de page constaté ; tableau de permissions défilant localement conservé. Tabulation, Échap et retour du focus vérifiés en session administrative, 25 tests réussis, aucune donnée modifiée.

# Affichage tous écrans
- [x] Adapter navigation publique, administration, listes, formulaires et fenêtres pour téléphone/tablette/ordinateur sans changement de données.
- [x] Vérifier toutes les pages aux largeurs 320, 375, 390, 430, 768, 1024, 1366 et 1920 ; menus tactiles, ajout membre/personnel/message, aucun débordement global et 14 tests réussis.
- [ ] Vérifier carte et exports avec un membre réel et appareils physiques iOS/Android : aucun membre enregistré et appareils indisponibles ; dimensions d’export conservées.

# Diagnostic du chargement
- [x] Reproduire le refus de chargement de l’accueil et du Président sur le déploiement externe ; corriger la sélection de configuration publique et la transmission initiale des données dans le projet, sans changer Lovable Cloud.
- [x] Vérifier toutes les pages existantes dans l’aperçu, les accès administratifs par session authentifiée, les lectures/enregistrements du message et les images sur ordinateur, téléphone et tablette ; tests réussis.
- [x] Identifier les limites : aucun membre réel enregistré ; aucune gestion séparée des véhicules/cotisations/partenaires ; authentification par mot de passe non retestée car aucun nouveau mot de passe fourni.
- [ ] Appliquer et revérifier la correction sur l’adresse externe workers.dev : déploiement externe non accessible depuis les outils du projet ; l’adresse officielle Lovable répond déjà en HTTP 200.

# Le mot du Président
- [x] Vérifier les boutons d’ajout/remplacement/retrait de signature, leur enregistrement et l’affichage sur l’accueil et la page dédiée (images temporaires supprimées, téléphone sans débordement).
- [x] Ajouter le portrait intact, la rubrique d’accueil, le menu et la page indépendante.
- [x] Permettre aux responsables autorisés de modifier et publier/dépublier le message, le nom, la fonction, la photo et la signature (Lovable Cloud existant, photos privées ; signature réelle à fournir).
- [x] Vérifier l’enregistrement authentifié, le remplacement de photo, la dépublication publique, la republication et l’affichage sur ordinateur/mobile ; 3 tests réussis, aucune erreur navigateur.

# Accès administrateur
- [x] Créer le compte administrateur demandé avec un mot de passe accepté.
- [x] Proposer le changement du mot de passe après connexion.
- [x] Vérifier les règles de mot de passe et l’accès authentifié à l’administration.

# Identifiants membres
- [x] Refuser les doublons de CNI et signaler clairement les collisions d’identifiants, à la création et à l’import (12 tests réussis ; deux refus vérifiés depuis le formulaire administrateur).
- [x] Générer vipbgg- suivi des trois derniers caractères de la CNI lors de la création et de l’import.
- [x] Accepter les nouveaux identifiants à la connexion sans modifier les anciens comptes (tests réussis).
- [x] Vérifier l’affichage automatique dans le formulaire administrateur.
- [ ] Vérifier un compte membre réel et sa première connexion : en attente des informations du premier membre ; aucun compte fictif créé.

# Application installable
- [x] Ajouter les icônes, le manifeste et les boutons d’installation avec guide iPhone/iPad (emblème actuel provisoire).
- [x] Ajouter une ouverture hors connexion sans mise en cache des données privées, avec protection de l’aperçu (génération Workbox contrôlée, aucun avertissement).
- [x] Préparer les points d’extension des notifications, sans Firebase ni envoi activé.
- [x] Vérifier les menus et guides sur ordinateur/téléphone, le contrôle du déclenchement natif et les règles de protection (13 tests, administration authentifiée, aucune erreur navigateur).
- [ ] Valider l’installation native, l’ouverture hors connexion et les mises à jour sur appareils physiques : attend la publication et les appareils Android/iOS/Edge, indisponibles dans l’aperçu.
- [x] Remplacer l’emblème provisoire par le logo officiel fourni sur le site, les cartes, le favicon et les icônes d’installation.