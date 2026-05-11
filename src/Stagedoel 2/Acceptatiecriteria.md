# Acceptatiecriteria

## User story

Als gebruiker van het klimaatsysteem wil ik dat een wijziging op een Polarbear-wallpanel automatisch wordt gesynchroniseerd naar de gekoppelde airco-unit, zodat de temperatuur en ventilatie in de ruimte consistent blijven zonder dat ik dit op twee plekken hoef in te stellen.

## Acceptatiecriteria in Gherkin

### AC-1: Geldige instelling wordt gesynchroniseerd

```gherkin
Scenario: Temperatuurinstelling wordt doorgezet naar de airco
  Given de gebruiker heeft een Polarbear-wallpanel gekoppeld aan een airco-unit
  And de synchronisatieservice is actief
  And de gebruiker stelt een geldige temperatuurwaarde in
  When de wijziging wordt verwerkt door het systeem
  Then wordt de nieuwe temperatuurwaarde naar de gekoppelde airco-adapter gestuurd
  And wordt de actuele status van de airco bijgewerkt
```

### AC-2: Ongeldige instelling wordt afgekeurd

```gherkin
Scenario: Ongeldige temperatuurinstelling wordt niet verstuurd
  Given de gebruiker heeft een Polarbear-wallpanel gekoppeld aan een airco-unit
  And de synchronisatieservice is actief
  When de gebruiker een temperatuurwaarde buiten het toegestane bereik instelt
  Then wordt de instelling afgekeurd
  And wordt er geen wijziging naar de airco-unit gestuurd
  And wordt de fout gelogd
```

### AC-3: Airco-unit is tijdelijk niet bereikbaar

```gherkin
Scenario: Synchronisatie faalt door een onbereikbare airco-unit
  Given de gebruiker heeft een Polarbear-wallpanel gekoppeld aan een airco-unit
  And de airco-unit is tijdelijk niet bereikbaar
  When de synchronisatieservice een wijziging probeert door te sturen
  Then crasht de synchronisatieservice niet
  And wordt de fout gelogd
  And blijft de laatst bekende status beschikbaar
```

### AC-4: Feedback-loop wordt voorkomen

```gherkin
Scenario: Een teruggelezen wijziging veroorzaakt geen eindeloze synchronisatie
  Given een wijziging is al door de synchronisatieservice naar de airco-unit gestuurd
  When dezelfde waarde opnieuw wordt teruggelezen vanuit de airco-unit
  Then wordt deze wijziging herkend als bestaande synchronisatie
  And wordt er geen nieuwe overbodige write-actie gestart
```
