# Onderzoek: Monitoren en Synchroniseren van Polarbear Units

## Hoe werkt het monitoren en synchroniseren?

Het systeem monitort continu alle units in een ruimte door periodiek de actuele waarden (setpoints) van elke unit op te halen. Bij elke tick worden deze waarden vergeleken met de vorige waarden die in een cache zijn opgeslagen. Als er een verschil wordt gedetecteerd (bijvoorbeeld door een fysieke wijziging op een unit), wordt deze wijziging automatisch doorgevoerd naar de andere units in dezelfde ruimte, zodat ze gesynchroniseerd blijven.

### Stappen:
1. Alle units worden periodiek uitgelezen.
2. De actuele waarde wordt vergeleken met de vorige waarde.
3. Bij een verandering wordt de nieuwe waarde naar de andere units geschreven.
4. Er wordt rekening gehouden met cooldowns om herhaalde mislukte schrijfacties te voorkomen.

## Waarom is dit beter dan werken met flags?

- **Flags** zijn interne indicatoren die aangeven dat er iets veranderd is. Dit werkt alleen als alle wijzigingen via de software verlopen. Als een unit fysiek wordt aangepast (bijvoorbeeld via een knop), wordt de flag niet automatisch gezet en mist het systeem de wijziging.
- **Monitoren en vergelijken** zorgt ervoor dat elke wijziging, ongeacht de bron (software of fysiek), wordt opgemerkt en gesynchroniseerd. Dit maakt het systeem robuuster en betrouwbaarder.
- Het voorkomt race-condities en verouderde data, omdat altijd de actuele status van de unit wordt gebruikt.
- Het systeem is bestand tegen externe wijzigingen en resets van apparaten.

## Samenvatting

Door te monitoren en te synchroniseren op basis van de echte status van de units, is het systeem accurater en betrouwbaarder dan een aanpak met flags. Dit is vooral belangrijk in omgevingen waar apparaten ook buiten de software om aangepast kunnen worden.


## Conclusie 

Het monitoren en synchroniseren van Polarbear Units biedt een robuuste oplossing voor het beheren van meerdere units in een ruimte.
Het zorgt ervoor dat alle units altijd up-to-date zijn, ongeacht hoe de wijzigingen worden aangebracht, en voorkomt problemen die kunnen 
ontstaan bij het gebruik van flags. Deze aanpak maakt het systeem flexibeler en beter bestand tegen onverwachte wijzigingen.