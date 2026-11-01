# DP-700 Exam Lab

Nederlandstalige DP-700 oefensite met volledige Engelse vertaling (vragen en uitleg inbegrepen), accounts en voortgangssynchronisatie via PocketBase. De site is niet officieel van Microsoft en gebruikt originele oefenvragen.

## Docker op de host

1. Kopieer deze map naar bijvoorbeeld `/volume1/docker/fabric-dp700` op de Docker-host.
2. Start vanuit die map met `docker compose up -d --build`.
3. Gebruik de bestaande Nginx Proxy Host voor `fabric.remb0.nl`; maak geen tweede host aan. Controleer dat deze naar de Docker-host op poort `8090` forwardt (of naar `fabric-dp700:8090` als NPM en de app hetzelfde Docker-netwerk delen).
4. Zorg dat DNS voor `fabric.remb0.nl` naar je publieke IP verwijst en dat je router alleen 80/443 naar NPM doorstuurt. Publiceer poort 8090 niet rechtstreeks op internet.
5. Open `https://fabric.remb0.nl/_/` lokaal op je LAN en maak de PocketBase superuser aan. Beperk `/_/` in NPM tot je LAN of beheer via VPN. Gebruik in Advanced Configuration bijvoorbeeld `location ^~ /_/ { allow 192.168.0.0/16; deny all; }` als dat je LAN-subnet dekt. Maak zelf een testaccount aan en controleer dat voortgang na heropenen behouden blijft.

Je kunt `index.html` lokaal openen om de Nederlandstalige oefenmodus zonder account te gebruiken; taalbestanden en accountfuncties werken op de Docker-host.

De database staat in de Docker-volume `fabric-dp700-data`. Maak periodiek een backup van deze volume (bij voorkeur eerst `docker compose stop fabric-dp700`). Bijvoorbeeld: `docker run --rm -v fabric-dp700-data:/data -v /pad/naar/backups:/backup alpine tar -czf /backup/fabric-dp700-data.tar.gz -C /data .`. De PocketBase admin interface is nodig voor beheer en voor optionele SMTP-configuratie. SMTP is niet nodig voor registratie of inloggen. Bij een vergeten wachtwoord herstelt de beheerder het account via PocketBase; er is nog geen zelfservice-wachtwoordherstel op de site.

## Accounts en privacy

Collega's kunnen zelf een account registreren met e-mailadres en wachtwoord. Zonder aanmelden zijn alle oefenfuncties beschikbaar, maar er wordt geen voortgang opgeslagen. Na aanmelden wordt voortgang gesynchroniseerd; iedere gebruiker kan alleen het eigen voortgangsrecord lezen en wijzigen. Er is geen e-mailverificatie geconfigureerd, zodat registratie zonder SMTP direct werkt. Gebruik een sterk PocketBase-superuser wachtwoord, houd de admininterface privé en maak databaseback-ups.

## Inhoud en examendekking

De oefenvragen zijn bedoeld om begrip te oefenen, niet om officiële examenvragen te reproduceren. De inhoud is gecontroleerd tegen de Microsoft DP-700-studiegids zoals bijgewerkt op 19 oktober 2026. De examenverdeling is gebalanceerd over de drie domeinen; de officiële gewichten zijn elk 30–35%. Zie [CONTENT_REVIEW.md](CONTENT_REVIEW.md) voor de inhoudscontrole, aandachtspunten en officiële oefenlinks. Gebruik de Microsoft Practice Assessment ook voor authentieke Microsoft-vragen en oefen hands-on met Fabric.

## Updates

PocketBase 0.41.1 is vastgepind in `Dockerfile` en `compose.yaml`. Controleer release notes en maak een backup voordat je de versie bijwerkt. De collectie-structuur wordt beheerd met `pb_migrations`.
