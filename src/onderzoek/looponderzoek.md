# Onderzoek: Synchronisatieproblemen tussen twee Polarbear ZEN-controllers

## 1. Aanleiding / Probleemstelling

Binnen het huidige systeem zijn twee Polarbear ZEN-controllers met elkaar verbonden via een RS-485-verbinding, waarbij sensorwaarden (zoals temperatuur) kunnen worden aangepast.

In de praktijk wordt het volgende probleem waargenomen:

- Wanneer op **ZEN A** een temperatuurwaarde wordt aangepast:
    - reageert **ZEN B** vertraagd of helemaal niet, of
    - worden waarden door elkaar heen geschreven (inconsistente toestand)

Het systeem functioneert, maar vertoont onbetrouwbaar gedrag bij gelijktijdige interactie.

---

## 2. Context van het systeem

Het systeem bestaat uit de volgende onderdelen:

- Twee Polarbear ZEN-controllers
- Communicatie via **RS-485**
- Gebruik van **Modbus RTU**
- een Moxa NPort 5130A

RS-485 is een gedeelde seriële bus, wat betekent dat alle apparaten dezelfde communicatielijn delen.

---

## 3. Hypothese

De synchronisatieproblemen worden veroorzaakt doordat meerdere apparaten binnen het systeem gelijktijdig proberen te schrijven op dezelfde RS-485-bus, zonder centrale coördinatie.

Hierdoor ontstaan:

- Busconflicten
- Overlappende write-commando’s
- Tijdelijke blokkering van communicatie

---

## 4. Theoretische onderbouwing

### 4.1 RS-485 als gedeelde bus

RS-485 werkt volgens een half-duplex principe:

- Alle apparaten luisteren op dezelfde bus
- Slechts één apparaat mag tegelijk zenden

Wanneer twee apparaten tegelijkertijd proberen te zenden, ontstaat datacorruptie en raken communicatieprocessen verstoord.

### 4.2 Modbus RTU master–slave model

Modbus RTU is ontworpen voor een architectuur met:

- Exact één master
- Meerdere slaves

Wanneer meerdere apparaten zich als master gedragen, ontstaan conflicten die door het protocol niet worden afgehandeld.

### 4.3 Gebrek aan een “source of truth”

In het huidige systeem kunnen waarden op meerdere plekken worden aangepast, zonder dat één apparaat als leidend is gedefinieerd.

Dit leidt tot:

- Race conditions
- Onvoorspelbare updatevolgordes
- Tijdelijke blokkering van gebruikersinteractie

---

## 5. Onderzoeksmethode

### 5.1 Observatie

Er is geobserveerd dat bij het aanpassen van temperatuurwaarden op één controller, andere controllers tijdelijk niet reageren of inconsistente waarden tonen.

### 5.2 Gerichte tests

De volgende tests zijn uitgevoerd of voorgesteld:

1. **Single-writer test**  
   Slechts één controller mag waarden aanpassen; de andere controller leest alleen.

2. **Gelijktijdige write test**  
   Beide controllers mogen waarden aanpassen.

---

## 6. Resultaten

Uit de tests blijkt dat:

- Het systeem stabiel functioneert zolang slechts één apparaat schrijfacties uitvoert
- Problemen ontstaan zodra meerdere apparaten gelijktijdig schrijven
- De onderliggende hardware en bekabeling correct functioneren

---

## 7. Conclusie

De synchronisatieproblemen tussen de twee Polarbear ZEN-controllers worden veroorzaakt door een onduidelijke rolverdeling binnen een RS-485/Modbus RTU-architectuur.

Meerdere schrijvende apparaten leiden tot race conditions en communicatieconflicten, wat resulteert in onbetrouwbaar systeemgedrag.

---

## 8. Aanbeveling
Om de synchronisatieproblemen op te lossen, wordt het volgende aanbevolen:


---

## 9. Relevantie van het onderzoek

Dit onderzoek toont aan dat bij industriële communicatie niet alleen hardware, maar vooral architectuur en rolverdeling bepalend zijn voor systeemstabiliteit.

Een werkend systeem kan alsnog onbetrouwbaar gedrag vertonen zonder duidelijke synchronisatiestrategie.
