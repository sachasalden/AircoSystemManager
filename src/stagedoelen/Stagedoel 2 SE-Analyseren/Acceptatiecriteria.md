# Acceptatiecriteria

## User story

Als gebruiker of beheerder van het klimaatsysteem wil ik airco-units, Polarbear-wallpanels, zones, ruimtes en omgevingsapparaten centraal kunnen beheren, monitoren en synchroniseren, zodat de actuele klimaatstatus betrouwbaar zichtbaar is en wijzigingen consistent worden doorgevoerd in het volledige systeem.

## Scope van het systeem

Deze acceptatiecriteria hebben betrekking op het volledige aircotest-systeem:

- Frontend dashboard voor beheer, filtering, bediening en inzichten.
- Backend API voor zones, ruimtes, wallpanels, airco-devices, environment-devices en adaptertypes.
- MongoDB-opslag voor configuratie, topology en laatst bekende gegevens.
- Synchronisatielus tussen Polarbear-wallpanels en airco-units.
- MQTT-syncbus voor berichten tussen backend-instances.
- Modbus-communicatie met Polarbear-wallpanels.
- Airco-adapters voor verschillende airco-protocollen.
- Insight stores en SSE/REST-endpoints voor actuele dashboarddata.

## Acceptatiecriteria in Gherkin

### AC-1: Configuratie van zones, ruimtes en apparaten wordt opgeslagen

```gherkin
Scenario: Beheerder maakt een klimaattopologie aan
  Given de backend API en database zijn beschikbaar
  When de beheerder een zone, ruimte, wallpanel, airco-device en environment-device aanmaakt of wijzigt
  Then worden de gegevens gevalideerd
  And worden de gegevens opgeslagen in MongoDB
  And kan de frontend de bijgewerkte device tree opnieuw ophalen
```

### AC-2: Ongeldige configuratie wordt afgekeurd

```gherkin
Scenario: Beheerder voert een ongeldige apparaatconfiguratie in
  Given de beheerder gebruikt het configuratiescherm of de API
  When een verplicht veld ontbreekt of een device-id, adaptertype of koppeling ongeldig is
  Then wordt de configuratie afgekeurd
  And wordt er geen ongeldige configuratie opgeslagen
  And krijgt de gebruiker of API-client een duidelijke foutmelding
```

### AC-3: Topology wordt gebruikt voor synchronisatie

```gherkin
Scenario: Synchronisatieservice bepaalt welke apparaten gekoppeld zijn
  Given er zijn zones, ruimtes, wallpanels, airco-devices en environment-devices opgeslagen
  When de synchronisatieservice de topology vernieuwt
  Then worden de juiste panel-airco-koppelingen opgebouwd
  And worden alleen gekoppelde apparaten meegenomen in synchronisatie
  And worden ontbrekende of incomplete koppelingen gelogd zonder dat de service crasht
```

### AC-4: Geldige wallpanel-wijziging wordt naar de airco gesynchroniseerd

```gherkin
Scenario: Temperatuurinstelling op een wallpanel wordt doorgezet naar de airco
  Given een Polarbear-wallpanel is gekoppeld aan een airco-unit
  And de synchronisatieservice is actief
  And de gebruiker stelt een geldige temperatuurwaarde in op het wallpanel
  When de wijziging wordt verwerkt door het systeem
  Then wordt de nieuwe temperatuurwaarde naar de gekoppelde airco-adapter gestuurd
  And wordt de actuele aircostatus bijgewerkt in de insight store
  And wordt de wijziging gepubliceerd op de MQTT-syncbus wanneer dat nodig is
```

### AC-5: Geldige airco-wijziging wordt naar het wallpanel gesynchroniseerd

```gherkin
Scenario: Airco-status of dashboardcommando wordt doorgezet naar het wallpanel
  Given een airco-unit is gekoppeld aan een Polarbear-wallpanel
  And de airco-adapter kan de actuele status lezen of een commando verwerken
  When de airco-status wijzigt of de gebruiker een geldig commando geeft via het dashboard
  Then wordt de wijziging verwerkt door de synchronisatieservice
  And wordt de gekoppelde wallpanel-unit bijgewerkt via Modbus wanneer synchronisatie nodig is
  And worden wallpanel insights bijgewerkt voor het dashboard
```

### AC-6: Ongeldige klimaatwaarde wordt afgekeurd

```gherkin
Scenario: Ongeldige temperatuur- of ventilatiewaarde wordt niet verstuurd
  Given een gebruiker of systeemonderdeel probeert een klimaatwaarde te wijzigen
  When de temperatuur, fan speed, fan mode of control zone buiten het toegestane bereik valt
  Then wordt de wijziging afgekeurd
  And wordt er geen write-actie naar wallpanel of airco-unit uitgevoerd
  And wordt de fout gelogd
```

### AC-7: Adaptertype bepaalt hoe een airco wordt aangestuurd

```gherkin
Scenario: Airco-device gebruikt het ingestelde adaptertype
  Given een airco-device heeft een ondersteund adaptertype
  When de synchronisatieservice of API een airco-status leest of commando schrijft
  Then wordt de juiste adapter opgehaald via de AdapterRegistry
  And wordt het protocol van die adapter gebruikt voor de airco-unit
```

### AC-8: Onbekend adaptertype wordt niet gebruikt

```gherkin
Scenario: Airco-device heeft een niet-ondersteund adaptertype
  Given een airco-device verwijst naar een adaptertype dat niet geregistreerd is
  When het systeem deze airco-unit probeert te gebruiken
  Then wordt de actie geweigerd of overgeslagen
  And wordt er geen onveilige of willekeurige adapter aangemaakt
  And wordt de fout gelogd voor beheer of analyse
```

### AC-9: Feedback-loop wordt voorkomen

```gherkin
Scenario: Een teruggelezen wijziging veroorzaakt geen eindeloze synchronisatie
  Given een wijziging is al door de synchronisatieservice naar een gekoppeld apparaat gestuurd
  When dezelfde waarde opnieuw wordt teruggelezen vanuit wallpanel, airco of MQTT
  Then wordt deze wijziging herkend als bestaande of verwachte synchronisatie
  And wordt er geen overbodige write-actie gestart
  And blijft de status consistent
```

### AC-10: Dubbele of verouderde berichten worden genegeerd

```gherkin
Scenario: Systeem ontvangt een ouder of identiek syncbericht
  Given het systeem heeft al een recentere of gelijke waarde verwerkt
  When een MQTT-bericht, pollresultaat of dashboardcommando dezelfde of oudere waarde bevat
  Then wordt de waarde niet opnieuw geschreven naar fysieke apparaten
  And blijft de laatst bekende actuele status behouden
```

### AC-11: MQTT-syncbus synchroniseert backend-instances

```gherkin
Scenario: Wijziging wordt gedeeld met andere backend-instances
  Given meerdere backend-instances zijn verbonden met dezelfde MQTT-broker
  When een instance een geldige statuswijziging publiceert
  Then ontvangen de andere instances het syncbericht
  And verwerken zij het bericht volgens dezelfde validatie- en echo-regels
  And ontstaat er geen write-ping-pong tussen instances
```

### AC-12: Uitval van MQTT maakt lokale werking niet onmogelijk

```gherkin
Scenario: MQTT-broker is tijdelijk niet bereikbaar
  Given de backend draait en gekoppelde apparaten lokaal bereikbaar zijn
  And de MQTT-broker is tijdelijk niet bereikbaar
  When de synchronisatieservice een lokale wijziging verwerkt
  Then blijft lokale synchronisatie waar mogelijk functioneren
  And wordt de MQTT-fout gelogd
  And probeert het systeem later opnieuw verbinding te maken
```

### AC-13: Wallpanel is tijdelijk niet bereikbaar

```gherkin
Scenario: Modbus-wallpanel reageert niet tijdens polling of schrijven
  Given een Polarbear-wallpanel is gekoppeld aan een ruimte
  And het wallpanel is tijdelijk niet bereikbaar
  When de wallpanel monitor een status leest of wijziging schrijft
  Then crasht de synchronisatieservice niet
  And wordt de fout gelogd
  And blijft de laatst bekende wallpanelstatus beschikbaar voor het dashboard
```

### AC-14: Airco-unit is tijdelijk niet bereikbaar

```gherkin
Scenario: Airco-adapter kan een airco-unit niet bereiken
  Given een airco-unit is gekoppeld aan een ruimte
  And de airco-unit of gateway is tijdelijk niet bereikbaar
  When de airco monitor een status leest of wijziging schrijft
  Then crasht de synchronisatieservice niet
  And wordt de fout gelogd
  And blijft de laatst bekende aircostatus beschikbaar voor het dashboard
```

### AC-15: Database-uitval wordt gecontroleerd afgehandeld

```gherkin
Scenario: MongoDB is tijdelijk niet beschikbaar
  Given de backend probeert configuratie of topology op te halen
  And MongoDB is tijdelijk niet bereikbaar
  When de API of synchronisatieservice een databaseactie uitvoert
  Then wordt de fout gecontroleerd afgehandeld
  And wordt er geen corrupte of incomplete configuratie gebruikt
  And blijft de service waar mogelijk werken met laatst bekende runtime-status
```

### AC-16: Dashboard toont actuele wallpanel insights

```gherkin
Scenario: Gebruiker bekijkt actuele wallpanelgegevens
  Given de wallpanel monitor heeft paneldata opgehaald
  When de gebruiker het wallpanel dashboard opent of filters toepast
  Then toont de frontend de actuele setpoint, virtual temp, fan speed, fan mode, status en update-tijd
  And worden alleen gegevens getoond die passen bij de gekozen zone, ruimte of unit
```

### AC-17: Dashboard toont actuele airco insights

```gherkin
Scenario: Gebruiker bekijkt actuele aircogegevens
  Given de airco monitor heeft aircodata opgehaald
  When de gebruiker het airco dashboard opent of filters toepast
  Then toont de frontend de actuele aircostatus, setpoint, temperatuur, fan speed, fan mode en update-tijd
  And worden wijzigingen via REST of SSE zichtbaar zonder handmatige databasecontrole
```

### AC-18: Dashboardcommando wordt gevalideerd en uitgevoerd

```gherkin
Scenario: Gebruiker past airco-instelling aan via het dashboard
  Given de gebruiker bekijkt een gekoppelde airco-unit in het dashboard
  When de gebruiker een geldige temperatuur, fan speed of fan mode instelt
  Then stuurt de frontend het commando naar de backend API
  And valideert de backend het commando
  And voert de synchronisatieservice het commando uit via de juiste airco-adapter
  And wordt het resultaat zichtbaar in de airco insights
```

### AC-19: API geeft consistente data terug aan de frontend

```gherkin
Scenario: Frontend haalt configuratie en inzichten op
  Given de backend heeft configuratie en runtime-status beschikbaar
  When de frontend device tree, adaptertypes, wallpanel insights of airco insights opvraagt
  Then geeft de API consistente response-structuren terug
  And bevat de response voldoende informatie om zones, ruimtes, apparaten en status te tonen
```

### AC-20: Logging ondersteunt foutanalyse en beheer

```gherkin
Scenario: Systeem verwerkt een fout in communicatie of validatie
  Given een fout ontstaat in API-validatie, database, MQTT, Modbus of airco-adaptercommunicatie
  When de fout wordt afgehandeld
  Then wordt de fout gelogd met context zoals apparaat, ruimte, bron en type actie
  And worden gevoelige gegevens niet onnodig in logs opgenomen
```

### AC-21: Herstel na storing brengt statussen weer gelijk

```gherkin
Scenario: Apparaat of verbinding komt terug na tijdelijke storing
  Given een wallpanel, airco-unit, MQTT-broker of database was tijdelijk niet bereikbaar
  When de verbinding herstelt
  Then haalt het systeem opnieuw de actuele status op
  And vergelijkt het systeem deze status met de laatst bekende status
  And synchroniseert het systeem alleen verschillen die volgens de synchronisatieregels geldig zijn
```

### AC-22: Nieuwe airco-adapter kan worden toegevoegd zonder sync-core aan te passen

```gherkin
Scenario: Ontwikkelaar voegt ondersteuning toe voor een nieuw aircotype
  Given er bestaat een nieuwe adapterimplementatie die voldoet aan IAircoAdapter
  When de adapter wordt geregistreerd in de AdapterRegistry
  Then kan een airco-device dit adaptertype gebruiken
  And hoeft de synchronisatielus niet inhoudelijk aangepast te worden
```

### AC-23: Tests dekken kernfunctionaliteit

```gherkin
Scenario: Ontwikkelaar voert de test suite uit
  Given de codebase bevat tests voor controllers, services, adapters, MQTT, topology en synchronisatie
  When de ontwikkelaar de tests uitvoert
  Then wordt de validatie, adapterselectie, synchronisatie, echo-preventie en foutafhandeling zichtbaar
  And kan de wijziging pas betrouwbaar worden opgeleverd wanneer de relevante tests slagen
```
