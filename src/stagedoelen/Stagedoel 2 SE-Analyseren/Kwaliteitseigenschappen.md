# Kwaliteitseigenschappen

De onderstaande kwaliteitseigenschappen zijn gebaseerd op ISO/IEC 25010. De namen van de quality attributes zijn in het Engels gezet, omdat ISO 25010 deze termen ook zo gebruikt. Availability valt binnen ISO 25010 onder Reliability.

| ISO/IEC 25010 quality attribute | Waarom relevant voor dit project?                                                                     | Hoe toegepast?                                                                                     |
|---------------------------------|-------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Reliability                     | Klimaatinstellingen moeten correct worden doorgestuurd naar gekoppelde airco-units.                   | Timeouts, retry-logica, foutafhandeling en logging in de synchronisatieservice.                    |
| Availability                    | Het systeem moet blijven werken wanneer een airco-unit, gateway of netwerkverbinding tijdelijk faalt. | Reconnect-logica, laatst bekende status bewaren en failures gecontroleerd afhandelen.              |
| Security                        | Alleen bevoegde gebruikers en services mogen instellingen aanpassen.                                  | Authenticatie, autorisatie, inputvalidatie en netwerksegmentatie.                                  |
| Confidentiality                 | Devicegegevens, locaties en netwerkadressen kunnen gevoelig zijn.                                     | Alleen noodzakelijke gegevens opslaan en gevoelige gegevens beperken in logs.                      |
| Maintainability                 | Nieuwe airco-typen of communicatieprotocollen moeten later makkelijk toegevoegd kunnen worden.        | Adapterstructuur gebruiken via `IAircoAdapter`, `AdapterRegistry` en losse adapterimplementaties.  |
| Performance Efficiency          | Synchronisatie mag het systeem en de fysieke apparaten niet onnodig belasten.                         | Polling beperken, writes voorkomen als waarden al gelijk zijn en waar mogelijk batching gebruiken. |
