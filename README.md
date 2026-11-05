# Microsoft Data Exam Trainer

Nederlandstalig examentrainingsplatform voor DP-600, DP-700, DP-800 en DP-900. De app gebruikt PocketBase voor accounts, voortgang per examen en beheerdersfuncties. Dit is een onafhankelijke leerapp met originele oefenvragen, niet een officiële Microsoft-app. Zie [EXAM_PLATFORM_PLAN.md](EXAM_PLATFORM_PLAN.md) voor de productopzet en implementatiestatus.

## Installatie

1. Plaats de projectbestanden op de Docker-host.
2. Maak vóór de eerste upgrade een herstelbare back-up van de PocketBase-volume.
3. Bouw de container en start de Compose-service met `docker compose up -d --build`.
4. Configureer je bestaande reverse proxy voor de app. Beperk de PocketBase-beheerinterface tot vertrouwde beheerverbindingen; publiceer de beheerinterface niet rechtstreeks op internet.
5. Controleer de containerlogs en meld aan met een testaccount.

PocketBase voert de versiebeheerste collectiemigraties bij het starten uit. De persistent volume bewaart accounts en voortgang. Maak periodiek back-ups en controleer dat je een back-up kunt herstellen.

## Accounts en beheer

Gebruikers kunnen zelf een account aanmaken. Zonder account kun je de oefenfuncties gebruiken, maar wordt voortgang niet tussen apparaten gesynchroniseerd. Aangemelde gebruikers zien hun eigen voortgang per examen in hun profiel.

Maak een beheeraccount aan via de gewone registratie en stel daarna in de afgeschermde PocketBase-beheerinterface het veld `role` op `admin` in. Gewone gebruikers kunnen hun eigen rol niet wijzigen. De beheerpagina is server-side alleen toegankelijk voor accounts met de adminrol. Zij toont accounts, aanmeldpogingen en globale activiteit: examen, grove schermactiviteit en laatste heartbeat. Antwoordkeuzes en vraaginhoud worden niet als activiteit geregistreerd.

De app meldt gebruikers dat de beheerder hun globale activiteit kan zien. Pas bewaartermijnen en accountverwijdering toe volgens het privacybeleid van de organisatie.

## VCE-import

Beheerders kunnen een VCE-bestand van maximaal 20 MB importeren. Het bestand wordt in de browser verwerkt; alleen genormaliseerde vragen worden opgeslagen. Single-choice, multiple-choice en hotspotvragen worden ondersteund. Sommige VCE-bestanden vereisen een externe Avanset-ontgrendelsleutel en kunnen niet rechtstreeks worden verwerkt.

## Inhoud en examendekking

DP-700 behoudt de bestaande vragenbank. DP-600, DP-800 en DP-900 hebben startersets om de leerroute en afzonderlijke voortgang te demonstreren; deze sets zijn nog geen volledige examendekking. De officiële Microsoft-studiegidsen zijn de bron voor examendoelen en kunnen wijzigen. Oefenscores zijn geen officiële Microsoft-examenscores.

## Ontwikkelchecks

Voer lokaal uit:

```sh
node --test tests/*.test.cjs
node --check questions-extra.js
node --check pb_hooks/auth_audit.pb.js
node --check pb_migrations/1793568000_admin_and_imported_exams.js
node --check pb_migrations/1793570000_learning_activity.js
docker compose build
```

GitHub Actions voert deze syntaxchecks, smoke-tests en een containerbuild uit bij pushes naar `main` en pull requests.
