# DISC LIVE · Atelier management

Quatre étapes : découverte du DISC, questionnaire sur les réflexes, questionnaire
sur les attentes envers un manager, puis jeu de décision en binôme.

## Lancer

Avec Node.js 22 ou plus récent, ouvrez un terminal dans ce dossier et lancez
`npm start`. Accédez à `http://localhost:3000/teacher`. Le terminal affiche le
mot de passe temporaire si la variable `TEACHER_PASSWORD` n’est pas définie.
L’espace enseignant propose également une démonstration avec des données fictives.

Pour faire participer des téléphones depuis des réseaux différents, utilisez
un nouveau dépôt GitHub et déployez-le comme Blueprint sur Render. Le fichier
`render.yaml` demande le plan Free et génère `TEACHER_PASSWORD`, disponible dans
Environment. Ouvrez `/teacher`, puis ouvrez `/projection` sur l’écran de classe et
transmettez le lien étudiant. Le code change pour chaque nouvelle séance.

## Animation

1. Expliquez les quatre tendances avec l’étape Comprendre le DISC.
2. Ouvrez Mes réflexes puis Mes attentes. Chaque questionnaire contient 16
   situations. Chaque réponse compte pour une tendance. Les pourcentages
   correspondent aux choix effectués dans l’exercice.
3. Depuis l’onglet Étudiants, ouvrez chaque bilan nominatif. Dans Bilan du
   groupe, choisissez quand projeter les résultats agrégés.
4. Formez les binômes par prénom et attribuez les rôles. Ouvrez Jeu en binôme.
   Après les deux réponses, chaque binôme voit la comparaison. L’enseignant peut
   projeter un binôme précis pour le débrief.

La séance est conservée en mémoire serveur. Une nouvelle séance ou un
redémarrage efface les résultats et génère un nouveau code. La projection est
accessible à toute personne possédant son lien et peut afficher les prénoms
du binôme que l’enseignant sélectionne. Les bilans nominatifs se consultent
depuis l’espace enseignant et par l’étudiant concerné.

## Signature

Ajoutez votre original JPEG dans `assets/signature.jpg`. Le sélecteur
d’image sur l’accueil permet aussi de prévisualiser votre PNG, JPEG ou WebP
dans le navigateur. Cette prévisualisation reste sur cet appareil.
