# Polarbear Wall Panel Module

Deze module beheert de communicatie met Polarbear Zentium Palladium wandpanelen/thermostaten via Modbus RTU over TCP.

## Bestandsstructuur

De code is opgesplitst in verschillende modules voor betere overzichtelijkheid en onderhoudbaarheid:

### 📄 `polarbear-constants.ts`
**Doel:** Bevat alle Modbus register mappings en constanten
- Flag bits voor change detection
- Coil registers
- Holding registers
- Input registers  
- Modbus function codes

### 📄 `polarbear-modbus.ts`
**Doel:** Low-level Modbus communicatie functies
- `send()` - Verzend een Modbus bericht en wacht op response
- `readHoldingRegister()` - Lees een holding register
- `writeHoldingRegister()` - Schrijf naar een holding register

### 📄 `polarbear-device-operations.ts`
**Doel:** Device-level operaties voor lezen en schrijven van Polarbear registers
- `getFanMode()` - Lees de ventilator modus voor een zone
- `setFanMode()` - Stel de ventilator modus in voor een zone
- `getSetPoint()` - Lees de setpoint temperatuur voor een zone
- `setSetPoint()` - Stel de setpoint temperatuur in voor een zone
- `setCurrentTemperature()` - Stel de huidige/virtuele temperatuur in voor een zone
- `setFlag()` - Zet een flag bit om aan te geven dat een wijziging is verwerkt

### 📄 `polarbear-flag-monitor.ts`
**Doel:** Monitort flags en verwerkt responses van Polarbear apparaten
- `getFlags()` - Leest flags van alle panel IDs
- `processResponse()` - Verwerkt response van flag reading
- Detecteert wijzigingen in setpoint en fan speed
- Update database wanneer gebruiker wijzigingen maakt op het paneel

### 📄 `polarbear.ts`
**Doel:** Hoofdcontroller die alles samenbrengt
- `PolarbearController` class die `Ipolarbear` interface implementeert
- Beheert TCP connectie naar Moxa device server
- `updateAcPanels()` - Update methode die periodiek wordt aangeroepen
- `checkDatabaseChanges()` - Synchroniseert database wijzigingen naar alle panelen

### 📄 `Ipolarbear.ts`
**Doel:** Interface definitie voor Polarbear implementaties

## Communicatie Flow

```
┌─────────────────────┐
│  PolarbearController│
│   (polarbear.ts)    │
└──────────┬──────────┘
           │
           ├─────────────────────────────────┐
           │                                 │
           ▼                                 ▼
┌──────────────────────┐        ┌───────────────────────┐
│  PolarbearFlagMonitor│        │PolarbearDeviceOps     │
│(polarbear-flag-      │◄───────┤(polarbear-device-     │
│ monitor.ts)          │        │ operations.ts)        │
└──────────┬───────────┘        └──────────┬────────────┘
           │                               │
           │                               ▼
           │                    ┌──────────────────────┐
           │                    │  PolarbearModbus     │
           │                    │ (polarbear-modbus.ts)│
           │                    └──────────┬───────────┘
           │                               │
           └───────────────┬───────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Modbus RTU    │
                  │  over TCP/IP   │
                  └────────┬───────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Moxa NPort    │
                  │  5130A         │
                  └────────────────┘
```

## Gebruik

```typescript
import PolarbearController from './polarbear';
import Logger from '../../../libraries/logger/logger';

// Initialiseer controller
const controller = new PolarbearController(
  acpanel,
  deviceRepository,
  airconFactory,
  logger
);

// Update panelen
const updatedAirconditioners = controller.updateAcPanels(airconditioners);
```

## Configuratie

- Configureer "SENSOR 9" voor elke zone om de 'virtual temperature' te gebruiken
- Moxa device server moet toegankelijk zijn via TCP/IP
- IP adres en poort worden geconfigureerd in `acpanel` object

## Known Issues

Zie de comments bovenaan `polarbear.ts` voor bekende beperkingen en workarounds.
