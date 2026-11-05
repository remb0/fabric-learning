# Microsoft DP Exam Trainer

Een uitbreidbaar examentrainingsplatform voor Microsoft DP-certificeringen. De huidige routes zijn DP-600, DP-700, DP-800 en DP-900; nieuwe examens kunnen als zelfstandige routes worden toegevoegd. De app gebruikt PocketBase voor accounts, voortgang per examen en beheerdersfuncties. Dit is een onafhankelijke leerapp met originele oefenvragen, niet een officiële Microsoft-app. Zie [EXAM_PLATFORM_PLAN.md](EXAM_PLATFORM_PLAN.md) voor de productopzet en implementatiestatus.

## Installatie

1. Plaats de projectbestanden op de Docker-host.
2. Maak vóór de eerste upgrade een herstelbare back-up van de PocketBase-volume.
3. Bouw de container en start de Compose-service met `docker compose up -d --build`.
4. Configureer je bestaande reverse proxy voor de app. Beperk de PocketBase-beheerinterface tot vertrouwde beheerverbindingen; publiceer de beheerinterface niet rechtstreeks op internet.
5. Controleer de containerlogs en meld aan met een testaccount.

PocketBase voert de versiebeheerste collectiemigraties bij het starten uit. De persistent volume bewaart accounts en voortgang. Maak periodiek back-ups en controleer dat je een back-up kunt herstellen.

## Deploy op de Docker-host

Haal de eerste keer de nieuwste projectbestanden op en start de deploy:

```sh
git pull --ff-only origin main
chmod +x deploy.sh
./deploy.sh
```

Daarna is `./deploy.sh` voldoende voor volgende updates. Het script haalt `main` op, controleert dat de werkmap schoon is, bouwt de Compose-service opnieuw, start de container opnieuw en controleert de appbestanden in de container. Het behoudt de bestaande PocketBase-datavolume. Als er lokale wijzigingen of een Git-conflict zijn, stopt het script en toont het de reden.

## Accounts en beheer

Gebruikers kunnen zelf een account aanmaken. Zonder account kun je de oefenfuncties gebruiken, maar wordt voortgang niet tussen apparaten gesynchroniseerd. Aangemelde gebruikers zien hun eigen voortgang per examen in hun profiel.

Maak een beheeraccount aan via de gewone registratie en stel daarna in de afgeschermde PocketBase-beheerinterface het veld `role` op `admin` in. Gewone gebruikers kunnen hun eigen rol niet wijzigen. De beheerpagina is server-side alleen toegankelijk voor accounts met de adminrol. Zij toont accounts, aanmeldpogingen en globale activiteit: examen, grove schermactiviteit en laatste heartbeat. Antwoordkeuzes en vraaginhoud worden niet als activiteit geregistreerd.

De app meldt gebruikers dat de beheerder hun globale activiteit kan zien. Pas bewaartermijnen en accountverwijdering toe volgens het privacybeleid van de organisatie.

## VCE-import

Beheerders kunnen een VCE-bestand van maximaal 20 MB importeren. Het bestand wordt in de browser verwerkt; alleen genormaliseerde vragen worden opgeslagen. Single-choice, multiple-choice en hotspotvragen worden ondersteund. Sommige VCE-bestanden vereisen een externe Avanset-ontgrendelsleutel en kunnen niet rechtstreeks worden verwerkt.

## Inhoud en examendekking

DP-700 heeft de bestaande uitgebreide vragenbank. DP-600, DP-800 en DP-900 hebben startersets om de leerroute en afzonderlijke voortgang te demonstreren; deze sets zijn nog geen volledige examendekking. Elke route gebruikt zijn eigen examendoelen en Microsoft-studiegids. Die doelen kunnen wijzigen. Oefenscores zijn geen officiële Microsoft-examenscores. Nieuwe routes worden aan de examencatalogus en hun eigen vragenbank toegevoegd; de voortgang, keuze-interface en quizmotor zijn al examen-onafhankelijk.

## Een examenroute uitbreiden

De examencatalogus staat in `certifications.js`; de extra vragenbanken staan in `questions-extra.js`. Voeg daar de examencode, titel, omschrijving, doelgroep, domeinen, Microsoft-studiegids, simulatieduur en vragenbank toe. De interface, domeinkeuze, profielvoortgang en administratie bouwen hun weergave uit deze configuratie op. Werk daarna de smoke-tests bij en controleer de officiële examendoelen en bronlinks.

## Ontwikkelchecks

Voer lokaal uit:

```sh
node --test tests/*.test.cjs
node --check certifications.js
node --check questions-extra.js
node --check pb_hooks/auth_audit.pb.js
node --check pb_migrations/1793568000_admin_and_imported_exams.js
node --check pb_migrations/1793570000_learning_activity.js
docker compose build
```

GitHub Actions voert deze syntaxchecks, smoke-tests en een containerbuild uit bij pushes naar `main` en pull requests.
