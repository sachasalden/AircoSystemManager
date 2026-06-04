# Risicoanalyse

| Risico | Kans | Impact | Prioriteit | Maatregel |
| --- | --- | --- | --- | --- |
| Wijziging wordt niet naar de gekoppelde airco-unit of wallpanel verstuurd | Middel | Hoog | Hoog | Synchronisatieregels vastleggen, logging toepassen, relevante tests uitvoeren en status na write opnieuw controleren. |
| Airco-unit, wallpanel of gateway is tijdelijk niet bereikbaar | Hoog | Hoog | Kritiek | Timeouts, reconnect-logica, behoud van laatst bekende status en duidelijke foutmelding/logging gebruiken. |
| Synchronisatie veroorzaakt een feedback-loop of write-ping-pong | Middel | Hoog | Hoog | Echo-detectie, bron/timestamp-controle en duplicate detection toepassen. |
| Ongeldige temperatuur-, fan speed-, fan mode- of control-zonewaarde wordt verwerkt | Middel | Middel | Gemiddeld | Inputvalidatie toepassen op dashboardcommando's, API-requests en serviceaanroepen. |
| Onjuiste topology koppelt een wallpanel aan de verkeerde airco | Middel | Hoog | Hoog | Topology-validatie toepassen, incomplete koppelingen overslaan en device tree controleerbaar maken in de frontend. |
| Onbekend of verkeerd adaptertype stuurt een airco verkeerd aan | Middel | Hoog | Hoog | Alleen geregistreerde adaptertypes toestaan via `AdapterRegistry` en onbekende types weigeren/loggen. |
| MQTT-broker of netwerkverbinding faalt | Middel | Hoog | Hoog | Lokale synchronisatie waar mogelijk laten doorgaan, reconnect-logica gebruiken en berichten gecontroleerd opnieuw verwerken. |
| Verouderde of dubbele MQTT-/pollberichten overschrijven actuele status | Middel | Hoog | Hoog | Timestamps, broninformatie en last-value-wins-regels gebruiken; identieke waarden niet opnieuw schrijven. |
| MongoDB is tijdelijk niet beschikbaar of bevat incomplete configuratie | Middel | Hoog | Hoog | Databasefouten gecontroleerd afhandelen, corrupte/incomplete configuratie niet gebruiken en laatst bekende runtime-status behouden. |
| Dashboard toont verouderde of inconsistente inzichten | Middel | Middel | Gemiddeld | Insight stores bijwerken vanuit monitors, update-tijd tonen en SSE/REST-responses consistent houden. |
| API accepteert incomplete of ongeldige beheerdata | Middel | Middel | Gemiddeld | Velden valideren, verplichte relaties controleren en foutmeldingen teruggeven aan frontend/API-client. |
| Logs bevatten te veel gevoelige device- of netwerkinformatie | Laag | Middel | Gemiddeld | Alleen noodzakelijke foutcontext loggen en gevoelige details beperken. |
| Polling of writes belasten apparaten of netwerk onnodig | Middel | Middel | Gemiddeld | Pollingfrequentie beperken, writes overslaan wanneer waarden gelijk zijn en overbodige commando's negeren. |
| Nieuwe adapter of feature breekt bestaande synchronisatie | Middel | Hoog | Hoog | Adapterinterface aanhouden, unit tests uitbreiden en regressietests uitvoeren voor topology, sync, MQTT en echo guard. |
