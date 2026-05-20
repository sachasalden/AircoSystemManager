# 1. Inleiding

## 1.1. Aanleiding
Binnen het huidige systeem worden Polarbears gebruikt om temperatuurwaarden te meten en aan te passen. Er zijn echter problemen met de synchronisatie tussen twee Polarbear ZEN-controllers, wat leidt tot onbetrouwbaar gedrag bij gelijktijdige interactie. Dit kan zorgen voor onverwachte toestand, tegenstrijdige updates en onvoorspelbare temperatuurregeling.

Aan mij is daarom de taak gegeven om te onderzoeken hoe de Polarbears werken, hoe zij communiceren en wat mogelijke oorzaken zijn van de synchronisatieproblemen. Aan de hand van de onderzoeksresultaten kan vervolgens een gerichte aanpak worden opgesteld om de synchronisatie tussen de controllers te verbeteren.

## 1.2. Doelstelling
Het doel van dit onderzoek is om inzicht te krijgen in de werking en communicatie van Polarbear ZEN-controllers en om de oorzaken van synchronisatieproblemen tussen twee controllers in kaart te brengen. Daarbij wordt gekeken naar gebruikte communicatieprotocollen, bekende conflicten bij gelijktijdige aansturing en praktische richtlijnen om dergelijke problemen te voorkomen.

De uitkomst van dit onderzoek is een onderbouwd overzicht van mogelijke oorzaken en kansrijke verbeteropties, zodat gerichte maatregelen kunnen worden genomen om de synchronisatie tussen de controllers te verbeteren.

# 2. Hoofdvraag

**Welke factoren in de communicatie en aansturing van twee Polarbear ZEN-controllers veroorzaken synchronisatieproblemen, en welke verbeteropties zijn het meest kansrijk?**

# 3. Deelvragen

## 3.1. Welke communicatieprotocollen en synchronisatiestrategieën worden doorgaans gebruikt bij vergelijkbare controllers?

### 3.1.1. Methoden
Voor deze deelvraag is gebruikgemaakt van een literature study. Daarbij is gezocht naar informatie over communicatieprotocollen, communicatiepatronen en synchronisatiestrategieën die worden gebruikt bij vergelijkbare controllersystemen.

### 3.1.2. Resultaten
Uit het onderzoek blijkt dat bij vergelijkbare controllers vaak gebruik wordt gemaakt van vaste communicatieprotocollen en afspraken om gegevensuitwisseling betrouwbaar te laten verlopen. Belangrijke aspecten daarbij zijn:
- een duidelijke structuur voor het versturen en ontvangen van statusinformatie;
- vaste afspraken over welke controller welke gegevens mag aanpassen;
- mechanismen om gelijktijdige wijzigingen op een gecontroleerde manier af te handelen.

Veelgebruikte synchronisatiestrategieën zijn:
- een **master-slave-model**, waarbij één controller leidend is en de andere controller volgt;
- een model met **centrale coördinatie**, waarbij updates via één centraal punt worden verwerkt;
- periodieke **reconciliatie**, waarbij controllers hun status opnieuw afstemmen om afwijkingen te corrigeren.

Deze strategieën zijn relevant voor het Polarbear-vraagstuk, omdat ze helpen om tegenstrijdige updates en inconsistente toestanden te voorkomen.

## 3.2. Welke conflicten of race-conditions zijn bekend bij gelijktijdige aansturing?

### 3.2.1. Methoden
Voor deze deelvraag is gebruikgemaakt van een literature study naar gelijktijdige aansturing van controllers, race-conditions en veelvoorkomende synchronisatieconflicten binnen technische systemen.

### 3.2.2. Resultaten
Uit het onderzoek blijkt dat bij gelijktijdige aansturing verschillende conflicten kunnen ontstaan. Een belangrijk voorbeeld is dat beide controllers bijna tegelijkertijd een wijziging doorvoeren, waardoor onduidelijk wordt welke update leidend is.

Bekende problemen zijn onder andere:
- **race-conditions**, waarbij de uitkomst afhangt van de exacte timing van berichten of updates;
- **last-write-wins-gedrag**, waarbij de laatste update eerdere wijzigingen overschrijft;
- **status drift**, waarbij controllers na verloop van tijd verschillende waarden of toestanden aanhouden;
- **conflicterende setpoint-updates**, waarbij beide controllers een andere temperatuurinstelling proberen door te voeren.

Deze conflicten kunnen leiden tot onverwacht gedrag en onvoorspelbare temperatuurregeling. Vooral wanneer geen duidelijke regels bestaan over eigenaarschap of conflict-afhandeling, neemt de kans op synchronisatieproblemen toe.

## 3.3. Welke praktische richtlijnen of best practices bestaan om synchronisatieproblemen te voorkomen?

### 3.3.1. Methoden
Voor deze deelvraag is gebruikgemaakt van een literature study naar best practices voor controllercommunicatie, conflictpreventie en synchronisatie binnen systemen waarin meerdere apparaten gelijktijdig actief zijn.

### 3.3.2. Resultaten
Uit de geraadpleegde literatuur komen verschillende praktische richtlijnen naar voren om synchronisatieproblemen te beperken of te voorkomen.

Belangrijke best practices zijn:
- het hanteren van een **eenduidige rolverdeling**, bijvoorbeeld met een master en een slave;
- het toepassen van **conflict-afhandeling**, zoals lock- of lease-mechanismen;
- het uitvoeren van **periodieke reconciliatie** van setpoints en statuswaarden;
- het vastleggen van duidelijke regels voor welke controller wijzigingen mag doorvoeren;
- het testen van situaties waarin beide controllers tegelijkertijd actief zijn.

Voor het Polarbear-probleem lijken vooral een duidelijke rolverdeling, expliciete conflict-afhandeling en periodieke statuscontrole kansrijke maatregelen. Deze sluiten direct aan op de geconstateerde problemen rond gelijktijdige updates en timing-conflicten.

## 3.4. Hoe kan de kennis uit de literatuur worden toegepast op het Polarbear-vraagstuk?

### 3.4.1. Methoden
Voor deze deelvraag zijn de bevindingen uit de literature study vertaald naar de context van twee Polarbear ZEN-controllers binnen het bestaande systeem.

### 3.4.2. Resultaten
Op basis van de literatuur is het aannemelijk dat de synchronisatieproblemen tussen de twee Polarbear ZEN-controllers vooral ontstaan door concurrerende setpoint-updates en timing-conflicten. Wanneer beide controllers gelijktijdig proberen dezelfde toestand te beïnvloeden, kan inconsistent gedrag ontstaan.

De meest kansrijke verbeteropties binnen deze context zijn:
- een **master-slave-verdeling**, zodat één controller leidend is;
- een **lock- of lease-mechanisme**, zodat tijdelijke exclusiviteit op wijzigingen kan worden afgedwongen;
- **periodieke reconciliatie** van setpoints en status om verschillen te corrigeren;
- aanvullende logging en tests om beter inzicht te krijgen in het exacte moment waarop conflicten ontstaan.

Deze maatregelen bieden een concreet uitgangspunt voor verdere uitwerking, implementatie en testen binnen het systeem.

# 4. Conclusie

Op basis van dit onderzoek kan worden geconcludeerd dat de synchronisatieproblemen tussen twee Polarbear ZEN-controllers waarschijnlijk vooral worden veroorzaakt door concurrerende setpoint-updates en timing-conflicten bij gelijktijdige aansturing. Wanneer er geen duidelijke afspraken zijn over eigenaarschap of conflict-afhandeling, kan het systeem last-write-wins-gedrag vertonen, wat leidt tot onverwachte toestanden en onvoorspelbare temperatuurregeling.

Uit de literatuur blijkt dat verschillende strategieën en best practices beschikbaar zijn om dit soort problemen te voorkomen. De meest kansrijke verbeteringen binnen deze situatie zijn een eenduidige rolverdeling, expliciete conflict-afhandeling en periodieke reconciliatie van setpoints en status.

Daarmee biedt dit onderzoek een onderbouwd vertrekpunt voor verdere technische uitwerking. De volgende stap is om deze verbeteropties te vertalen naar een concrete aanpak en in de praktijk te testen binnen het bestaande systeem.

# 5. Bronnen

- HBO-i. (2018). *ICT Research Methods — Methods Pack for Research in ICT*. Methode: Literature study.
- Polarbear documentatie en technische specificaties (pdf's ontvangen van stagebegeleider).