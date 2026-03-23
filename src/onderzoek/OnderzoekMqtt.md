# Onderzoek MQTT

## Inleiding
Binnen het huidige systeem is er een vraagstuk rondom het synchroniseren van de polarbear units en de airco units. Op dit moment is het belangrijk dat wijzigingen in status of gegevens betrouwbaar en snel tussen deze onderdelen worden gedeeld. Een mogelijke oplossing hiervoor is het gebruik van MQTT.

MQTT is een lichtgewicht publish-subscribe protocol dat veel wordt gebruikt binnen IoT-toepassingen. In dit onderzoek bekijk ik of MQTT geschikt is om de synchronisatie tussen de polarbear units en de airco units te verbeteren. Daarbij onderzoek ik niet alleen de voordelen van MQTT, maar ook welke aandachtspunten, risico’s en randvoorwaarden er zijn voor toepassing binnen het bestaande systeem.

Dit onderzoek sluit aan op mijn stagedoel rondom onderzoekend vermogen, omdat ik niet direct uitga van een oplossing, maar eerst het probleem afbaken, ontbrekende kennis in beeld breng, onderzoek uitvoer en op basis daarvan tot een onderbouwd voorstel kom.

## Vraagstelling
De centrale vraag binnen dit onderzoek is:

**In hoeverre is MQTT een geschikte oplossing voor het synchroniseren van de polarbear units en de airco units binnen het bestaande systeem?**

Om deze vraag te beantwoorden, kijk ik naar de volgende deelvragen:
- Wat is het huidige synchronisatieprobleem tussen de polarbear units en de airco units?
- Welke eisen zijn belangrijk voor een goede synchronisatie, zoals snelheid, betrouwbaarheid en schaalbaarheid?
- Hoe werkt MQTT en welke eigenschappen maken het geschikt of minder geschikt voor dit vraagstuk?
- Welke risico’s en valkuilen brengt het gebruik van MQTT met zich mee?
- Hoe zou MQTT binnen het bestaande systeem geïmplementeerd kunnen worden?

## Methodische probleemaanpak
Voordat ik een oplossing kies, breng ik eerst het vraagstuk in beeld. Het probleem is dat de polarbear units en airco units goed met elkaar gesynchroniseerd moeten blijven. Wanneer deze synchronisatie niet goed verloopt, kan dat leiden tot inconsistente data, verouderde statussen of fouten in de aansturing.

Om dit vraagstuk goed te onderzoeken, moet eerst duidelijk zijn:
- hoe de synchronisatie nu verloopt
- waar de huidige knelpunten zitten
- welke informatie ontbreekt om te bepalen of MQTT een passende oplossing is
- aan welke eisen een nieuwe oplossing moet voldoen

De ontbrekende kennis zit vooral in:
- de technische mogelijkheden van MQTT binnen deze context
- de betrouwbaarheid van MQTT bij netwerkproblemen of uitval
- de manier waarop MQTT geïntegreerd kan worden in het bestaande systeem
- de mogelijke gevolgen voor backend, data-opslag en foutafhandeling

Om tot inzicht te komen, kies ik voor een **literatuuronderzoek**. Daarmee kan ik op een gestructureerde manier documentatie en andere bronnen raadplegen over MQTT, de werking ervan, de betrouwbaarheid, de voor- en nadelen en de toepasbaarheid binnen IoT-achtige systemen.

## Onderzoeksmethode
Voor dit onderzoek gebruik ik de methode **literatuuronderzoek**.

Ik raadpleeg technische documentatie, artikelen, whitepapers en andere relevante bronnen over MQTT en vergelijkbare manieren van synchroniseren. Deze methode past bij dit vraagstuk, omdat ik eerst theoretisch wil onderbouwen wat MQTT precies biedt en of dit aansluit bij de eisen van het systeem.

Bij het uitvoeren van dit onderzoek let ik kritisch op:
- welke voordelen MQTT in theorie biedt
- welke beperkingen of risico’s genoemd worden
- of de bronnen passen bij systemen waarin meerdere apparaten met elkaar moeten synchroniseren
- welke inzichten direct toepasbaar zijn binnen de context van de polarbear units en airco units

Hierdoor voer ik het onderzoek niet alleen beschrijvend uit, maar ook kritisch en onderbouwd.

## Analyse: waarom MQTT?
MQTT heeft eigenschappen die mogelijk goed aansluiten op het synchronisatievraagstuk.

### 1. Lichtgewicht protocol
MQTT is ontworpen voor situaties waarin apparaten efficiënt moeten communiceren met beperkte belasting. Dit maakt het geschikt voor omgevingen waarin apparaten niet onnodig zwaar belast mogen worden.

### 2. Publish-subscribe model
Bij MQTT communiceren apparaten niet direct met elkaar, maar via een broker. Hierdoor ontstaat minder onderlinge afhankelijkheid tussen units. Dit kan de architectuur overzichtelijker maken en maakt het eenvoudiger om meerdere units tegelijk te laten meeluisteren naar veranderingen.

### 3. Real-time communicatie
Wanneer een unit een wijziging publiceert op een topic, kunnen andere geabonneerde units deze wijziging vrijwel direct ontvangen. Dit maakt snellere synchronisatie mogelijk dan wanneer gegevens alleen via periodieke database-updates worden verwerkt.

### 4. Betrouwbaarheid
MQTT ondersteunt verschillende Quality of Service-niveaus (QoS). Daarmee kan worden bepaald hoe belangrijk het is dat een bericht zeker aankomt. Dit is relevant voor synchronisatie, omdat sommige berichten niet verloren mogen gaan.

### 5. Integratie in verschillende omgevingen
MQTT wordt breed ondersteund en is beschikbaar voor veel programmeertalen en platformen. Daardoor is het in principe goed te integreren in een bestaand systeem.

## Hoe werkt MQTT binnen dit vraagstuk?
MQTT werkt met een broker, publishers en subscribers. In deze situatie zouden de polarbear units en airco units berichten kunnen publiceren en ontvangen via een of meerdere topics.

Bijvoorbeeld:
- een polarbear unit publiceert een statuswijziging op een topic
- de broker ontvangt dit bericht
- alle airco units of andere onderdelen die op dit topic zijn geabonneerd, ontvangen de wijziging
- deze units kunnen vervolgens hun eigen status of gedrag aanpassen

Hierdoor ontstaat een model waarbij veranderingen centraal verspreid worden, zonder dat iedere unit rechtstreeks met alle andere units hoeft te communiceren.


## Mogelijke oplossing en toepassing binnen het systeem
Op basis van dit onderzoek lijkt MQTT een kansrijke oplossing voor het synchroniseren van de polarbear units en airco units, mits rekening wordt gehouden met de genoemde aandachtspunten.

Een mogelijke toepassing binnen het bestaande systeem bestaat uit de volgende onderdelen:

### 1. MQTT-broker opzetten
Er moet een broker worden gekozen en ingericht, bijvoorbeeld Mosquitto of EMQX, die de communicatie tussen de units afhandelt.

### 2. MQTT-clients toevoegen
De software van de polarbear units en airco units moet worden uitgebreid met MQTT-clients, zodat zij berichten kunnen publiceren en ontvangen.

### 3. Berichtstructuur definiëren
Er moet een duidelijke en consistente structuur worden afgesproken voor de inhoud van berichten, bijvoorbeeld in JSON-formaat. Daarbij moet vastliggen welke gegevens worden verstuurd en hoe andere units die interpreteren.

### 4. Betrouwbaarheid inbouwen
Om de kans op synchronisatieproblemen te verkleinen, moet worden gekeken naar QoS-instellingen, retained messages, reconnect-logica en mogelijke fallback-mechanismen.

### 5. Testen in de praktijk
Na de implementatie moet getest worden of de synchronisatie daadwerkelijk sneller, betrouwbaarder en minder foutgevoelig verloopt dan in de huidige situatie.

## Resultaten
Uit het literatuuronderzoek blijkt dat MQTT verschillende eigenschappen heeft die goed aansluiten bij het synchroniseren van apparaten binnen een systeem. Vooral het lichtgewicht karakter, het publish-subscribe model en de ondersteuning voor real-time communicatie maken MQTT geschikt voor dit type vraagstuk.

Tegelijkertijd laat het onderzoek zien dat MQTT niet automatisch alle problemen oplost. Er moet expliciet aandacht zijn voor uitval van de broker, netwerkstoringen, berichtbetrouwbaarheid en de manier waarop units herstellen na tijdelijke onderbrekingen. Ook moet goed worden nagedacht over de inrichting van topics en berichtstructuren.

Het onderzoek laat daarmee zien dat MQTT niet alleen voordelen biedt, maar dat de kwaliteit van de uiteindelijke oplossing sterk afhangt van de manier waarop het wordt geïmplementeerd.

## Conclusie
Op basis van dit onderzoek concludeer ik dat MQTT een geschikte en veelbelovende oplossing kan zijn voor het synchroniseren van de polarbear units en airco units binnen het bestaande systeem. MQTT sluit goed aan bij de behoefte aan efficiënte, schaalbare en snelle communicatie tussen meerdere apparaten.

Tegelijkertijd blijkt uit het onderzoek dat een succesvolle toepassing van MQTT afhangt van een zorgvuldige implementatie. Met name de betrouwbaarheid bij netwerkproblemen, het omgaan met uitval en het waarborgen van consistente synchronisatie zijn belangrijke aandachtspunten.

Daarom is MQTT niet alleen interessant als technisch protocol, maar vooral als oplossing wanneer het bewust en onderbouwd wordt toegepast binnen de context van het systeem. Op basis van de onderzochte informatie kan ik voorstellen om MQTT verder uit te werken in een prototype of proof-of-concept, zodat in de praktijk getest kan worden hoe goed deze oplossing werkt voor de synchronisatie tussen de units.