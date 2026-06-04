# Traceability matrix

| Risico | Kwaliteitseigenschap | Acceptatiecriterium |
| --- | --- | --- |
| Wijziging wordt niet naar de gekoppelde airco-unit of wallpanel verstuurd | Reliability / Integrity | AC-4: Geldige wallpanel-wijziging wordt naar de airco gesynchroniseerd; AC-5: Geldige airco-wijziging wordt naar het wallpanel gesynchroniseerd |
| Airco-unit, wallpanel of gateway is tijdelijk niet bereikbaar | Availability / Reliability | AC-13: Wallpanel is tijdelijk niet bereikbaar; AC-14: Airco-unit is tijdelijk niet bereikbaar; AC-21: Herstel na storing brengt statussen weer gelijk |
| Synchronisatie veroorzaakt een feedback-loop of write-ping-pong | Reliability / Performance Efficiency / Integrity | AC-9: Feedback-loop wordt voorkomen; AC-10: Dubbele of verouderde berichten worden genegeerd; AC-11: MQTT-syncbus synchroniseert backend-instances |
| Ongeldige temperatuur-, fan speed-, fan mode- of control-zonewaarde wordt verwerkt | Security / Reliability | AC-6: Ongeldige klimaatwaarde wordt afgekeurd; AC-18: Dashboardcommando wordt gevalideerd en uitgevoerd |
| Onjuiste topology koppelt een wallpanel aan de verkeerde airco | Functional Suitability / Integrity | AC-1: Configuratie van zones, ruimtes en apparaten wordt opgeslagen; AC-2: Ongeldige configuratie wordt afgekeurd; AC-3: Topology wordt gebruikt voor synchronisatie |
| Onbekend of verkeerd adaptertype stuurt een airco verkeerd aan | Maintainability / Compatibility / Security | AC-7: Adaptertype bepaalt hoe een airco wordt aangestuurd; AC-8: Onbekend adaptertype wordt niet gebruikt; AC-22: Nieuwe airco-adapter kan worden toegevoegd zonder sync-core aan te passen |
| MQTT-broker of netwerkverbinding faalt | Availability / Compatibility | AC-11: MQTT-syncbus synchroniseert backend-instances; AC-12: Uitval van MQTT maakt lokale werking niet onmogelijk; AC-21: Herstel na storing brengt statussen weer gelijk |
| Verouderde of dubbele MQTT-/pollberichten overschrijven actuele status | Integrity / Performance Efficiency | AC-9: Feedback-loop wordt voorkomen; AC-10: Dubbele of verouderde berichten worden genegeerd |
| MongoDB is tijdelijk niet beschikbaar of bevat incomplete configuratie | Availability / Integrity | AC-1: Configuratie van zones, ruimtes en apparaten wordt opgeslagen; AC-15: Database-uitval wordt gecontroleerd afgehandeld |
| Dashboard toont verouderde of inconsistente inzichten | Usability / Functional Suitability | AC-16: Dashboard toont actuele wallpanel insights; AC-17: Dashboard toont actuele airco insights; AC-19: API geeft consistente data terug aan de frontend |
| API accepteert incomplete of ongeldige beheerdata | Security / Functional Suitability | AC-2: Ongeldige configuratie wordt afgekeurd; AC-6: Ongeldige klimaatwaarde wordt afgekeurd; AC-19: API geeft consistente data terug aan de frontend |
| Logs bevatten te veel gevoelige device- of netwerkinformatie | Confidentiality / Security | AC-20: Logging ondersteunt foutanalyse en beheer |
| Polling of writes belasten apparaten of netwerk onnodig | Performance Efficiency / Reliability | AC-9: Feedback-loop wordt voorkomen; AC-10: Dubbele of verouderde berichten worden genegeerd |
| Nieuwe adapter of feature breekt bestaande synchronisatie | Maintainability / Testability | AC-22: Nieuwe airco-adapter kan worden toegevoegd zonder sync-core aan te passen; AC-23: Geautomatiseerde tests dekken kernfunctionaliteit |
