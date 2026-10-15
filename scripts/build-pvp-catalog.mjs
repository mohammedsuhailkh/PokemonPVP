import { mkdir, writeFile } from 'node:fs/promises';
import { RIVALRIES } from '../src/game/constants.js';
import { PokeApiService } from '../src/game/PokeApiService.js';
const entries = new Map();
for (const r of Object.values(RIVALRIES)) for (const p of [...r.playerTeam, ...r.enemyTeam]) if (!entries.has(p.id)) entries.set(p.id, p);
entries.set(143, { id: 143, name: 'snorlax' });
const catalog = {};
await Promise.all([...entries].map(async ([id, entry]) => {
    catalog[id] = await PokeApiService.fetchPokemon(entry);
}));
await mkdir(new URL('../server/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../server/data/catalog.json', import.meta.url), JSON.stringify(catalog, null, 2));
console.log(`Saved ${Object.keys(catalog).length} server-owned species`);
