# Traceability matrix

| Risico | Kwaliteitseigenschap | Acceptatiecriterium |
| --- | --- | --- |
| Wijziging wordt niet naar de airco-unit verstuurd | Reliability | AC-1: Geldige instelling wordt gesynchroniseerd |
| Airco-unit of gateway is tijdelijk niet bereikbaar | Availability / Reliability | AC-3: Airco-unit is tijdelijk niet bereikbaar |
| Synchronisatie veroorzaakt een feedback-loop of write-ping-pong | Reliability / Performance Efficiency | AC-4: Feedback-loop wordt voorkomen |
| Ongeldige temperatuur- of ventilatiewaarde wordt ingevoerd | Security / Reliability | AC-2: Ongeldige instelling wordt afgekeurd |
| Onbevoegde gebruiker wijzigt klimaatinstellingen | Security / Confidentiality | AC-2: Ongeldige instelling wordt afgekeurd |
| Externe communicatie zoals MQTT, Modbus of TCP faalt | Availability / Maintainability | AC-3: Airco-unit is tijdelijk niet bereikbaar |
