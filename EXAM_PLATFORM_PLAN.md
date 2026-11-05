# Microsoft DP Exam Trainer — uitbreidingsplan en gerealiseerde basis

## Doel en productkeuze

De app is een uitbreidbaar platform voor Microsoft DP-examens, waarin DP-700 één van de leerpaden is. Gebruikers beginnen met een keuze uit vier certificeringen. Een tegel beschrijft het niveau, de doelgroep en het onderwerp, zodat iemand eerst de juiste route kiest en daarna pas de oefenmodus ziet.

| Examen | Voor wie | Focus |
|---|---|---|
| DP-900 | Beginners in data en cloud | Dataconcepten, Azure relationele en niet-relationele data, analytics |
| DP-600 | Analytics engineers en Power BI/Fabric-modelleurs | Data voorbereiden, semantische modellen, beveiliging en lifecycle |
| DP-700 | Data engineers | Inname, transformatie, orchestration, monitoring en optimalisatie in Fabric |
| DP-800 | SQL/databaseontwikkelaars met AI-focus | T-SQL, databasebeveiliging, CI/CD, vector search en RAG |

De vier tracks sluiten aan op de Microsoft-studiegidsen. De examendoelen en wegingen kunnen wijzigen; de beheer- en contentworkflow moet daarom datum en bronversie per vragenbank bijhouden. De vragen zijn originele leerinhoud, geen officiële of gelekte examenvragen.

## Gebruikerservaring

1. **Examen kiezen:** toon vier tegels met code, niveau, doelgroep, leerdoel en opgeslagen voortgang. DP-900 wordt als instaproute uitgelegd; DP-600 en DP-700 onderscheiden analytics van data engineering; DP-800 beschrijft de SQL- en AI-focus.
2. **Examenstartpagina:** toon de geselecteerde certificering, officiële studiegids, examendomeinen, beschikbare bankomvang en passende leeractiviteiten.
3. **Oefenen:** leerstand met feedback, gerichte herhaling, bladwijzers en een examensimulatie. De simulatie gebruikt de duur van het gekozen examen en een representatieve bank; de score blijft duidelijk een oefenscore.
4. **Profiel:** toon per examen beantwoorde vragen, pogingen, laatste score, zwakke domeinen en een hervatbare onafgeronde sessie. Gegevens synchroniseren tussen apparaten na aanmelding.
5. **Taal en toegankelijkheid:** behoud Nederlands/Engels, toetsenbordbediening, mobiel ontwerp en duidelijke scheiding tussen officiële exameneisen en eigen oefenmateriaal.

## Voortgangsmodel

De bestaande `progress`-record blijft de eigendomsenvelop per gebruiker. Het payload wordt versieerbaar en bevat voortgang per certificaat (`dp600`, `dp700`, `dp800`, `dp900`). Per track staan antwoorden/statistieken, sessie, bladwijzers en pogingen apart. De migratie van bestaande DP-700-payloads moet DP-700 onderbrengen zonder de oude historie te verliezen. Bij uitloggen blijft accountvoortgang in de cloud beschikbaar; een gedeeld apparaat mag geen lokaal profiel van de volgende gebruiker tonen.

## Beheerdersoverzicht en privacy

- Beheerder ziet accounts, aanmeldpogingen en een aanwezigheids-/activiteitsoverzicht.
- Per gebruiker wordt alleen de certificaatcode, een grove pagina-activiteit en de laatste heartbeat bijgehouden. Heartbeat is elke 45 seconden; activiteit wordt na twee minuten als inactief gemarkeerd.
- Antwoordkeuzes, vraagtekst, inhoud van notities en persoonlijke antwoorden worden niet naar het activiteitenoverzicht gestuurd.
- PocketBase-regels beperken het overzicht tot de beheerrol. De gebruiker mag alleen de eigen statusregel aanmaken of bijwerken; gebruikers kunnen elkaars voortgang en status niet lezen.
- Gebruikers krijgen bij accountgebruik een heldere melding dat de beheerder actieve examens en globale activiteit kan zien. Voeg later bewaartermijn, export en verwijdering toe aan privacy-instellingen.

## Inhoud en kwaliteit

Elke vragenbank krijgt eigen metadata: certificaatcode, Microsoft-studiegids-URL, datum van inhoudscontrole, domeinen en wegingen. Vragen moeten per doel worden gemarkeerd, uitleggen waarom het antwoord klopt, foutieve afleiders motiveren waar dat leerwaarde toevoegt en verwijzen naar Microsoft Learn. Importvragen blijven gescheiden van originele content en mogen een examencode dragen.

### Huidige inhoudsstatus

- DP-700: bestaande uitgebreide vragenbank en Engelse vertaling blijven behouden.
- DP-600, DP-800 en DP-900: eerste originele voorbeeldset is toegevoegd om de volledige route technisch te demonstreren. Dit is nadrukkelijk nog geen volledige of evenwichtige examenvragenbank.
- Voor productie moeten de drie nieuwe banken worden uitgebreid naar alle examendoelen, gewogen naar de officiële domeinpercentages en onafhankelijk inhoudelijk worden nagekeken.
- De keuze van het examen en de domeinlabels zijn per track ingericht. De bestaande quizmotor wordt nog hergebruikt; gespecialiseerde vraagtypen en per-examen volledig gelokaliseerde uitleg zijn uitbreidingswerk.

## Uitbreiden met nieuwe examens

De merkuitstraling en algemene pagina’s zijn examen-onafhankelijk. De certificaatcatalogus staat in `certifications.js` en bevat per route de titel, doelgroep, omschrijving, domeinen, studiegids en simulatieduur. Vragen staan apart in `questions-extra.js` of in de bestaande DP-700-vragenbank. Een nieuw examen wordt toegevoegd door catalogusmetadata, een afzonderlijke vragenbank, Microsoft Learn-bronnen en tests voor de domeindekking aan te leveren. De keuze-interface, voortgang, adminweergave en toetsmotor lezen de actieve examenconfiguratie dynamisch. Dit maakt toevoegen van routes mogelijk zonder de productbranding of quizstroom om te bouwen.

## Architectuur en gegevensstromen

- **Frontend:** statische single-page app met certificaatconfiguratie en per-certificaat vragenbank.
- **API en accounts:** PocketBase-auth, gebruikersgebonden voortgang, beheerderscollecties en server-side toegangregels.
- **Deploy:** Docker-image neemt de aanvullende vragenbestanden en migraties mee; bestaande data-volume en reverse-proxy blijven behouden.
- **Compatibiliteit:** de DP-700 local-storage key wordt als migratiebron gelezen; bestaand cloudpayload wordt als DP-700-historie behandeld.
- **Observability:** aanwezigheid wordt als upsert per gebruiker opgeslagen, niet als onbeperkte reeks pageview-events.

## Uitrol- en acceptatieplan

1. Maak vóór deploy een consistente kopie van de PocketBase-volume.
2. Bouw de image en voer de nieuwe PocketBase-migratie uit.
3. Meld aan met een regulier testaccount: alle vier de tegels zijn zichtbaar, DP-700-historie blijft staan en de drie nieuwe tracks openen hun eigen bank.
4. Beantwoord vragen in twee tracks, herlaad en controleer dat pogingen, historie en sessies per track gescheiden blijven.
5. Meld aan als beheerder: controleer status, examen, globale activiteit en time-out; controleer als gewone gebruiker dat beheerdata niet leesbaar is.
6. Controleer mobiele layout, toetsenbord, Nederlandse en Engelse interface, foutmelding wanneer API of statuscollectie tijdelijk niet beschikbaar is.
7. Pas na acceptatie de productieconfiguratie aan. Houd bestaande databack-up en rollbackmogelijkheid beschikbaar.

## Huidige implementatie in deze wijziging

- Generieke productbranding voor Microsoft DP-certificeringen en startscherm met uitlegtegels voor vier routes.
- Certificaatmetadata en simulatieduur losgekoppeld van de applicatieschil, zodat toekomstige routes eenvoudig configureerbaar zijn.
- Certificaatconfiguratie, per-examen domeinnamen en afzonderlijke voortgangsvelden.
- Startervragen voor DP-600, DP-800 en DP-900; bestaande DP-700-vragenbank blijft beschikbaar.
- Profieloverzicht met aantallen per examen en voortgang blijft lokaal en in PocketBase opgeslagen.
- Nieuwe `learning_activity`-collectie met beperkte statusvelden, owner-write/admin-read-regels en automatische verwijdering bij accountverwijdering.
- Beheerderspagina toont recente globale activiteit plus bestaande accounts, pogingen en VCE-import.
- Docker-image neemt de nieuwe vragenbank mee.

## Open werk vóór brede productie-uitrol

1. Vul DP-600, DP-800 en DP-900 uit tot volledige, geproportioneerde oefenbanken en laat alle uitleg controleren.
2. Maak per certificaat een eigen Engelse vertaling, studiebronnen, examenduur en domeinwegingen.
3. Werk het profiel uit met trendgrafieken, laatste score, zwakke-doelenanalyse en een doel-/examendatum.
4. Voeg expliciete privacy-instellingen toe: activiteit zichtbaar ja/nee, retentie, export en verwijdering.
5. Voeg een admin-filter toe op examen, activiteit en periode; overweeg samenvattingen die geen individueel gedrag tonen.
6. Voeg contentversies en een admin-import/review/publicatieflow voor vragenbanken toe.
7. Controleer herstel van oude progress-payloads en multi-tab gelijktijdige wijzigingen op staging vóór productie.
