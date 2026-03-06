# Airco Adapter Pattern

Doel: elk merk/model airco krijgt een eigen adapter. Daardoor kun je makkelijk
nieuwe apparaten toevoegen zonder je controller/service/repo te dupliceren.

## Structuur
- `IAircoAdapter.ts` definieert de interface
- `AdapterRegistry.ts` registreert `type -> adapter`
- `registerAdapters.ts` is de standaard wiring
- `hopmann/HopmannAdapter.ts` is een template voor nu

## Nieuwe airco toevoegen
1. Maak een map: `src/Airco/adapters/<type>/`
1. Voeg `<Type>Adapter.ts` toe dat `AircoAdapter` implementeert
1. Registreer in `src/Airco/adapters/registerAdapters.ts`
1. Zet `device.type` in je data op dezelfde string

## Example usage
```ts
import AdapterRegistry from './AdapterRegistry';
import { registerDefaultAdapters } from './registerAdapters';

const registry = new AdapterRegistry();
registerDefaultAdapters(registry);

const adapter = registry.create('HeinhopmannIp', { host: '192.168.1.10', port: 502 });
await adapter.connect();
const sp = await adapter.getSetpoint(1, 1);
await adapter.disconnect();
```
