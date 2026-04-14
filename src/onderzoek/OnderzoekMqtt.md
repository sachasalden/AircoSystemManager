# 1. Inleiding

## 1.1. Aanleiding
Binnen het huidige systeem is er een vraagstuk rondom het synchroniseren van de polarbear units en de airco units. Op dit moment is het belangrijk dat wijzigingen in status of gegevens betrouwbaar en snel tussen deze onderdelen worden gedeeld. Wanneer deze synchronisatie niet goed verloopt, kan dat leiden tot inconsistente data, verouderde statussen of fouten in de aansturing.

Een mogelijke oplossing hiervoor is het gebruik van MQTT. MQTT is een lichtgewicht publish-subscribe protocol dat veel wordt gebruikt binnen IoT-toepassingen. Omdat de polarbear units en airco units ook met elkaar moeten communiceren en onderling wijzigingen moeten delen, is het relevant om te onderzoeken of MQTT hierbij een geschikte oplossing kan zijn.

Dit onderzoek sluit aan op mijn stagedoel rondom onderzoekend vermogen, omdat ik niet direct uitga van een oplossing, maar eerst het probleem afbaken, ontbrekende kennis in beeld breng, onderzoek uitvoer en op basis daarvan tot een onderbouwd voorstel kom.

## 1.2. Doelstelling
Het doel van dit onderzoek is om te bepalen in hoeverre MQTT een geschikte oplossing is voor het synchroniseren van de polarbear units en de airco units binnen het bestaande systeem. Daarbij wordt gekeken naar de werking van MQTT, de relevante eigenschappen van het protocol, de mogelijke voordelen, risico’s en randvoorwaarden, en de manier waarop MQTT binnen het huidige systeem toegepast zou kunnen worden.

De uitkomst van dit onderzoek is een onderbouwd advies over de toepasbaarheid van MQTT voor dit synchronisatievraagstuk, met aandacht voor zowel de technische kansen als de mogelijke beperkingen.

# 2. Hoofdvraag

**In hoeverre is MQTT een geschikte oplossing voor het synchroniseren van de polarbear units en de airco units binnen het bestaande systeem?**

# 3. Deelvragen

## 3.1. Wat is het huidige synchronisatieprobleem tussen de polarbear units en de airco units?

### 3.1.1. Methoden
Voor deze deelvraag is gebruikgemaakt van een literatuuronderzoek, aangevuld met een analyse van het bestaande probleem binnen de systeemcontext.

### 3.1.2. Resultaten
Het huidige probleem is dat de polarbear units en airco units goed met elkaar gesynchroniseerd moeten blijven. Wanneer deze synchronisatie niet goed verloopt, kan dat leiden tot inconsistente data, verouderde statussen of fouten in de aansturing.

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

## 3.2. Welke eisen zijn belangrijk voor een goede synchronisatie, zoals snelheid, betrouwbaarheid en schaalbaarheid?

### 3.2.1. Methoden
Voor deze deelvraag is gebruikgemaakt van literatuuronderzoek, waarbij is gekeken naar algemene eisen die gelden voor communicatie en synchronisatie tussen meerdere apparaten binnen een systeem.

### 3.2.2. Resultaten
Voor een goede synchronisatie tussen de polarbear units en de airco units zijn meerdere eisen van belang.

**Snelheid** is belangrijk, omdat statuswijzigingen zo snel mogelijk moeten worden doorgegeven aan andere onderdelen van het systeem.

**Betrouwbaarheid** is essentieel, omdat belangrijke berichten niet verloren mogen gaan. Wanneer een wijziging niet aankomt, kan dit zorgen voor inconsistente statussen of foutieve aansturing.

**Schaalbaarheid** speelt ook een rol. De oplossing moet niet alleen werken voor een klein aantal units, maar ook bruikbaar blijven wanneer meerdere apparaten tegelijk gegevens uitwisselen.

Daarnaast is het belangrijk dat de oplossing goed kan omgaan met:
- netwerkproblemen
- tijdelijke uitval van apparaten
- herstel na onderbrekingen
- consistente verwerking van ontvangen gegevens

## 3.3. Hoe werkt MQTT en welke eigenschappen maken het geschikt of minder geschikt voor dit vraagstuk?

### 3.3.1. Methoden
Voor deze deelvraag is gebruikgemaakt van literatuuronderzoek naar de werking van MQTT en de eigenschappen van het protocol binnen IoT-achtige systemen.

### 3.3.2. Resultaten
MQTT is een lichtgewicht publish-subscribe protocol dat veel wordt gebruikt binnen IoT-toepassingen. Het werkt met een broker, publishers en subscribers.

Bij MQTT communiceren apparaten niet direct met elkaar, maar via een broker. Een apparaat kan een bericht publiceren op een bepaald topic. Andere apparaten die op dat topic geabonneerd zijn, ontvangen dit bericht vervolgens vrijwel direct.

Binnen dit vraagstuk betekent dit bijvoorbeeld dat:
- een polarbear unit een statuswijziging publiceert op een topic
- de broker dit bericht ontvangt
- alle airco units of andere onderdelen die op dit topic zijn geabonneerd, deze wijziging ontvangen
- deze units vervolgens hun eigen status of gedrag aanpassen

Eigenschappen van MQTT die het protocol geschikt maken voor dit vraagstuk zijn:

### Lichtgewicht protocol
MQTT is ontworpen voor efficiënte communicatie met beperkte belasting. Dit maakt het geschikt voor omgevingen waarin apparaten niet onnodig zwaar belast mogen worden.

### Publish-subscribe model
Door het gebruik van een broker hoeven apparaten niet rechtstreeks met elkaar te communiceren. Dit vermindert de onderlinge afhankelijkheid tussen units en maakt de architectuur overzichtelijker.

### Real-time communicatie
Berichten kunnen vrijwel direct worden doorgestuurd naar geabonneerde apparaten. Hierdoor kan synchronisatie sneller plaatsvinden dan bij periodieke updates.

### Betrouwbaarheid
MQTT ondersteunt verschillende Quality of Service-niveaus (QoS). Hiermee kan worden bepaald hoe belangrijk het is dat een bericht zeker aankomt.

### Integratie
MQTT wordt breed ondersteund in verschillende programmeertalen en platformen. Daardoor is het in principe goed te integreren in een bestaand systeem.

Minder geschikte kanten van MQTT zijn dat het protocol niet automatisch alle synchronisatieproblemen oplost. De kwaliteit van de oplossing hangt sterk af van de manier waarop MQTT wordt ingericht en geïmplementeerd.

## 3.4. Welke risico’s en valkuilen brengt het gebruik van MQTT met zich mee?

### 3.4.1. Methoden
Voor deze deelvraag is gebruikgemaakt van literatuuronderzoek naar de betrouwbaarheid van MQTT, met name in situaties van netwerkproblemen, uitval en foutafhandeling.

### 3.4.2. Resultaten
Hoewel MQTT veel voordelen biedt, zijn er ook belangrijke risico’s en aandachtspunten.

Een belangrijk risico is de **uitval van de broker**. Omdat de communicatie via een broker verloopt, vormt deze een centraal onderdeel van het systeem. Wanneer de broker niet beschikbaar is, kan communicatie tussen units tijdelijk stilvallen.

Daarnaast kunnen **netwerkstoringen** leiden tot vertraagde of gemiste berichten. Daarom moet goed worden nagedacht over reconnect-logica en herstelmechanismen.

Ook de **berichtbetrouwbaarheid** vraagt aandacht. Niet ieder bericht heeft dezelfde prioriteit. Voor sommige berichten is het acceptabel als ze een keer niet aankomen, maar voor andere berichten kan dat grote gevolgen hebben voor de synchronisatie.

Andere belangrijke aandachtspunten zijn:
- de keuze van het juiste QoS-niveau
- het gebruik van retained messages
- de manier waarop units herstellen na tijdelijke onderbrekingen
- het voorkomen van inconsistente statussen
- foutafhandeling binnen backend en gekoppelde onderdelen

Uit het onderzoek blijkt daarmee dat MQTT voordelen biedt, maar alleen goed werkt wanneer deze risico’s expliciet worden meegenomen in het ontwerp.

## 3.5. Hoe zou MQTT binnen het bestaande systeem geïmplementeerd kunnen worden?

### 3.5.1. Methoden
Voor deze deelvraag is gebruikgemaakt van literatuuronderzoek en een verkenning van hoe MQTT technisch toegepast zou kunnen worden binnen het huidige systeem.

### 3.5.2. Resultaten
Een mogelijke toepassing van MQTT binnen het bestaande systeem bestaat uit de volgende onderdelen.

### MQTT-broker opzetten
Er moet een broker worden gekozen en ingericht, bijvoorbeeld Mosquitto of EMQX, die de communicatie tussen de units afhandelt.

### MQTT-clients toevoegen
De software van de polarbear units en airco units moet worden uitgebreid met MQTT-clients, zodat zij berichten kunnen publiceren en ontvangen.

### Berichtstructuur definiëren
Er moet een duidelijke en consistente structuur worden afgesproken voor de inhoud van berichten, bijvoorbeeld in JSON-formaat. Daarbij moet vastliggen welke gegevens worden verstuurd en hoe andere units die interpreteren.

### Betrouwbaarheid inbouwen
Om de kans op synchronisatieproblemen te verkleinen, moet worden gekeken naar QoS-instellingen, retained messages, reconnect-logica en mogelijke fallback-mechanismen.

### Testen in de praktijk
Na de implementatie moet getest worden of de synchronisatie daadwerkelijk sneller, betrouwbaarder en minder foutgevoelig verloopt dan in de huidige situatie.

### Implementatie in het huidige systeem
Een belangrijke vervolgvraag is of MQTT het huidige pollen volledig kan vervangen. Dat hangt af van de mogelijkheden van de wallpanels en de airco’s zelf. Wanneer deze apparaten actief statusupdates kunnen publiceren, kan polling mogelijk grotendeels of volledig worden verminderd. Als bepaalde gegevens alleen via polling beschikbaar blijven, zal waarschijnlijk een hybride oplossing nodig zijn waarbij MQTT en polling naast elkaar bestaan.

# 4. Conclusie

Op basis van dit onderzoek kan worden geconcludeerd dat MQTT een geschikte en veelbelovende oplossing kan zijn voor het synchroniseren van de polarbear units en de airco units binnen het bestaande systeem. MQTT sluit goed aan bij de behoefte aan efficiënte, schaalbare en snelle communicatie tussen meerdere apparaten.

Vooral het lichtgewicht karakter, het publish-subscribe model en de ondersteuning voor real-time communicatie maken MQTT geschikt voor dit type vraagstuk. Daarnaast biedt MQTT mogelijkheden om de betrouwbaarheid van berichten te verbeteren door middel van QoS-niveaus en aanvullende instellingen.

Tegelijkertijd blijkt uit het onderzoek dat MQTT niet automatisch alle synchronisatieproblemen oplost. Een succesvolle toepassing hangt af van een zorgvuldige implementatie, waarbij rekening wordt gehouden met broker-uitval, netwerkstoringen, berichtbetrouwbaarheid, foutafhandeling en herstel na onderbrekingen.

Daarom kan MQTT worden gezien als een kansrijke oplossing, mits deze bewust en goed onderbouwd wordt toegepast binnen de context van het huidige systeem. Op basis van deze bevindingen is het logisch om MQTT verder uit te werken in een prototype of proof-of-concept, zodat in de praktijk getest kan worden hoe goed deze oplossing werkt voor de synchronisatie tussen de units.

# 5. Bronnen

Hier kun je straks je gebruikte bronnen onder zetten, bijvoorbeeld:
- documentatie over MQTT
- artikelen of whitepapers over publish-subscribe architecturen
- informatie over Mosquitto, EMQX of andere brokers
- bronnen over betrouwbaarheid, QoS en retained messages

