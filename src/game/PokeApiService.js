import { FALLBACK_MOVES, SIGNATURE_MOVESETS, classifyMoveSpatialArchetype } from './constants.js';
import { fighterTraits } from './BattleRules.js';

const LOCAL_SPECIES = {
    pikachu: { id: 25, types: ['electric'], weight: 60, height: 4, stats: [35, 55, 40, 50, 50, 90] },
    blastoise: { id: 9, types: ['water'], weight: 855, height: 16, stats: [79, 83, 100, 85, 105, 78] },
    charizard: { id: 6, types: ['fire', 'flying'], weight: 905, height: 17, stats: [78, 84, 78, 109, 85, 100] },
    lucario: { id: 448, types: ['fighting', 'steel'], weight: 540, height: 12, stats: [70, 110, 70, 115, 70, 90] },
    greninja: { id: 658, types: ['water', 'dark'], weight: 400, height: 15, stats: [72, 95, 67, 103, 71, 122] },
    electivire: { id: 466, types: ['electric'], weight: 1386, height: 18, stats: [75, 123, 67, 95, 85, 95] },
    garchomp: { id: 445, types: ['dragon', 'ground'], weight: 950, height: 19, stats: [108, 130, 95, 80, 85, 102] },
    scizor: { id: 212, types: ['bug', 'steel'], weight: 1180, height: 18, stats: [70, 130, 100, 55, 80, 65] }
};

async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        return await response.json();
    } finally { clearTimeout(timer); }
}

/**
 * ============================================================================
 * POKÉAPI REAL-TIME FETCHER & GEN V ANIMATED SPRITE LOADER
 * ============================================================================
 */
export const PokeApiService = {
    pokemonCache: {},
    moveCache: {},

    async fetchPokemon(entry) {
        const queryKey = String(entry.id || entry.name).toLowerCase().trim();
        const cacheKey = `${queryKey}:${(entry.moves || []).join(',')}`;
        if (this.pokemonCache[cacheKey]) {
            return this.buildCombatant(this.pokemonCache[cacheKey]);
        }

        try {
            const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(queryKey)}`);

            const bwAnimated = data.sprites?.versions?.['generation-v']?.['black-white']?.animated;
            const frontSprite = bwAnimated?.front_default ||
                                data.sprites?.other?.showdown?.front_default ||
                                data.sprites?.front_default;

            const baseStats = {};
            if (Array.isArray(data.stats)) {
                data.stats.forEach(s => {
                    baseStats[s.stat.name] = s.base_stat;
                });
            }

            // Determine 4 moves:
            // 1) Explicit preset moves, 2) Authentic Signature Moveset by ID or Name, or 3) High-level PokéAPI learnset
            let moveSlugs = entry.moves;
            if (!moveSlugs || moveSlugs.length === 0) {
                const cleanName = data.name.toLowerCase();
                const baseSpeciesName = cleanName.split('-')[0];
                if (SIGNATURE_MOVESETS[String(data.id)]) {
                    moveSlugs = SIGNATURE_MOVESETS[String(data.id)];
                } else if (SIGNATURE_MOVESETS[cleanName]) {
                    moveSlugs = SIGNATURE_MOVESETS[cleanName];
                } else if (SIGNATURE_MOVESETS[baseSpeciesName]) {
                    moveSlugs = SIGNATURE_MOVESETS[baseSpeciesName];
                } else {
                    // Prioritize signature/known moves from the Pokémon's actual PokéAPI learnset (reversed so high-ID/signature moves come first)
                    const apiMoveNames = data.moves.map(m => m.move.name);
                    const signatureMatches = apiMoveNames.filter(name => FALLBACK_MOVES[name]?.isSignature);
                    const knownMatches = apiMoveNames.filter(name => FALLBACK_MOVES[name] && !FALLBACK_MOVES[name].isSignature).reverse();
                    const rawReversed = [...apiMoveNames].reverse();
                    const defaultPool = ['thunderbolt', 'flamethrower', 'ice-beam', 'aura-sphere'];
                    moveSlugs = [...new Set([...signatureMatches, ...knownMatches, ...rawReversed, ...defaultPool])].slice(0, 4);
                }
            }

            const moves = await Promise.all(moveSlugs.slice(0, 4).map(m => this.fetchMove(m)));

            const rawSpec = {
                id: data.id,
                speciesId: Number(data.species?.url?.split('/').filter(Boolean).pop()) || data.id,
                name: data.name.toUpperCase(),
                types: data.types.map(t => t.type.name),
                baseStats,
                weight: data.weight,
                height: data.height,
                sprite: frontSprite,
                cry: data.cries?.latest || null,
                moves
            };

            this.pokemonCache[cacheKey] = rawSpec;
            return this.buildCombatant(rawSpec);
        } catch (err) {
            const local = LOCAL_SPECIES[queryKey] || Object.values(LOCAL_SPECIES).find(p => String(p.id) === queryKey);
            if (!local) throw new Error(`Cannot load ${entry.name || queryKey}. Check the Pokémon name and connection.`);
            const name = Object.keys(LOCAL_SPECIES).find(key => LOCAL_SPECIES[key] === local);
            const fbMoves = await Promise.all((entry.moves || SIGNATURE_MOVESETS[String(local.id)] ||
                SIGNATURE_MOVESETS[name] || ['tackle']).slice(0, 4).map(m => this.fetchMove(m)));
            return this.buildCombatant({
                id: local.id,
                name: name.toUpperCase(),
                types: local.types,
                weight: local.weight, height: local.height,
                baseStats: Object.fromEntries(['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((key, i) => [key, local.stats[i]])),
                sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${local.id}.gif`,
                offline: true,
                cry: null,
                moves: fbMoves
            });
        }
    },

    async fetchMove(slug) {
        const s = slug.toLowerCase();
        if (this.moveCache[s]) {
            return JSON.parse(JSON.stringify(this.moveCache[s]));
        }

        // Check curated fallback first for instant response, then enrich via API if needed
        if (FALLBACK_MOVES[s]) {
            const fb = FALLBACK_MOVES[s];
            const archetype = classifyMoveSpatialArchetype(s, fb.damageClass, fb.type, fb.power);
            const cooldownMax = archetype === 'BEAM' ? 3.4 : (archetype === 'AOE' ? 4.2 : (archetype === 'BLITZ' ? 2.5 : 1.7));
            const moveObj = {
                slug: s,
                name: fb.name,
                type: fb.type,
                power: fb.power,
                accuracy: fb.accuracy,
                pp: fb.pp,
                maxPp: fb.pp,
                damageClass: fb.damageClass,
                ailment: fb.ailment || null,
                ailmentChance: fb.ailmentChance || 0,
                multiShot: fb.multiShot || (s.includes('shuriken') || s.includes('slash') ? 3 : 1),
                isSignature: Boolean(fb.isSignature),
                archetype,
                cooldown: 0,
                cooldownMax
            };
            this.moveCache[s] = moveObj;
            return JSON.parse(JSON.stringify(moveObj));
        }

        try {
            const data = await fetchJson(`https://pokeapi.co/api/v2/move/${encodeURIComponent(s)}`);

            const power = data.power ?? 0;
            const damageClass = data.damage_class?.name || 'special';
            const type = data.type?.name || 'normal';
            const archetype = classifyMoveSpatialArchetype(s, damageClass, type, power);
            const cooldownMax = archetype === 'BEAM' ? 3.5 : (archetype === 'AOE' ? 4.2 : (archetype === 'BLITZ' ? 2.5 : 1.8));

            const moveObj = {
                slug: s,
                name: data.names?.find(n => n.language.name === 'en')?.name || s.replace(/-/g, ' ').toUpperCase(),
                type,
                power,
                accuracy: data.accuracy ?? 100,
                pp: data.pp || 15,
                maxPp: data.pp || 15,
                damageClass,
                ailment: ({ paralysis: 'PAR', burn: 'BRN', poison: 'PSN', freeze: 'FRZ' })[data.meta?.ailment?.name] || null,
                ailmentChance: data.meta?.ailment_chance || 0,
                multiShot: 1,
                archetype,
                cooldown: 0,
                cooldownMax
            };
            this.moveCache[s] = moveObj;
            return JSON.parse(JSON.stringify(moveObj));
        } catch (e) {
            throw new Error(`Cannot load move ${s}. Check the connection.`);
        }
    },

    buildCombatant(raw) {
        const level = 50;
        const calcStat = (base, isHp = false) => {
            if (isHp) return Math.floor(((2 * base + 31 + 21) * level) / 100) + level + 55; // Slightly higher stadium HP pool for real-time action pacing
            return Math.floor(((2 * base + 31 + 21) * level) / 100) + 5;
        };

        const maxHp = calcStat(raw.baseStats['hp'] || 80, true);
        return {
            id: raw.id,
            speciesId: raw.speciesId || raw.id,
            name: raw.name,
            height: raw.height || 10,
            weight: raw.weight || 100,
            level,
            types: [...raw.types],
            traits: fighterTraits(raw),
            offline: Boolean(raw.offline),
            maxHp,
            currentHp: maxHp,
            stats: {
                attack: calcStat(raw.baseStats['attack'] || 80),
                defense: calcStat(raw.baseStats['defense'] || 80),
                spAtk: calcStat(raw.baseStats['special-attack'] || 80),
                spDef: calcStat(raw.baseStats['special-defense'] || 80),
                speed: calcStat(raw.baseStats['speed'] || 85)
            },
            status: null, // 'PAR', 'BRN', 'PSN', 'FRZ'
            statusTimer: 0,
            stamina: 100,
            fainted: false,
            sprite: raw.sprite,
            cry: raw.cry,
            moves: raw.moves.map(move => ({ ...move, cooldown: 0, pp: move.maxPp })),

            // 2.5D Spatial Physics State
            x: -240,
            y: 40,
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            facing: 1, // 1 = right, -1 = left
            radius: Math.max(11, Math.min(28, 9 + (raw.height || 10) * 0.55)),
            bobPhase: 0,

            // Tactical States
            iFrames: 0,
            perfectDodgeWindow: 0,
            dashTimer: 0,
            dashDirX: 0,
            dashDirY: 0,
            counterShieldTimer: 0,
            counterCooldown: 0,
            shieldStrength: 0,
            dodgeCooldown: 0,
            dodgeRewarded: false,
            recoveryTimer: 0,
            guardBreakTimer: 0,
            switchCooldown: 0,
            action: null,
            statusTick: 1,
            guarding: false,
            blitzState: null, // Active melee dash state
            hitFlashTimer: 0,
            afterimages: []
        };
    }
};
