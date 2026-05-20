# 1. Inleiding

## 1.1. Aanleiding
Binnen het huidige systeem is het belangrijk dat meerdere Polarbear-units binnen dezelfde ruimte met elkaar gesynchroniseerd blijven. Wanneer één unit wordt aangepast, moeten de andere units deze wijziging ook overnemen. Zo blijft de aansturing binnen dezelfde ruimte consistent.

In eerste instantie kan synchronisatie worden gebaseerd op het steeds vergelijken van actuele waarden. Daarbij worden de waarden van een unit periodiek uitgelezen en vergeleken met eerder bekende waarden. Deze aanpak kan nuttig zijn voor algemene statusinformatie, maar is minder geschikt om precies te bepalen welke wijziging bewust door een gebruiker is gedaan.

Daarom wordt in de huidige oplossing gebruikgemaakt van een combinatie van monitoring en flags. De units worden nog steeds periodiek uitgelezen, maar wijzigingen aan belangrijke instellingen zoals setpoint en fanMode worden herkend via flags. Een flag geeft aan dat er op een unit een wijziging klaarstaat die verwerkt moet worden. Vervolgens wordt de bijbehorende pending waarde opgehaald en doorgezet naar de andere units in dezelfde ruimte.

## 1.2. Doelstelling
Het doel van dit onderzoek is om inzichtelijk te maken hoe het monitoren en synchroniseren van Polarbear-units werkt op basis van flags. Daarbij wordt gekeken naar de rol van periodieke monitoring, het uitlezen van flags, het verwerken van pending waarden en het synchroniseren naar andere units.

De uitkomst van dit onderzoek is een onderbouwde uitleg van de gekozen synchronisatieaanpak en waarom deze beter aansluit bij het systeem dan alleen synchroniseren op basis van statusvergelijking.

# 2. Hoofdvraag

**Hoe zorgt een flaggestuurde monitoringsaanpak voor betrouwbare synchronisatie tussen meerdere Polarbear-units binnen dezelfde ruimte?**

# 3. Deelvragen

## 3.1. Hoe werkt het monitoren en synchroniseren van Polarbear-units?

### 3.1.1. Methoden
Voor deze deelvraag is gebruikgemaakt van een analyse van de huidige synchronisatielogica binnen het systeem. Hierbij is gekeken naar het periodiek uitlezen van units, het detecteren van flags en het doorzetten van wijzigingen naar andere units.

### 3.1.2. Resultaten
Binnen het systeem worden alle Polarbear-units in een ruimte periodiek gemonitord. Per panel en per unit wordt een snapshot opgehaald met actuele waarden, zoals setpoint, virtualTemperature, fanSpeed en fanMode. Deze snapshot wordt gebruikt om de actuele toestand van de unit beschikbaar te houden.

Naast deze snapshot wordt per unit ook gecontroleerd of er flags actief zijn. Deze flags geven aan of er een relevante wijziging heeft plaatsgevonden. In de huidige synchronisatielogica worden vooral flags gebruikt voor setpoint en fanMode.

Wanneer een setpoint-flag actief is, wordt de pending setpoint-waarde opgehaald. Deze waarde wordt tijdelijk opgeslagen als candidate. Na een korte debounce-periode wordt deze wijziging verwerkt en doorgeschreven naar de andere units in dezelfde ruimte.

Wanneer een fanMode-flag actief is, wordt de pending fanMode opgehaald. Daarnaast wordt ook de huidige fanSpeed opgehaald, omdat fanMode en fanSpeed samen nodig zijn om de ventilatiestand goed te synchroniseren. Daarna wordt ook deze wijziging als candidate verwerkt en doorgeschreven naar de andere units.

Het proces verloopt in grote lijnen als volgt:

- alle panels en units in een ruimte worden periodiek uitgelezen;
- per unit wordt een snapshot opgehaald;
- per zone wordt gecontroleerd of er flags actief zijn;
- bij een setpoint-flag wordt de pending setpoint opgehaald;
- bij een fanMode-flag worden de pending fanMode en fanSpeed opgehaald;
- de wijziging wordt tijdelijk als candidate opgeslagen;
- na een debounce-periode wordt de wijziging naar de andere units geschreven;
- de flag wordt na verwerking geleegd, zodat dezelfde wijziging niet opnieuw wordt verwerkt.

Deze werkwijze zorgt ervoor dat het systeem gericht kan reageren op wijzigingen die door een unit worden aangegeven.

## 3.2. Waarom wordt er gewerkt met flags in plaats van alleen statusvergelijking?

### 3.2.1. Methoden
Voor deze deelvraag is gekeken naar het verschil tussen synchronisatie op basis van statusvergelijking en synchronisatie op basis van flags.

### 3.2.2. Resultaten
Bij synchronisatie op basis van alleen statusvergelijking kijkt het systeem steeds naar de actuele waarden van een unit en vergelijkt deze met eerder opgeslagen waarden. Wanneer een waarde anders is, kan het systeem concluderen dat er iets is veranderd.

Deze aanpak heeft als voordeel dat de actuele toestand altijd wordt uitgelezen. Toch is het niet altijd duidelijk of een verschil ook echt een nieuwe gebruikerswijziging is die gesynchroniseerd moet worden. Een verschil kan bijvoorbeeld ook ontstaan door een eerdere schrijfactie vanuit het systeem zelf, een vertraagde update of een tijdelijke afwijking.

Flags maken dit gerichter. Een flag geeft expliciet aan dat een bepaalde waarde is gewijzigd en verwerkt moet worden. Hierdoor hoeft het systeem niet alleen te gokken op basis van verschillen tussen snapshots, maar kan het reageren op een signaal vanuit de unit zelf.

Voor setpoint en fanMode is dit belangrijk, omdat dit instellingen zijn die actief naar andere units moeten worden gesynchroniseerd. Door flags te gebruiken, weet het systeem beter wanneer een wijziging bewust verwerkt moet worden.

De voordelen van flags zijn:

- het systeem hoeft niet iedere kleine statuswijziging als synchronisatie-event te behandelen;
- setpoint- en fanMode-wijzigingen worden gericht verwerkt;
- pending waarden kunnen worden opgehaald op het moment dat een flag actief is;
- dubbele verwerking wordt beperkt doordat flags na verwerking worden geleegd;
- debounce voorkomt dat meerdere snelle wijzigingen direct meerdere synchronisaties veroorzaken.

Statusvergelijking blijft wel nuttig voor het algemene monitoren van de actuele toestand. In de huidige aanpak wordt dit bijvoorbeeld gebruikt om snapshots bij te houden en wijzigingen in virtualTemperature te detecteren.

## 3.3. Welke rol spelen debounce, cache en het negeren van eigen writes?

### 3.3.1. Methoden
Voor deze deelvraag is gekeken naar de aanvullende mechanismen die worden gebruikt om foutieve of dubbele synchronisatie te voorkomen.

### 3.3.2. Resultaten
Naast flags gebruikt het systeem extra controlemechanismen om de synchronisatie betrouwbaar te houden.

Ten eerste wordt er gebruikgemaakt van een debounce-periode. Wanneer een flag wordt gedetecteerd, wordt de wijziging niet direct definitief verwerkt, maar eerst tijdelijk opgeslagen als candidate. Pas wanneer de debounce-periode voorbij is, wordt de wijziging doorgestuurd. Hierdoor worden snelle opeenvolgende wijzigingen beter opgevangen.

Ten tweede wordt er een cache bijgehouden voor pending setpoints. Hiermee kan het systeem bepalen of een pending setpoint daadwerkelijk veranderd is. Dit voorkomt dat oude of dubbele waarden onnodig opnieuw worden verwerkt.

Ten derde worden eigen schrijfacties tijdelijk onderdrukt. Wanneer het systeem zelf een waarde naar een panel schrijft, kan dat panel later opnieuw een wijziging of flag laten zien. Zonder bescherming zou het systeem zijn eigen wijziging kunnen interpreteren als een nieuwe handmatige wijziging. Door eigen writes tijdelijk te onthouden, kan het systeem deze herkennen en negeren.

Deze extra mechanismen zorgen ervoor dat synchronisatie niet alleen werkt, maar ook stabiel blijft.

## 3.4. Welke voordelen biedt deze aanpak voor de betrouwbaarheid van het systeem?

### 3.4.1. Methoden
Voor deze deelvraag is gekeken naar de invloed van flags, monitoring en aanvullende controlemechanismen op de betrouwbaarheid van het systeem.

### 3.4.2. Resultaten
De huidige aanpak biedt meerdere voordelen voor de betrouwbaarheid van het systeem.

Ten eerste zorgt het gebruik van flags ervoor dat belangrijke wijzigingen aan setpoint en fanMode gericht worden verwerkt. Het systeem hoeft niet alleen te vertrouwen op verschillen tussen actuele snapshots, maar kan reageren op een expliciet wijzigingssignaal.

Ten tweede blijven de units in dezelfde ruimte beter met elkaar gesynchroniseerd. Wanneer één unit een wijziging aangeeft via een flag, wordt deze wijziging verwerkt en doorgeschreven naar de andere gekoppelde units.

Ten derde voorkomt het systeem dubbele of foutieve synchronisatie door gebruik te maken van debounce, candidates, caching en het tijdelijk negeren van eigen writes.

Ten vierde blijft monitoring van actuele waarden nog steeds belangrijk. De snapshots zorgen ervoor dat de actuele toestand bekend blijft en dat bepaalde waarden, zoals virtualTemperature, alsnog via statusvergelijking kunnen worden opgepakt.

Hierdoor ontstaat een hybride aanpak:

- flags worden gebruikt voor gerichte detectie van setpoint en fanMode;
- snapshots worden gebruikt voor actuele status en virtualTemperature;
- debounce voorkomt te snelle dubbele verwerking;
- caching helpt bij het herkennen van echte wijzigingen;
- suppressie van eigen writes voorkomt sync-loops.

# 4. Conclusie

Op basis van dit onderzoek kan worden geconcludeerd dat de huidige synchronisatieaanpak niet puur gebaseerd is op statusvergelijking, maar op een combinatie van monitoring en flags.

Voor belangrijke instellingen zoals setpoint en fanMode gebruikt het systeem flags om te bepalen of een wijziging verwerkt moet worden. Wanneer een flag actief is, wordt de bijbehorende pending waarde opgehaald en als candidate opgeslagen. Na een debounce-periode wordt deze wijziging doorgeschreven naar de andere units in dezelfde ruimte.

De actuele snapshot van de unit blijft daarnaast belangrijk. Deze snapshot wordt gebruikt om de huidige toestand van het systeem bij te houden en om wijzigingen zoals virtualTemperature te detecteren.

De gekozen aanpak is daardoor betrouwbaar omdat het systeem niet alleen kijkt naar ruwe verschillen in actuele waarden, maar gebruikmaakt van expliciete wijzigingssignalen via flags. Tegelijkertijd zorgen debounce, caching en het negeren van eigen writes ervoor dat dubbele updates en synchronisatielussen worden voorkomen.

De synchronisatie van Polarbear-units werkt daarom het beste als een hybride oplossing: flags voor gerichte wijzigingsdetectie en monitoring voor actuele statusinformatie.

# 5. Bronnen

- Beschrijving van de huidige synchronisatielogica binnen het systeem
- Analyse van de PolarbearMonitor
- Analyse van de PolarbearService
- Interne analyse van flags, pending waarden, snapshots, caching en synchronisatie