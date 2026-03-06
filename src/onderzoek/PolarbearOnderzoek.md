# Polarbear Onderzoek

## 1. Aanleiding / Probleemstelling
Binnen het huidige systeem worden Polarbears gebruikt om temperatuurwaarden te meten en aan te passen. Er zijn echter problemen met de synchronisatie tussen twee Polarbear ZEN-controllers, wat leidt tot onbetrouwbaar gedrag bij gelijktijdige interactie. Aan de hand van de onderzoeksresultaten kan de aanpak worden gemaakt om de synchronisatie tussen de controllers te verbeteren.

Aan mij is dan ook nu ook de taak om te onderzoeken hoe de Polarbears werken, hoe ze communiceren en wat de mogelijke oorzaken zijn van de synchronisatieproblemen.

## 2. Doel en onderzoeksvraag
**Doel:** inzicht krijgen in de werking en communicatie van Polarbear ZEN-controllers en het identificeren van oorzaken van synchronisatieproblemen, zodat gerichte verbeteringen mogelijk zijn.

**Hoofdonderzoeksvraag:**  
Welke factoren in de communicatie en aansturing van twee Polarbear ZEN-controllers veroorzaken synchronisatieproblemen, en welke verbeteropties zijn het meest kansrijk?

**Deelvragen:**
1. Welke communicatieprotocollen en synchronisatiestrategien worden doorgaans gebruikt bij vergelijkbare controllers?
2. Welke conflicten of race-conditions zijn bekend bij gelijktijdige aansturing?
3. Welke praktische richtlijnen of best practices bestaan om synchronisatieproblemen te voorkomen?

## 3. Onderzoeksmethode
Om dit onderzoek uit te voeren, zal ik vooral een **literature study** gebruiken (zoals beschreven op ICT Research Methods). Dit past bij het doel om bestaande kennis, best practices en mogelijke oorzaken van synchronisatieproblemen te verzamelen en te ordenen.

**Literature study (primair)**
- Waarom: algemene informatie, richtlijnen en best practices vinden die relevant zijn voor synchronisatie tussen controllers en communicatieprotocollen.
- Hoe (kort stappenplan):
  - Zoekplan maken en relevante kernbegrippen vaststellen (bijv. "controller synchronization", "multi-controller conflict", "Modbus/ZEN controller protocol").
  - Bronnen zoeken en beoordelen op kwaliteit, actualiteit en relevantie.
  - Doorverwijzingen in bronnen volgen om belangrijke publicaties te vinden.
  - Selecteren wat in detail gelezen wordt, de leesvolgorde plannen en bevindingen tijdens het lezen samenvatten.
  - Conclusies vertalen naar het Polarbear-probleem.


## 4. Afbakening
- Focus op communicatie en synchronisatie tussen twee Polarbear ZEN-controllers.
- Geen diepgaand hardware-onderzoek of uitgebreide veldtests in deze fase.
- Resultaten richten zich op oorzaken en verbeteropties, niet op volledige implementatie.

## 5. Verwachte output
- Overzicht van relevante protocollen, communicatiepatronen en synchronisatiestrategien.
- Mogelijke oorzaken van synchronisatieproblemen tussen twee controllers.
- Concrete verbeteropties en aandachtspunten voor implementatie en testen.

## 6. Conclusie
Op basis van het onderzoek naar literatuur over gelijktijdige aansturing en synchronisatie is het aannemelijk dat de problemen vooral ontstaan door concurrerende setpoint-updates en timing-conflicten tussen de twee ZEN-controllers. Zonder duidelijke eigenaarschap- of conflictregels kan het systeem last-write-wins gedrag vertonen, wat leidt tot onverwachte toestand en onvoorspelbare temperatuurregeling.

De meest kansrijke verbeteringen zijn daarom:
- een eenduidige rolverdeling (bijv. een master en een slave);
- expliciete conflict-afhandeling (bijv. lock- of lease-mechanisme);
- periodieke reconciliatie van setpoints en status om drift te corrigeren.

Deze maatregelen sluiten direct aan op de geconstateerde symptomen en bieden een concreet pad voor implementatie en test.

## 7. Bronnen
- HBO-i (2018). ICT Research Methods — Methods Pack for Research in ICT. Methoden: Literature study.
- Polarbear documentatie en technische specificaties (pdf's gekregen van mijn stagebegeleider).
