# 1. Inleiding

## 1.1. Aanleiding
Binnen de backend spelen de domotics airco-integraties en de wall panel/thermostaatlogica (Polarbear) een belangrijke rol. Deze modules communiceren met fysieke apparaten via TCP sockets, Modbus (TCP/RTU) en in één geval via HTTP-calls naar een lokale of remote service.

Een belangrijk kenmerk van dit domein is dat het gaat om communicatie met netwerk- en hardwarecomponenten die vaak traag of onbetrouwbaar kunnen zijn. Daardoor ontstaan risico’s op het gebied van beschikbaarheid, performance en security. Denk hierbij aan timeouts, verbindingsproblemen, retries, resource-beheer en beperkte transportbeveiliging.

Deze analyse is uitgevoerd om inzicht te krijgen in de belangrijkste kwaliteitsrisico’s binnen deze onderdelen van de backend, zodat gerichte verbeteringen kunnen worden voorgesteld.

## 1.2. Doelstelling
Het doel van deze analyse is om de relevante kwaliteitsaspecten binnen de domotics airco-integraties en de Polarbear-logica in kaart te brengen. Daarbij ligt de focus op drie kwaliteitskenmerken: beschikbaarheid, performance en security.

De uitkomst van deze analyse is een onderbouwd overzicht van sterke punten, risico’s en concrete aanbevelingen, zodat de backend stabieler, efficiënter en veiliger kan worden ingericht.

# 2. Centrale vraag

**Welke risico’s en verbeterpunten zijn binnen de domotics airco-integraties en Polarbear-logica het meest relevant op het gebied van beschikbaarheid, performance en security?**

# 3. Analyseonderdelen

## 3.1. Welke analysemethoden en referentiekaders zijn gebruikt?

### 3.1.1. Methoden
Voor deze kwaliteitsanalyse is gebruikgemaakt van een combinatie van documentanalyse, statische code-inspectie, architectuur- en ketenanalyse en risicogerichte kwaliteitsanalyse.

De volgende methoden zijn toegepast:

- **Documentanalyse**
    - Bestudering van bestaande projectdocumentatie, comments en bekende beperkingen van de Polarbear-integratie.
    - Doel: context, aannames en operationele beperkingen expliciet maken.

- **Statische code-inspectie**
    - Gerichte review van kritieke backend-modules met focus op TCP, Modbus, HTTP, foutafhandeling, polling-loops, timeouts en reconnect-flow.
    - Doel: structurele risico’s identificeren zonder afhankelijk te zijn van runtime-tests.

- **Architectuur- en ketenanalyse**
    - Analyse van afhankelijkheden in de keten van applicatie naar transportlaag, gateway of device en terugkoppeling naar database of synchronisatie.
    - Doel: single points of failure, cascading effects en bottlenecks herkennen.

- **Risicogerichte kwaliteitsanalyse**
    - Prioritering van bevindingen op basis van impact voor beschikbaarheid, performance en security.
    - Doel: eerst de risico’s met de grootste operationele impact adresseren.

### 3.1.2. Resultaten
Bij deze analyse is gebruikgemaakt van de volgende referentiekaders en standaarden:

- **ISO/IEC 25010**
    - Toegepast op Reliability, Performance Efficiency en Security.

- **OWASP Top 10 / OWASP ASVS**
    - Richtinggevend voor inputvalidatie, transportbeveiliging, logging-hygiëne en trust boundaries.

- **Protocolspecifieke praktijkrichtlijnen**
    - Met name voor Modbus/TCP en raw TCP, waarbij rekening is gehouden met het ontbreken van native encryptie en authenticatie.

Deze combinatie van methoden en standaarden biedt een passend kader om de backend op een gestructureerde manier te beoordelen.

## 3.2. Welke aandachtspuntexn zijn er op het gebied van beschikbaarheid?

### 3.2.1. Methoden
Voor dit onderdeel is vooral gekeken naar socket-afhandeling, timeouts, reconnect-logica, polling-mechanismen en foutafhandeling binnen de device-communicatie.

### 3.2.2. Resultaten
Binnen de backend zijn verschillende positieve punten zichtbaar op het gebied van beschikbaarheid. Zo zijn op meerdere plekken timeouts aanwezig, waardoor vastgelopen connecties niet onbeperkt blijven hangen. Daarnaast bevat de Polarbear v2-module een reconnect-mechanisme met vertraging en een vlag om dubbele reconnect-pogingen te beperken.

Tegelijkertijd zijn er ook duidelijke risico’s:

- **Single point of failure per device-communicatiepad**
    - Wanneer een device of gateway niet reageert, kunnen meerdere gerelateerde flows vertragen of blokkeren.

- **Onvolledig socket lifecycle-beheer**
    - Niet alle event-paths worden altijd eenduidig afgehandeld, wat kan leiden tot hanging promises, resource leaks en instabiel gedrag.

- **Agressieve polling**
    - In Polarbear v2 wordt `getFlags()` met een interval van ongeveer 20 ms aangeroepen. Dit is zeer frequent en kan leiden tot extra load, timeouts en reconnects.

- **Silent failure**
    - Sommige fouten worden alleen gelogd, zonder dat hogere lagen goed geïnformeerd worden. Hierdoor lijkt het systeem beschikbaar, terwijl synchronisatieproblemen blijven bestaan.

De belangrijkste aanbevelingen op het gebied van beschikbaarheid zijn:

- een centrale retry-policy per transporttype;
- exponential backoff en jitter toepassen;
- polling realistischer maken;
- adaptive polling gebruiken bij foutcondities;
- garanderen dat iedere async I/O-call altijd eindigt in resolve of reject met cleanup;
- health metrics toevoegen, zoals timeout rate, reconnect count en last-success timestamp.

## 3.3. Welke aandachtspunten zijn er op het gebied van performance?

### 3.3.1. Methoden
Voor dit onderdeel is gekeken naar seriële verwerking, netwerkroundtrips, logging in hot paths en batching-mogelijkheden binnen de gebruikte protocollen.

### 3.3.2. Resultaten
Binnen de backend wordt regelmatig sequentieel gewerkt. Dat is in sommige gevallen logisch, bijvoorbeeld om botsingen op een Modbus-bus te voorkomen. Ook zijn er op meerdere plekken vertragingen ingebouwd om hardware niet te overspoelen.

Toch zijn er duidelijke performance-risico’s:

- **Seriële verwerking in combinatie met hoge timeouts**
    - Wanneer requests per panel of per register achter elkaar worden uitgevoerd, kan de totale verwerkingstijd sterk oplopen.

- **Veel losse netwerktransacties**
    - Het patroon van meerdere reads en writes per wijziging veroorzaakt extra roundtrips en verhoogt de belasting.

- **Logging in hot paths**
    - Veel console logging binnen polling-loops of socket-events verhoogt CPU- en I/O-belasting.

- **Gebrek aan batching**
    - Waar Modbus het toestaat, worden niet altijd meerdere registers tegelijk gelezen of geschreven.

Aanbevelingen op het gebied van performance zijn:

- rate limiting per device of gateway invoeren;
- batch reads en writes gebruiken waar mogelijk;
- logging in hot paths beperken tot debug-niveau;
- onderscheid maken tussen control path en sync path;
- een queue per device toepassen om concurrency gecontroleerd te houden.

## 3.4. Welke aandachtspunten zijn er op het gebied van security?

### 3.4.1. Methoden
Voor dit onderdeel is gekeken naar transportbeveiliging, inputvalidatie, trust boundaries en logging-hygiëne binnen de device- en servicecommunicatie.

### 3.4.2. Resultaten
De onderzochte integraties draaien grotendeels binnen een vertrouwd netwerk, maar hebben wel een aanzienlijk attack surface. Er wordt gebruikgemaakt van open TCP sockets, Modbus zonder standaard encryptie of authenticatie en in één geval HTTP-verkeer zonder TLS.

De belangrijkste security-risico’s zijn:

- **Ontbrekende transportbeveiliging**
    - Modbus/TCP en raw TCP zijn doorgaans plaintext en zonder authenticatie, waardoor sniffing en spoofing mogelijk zijn binnen hetzelfde netwerk.

- **HTTP zonder TLS**
    - Wanneer HTTP over het netwerk loopt, ontstaat risico op MITM-aanvallen en request-tampering.

- **Onvoldoende inputvalidatie**
    - Zonder strikte validatie van device ID’s, registeradressen, hosts, poorten, temperatuurwaarden en fanspeed kunnen fouten of misconfiguraties leiden tot onjuist hardwaregedrag of crashes.

- **Gevoelige logging**
    - Logs kunnen IP-adressen, device identifiers en payloads bevatten, wat de impact van een lek vergroot.

Aanbevelingen op het gebied van security zijn:

- netwerksegmentatie toepassen met aparte VLAN’s en firewallregels;
- TLS gebruiken waar dat mogelijk is;
- services niet onnodig buiten localhost of VLAN beschikbaar maken;
- strikte inputvalidatie toevoegen op alle write-paden;
- logging beperken en gevoelige gegevens maskeren;
- waar relevant app-level autorisatie toepassen voor setpoint-wijzigingen.

## 3.5. Wat zijn de belangrijkste bevindingen en prioriteiten?

### 3.5.1. Methoden
Voor dit onderdeel zijn de bevindingen uit de eerdere analyseonderdelen samengebracht en geprioriteerd op basis van operationele impact.

### 3.5.2. Resultaten
Uit de analyse blijkt dat beschikbaarheid momenteel het meest kwetsbare kwaliteitsaspect is. Vooral agressieve polling, foutgevoelige socket-afhandeling en afhankelijkheid van trage of offline devices vormen hier een groot risico.

Performance wordt vooral beperkt door seriële I/O, relatief hoge timeout-paden en een hoog aantal losse netwerktransacties. Security is in grote mate afhankelijk van trusted-LAN-aannames, terwijl de gebruikte protocollen van zichzelf weinig bescherming bieden.

De belangrijkste prioriteiten zijn:

1. stabiliseren van het device-communicatiepad;
2. verlagen en beheersen van poll-load;
3. voorkomen van sync-feedback en write-ping-pong;
4. beperken van roundtrips en seriële bottlenecks;
5. versterken van de security-baseline met segmentatie, inputvalidatie en logging-hygiëne.

# 4. Conclusie

Op basis van deze kwaliteitsanalyse kan worden geconcludeerd dat de backend binnen de domotics airco-integraties en de Polarbear-logica vooral kwetsbaar is op het gebied van beschikbaarheid. De grootste risico’s liggen bij agressieve polling, fragiele socket-afhandeling en cascading failures wanneer één device offline raakt.

Op het gebied van performance zorgen vooral seriële I/O, hoge timeout-paden en veel losse netwerktransacties voor vertraging en inefficiëntie. Security is daarnaast beperkt doordat de gebruikte transportprotocollen grotendeels insecure by design zijn en vooral steunen op de aanname van een vertrouwd netwerk.

De analyse laat zien dat gerichte verbeteringen mogelijk zijn. Denk hierbij aan uniforme timeout- en retry-strategieën, realistischer polling, batching, queueing, netwerksegmentatie, inputvalidatie en betere logging-hygiëne. Door deze maatregelen door te voeren kan de backend stabieler, efficiënter en veiliger worden ingericht.

# 5. Bronnen

- ISO/IEC 25010
- OWASP Top 10
- OWASP ASVS
- Protocolspecifieke praktijkrichtlijnen voor Modbus/TCP en raw TCP
- Bestaande projectdocumentatie, comments en codeanalyse van de backend