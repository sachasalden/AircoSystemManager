# Airco onderzoek

## Inleiding
Het doel van dit onderzoek is om het bestaande systeem van het syncen van de polarbear units en de airco units te verbeteren.
Op dit moment worden de de polarbears en de airo units gesychcroniseerd door middel van de database.
Als er een waarde veranderd wordt veranderd op de polarbear unit, wordt deze waarde opgeslagen in de database en vervolgens vergeleken met de waarde van de airco unit.
Als er een verschil is, wordt de waarde van de airco unit aangepast naar de waarde van de polarbear unit.
Dit werkt ook visa versa. Dit is hoe huidig werkt en dit werkt prima, maar er zijn een aantal problemen met deze aanpak.
In dit onderzoek zal ik kijken naar een andere aanpak waarbij er direct gesynchroniseerd wordt tussen de units zonder dat er een database update nodig is.


## Probleemstelling
Het huidige systeem van het syncen van de polarbear units en de airco units werkt prima, maar er zijn een aantal problemen met deze aanpak.
zoals dat er een vertraging tussen het veranderen van de waarde en het aanpassen van de andere unit, omdat er eerst een database update moet plaatsvinden.
Daarnaast is het systeem afhankelijk van de database, wat betekent dat als er een probleem is met de database, het syncen van de units ook niet werkt.

## Doelstelling
Het doel van dit onderzoek is om een nieuwe aanpak te ontwikkelen voor het syncen van de polarbear units en de airco units, waarbij er direct gesynchroniseerd wordt tussen de units zonder dat er een database update nodig is.
Deze nieuwe aanpak moet sneller zijn dan het huidige systeem en minder afhankelijk van de database. Daarnaast moet het systeem robuuster zijn en beter bestand tegen fouten. 

## Onderzoeksvragen
1. Hoe kan er direct gesynchroniseerd worden tussen de polarbear units en de airco units zonder dat er een database update nodig is?
2. Wat zijn de voordelen van deze nieuwe aanpak ten opzichte van het huidige systeem?
3. Wat zijn de mogelijke nadelen van deze nieuwe aanpak en hoe kunnen deze worden opgelost?
4. Hoe kan deze nieuwe aanpak worden geïmplementeerd in het bestaande systeem?

## Onderzoeksmethode
Om deze onderzoeksvragen te beantwoorden, zal ik een literatuuronderzoek uitvoeren naar bestaande methoden voor het synchroniseren van apparaten zonder afhankelijkheid van een database. Daarnaast zal ik een prototype ontwikkelen van de nieuwe aanpak en deze testen in een gecontroleerde omgeving om de prestaties en betrouwbaarheid te evalueren.


## Hoe kan er direct gesynchroniseerd worden tussen de polarbear units en de airco units zonder dat er een database update nodig is?
Er zijn verschillende manieren om direct te synchroniseren tussen de polarbear units en de airco units zonder dat er een database update nodig is. Een mogelijke aanpak is het gebruik van een publish-subscribe model, waarbij de units direct met elkaar communiceren via een netwerkprotocol zoals MQTT of WebSockets. In dit model kunnen de units zich abonneren op updates van elkaar en direct reageren op veranderingen zonder dat er een tussenstap nodig is via de database.
Ook kan er gebruik worden gemaakt van een store state management systeem zoals Redux of MobX, waarbij de units direct toegang hebben tot de actuele status van elkaar en kunnen reageren op veranderingen in real-time.
Dit zie ik als een veelbelovende aanpak omdat het de afhankelijkheid van de database vermindert en de synchronisatie tussen de units versnelt.

## Wat zijn de voordelen van deze nieuwe aanpak ten opzichte van het huidige systeem?
De voordelen van deze nieuwe aanpak zijn onder andere:
1. Snellere synchronisatie: Doordat er direct gesynchroniseerd wordt tussen de units, is er geen vertraging meer door database updates, wat resulteert in een snellere reactietijd.
2. Minder afhankelijkheid van de database: Het systeem is minder kwetsbaar voor problemen met de database, omdat de units direct met elkaar communiceren.
3. Real-time updates: De units kunnen direct reageren op veranderingen, wat zorgt voor een meer responsive gebruikerservaring.
4. Verbeterde fouttolerantie: Doordat de units direct communiceren, kunnen ze beter omgaan met fouten en kunnen ze sneller herstellen van eventuele problemen.
5. Minder complexiteit: Het systeem is eenvoudiger omdat er geen tussenstap meer is via de database, wat de implementatie en het onderhoud vereenvoudigt.

## Wat zijn de mogelijke nadelen van deze nieuwe aanpak en hoe kunnen deze worden opgelost?
De mogelijke nadelen van deze nieuwe aanpak zijn onder andere:
1. Complexiteit van communicatie: Het direct synchroniseren tussen de units kan complex zijn, vooral als er veel units zijn die met elkaar moeten communiceren. Dit kan worden opgelost door het gebruik van een gestandaardiseerd communicatieprotocol en het implementeren van een goed ontworpen architectuur voor de communicatie tussen de units.
2. Beveiliging: Directe communicatie tussen de units kan beveiligingsrisico's met zich meebrengen, zoals ongeautoriseerde toegang of gegevensmanipulatie. Dit kan worden opgelost door het implementeren van beveiligingsmaatregelen zoals authenticatie, encryptie en toegangscontrole.
3. Foutafhandeling: Als er een fout optreedt in de communicatie tussen de units, kan dit leiden tot inconsistenties in de status van de units. Dit kan worden opgelost door het implementeren van een robuust foutafhandelingsmechanisme dat ervoor zorgt dat de units kunnen herstellnen van fouten en dat de status van de units consistent blijft.


## Hoe kan deze nieuwe aanpak worden geïmplementeerd in het bestaande systeem?
Om deze nieuwe aanpak te implementeren in het bestaande systeem, kunnen de volgende stappen worden genomen:
1. Ontwikkel een communicatieprotocol: Ontwerp een gestandaardiseerd communicatieprotocol dat de units kunnen gebruiken om direct met elkaar te communiceren. Dit kan bijvoorbeeld worden gedaan met behulp van state store management systemen zoals Redux of MobX, of door gebruik te maken van een publish-subscribe model met MQTT of WebSockets.
2. Implementeer de communicatie tussen de units : Pas de software van de polarbear units en de airco units aan zodat ze direct met elkaar kunnen communiceren volgens het ontworpen protocol.
3. Test de nieuwe aanpak: Voer uitgebreide tests uit om ervoor te zorgen dat de nieuwe aanpak correct werkt en dat de synchronisatie tussen de units snel en betrouwbaar is.

## Conclusie
In dit onderzoek is gekeken naar een nieuwe aanpak voor het synchroniseren van de polarbear units en de airco units, waarbij er direct gesynchroniseerd wordt tussen de units zonder dat er een database update nodig is. Deze nieuwe aanpak biedt verschillende voordelen, zoals snellere synchronisatie, minder afhankelijkheid van de database, real-time updates, verbeterde fouttolerantie en minder complexiteit. Er zijn ook mogelijke nadelen, zoals complexiteit van communicatie, beveiligingsrisico's en foutafhandeling, maar deze kunnen worden opgelost door het implementeren van een goed ontworpen communicatieprotocol en robuuste beveiligings- en foutafhandelingsmechanismen. De implementatie van deze nieuwe aanpak kan worden gedaan door het ontwikkelen van een communicatieprotocol, het aanpassen van de software van de units en het uitvoeren van uitgebreide tests. Al met al biedt deze nieuwe aanpak een veelbelovende oplossing voor het verbeteren van het synchroniseren van de polarbear units en de airco units, waardoor het systeem sneller, betrouwbaarder en minder afhankelijk van de database wordt.
