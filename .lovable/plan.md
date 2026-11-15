# Gestion des adhérents et cartes officielles

## Préserver l’existant
Conserver Lovable Cloud, les comptes, les cotisations, la flotte, les pages publiques, le logo et l’installation de l’application. Réutiliser la gestion actuelle des membres, le changement obligatoire du mot de passe, les photos privées et les exports de cartes.

**Constat vérifié :** le membre demandé existe avec le matricule `vipbgg-656` en minuscules. Il sera conservé exactement ainsi, sans modifier son accès. Les nouveaux matricules seront en majuscules, selon le format demandé.

## 1. Comptes et matricules
- Générer les nouveaux matricules `VIPBGG-657`, puis suivants, côté serveur, en tenant compte des numéros déjà attribués et en protégeant les créations simultanées.
- Ne plus fabriquer de matricule à partir de la CNI ; conserver tous les anciens matricules et leurs connexions.
- Permettre la création d’un compte avec nom, prénom et téléphone ; compléter la CNI dans le dossier privé ensuite.
- Conserver les mots de passe provisoires et leur remplacement obligatoire, la réinitialisation administrative et les contrôles de doublons.

## 2. Dossier personnel
- Ajouter un formulaire en cinq étapes : identité, pièce d’identité, photo, permis, récapitulatif certifié.
- Sauvegarder les brouillons, afficher les informations manquantes et soumettre le dossier à l’administration.
- Verrouiller les données sensibles après soumission ; les rendre modifiables lorsqu’une correction est demandée.
- Afficher le suivi du dossier, les dates, les remarques adressées au membre et ses notifications.
- Ne demander aucune information de véhicule dans ce formulaire ; conserver la flotte séparée.

## 3. Photo d’identité avec IA réelle
Les modèles de retouche d’images disponibles sont génératifs : ils ne garantissent pas l’intégrité des traits du visage. Ne pas les utiliser pour reconstruire une photo d’identité.

Utiliser les modèles documentés **MediaPipe** de détection du visage et de segmentation du portrait, exécutés localement dans le navigateur :
- Import JPG/PNG, caméra du téléphone et webcam avec autorisation explicite.
- Détection d’un seul visage, suppression du fond et fond blanc, cadrage tête/épaules au format 35 × 45 mm.
- Ajustements photographiques légers sans inventer de détail ni modifier les traits ; cadrage manuel si nécessaire.
- Comparaison avant/après, téléchargement, reprise et confirmation obligatoire avant sauvegarde.
- Progression liée aux étapes réellement exécutées ; possibilité de garder l’original si le traitement échoue.
- Aucun envoi de photo à un prestataire pour le traitement. Les modèles seront chargés comme ressources publiques, les photos enregistrées dans le stockage privé du GIE.

La qualité finale dépendra de la photo source : ne pas promettre de récupérer des détails absents ni une conformité officielle automatique.

## 4. Examen administratif
- Ajouter les indicateurs, filtres par statut et date, consultation du dossier et des justificatifs privés.
- Permettre réception, examen, demande de correction, validation, rejet motivé, suspension et réactivation selon les autorisations existantes.
- Séparer les commentaires internes des messages visibles par le membre.
- Journaliser les décisions et afficher des notifications internes aux membres et responsables concernés.
- Prévoir les rappels de validité dans l’application ; ne pas activer de notifications push sans consentement et configuration dédiés.

## 5. Cartes officielles
- Générer uniquement à partir d’un dossier validé et d’une photo confirmée.
- Prévoir recto/verso au format 85,6 × 54 mm, PDF deux pages et PNG haute résolution.
- Afficher les dates d’adhésion et de validité définies par l’administration ; aucune durée inventée.
- Utiliser la signature et le cachet officiels téléversés, sans dessin de remplacement. Prévoir les mentions du verso administrables.
- Historiser génération, renouvellement, réédition, suspension et annulation ; conserver les anciennes cartes.
- QR code avec jeton aléatoire opaque et page publique limitée. Vérifier en direct expiration, suspension et annulation, sans CNI ni autre document privé.
- Conserver les anciennes adresses de vérification, sans les présenter comme preuve de validité des nouvelles cartes.

## Détails techniques
- Réutiliser `drivers` pour le membre ; ajouter les dossiers, documents, photos, cartes, notifications et paramètres nécessaires sans supprimer de colonnes ni de lignes existantes.
- Numérotation atomique en base, unicité insensible à la casse pour les nouveaux identifiants, et protection des matricules permanents.
- Stockage privé avec droits propriétaire/responsables autorisés ; pas d’accès public aux originaux, CNI ou permis. Photo publique uniquement si autorisée pour une carte vérifiable.
- Fonctions serveur authentifiées pour les décisions et transitions ; contrôles en base empêchant les modifications sensibles même en appel direct.
- Étendre le pont existant Cloudflare pour les opérations du module ; aucune clé privée transmise au site externe.
- Charger les outils photo uniquement après ouverture de l’étape photo, sans les faire exécuter lors de l’affichage serveur.

## Vérifications avant conclusion
- Tests des règles : matricules uniques et anciens conservés, doublons CNI, verrouillage du dossier, décisions autorisées, dates et statuts des cartes, confidentialité du QR.
- Parcours authentifié complet : création, premier accès, profil, photo, soumission, correction, validation, téléchargement, vérification et suspension.
- Tests d’accès entre membres et responsables ; vérifier les données relues après chaque sauvegarde.
- Contrôles sur petits écrans, ordinateur et ouverture publique de l’application installable.
- Distinguer les essais effectués des vérifications nécessitant un téléphone physique ou un redéploiement Cloudflare externe.

**Aucune modification des données ni du fonctionnement actuel n’a encore été appliquée pour ce module.**