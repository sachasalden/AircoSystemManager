# Airco Test

Korte setup voor development.

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
```
