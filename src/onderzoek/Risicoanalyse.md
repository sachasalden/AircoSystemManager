# Risicoanalyse

| Risico | Kans | Impact | Prioriteit | Maatregel |
| --- | --- | --- | --- | --- |
| Wijziging wordt niet naar de airco-unit verstuurd | Middel | Hoog | Hoog | Logging, foutafhandeling en retry-logica toepassen |
| Airco-unit of gateway is tijdelijk niet bereikbaar | Hoog | Hoog | Kritiek | Timeouts, reconnect-logica en behoud van laatst bekende status gebruiken |
| Synchronisatie veroorzaakt een feedback-loop of write-ping-pong | Middel | Hoog | Hoog | Echo-detectie en controle op bron/timestamp toepassen |
| Ongeldige temperatuur- of ventilatiewaarde wordt ingevoerd | Middel | Middel | Gemiddeld | Inputvalidatie toepassen voor setpoint, fanspeed en device-id |
| Onbevoegde gebruiker wijzigt klimaatinstellingen | Laag | Hoog | Hoog | Authenticatie, autorisatie en netwerksegmentatie toepassen |
| Externe communicatie zoals MQTT, Modbus of TCP faalt | Middel | Hoog | Hoog | Adapterstructuur, fallback-afhandeling en health logging gebruiken |
