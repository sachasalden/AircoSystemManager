# 1. Inleiding

## 1.1. Aanleiding
Binnen het huidige systeem worden de Polarbear-units en de airco-units met elkaar gesynchroniseerd via de database. Wanneer een waarde wordt aangepast op een Polarbear-unit, wordt deze waarde opgeslagen in de database. Vervolgens wordt deze waarde vergeleken met de waarde van de airco-unit. Als er een verschil wordt gevonden, wordt de waarde van de airco-unit aangepast naar de waarde van de Polarbear-unit.

Dit werkt ook andersom: wanneer een waarde aan de kant van de airco-unit verandert, kan deze wijziging via de database worden verwerkt en vervolgens worden gebruikt om de Polarbear-units bij te werken.

Deze aanpak werkt in de basis goed, maar brengt ook enkele nadelen met zich mee. Er kan vertraging ontstaan doordat iedere wijziging eerst via de database verwerkt moet worden. Daarnaast is de synchronisatie afhankelijk van de beschikbaarheid en correcte werking van de database. Wanneer de database traag is of tijdelijk niet beschikbaar is, kan dit direct invloed hebben op de synchronisatie tussen de units.

Daarom is het relevant om te onderzoeken of een andere aanpak mogelijk is, waarbij de Polarbear-units en airco-units directer met elkaar synchroniseren zonder dat voor iedere wijziging eerst een database-update nodig is.

## 1.2. Doelstelling
Het doel van dit onderzoek is om te onderzoeken hoe de synchronisatie tussen de Polarbear-units en de airco-units verbeterd kan worden. Daarbij wordt gekeken naar een aanpak waarbij units directer met elkaar communiceren, zodat de synchronisatie sneller en minder afhankelijk van de database wordt.

De uitkomst van dit onderzoek is een onderbouwd beeld van de mogelijke voordelen, nadelen en implementatiestappen van een directe synchronisatieaanpak binnen het bestaande systeem.

# 2. Hoofdvraag

**Hoe kan de synchronisatie tussen Polarbear-units en airco-units worden verbeterd door directer te synchroniseren zonder voor iedere wijziging afhankelijk te zijn van een database-update?**

# 3. Deelvragen

## 3.1. Hoe kan er direct gesynchroniseerd worden tussen de Polarbear-units en de airco-units zonder dat er voor iedere wijziging een database-update nodig is?

### 3.1.1. Methoden
Voor deze deelvraag is gebruikgemaakt van literatuuronderzoek naar bestaande methoden voor het synchroniseren van apparaten zonder volledige afhankelijkheid van een database. Daarbij is gekeken naar communicatiepatronen zoals publish-subscribe, MQTT, WebSockets en state management.

### 3.1.2. Resultaten
Er zijn verschillende manieren om directer te synchroniseren tussen Polarbear-units en airco-units zonder dat iedere wijziging eerst via de database verwerkt hoeft te worden.

Een mogelijke aanpak is het gebruik van een **publish-subscribe model**. In dit model communiceren onderdelen niet direct één-op-één met elkaar, maar via een centraal communicatiekanaal of broker. Een unit kan een wijziging publiceren, waarna andere units die op dit type wijziging zijn geabonneerd deze update direct ontvangen. MQTT is hiervoor een geschikt voorbeeld, omdat dit protocol vaak wordt gebruikt voor communicatie tussen apparaten en IoT-systemen.

Een andere mogelijkheid is het gebruik van **WebSockets**. Hiermee kan een continue verbinding worden opgezet tussen onderdelen van het systeem, waardoor wijzigingen real-time kunnen worden doorgestuurd zonder steeds opnieuw een request te hoeven doen.

Daarnaast kan er binnen de software gebruik worden gemaakt van een vorm van **state management**, waarbij de actuele status van units centraal wordt bijgehouden en wijzigingen direct worden verwerkt. Voorbeelden hiervan zijn concepten zoals Redux of MobX. Deze oplossingen zijn vooral relevant binnen applicatielogica, maar minder geschikt als directe communicatieoplossing tussen fysieke apparaten.

Voor dit vraagstuk lijkt vooral een publish-subscribe aanpak met bijvoorbeeld MQTT kansrijk, omdat dit goed aansluit bij systemen waarin meerdere apparaten wijzigingen moeten ontvangen en verwerken.

## 3.2. Wat zijn de voordelen van deze nieuwe aanpak ten opzichte van het huidige systeem?

### 3.2.1. Methoden
Voor deze deelvraag is een vergelijking gemaakt tussen de huidige synchronisatie via de database en een directe synchronisatieaanpak via een communicatieprotocol zoals MQTT of WebSockets.

### 3.2.2. Resultaten
Een directe synchronisatieaanpak biedt verschillende voordelen ten opzichte van de huidige database-afhankelijke werkwijze.

Ten eerste kan de synchronisatie sneller verlopen. Doordat een wijziging niet eerst volledig via de database verwerkt hoeft te worden, kan de andere unit sneller worden bijgewerkt. Dit zorgt voor een kortere reactietijd binnen het systeem.

Ten tweede wordt het systeem minder afhankelijk van de database. De database blijft belangrijk voor opslag, logging en historische gegevens, maar is niet meer noodzakelijk als tussenstap voor iedere synchronisatieactie. Hierdoor blijft de synchronisatie minder kwetsbaar wanneer de database tijdelijk traag of niet beschikbaar is.

Ten derde maakt deze aanpak real-time updates beter mogelijk. Wanneer een wijziging direct wordt gepubliceerd en ontvangen door andere onderdelen, kunnen units sneller reageren op nieuwe waarden.

Daarnaast kan de fouttolerantie verbeteren. Wanneer communicatie en database-opslag van elkaar worden gescheiden, kan het systeem beter omgaan met tijdelijke problemen. Een wijziging kan bijvoorbeeld eerst direct worden doorgegeven en later alsnog worden opgeslagen of gecontroleerd.

De belangrijkste voordelen zijn:
- snellere synchronisatie tussen units;
- minder afhankelijkheid van database-updates;
- betere ondersteuning voor real-time communicatie;
- meer flexibiliteit in foutafhandeling;
- duidelijkere scheiding tussen communicatie en data-opslag.

## 3.3. Wat zijn de mogelijke nadelen van deze nieuwe aanpak en hoe kunnen deze worden opgelost?

### 3.3.1. Methoden
Voor deze deelvraag is gekeken naar risico’s van directe communicatie tussen apparaten en systeemonderdelen. Daarbij is vooral gelet op complexiteit, beveiliging en foutafhandeling.

### 3.3.2. Resultaten
Hoewel directe synchronisatie voordelen biedt, brengt deze aanpak ook nieuwe aandachtspunten met zich mee.

Een eerste nadeel is de extra complexiteit van communicatie. Wanneer meerdere units direct of via een broker met elkaar communiceren, moeten duidelijke afspraken worden gemaakt over berichtstructuur, volgorde, timing en eigenaarschap van wijzigingen. Zonder goede afspraken kunnen alsnog inconsistenties ontstaan.

Dit kan worden beperkt door een gestandaardiseerd communicatieprotocol te gebruiken en duidelijke topics, berichtstructuren en synchronisatieregels vast te leggen.

Een tweede risico is beveiliging. Directe communicatie tussen units kan kwetsbaar zijn voor ongeautoriseerde toegang of manipulatie van berichten. Dit is vooral belangrijk wanneer communicatie via het netwerk verloopt.

Dit kan worden opgelost door:
- authenticatie toe te passen;
- communicatie te versleutelen waar mogelijk;
- toegangscontrole in te richten;
- alleen toegestane devices of services toegang te geven.

Een derde aandachtspunt is foutafhandeling. Wanneer een bericht niet aankomt of een unit tijdelijk offline is, kan de status tussen units alsnog verschillen. Daarom moet worden nagedacht over retries, timeouts, reconnect-logica en eventueel een fallback naar de database.

Mogelijke oplossingen zijn:
- retry-mechanismen;
- reconnect-logica;
- statuscontrole na herstel van verbinding;
- periodieke reconciliatie tussen actuele status en opgeslagen status;
- duidelijke logging van mislukte synchronisatieacties.

## 3.4. Hoe kan deze nieuwe aanpak worden geïmplementeerd in het bestaande systeem?

### 3.4.1. Methoden
Voor deze deelvraag is gekeken naar een mogelijke implementatieaanpak binnen het bestaande systeem. Daarbij is vooral gekeken naar de benodigde technische stappen en aandachtspunten voor integratie.

### 3.4.2. Resultaten
Om directe synchronisatie tussen Polarbear-units en airco-units te implementeren, kunnen meerdere stappen worden genomen.

### Communicatieprotocol kiezen
Eerst moet worden bepaald welk communicatieprotocol het beste aansluit bij het systeem. MQTT lijkt hiervoor een geschikte kandidaat, omdat het publish-subscribe model goed past bij situaties waarin meerdere apparaten updates moeten ontvangen. WebSockets kunnen ook geschikt zijn, vooral wanneer er continue real-time communicatie nodig is tussen applicatieonderdelen.

### Berichtstructuur ontwerpen
Er moet een duidelijke berichtstructuur worden opgesteld. Daarin moet staan welke gegevens worden verstuurd, zoals:
- unit-id;
- ruimte-id;
- type wijziging;
- nieuwe waarde;
- timestamp;
- bron van de wijziging.

Door deze structuur vast te leggen, kunnen alle onderdelen berichten op dezelfde manier interpreteren.

### Software van units aanpassen
De software van de Polarbear-units en airco-units moet worden aangepast zodat zij berichten kunnen versturen en ontvangen volgens het gekozen protocol. Hierbij moet ook worden bepaald welke unit of service verantwoordelijk is voor het doorvoeren van wijzigingen.

### Database anders positioneren
De database hoeft niet volledig te verdwijnen uit het systeem. In plaats daarvan kan de database vooral worden gebruikt voor opslag, logging en controle achteraf. De directe communicatie wordt dan gebruikt voor snelle synchronisatie, terwijl de database de bron blijft voor historische gegevens en herstel na fouten.

### Testen van de nieuwe aanpak
Na implementatie moet de nieuwe aanpak uitgebreid worden getest. Daarbij moet onder andere worden gecontroleerd:
- of wijzigingen snel genoeg worden doorgegeven;
- of units consistent blijven;
- wat er gebeurt bij netwerkproblemen;
- wat er gebeurt wanneer een unit tijdelijk offline is;
- of de database en actuele status niet uit elkaar lopen.

## 3.5. Welke rol blijft de database spelen binnen de nieuwe aanpak?

### 3.5.1. Methoden
Voor deze deelvraag is gekeken naar de verhouding tussen directe synchronisatie en database-opslag binnen het bestaande systeem.

### 3.5.2. Resultaten
Ook wanneer directe synchronisatie wordt toegepast, blijft de database een belangrijke rol spelen. De database hoeft alleen niet meer de centrale tussenstap te zijn voor iedere synchronisatieactie.

In de nieuwe aanpak kan de database vooral worden gebruikt voor:
- opslag van de laatste bekende status;
- logging van wijzigingen;
- foutanalyse;
- herstel na uitval;
- controle of units na verloop van tijd nog gelijk lopen.

Hierdoor ontstaat een hybride aanpak. De directe communicatie zorgt voor snelle synchronisatie, terwijl de database zorgt voor opslag, controle en betrouwbaarheid op langere termijn.

Deze combinatie kan sterker zijn dan het huidige systeem, omdat snelheid en robuustheid beter van elkaar worden gescheiden.

# 4. Conclusie

Op basis van dit onderzoek kan worden geconcludeerd dat de synchronisatie tussen Polarbear-units en airco-units verbeterd kan worden door gebruik te maken van directe communicatie tussen systeemonderdelen. In het huidige systeem verloopt synchronisatie via de database, wat in de basis werkt, maar ook zorgt voor vertraging en afhankelijkheid van database-updates.

Een directe synchronisatieaanpak, bijvoorbeeld via MQTT of WebSockets, kan zorgen voor snellere updates, minder afhankelijkheid van de database en betere ondersteuning voor real-time communicatie. Vooral een publish-subscribe model lijkt kansrijk, omdat dit goed past bij een systeem waarin meerdere apparaten wijzigingen moeten ontvangen en verwerken.

Tegelijkertijd brengt deze aanpak ook nieuwe aandachtspunten met zich mee. Er moeten duidelijke afspraken worden gemaakt over communicatie, beveiliging, foutafhandeling en herstel na verbindingsproblemen. Ook moet worden voorkomen dat de actuele status van units en de opgeslagen status in de database uit elkaar lopen.

Daarom lijkt een hybride oplossing het meest geschikt. Hierbij wordt directe communicatie gebruikt voor snelle synchronisatie, terwijl de database behouden blijft voor opslag, logging en herstel. Op die manier wordt het systeem sneller en minder afhankelijk van de database, zonder dat betrouwbaarheid en controle verloren gaan.

# 5. Bronnen

- Interne analyse van het huidige synchronisatieproces tussen Polarbear-units en airco-units.
- Bestaande projectdocumentatie over Polarbear- en airco-integratie.
- Literatuur over publish-subscribe communicatie, MQTT, WebSockets en real-time synchronisatie.