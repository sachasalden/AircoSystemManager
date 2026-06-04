# Kwaliteitseigenschappen

De onderstaande kwaliteitseigenschappen zijn gebaseerd op ISO/IEC 25010. De namen van de quality attributes zijn in het Engels gezet, omdat ISO/IEC 25010 deze termen ook zo gebruikt. Availability valt binnen ISO/IEC 25010 onder Reliability.

| ISO/IEC 25010 quality attribute | Waarom relevant voor dit systeem? | Hoe toegepast in dit project? |
| --- | --- | --- |
| Functional Suitability | Het systeem moet de volledige klimaatketen ondersteunen: configuratie, monitoring, bediening en synchronisatie. | CRUD voor zones, ruimtes, wallpanels, airco-devices en environment-devices; dashboard voor airco- en wallpanelinzichten; synchronisatie tussen gekoppelde apparaten. |
| Reliability | Klimaatinstellingen moeten correct en voorspelbaar worden doorgestuurd tussen wallpanel, airco, backend en dashboard. | Validatie, laatst bekende status, gecontroleerde foutafhandeling, retry/reconnect-logica en duidelijke synchronisatieregels. |
| Availability | Het systeem moet blijven functioneren wanneer een airco-unit, wallpanel, MQTT-broker, gateway of database tijdelijk faalt. | Timeouts, reconnect-logica, lokale verwerking waar mogelijk, behoud van laatst bekende status en logging van tijdelijke storingen. |
| Security | Alleen geldige en toegestane configuraties en commando's mogen worden verwerkt. | Inputvalidatie op API- en serviceniveau, afwijzen van onbekende adaptertypes, controle op device-id's en veilige verwerking van commando's. |
| Confidentiality | Devicegegevens, locaties, netwerkadressen en foutcontext kunnen gevoelig zijn. | Alleen noodzakelijke gegevens opslaan, gevoelige details beperken in logs en geen onnodige data naar frontendresponses sturen. |
| Integrity | De status van wallpanel, airco, database, MQTT en dashboard mag niet onbedoeld uit elkaar lopen. | Echo-preventie, timestamp/source-controle, duplicate detection, topology-validatie en reconciliatie na herstel. |
| Maintainability | Nieuwe airco-typen, routes, stores of monitorlogica moeten later beheersbaar toegevoegd kunnen worden. | Scheiding tussen controllers, services, repositories, monitors en adapters; `IAircoAdapter`, `AdapterRegistry` en losse adapterimplementaties. |
| Performance Efficiency | Synchronisatie en monitoring mogen fysieke apparaten, netwerk en backend niet onnodig belasten. | Polling beperken, overbodige writes voorkomen, identieke of verouderde berichten negeren en runtime-status cachen in insight stores. |
| Usability | Gebruikers en beheerders moeten snel kunnen zien wat de klimaatstatus is en gericht kunnen filteren of bedienen. | Frontend dashboards met kaarten, temperatuurweergave, filters op zone/ruimte/device en duidelijke status- en update-informatie. |
| Compatibility / Interoperability | Het systeem moet samenwerken met externe protocollen en verschillende apparaattypen. | Modbus voor Polarbear-wallpanels, MQTT voor syncberichten, MongoDB voor opslag en adapterpatroon voor airco-protocollen. |
| Testability | Wijzigingen moeten controleerbaar zijn om regressies in synchronisatie en configuratie te voorkomen. | Unit- en servicetests voor controllers, repositories/services, adapterregistratie, topology, MQTT-sync, echo guard en main loop. |
