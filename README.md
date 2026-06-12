# AircosystemManager

Backend en frontend voor het beheren en synchroniseren van airco's, wallpanels
en Polarbear/Moxa Modbus-units. MQTT is de centrale sync-laag voor setpoint,
fan mode, fan speed en temperatuur-state.

## Installatie

Installeer eerst de dependencies in de root:

```bash
npm install
```

Installeer daarna de frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

## Database starten

Start MongoDB met Docker:

```bash
docker compose up -d mongo
```

De database draait daarna op `localhost:27017`.

Standaard connection string:

```text
mongodb://wallpanel:wallpanel@localhost:27017/wallpanel_sync?authSource=admin
```

Database stoppen:

```bash
docker compose down
```

## Backend starten

Start de backend lokaal vanuit de root:

```bash
npm run airco:prototype
```

De backend draait standaard op `http://localhost:8088`.

Backend met Docker starten:

```bash
docker compose up -d airco-api
```

`airco-api` start automatisch na de `mongo` container.

## Frontend starten

Start de frontend in een aparte terminal:

```bash
cd frontend
npm run dev
```

De frontend draait standaard op `http://localhost:5173`.

## Optionele env vars

De backend gebruikt defaults, maar je kunt deze overschrijven:

```text
MONGO_URI=mongodb://wallpanel:wallpanel@localhost:27017/wallpanel_sync?authSource=admin
MONGO_DB=wallpanel_sync
MQTT_BROKER=mqtt://192.168.55.10
MQTT_TOPIC_BASE=polarbears/wallpanel/airco
```

## Systeemoverzicht

De applicatie bestaat uit drie hoofdonderdelen:

- Backend: `src/AircoSystemManager/src/server.ts`
- Frontend: `frontend/src`
- Mongo seed/config: `src/AircoSystemManager/docker/mongo/init`

Belangrijke backend modules:

- `config.repository.ts`: leest en schrijft configuratie in MongoDB.
- `airco-mqtt-bridge.service.ts`: vertaalt MQTT commands naar de airco-adapter en publiceert airco-state terug naar MQTT.
- `wallpanel-poller.service.ts`: pollt Polarbear/wallpanel Modbus flags, schrijft MQTT-state naar wallpanels en synchroniseert wallpanel-wijzigingen terug naar MQTT.
- `polarbear.service.ts`: lage-level Polarbear registers, flags, setpoint, fan mode, fan speed, baudrate en reboot.
- `control.controller.ts`: HTTP API voor de frontend en admin-acties.

## Gebruikte API's en protocollen

- HTTP API: backend draait standaard op `http://localhost:8088`.
- MongoDB: configuratie en devices worden opgeslagen in `Climatezones` en `enviormentsaircodevices`.
- MQTT: source of truth voor runtime state.
- Modbus TCP/Telnet: communicatie met Moxa/Polarbear wallpanels.
- Server-Sent Events: live wallpanel- en airco-insights naar de frontend.

MQTT topics worden opgebouwd als:

```text
{MQTT_TOPIC_BASE}/{climatezoneId}/{roomId}/setTemperature/set
{MQTT_TOPIC_BASE}/{climatezoneId}/{roomId}/setTemperature/state
{MQTT_TOPIC_BASE}/{climatezoneId}/{roomId}/fanMode/set
{MQTT_TOPIC_BASE}/{climatezoneId}/{roomId}/fanMode/state
{MQTT_TOPIC_BASE}/{climatezoneId}/{roomId}/fanSpeed/set
{MQTT_TOPIC_BASE}/{climatezoneId}/{roomId}/fanSpeed/state
{MQTT_TOPIC_BASE}/{climatezoneId}/{roomId}/virtualTemp/state
```

Belangrijke HTTP routes:

```text
GET    /api/status
GET    /api/settings
PUT    /api/settings
GET    /devices
POST   /zones
PUT    /zones/:zoneId
DELETE /zones/:zoneId
POST   /zones/:zoneId/rooms
PUT    /zones/:zoneId/rooms/:roomId
DELETE /zones/:zoneId/rooms/:roomId
GET    /environment-devices
POST   /environment-devices
PUT    /environment-devices/:id
DELETE /environment-devices/:id
GET    /airco-adapter-types
POST   /devices
PUT    /devices/:id
DELETE /devices/:id
POST   /airco-devices
PUT    /airco-devices/:id
DELETE /airco-devices/:id
GET    /wallpanel-insights/rooms/:zoneId/:roomId
GET    /wallpanel-insights/stream/rooms/:zoneId/:roomId
POST   /wallpanel-insights/rooms/:zoneId/:roomId/sync/pause
POST   /wallpanel-insights/rooms/:zoneId/:roomId/sync/resume
POST   /wallpanel-insights/rooms/:zoneId/:roomId/panels/:panelId/reboot
POST   /wallpanel-insights/rooms/:zoneId/:roomId/panels/:panelId/baudrate
GET    /airco-insights/rooms/:zoneId/:roomId
GET    /airco-insights/stream/rooms/:zoneId/:roomId
POST   /airco-insights/rooms/:zoneId/:roomId/commands
POST   /api/setpoint
POST   /api/fan-mode
POST   /api/fan-speed
```

## Gebruikte packages

Backend dependencies:

- `mongodb`: MongoDB client.
- `mqtt`: MQTT client voor command/state topics.
- `modbus-serial`: Modbus communicatie met Moxa/Polarbear.
- `jsmodbus`, `modbus-event`, `modbus-rtu`: Modbus tooling/experimenten.
- `express`, `cors`, `ws`: aanwezig voor API/websocket tooling; de huidige AircoSystemManager control API gebruikt Node `http`.
- `dotenv`: environment variable ondersteuning.
- `uuid`: ID-generatie.

Backend dev dependencies:

- `typescript`, `tsx`, `ts-node`: TypeScript build en runtime.
- `jest`, `ts-jest`: tests.
- `vite`: root development tooling.
- `prettier`, `eslint`: formatting/linting.

Frontend dependencies:

- `react`, `react-dom`: frontend UI.
- `vite`, `@vitejs/plugin-react`: frontend development/build.
- `axios`: HTTP calls naar de backend.
- `react-router-dom`: routing dependency.
- `@mui/icons-material`, `@emotion/react`, `@emotion/styled`: UI/icon dependencies.
- `materialize-css`: CSS/UI dependency.
- `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`: linting.

## Huidige functionaliteit

- Zones, rooms, wallpanels, airco devices en environment devices beheren.
- Airco adapter types tonen vanuit de backend registry.
- Wallpanel en airco insights tonen in de frontend.
- MQTT setpoint, fan mode en fan speed naar airco en wallpanels synchroniseren.
- Wallpanel/iPad wijzigingen terug publiceren naar MQTT.
- Virtual/current temperature via MQTT naar wallpanels sturen.
- Polarbear reboot en baudrate beheer vanuit de frontend/API.
- Poll-loop pauzeren en hervatten voor onderhoud.
- Reconnect bij ontbrekende wallpanel-verbinding.
- Confirm popup voor remove/delete acties in de frontend.

## Nog toe te voegen functionaliteiten

- Health/status per room en per wallpanel duidelijker tonen in de UI, inclusief reconnect-status en laatste foutmelding.
- Automatische reconnect-status visualiseren in de frontend in plaats van alleen backend logs.
- Validatie uitbreiden voor Mongo-config, IP-adressen, poorten, unit IDs en zones.
- End-to-end tests toevoegen voor MQTT naar wallpanel en wallpanel naar MQTT sync.
- UI toevoegen voor retained MQTT state inspectie per room.
- Logging structureren met log levels en request/correlation IDs.
- Foutmeldingen in de frontend vervangen door consistente inline error states.
- Database-migratie toevoegen om legacy/string room-data naar normale Mongo objecten om te zetten.
- Tests toevoegen voor reboot-flow: na reboot opnieuw verbinden en MQTT-state terugschrijven naar wallpanels.
- Externe setpoint/currentTemperature sync configureerbaar maken via de UI als die koppeling definitief gebruikt blijft worden.
- Docker compose uitbreiden met optionele MQTT broker voor lokale development.

## Bekende aandachtspunten

- De iPad draait nog op de oude backend en is nog niet gekoppeld aan deze backend.
- De simulator geeft geen `setTemperature` en `currentTemperature` terug.
- De koppeling met de `192.168.55.10` database is nog niet werkend getest.
- Voorkeursoplossing: iPad direct op dezelfde MQTT topics aansluiten, zodat MQTT de source of truth blijft.
