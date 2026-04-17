import { Router } from 'express';
import AdapterRegistry from '../adapters/AdapterRegistry';

export default function createAircoAdapterTypesRoute(registry: AdapterRegistry) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(
      registry.listTypes().map((type) => ({
        type,
      })),
    );
  });

  return router;
}
