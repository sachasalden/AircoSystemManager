# 1. Inleiding

## 1.1. Aanleiding
Binnen het huidige systeem is het belangrijk dat meerdere Polarbear-units binnen dezelfde ruimte met elkaar gesynchroniseerd blijven. Wanneer één unit wordt aangepast, moeten de andere units deze wijziging ook overnemen om consistente aansturing en temperatuurregeling te behouden.

Eerder kan daarbij gedacht worden aan het gebruik van flags om wijzigingen te detecteren. In de praktijk blijkt deze aanpak echter beperkt te zijn, omdat flags alleen goed werken wanneer wijzigingen via de software verlopen. Wanneer een unit fysiek wordt aangepast, bijvoorbeeld via een knop op het apparaat zelf, wordt deze wijziging niet altijd correct gedetecteerd.

Daarom is het relevant om te onderzoeken hoe monitoren en synchroniseren op basis van de actuele status van units werkt, en waarom deze aanpak betrouwbaarder is dan een oplossing op basis van flags.

## 1.2. Doelstelling
Het doel van dit onderzoek is om inzichtelijk te maken hoe het monitoren en synchroniseren van Polarbear-units werkt en waarom deze aanpak beter aansluit bij de praktijk dan het gebruik van flags. Daarbij wordt gekeken naar de werking van het monitoringsproces, de voordelen van vergelijking op basis van actuele status en de meerwaarde hiervan voor de betrouwbaarheid van het systeem.

De uitkomst van dit onderzoek is een onderbouwde uitleg van de gekozen synchronisatieaanpak en de redenen waarom deze methode robuuster en nauwkeuriger is binnen een omgeving waarin units ook fysiek aangepast kunnen worden.

# 2. Hoofdvraag

**Waarom is het monitoren en synchroniseren van Polarbear-units op basis van de actuele status betrouwbaarder dan een aanpak met flags?**

# 3. Deelvragen

## 3.1. Hoe werkt het monitoren en synchroniseren van Polarbear-units?

### 3.1.1. Methoden
Voor deze deelvraag is gebruikgemaakt van een analyse van de huidige synchronisatielogica binnen het systeem en een beschrijving van de werking van het monitoringsproces.

### 3.1.2. Resultaten
Binnen het systeem worden alle units in een ruimte continu gemonitord door periodiek de actuele waarden, zoals setpoints, op te halen. Deze actuele waarden worden bij elke controle vergeleken met eerder opgeslagen waarden in een cache.

Wanneer er een verschil wordt vastgesteld, bijvoorbeeld doordat een gebruiker een unit fysiek heeft aangepast, wordt deze wijziging automatisch doorgezet naar de andere units in dezelfde ruimte. Hierdoor blijven de units onderling gesynchroniseerd.

Het proces verloopt in grote lijnen als volgt:
- alle units worden periodiek uitgelezen;
- de actuele waarde van iedere unit wordt vergeleken met de vorige bekende waarde;
- wanneer een wijziging wordt gedetecteerd, wordt deze nieuwe waarde naar de andere units geschreven;
- cooldowns voorkomen dat mislukte schrijfacties direct steeds opnieuw worden uitgevoerd.

Deze werkwijze maakt het mogelijk om wijzigingen snel te signaleren en consistent door te voeren naar alle gekoppelde units.

## 3.2. Waarom is monitoren en vergelijken beter dan werken met flags?

### 3.2.1. Methoden
Voor deze deelvraag is gebruikgemaakt van een inhoudelijke vergelijking tussen een synchronisatieaanpak op basis van flags en een aanpak op basis van monitoring en statusvergelijking.

### 3.2.2. Resultaten
Een aanpak met flags werkt vooral goed wanneer alle wijzigingen via de software plaatsvinden. Flags zijn interne indicatoren die aangeven dat er iets veranderd is. Wanneer een wijziging buiten de software om plaatsvindt, bijvoorbeeld via fysieke bediening op een unit, wordt zo’n flag niet automatisch gezet.

Daardoor bestaat het risico dat:
- wijzigingen niet worden opgemerkt;
- units onderling niet meer gelijk lopen;
- verouderde data in het systeem aanwezig blijft.

Monitoren en vergelijken op basis van de daadwerkelijke status van de units biedt hierin duidelijke voordelen. Doordat steeds de actuele waarden worden uitgelezen en vergeleken, kan iedere wijziging worden opgemerkt, ongeacht de bron van die wijziging.

Deze aanpak is daarom betrouwbaarder, omdat:
- zowel softwarematige als fysieke wijzigingen worden meegenomen;
- het systeem werkt op basis van de echte actuele status;
- de kans op verouderde informatie kleiner wordt;
- synchronisatie ook blijft werken wanneer apparaten tussentijds extern worden aangepast.

## 3.3. Welke voordelen biedt deze aanpak voor de betrouwbaarheid van het systeem?

### 3.3.1. Methoden
Voor deze deelvraag is gebruikgemaakt van een analyse van de gevolgen van beide aanpakken voor de consistentie en stabiliteit van het systeem.

### 3.3.2. Resultaten
Het monitoren en synchroniseren van Polarbear-units op basis van actuele status biedt meerdere voordelen voor de betrouwbaarheid van het systeem.

Ten eerste zorgt deze aanpak ervoor dat alle units in een ruimte met dezelfde actuele waarden blijven werken. Daardoor wordt de kans kleiner dat verschillende units verschillende toestanden aanhouden.

Ten tweede is deze methode beter bestand tegen externe wijzigingen. Omdat niet wordt vertrouwd op een interne vlag, maar op de echte status van het apparaat, blijft het systeem correct functioneren wanneer een gebruiker lokaal iets aanpast.

Ten derde helpt deze aanpak om inconsistent gedrag te voorkomen. Wanneer steeds de werkelijke toestand als uitgangspunt wordt genomen, is de kans kleiner op verouderde data, gemiste wijzigingen en onjuiste synchronisatie.

Hierdoor is het systeem:
- nauwkeuriger;
- robuuster;
- beter bestand tegen onverwachte wijzigingen;
- betrouwbaarder in omgevingen waarin apparaten ook fysiek worden bediend.

# 4. Conclusie

Op basis van dit onderzoek kan worden geconcludeerd dat het monitoren en synchroniseren van Polarbear-units op basis van de actuele status een betrouwbaardere aanpak is dan het werken met flags. Waar flags afhankelijk zijn van softwarematige wijzigingen, kijkt deze methode naar de daadwerkelijke toestand van de units zelf.

Daardoor kunnen zowel interne als externe wijzigingen worden gedetecteerd en correct worden doorgezet naar andere units in dezelfde ruimte. Dit verkleint de kans op gemiste updates, verouderde data en inconsistent gedrag tussen apparaten.

Het monitoren en synchroniseren van units biedt daarmee een robuuste oplossing voor het beheren van meerdere Polarbear-units binnen één ruimte. Deze aanpak maakt het systeem flexibeler, nauwkeuriger en beter bestand tegen onverwachte of fysieke wijzigingen.

# 5. Bronnen

- Beschrijving van de huidige synchronisatielogica binnen het systeem
- Interne analyse van monitoring, caching en synchronisatie van Polarbear-units