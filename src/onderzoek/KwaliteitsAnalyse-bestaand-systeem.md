# Analyse: relevante kwaliteitsaspecten (Beschikbaarheid, Performance, Security)

## Scope en context
Deze analyse richt zich op de **domotics airco–integraties** en **wall panel/thermostaat (Polarbear)** logica binnen de backend. De modules communiceren met fysieke apparaten via  **TCP sockets**, **Modbus (TCP/RTU)** en in één geval via **HTTP-calls naar een lokale/remote service**.

Belangrijke eigenschap van dit domein: het is netwerk + hardware, met vaak **trage of onbetrouwbare endpoints**. Daardoor worden beschikbaarheid, timeouts, retries en resource-beheer belangrijke kwaliteitsfactoren.

## Gebruikte analysemethoden en standaarden

Voor deze kwaliteitsanalyse is een combinatie gebruikt van documentanalyse, statische code-inspectie en architectuur-/risico-analyse.

### Analysemethoden
- **Documentanalyse**
  - Bestudering van bestaande projectdocumentatie, comments en bekende beperkingen van de Polarbear-integratie.
  - Doel: context, aannames en operationele constraints expliciet maken.
- **Statische code-inspectie**
  - Gerichte review van kritieke backend-modules met focus op I/O-gedrag (TCP/Modbus/HTTP), foutafhandeling, polling-loops, timeouts en reconnect-flow.
  - Doel: structurele risico's identificeren zonder runtime-afhankelijkheid.
- **Architectuur- en ketenanalyse**
  - Analyse van afhankelijkheden in de keten: applicatie -> transportlaag -> gateway/device -> terugkoppeling naar database/sync.
  - Doel: single points of failure, cascading effects en bottlenecks herkennen.
- **Risicogerichte kwaliteitsanalyse**
  - Prioritering van bevindingen op impact voor Beschikbaarheid, Performance en Security.
  - Doel: eerst de risico's met grootste operationele impact adresseren.

### Referentiekaders en standaarden
- **ISO/IEC 25010** (Software Product Quality Model)
  - Toegepast op relevante kenmerken: Reliability (incl. beschikbaarheid), Performance Efficiency en Security.
- **OWASP Top 10 / OWASP ASVS** (richtlijnniveau)
  - Richtinggevend voor inputvalidatie, transportbeveiliging, logging-hygiene en trust boundaries.
- **NIST-principes** (best-practice niveau)
  - Richtinggevend voor segmentatie, least privilege, monitoring en resilience.
- **Protocolspecifieke praktijkrichtlijnen** (Modbus/TCP en raw TCP)
  - Erkend dat native encryptie/authenticatie vaak ontbreekt; compenserende maatregelen zijn daarom noodzakelijk.

---

## 1) Beschikbaarheid (Availability)

### Wat gaat goed
- **Timeouts** zijn op meerdere plekken aanwezig (bijv. socket timeouts / setTimeout() met reject/destroy). Dit voorkomt dat een vastgelopen connectie de flow *voor altijd* blokkeert.
- In de Polarbear (v2) module is er een **reconnect-mechanisme** geïntroduceerd met een vertraging (`reconnectDelay`) en een `reconnecting`-flag om dubbele pogingen te beperken.

### Risico’s / zwakke punten
1. **Single point of failure per device-communicatiepad**
    - Als een device (of gateway) niet reageert, zijn er flows die meerdere devices/panels in één sessie updaten. Eén falende node kan de rest vertragen of blokkeren (dit wordt in comments ook benoemd).

2. **Onvolledig/risicovol socket lifecycle-beheer**
    - Er zijn patronen waarin sockets worden geopend en vervolgens via timers worden “destroyed”, maar niet altijd met duidelijke afhandeling van alle event-paths (connect/error/timeout/close). Dat kan leiden tot:
        - “hanging promises” (promises die nooit resolven/rejecten),
        - resource leaks (open sockets),
        - instabiel gedrag bij packet loss / partial reads.

3. **Tight polling / hoge frequentie loops**
    - In Polarbear v2 wordt `getFlags()` periodiek opnieuw aangeroepen met ~20ms delay. Dit is extreem agressief en kan beschikbaarheid verslechteren:
        - hoge load op panel(s),
        - meer kans op timeouts,
        - meer reconnects → “self-inflicted outage”.

4. **Foutafhandeling: soms loggen maar doorgaan**
    - In sommige gevallen worden errors gelogd maar wordt de hogere laag niet geïnformeerd of wordt alsnog `resolve` gedaan. Dat kan “silent failure” geven: systeem lijkt beschikbaar maar sync is kapot.

### Aanbevelingen (availability)
- Introduceer **centrale retry policy** per type transport:
    - max retries, exponential backoff + jitter, circuit breaker (tijdelijk “open” bij herhaald falen).
- Verlaag polling en maak het event/push-gedreven waar mogelijk; anders:
    - **poll interval** realistisch (bijv. 250ms–2s afhankelijk van hardware),
    - **adaptive polling** (langzamer bij fouten).
- Zorg dat elke async I/O call **altijd** eindigt in resolve/reject (met finally cleanup).
- Voeg **health metrics** toe: error rate per device, timeout rate, reconnect count, last-success timestamp.

---

## 2) Performance

### Wat gaat goed
- Er wordt regelmatig **sequentieel** gewerkt (bijv. “update panels one by one”), wat soms noodzakelijk is bij Modbus bussen om collisions te vermijden.
- Er zijn delays ingebouwd om hardware niet te overspoelen (bijv. 100ms in sommige loops).

### Bottlenecks / performance-risico’s
1. **Seriële processing + hoge timeouts = lange end-to-end latency**
    - Als updates per panel of per register sequentieel gebeuren en elk request een timeout van seconden kan raken, kan totale looptijd snel oplopen (N devices × timeout).

2. **Onnodig veel netwerk roundtrips**
    - Patroon: read flag → read setpoint/fanspeed → write flag clear → etc. Dit kan per wijziging meerdere transacties kosten.
    - Vooral bij polling-loop kan dit verkeer domineren.

3. **Console logging op hoge frequentie**
    - Veel logging in hot paths (polling, per socket data). Dit is CPU- en I/O-belastend en kan latency verhogen.

4. **Geen batching waar mogelijk**
    - Modbus ondersteunt vaak “read multiple registers” / “write multiple registers”. Als er veel single writes gebeuren kan batching performance en betrouwbaarheid verbeteren.

### Aanbevelingen (performance)
- Introduceer **rate limiting** per device/gateway (tokens per seconde).
- Gebruik **batch reads/writes** waar protocol het toelaat.
- Verlaag logging in hot paths naar debug-level en maak debug opt-in.
- Maak onderscheid tussen:
    - “control path” (user action) → lage latency,
    - “sync path” (periodieke sync) → mag trager maar moet stabiel zijn.
- Overweeg een **queue per device** (FIFO) zodat je concurrency gecontroleerd houdt zonder overal losse timeouts/delays.

---

## 3) Security

### Observaties
Dit soort integraties draaien vaak in een “trusted LAN”, maar hebben een groot attack surface:
- open TCP sockets naar apparaten/gateways,
- Modbus (meestal **geen encryptie/auth**),
- HTTP-calls naar services (in één implementatie plain HTTP).

### Risico’s
1. **Geen transport security / authenticatie op device-protocollen**
    - Modbus/TCP en raw TCP zijn doorgaans plaintext en zonder auth.
    - Dit betekent: iedereen op hetzelfde netwerk kan commando’s sniffen/spoofen.

2. **HTTP zonder TLS**
    - Als HTTP endpoints over het netwerk gaan: risico op MITM, request tampering.

3. **Input validation & trust boundaries**
    - Device IDs, register addresses, host/port, temperature en fanspeed worden doorgegeven. Zonder strikte validatie kunnen fouten of misconfiguratie leiden tot:
        - writes naar verkeerde registers,
        - onverwacht gedrag van hardware,
        - crash/DoS door out-of-range values.

4. **Logging van gevoelige info**
    - Logs kunnen IP’s, device identifiers en payloads bevatten. Dit vergroot impact bij log-leak.

### Aanbevelingen (security)
- Netwerksegmentatie is hier cruciaal:
    - plaats domotics/apparaten in een **apart VLAN**,
    - firewall rules: alleen backend → devices (least privilege).
- Waar mogelijk:
    - gebruik **TLS** (https) voor HTTP-services,
    - zet services niet bloot buiten localhost/VLAN.
- Voeg **strikte inputvalidatie** toe op:
    - temperatuurbereik, fanspeedbereik,
    - deviceTerminalId format,
    - host/port allowlist.
- Beperk logging van payloads/IDs (masking) en zet logs achter passende toegang.
- Overweeg **app-level authorization**: alleen geauthenticeerde gebruikers/flows mogen setpoints aanpassen (afhankelijk van hoe de API endpoints zijn ontworpen).

---

## Samenvatting van bevindingen en aandachtspunten

### Kernbevindingen
- **Beschikbaarheid** is het meest kwetsbaar door agressieve polling, foutgevoelige socket-lifecycle en afhankelijkheid van trage/offline devices.
- **Performance** wordt vooral beperkt door seriele I/O, relatief hoge timeout-paden en veel losse netwerktransacties.
- **Security** steunt nu sterk op trusted-LAN aannames, terwijl gebruikte transportprotocollen beperkt zijn in native beveiliging.

### Belangrijkste aandachtspunten (prioriteit)
1. **Stabiliseer device-communicatiepad**
   - Uniforme timeout/retry/backoff-strategie, duidelijke reconnect-state en gegarandeerde resolve/reject + cleanup.
2. **Verlaag en beheers poll-load**
   - Polling-interval realistischer maken en adaptive polling toepassen bij foutcondities.
3. **Voorkom sync-feedback en write-ping-pong**
   - Korte write-hold/cooldown per device-zone en consistente state-cache-afhandeling.
4. **Beperk roundtrips en serial bottlenecks**
   - Batch reads/writes waar mogelijk en queue/rate-limit per device/gateway.
5. **Versterk security-baseline**
   - Segmentatie (VLAN/firewall), inputvalidatie op write-paden, logging-sanitization en TLS waar toepasbaar.

---

## Korte conclusie
- **Beschikbaarheid**: grootste risico’s liggen bij agressieve polling, fragiele socket-afhandeling en cascading failures wanneer één device offline is.
- **Performance**: wordt vooral begrensd door seriële I/O + timeouts en het hoge aantal roundtrips; batching en rate limiting zijn logische verbeteringen.
- **Security**: transport is grotendeels “insecure by design” (Modbus/RAW TCP). Compenseer met netwerksegmentatie, TLS waar kan, inputvalidatie en logging-hygiëne.
