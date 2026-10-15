export const STADIUM_THEMES = {
    grassy: {
        id: 'grassy',
        name: 'Indigo Grass Colosseum',
        shortName: 'GRASS TURF',
        tagline: 'Vibrant League turf with conductive water puddles',
        image: '/grounds/high-angle/grassy.png',
        themeColor: '#22c55e',
        borderColor: '#4ade80',
        skyTop: '#040d07',
        skyMid: '#062013',
        skyBot: '#020a05',
        lightColor: 'rgba(74, 222, 128, 0.05)',
        turfBorder: '#166534',
        turfFill: '#15803d'
    },
    rocky: {
        id: 'rocky',
        name: 'Canyon Mountain Colosseum',
        shortName: 'ROCKY CANYON',
        tagline: 'Rugged stone crags & earth pillar battleground',
        image: '/grounds/high-angle/rocky.png',
        themeColor: '#f59e0b',
        borderColor: '#fbbf24',
        skyTop: '#150c04',
        skyMid: '#231406',
        skyBot: '#0b0602',
        lightColor: 'rgba(245, 158, 11, 0.06)',
        turfBorder: '#92400e',
        turfFill: '#78350f'
    },
    magma: {
        id: 'magma',
        name: 'Scorched Volcano Arena',
        shortName: 'MAGMA CRATER',
        tagline: 'Molten obsidian ring with burning lava traps',
        image: '/grounds/high-angle/magma.png',
        themeColor: '#ef4444',
        borderColor: '#f87171',
        skyTop: '#180404',
        skyMid: '#2d0909',
        skyBot: '#0c0202',
        lightColor: 'rgba(239, 68, 68, 0.07)',
        turfBorder: '#991b1b',
        turfFill: '#450a0a'
    },
    ice_water: {
        id: 'ice_water',
        name: 'Glacier Ice & Water Basin',
        shortName: 'ICE & WATER',
        tagline: 'Crystalline frozen lagoon with chilling frost',
        image: '/grounds/high-angle/ice_water.png',
        themeColor: '#06b6d4',
        borderColor: '#38bdf8',
        skyTop: '#030d17',
        skyMid: '#061d30',
        skyBot: '#01060c',
        lightColor: 'rgba(56, 189, 248, 0.06)',
        turfBorder: '#0369a1',
        turfFill: '#0c4a6e'
    }
};

        export const TYPE_CHART = {
            normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
            fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
            water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
            electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
            grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
            ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
            fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
            poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
            ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
            flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
            psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
            bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
            rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
            ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
            dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
            dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
            steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
            fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
        };

        export const TYPE_COLORS = {
            normal:   { bg: 'bg-stone-500', border: 'border-stone-400', hex: '#e7e5e4', glow: '#a8a29e', sfx: 'ドーン! BAM!' },
            fire:     { bg: 'bg-orange-600', border: 'border-orange-400', hex: '#fb923c', glow: '#ef4444', sfx: 'ゴォォ! BLAZE!' },
            water:    { bg: 'bg-sky-600', border: 'border-sky-400', hex: '#38bdf8', glow: '#0284c7', sfx: 'ザッパーン! SPLASH!' },
            electric: { bg: 'bg-amber-400 text-slate-950', border: 'border-yellow-300', hex: '#facc15', glow: '#eab308', sfx: 'バチバチ! ZAP!' },
            grass:    { bg: 'bg-emerald-600', border: 'border-emerald-400', hex: '#34d399', glow: '#059669', sfx: 'ザシュッ! LEAF!' },
            ice:      { bg: 'bg-cyan-400 text-slate-950', border: 'border-cyan-300', hex: '#67e8f9', glow: '#06b6d4', sfx: 'パキーン! FREEZE!' },
            fighting: { bg: 'bg-red-700', border: 'border-red-500', hex: '#f87171', glow: '#dc2626', sfx: 'ドガァッ! SMASH!' },
            poison:   { bg: 'bg-purple-600', border: 'border-purple-400', hex: '#c084fc', glow: '#9333ea', sfx: 'ドロドロ! VENOM!' },
            ground:   { bg: 'bg-yellow-700', border: 'border-yellow-500', hex: '#fbbf24', glow: '#b45309', sfx: 'ゴゴゴ! QUAKE!' },
            flying:   { bg: 'bg-indigo-500', border: 'border-indigo-300', hex: '#818cf8', glow: '#4f46e5', sfx: 'ビュォォ! GALE!' },
            psychic:  { bg: 'bg-pink-600', border: 'border-pink-400', hex: '#f472b6', glow: '#db2777', sfx: 'キィィン! PSY!' },
            bug:      { bg: 'bg-lime-600', border: 'border-lime-400', hex: '#a3e635', glow: '#65a30d', sfx: 'ブーン! SWARM!' },
            rock:     { bg: 'bg-stone-600', border: 'border-stone-400', hex: '#d6d3d1', glow: '#78716c', sfx: 'ズガァン! CRASH!' },
            ghost:    { bg: 'bg-violet-800', border: 'border-violet-500', hex: '#a78bfa', glow: '#6d28d9', sfx: 'ゾクゾク! PHANTOM!' },
            dragon:   { bg: 'bg-indigo-700', border: 'border-indigo-400', hex: '#60a5fa', glow: '#4338ca', sfx: 'ギャオォ! ROAR!' },
            dark:     { bg: 'bg-neutral-800', border: 'border-neutral-500', hex: '#a3a3a3', glow: '#171717', sfx: 'ズバッ! SLASH!' },
            steel:    { bg: 'bg-slate-500', border: 'border-slate-300', hex: '#cbd5e1', glow: '#64748b', sfx: 'ガキィン! CLANG!' },
            fairy:    { bg: 'bg-rose-400 text-slate-950', border: 'border-rose-300', hex: '#fda4af', glow: '#e11d48', sfx: 'キラキラ! SHINE!' }
        };

        /**
         * ============================================================================
         * 3. RIVALRY 3v3 PRESET ROSTERS & SPATIAL ARCHETYPE CLASSIFIER
         * ============================================================================
         */
        export const RIVALRIES = {
            ash_gary: {
                playerTrainer: "ASH KETCHUM",
                enemyTrainer: "RIVAL GARY OAK",
                playerTeam: [
                    { id: 25,  name: 'pikachu',   moves: ['thunderbolt', 'electro-ball', 'volt-tackle', 'iron-tail'] },
                    { id: 6,   name: 'charizard', moves: ['flamethrower', 'dragon-claw', 'air-slash', 'overheat'] },
                    { id: 658, name: 'greninja',  moves: ['water-shuriken', 'hydro-pump', 'aerial-ace', 'night-slash'] }
                ],
                enemyTeam: [
                    { id: 9,   name: 'blastoise',  moves: ['hydro-pump', 'ice-beam', 'flash-cannon', 'skull-bash'] },
                    { id: 466, name: 'electivire', moves: ['thunderbolt', 'thunder-punch', 'ice-punch', 'earthquake'] },
                    { id: 212, name: 'scizor',     moves: ['bullet-punch', 'x-scissor', 'flash-cannon', 'air-slash'] }
                ]
            },
            ash_alain: {
                playerTrainer: "ASH (KALOS FINALS)",
                enemyTrainer: "ALAIN",
                playerTeam: [
                    { id: 658, name: 'greninja',  moves: ['water-shuriken', 'hydro-pump', 'aerial-ace', 'night-slash'] },
                    { id: 25,  name: 'pikachu',   moves: ['thunderbolt', 'quick-attack', 'iron-tail', 'electro-ball'] },
                    { id: 706, name: 'goodra',    moves: ['dragon-pulse', 'muddy-water', 'ice-beam', 'sludge-bomb'] }
                ],
                enemyTeam: [
                    { id: 6,   name: 'charizard', moves: ['blast-burn', 'dragon-claw', 'flamethrower', 'thunder-punch'] },
                    { id: 376, name: 'metagross', moves: ['meteor-mash', 'psychic', 'flash-cannon', 'earthquake'] },
                    { id: 248, name: 'tyranitar', moves: ['stone-edge', 'dark-pulse', 'crunch', 'earthquake'] }
                ]
            },
            red_cynthia: {
                playerTrainer: "CHAMPION RED",
                enemyTrainer: "CHAMPION CYNTHIA",
                playerTeam: [
                    { id: 6,   name: 'charizard', moves: ['flare-blitz', 'flamethrower', 'air-slash', 'dragon-pulse'] },
                    { id: 448, name: 'lucario',   moves: ['aura-sphere', 'close-combat', 'extreme-speed', 'flash-cannon'] },
                    { id: 131, name: 'lapras',    moves: ['ice-beam', 'surf', 'thunderbolt', 'psychic'] }
                ],
                enemyTeam: [
                    { id: 445, name: 'garchomp',  moves: ['dragon-rush', 'earthquake', 'flamethrower', 'stone-edge'] },
                    { id: 350, name: 'milotic',   moves: ['hydro-pump', 'ice-beam', 'surf', 'dragon-pulse'] },
                    { id: 468, name: 'togekiss',  moves: ['air-slash', 'aura-sphere', 'dazzling-gleam', 'flamethrower'] }
                ]
            },
            arceus_legends: {
                playerTrainer: "MYTHIC GUARDIAN",
                enemyTrainer: "OMEGA CHALLENGER",
                playerTeam: [
                    { id: 493, name: 'arceus',   moves: ['judgment', 'extreme-speed', 'shadow-force', 'earth-power'] },
                    { id: 483, name: 'dialga',   moves: ['roar-of-time', 'flash-cannon', 'aura-sphere', 'earth-power'] },
                    { id: 484, name: 'palkia',   moves: ['spacial-rend', 'hydro-pump', 'aura-sphere', 'thunderbolt'] }
                ],
                enemyTeam: [
                    { id: 384, name: 'rayquaza', moves: ['dragon-ascent', 'v-create', 'extreme-speed', 'draco-meteor'] },
                    { id: 150, name: 'mewtwo',   moves: ['psystrike', 'aura-sphere', 'shadow-ball', 'ice-beam'] },
                    { id: 487, name: 'giratina-altered', moves: ['shadow-force', 'dragon-pulse', 'aura-sphere', 'earth-power'] }
                ]
            },
            mythic_titans: {
                playerTrainer: "ANCIENT MASTER",
                enemyTrainer: "UNOVA & JOHTO LEGENDS",
                playerTeam: [
                    { id: 382, name: 'kyogre',   moves: ['origin-pulse', 'water-spout', 'ice-beam', 'thunder'] },
                    { id: 383, name: 'groudon',  moves: ['precipice-blades', 'eruption', 'stone-edge', 'solar-beam'] },
                    { id: 250, name: 'ho-oh',    moves: ['sacred-fire', 'brave-bird', 'earthquake', 'flare-blitz'] }
                ],
                enemyTeam: [
                    { id: 644, name: 'zekrom',   moves: ['bolt-strike', 'fusion-bolt', 'dragon-claw', 'stone-edge'] },
                    { id: 643, name: 'reshiram', moves: ['blue-flare', 'fusion-flare', 'draco-meteor', 'earth-power'] },
                    { id: 249, name: 'lugia',    moves: ['aeroblast', 'psychic', 'hydro-pump', 'ice-beam'] }
                ]
            }
        };

        export const SIGNATURE_MOVESETS = {
            // Mythical & Box Legendaries (Gen 1 - 9)
            '493': ['judgment', 'extreme-speed', 'shadow-force', 'earth-power'],
            'arceus': ['judgment', 'extreme-speed', 'shadow-force', 'earth-power'],
            '483': ['roar-of-time', 'flash-cannon', 'aura-sphere', 'earth-power'],
            'dialga': ['roar-of-time', 'flash-cannon', 'aura-sphere', 'earth-power'],
            '484': ['spacial-rend', 'hydro-pump', 'aura-sphere', 'thunderbolt'],
            'palkia': ['spacial-rend', 'hydro-pump', 'aura-sphere', 'thunderbolt'],
            '487': ['shadow-force', 'dragon-pulse', 'aura-sphere', 'earth-power'],
            'giratina': ['shadow-force', 'dragon-pulse', 'aura-sphere', 'earth-power'],
            'giratina-altered': ['shadow-force', 'dragon-pulse', 'aura-sphere', 'earth-power'],
            'giratina-origin': ['shadow-force', 'dragon-pulse', 'aura-sphere', 'earth-power'],
            '384': ['dragon-ascent', 'v-create', 'extreme-speed', 'draco-meteor'],
            'rayquaza': ['dragon-ascent', 'v-create', 'extreme-speed', 'draco-meteor'],
            '150': ['psystrike', 'aura-sphere', 'shadow-ball', 'ice-beam'],
            'mewtwo': ['psystrike', 'aura-sphere', 'shadow-ball', 'ice-beam'],
            '151': ['psystrike', 'aura-sphere', 'flamethrower', 'thunderbolt'],
            'mew': ['psystrike', 'aura-sphere', 'flamethrower', 'thunderbolt'],
            '249': ['aeroblast', 'psychic', 'hydro-pump', 'ice-beam'],
            'lugia': ['aeroblast', 'psychic', 'hydro-pump', 'ice-beam'],
            '250': ['sacred-fire', 'brave-bird', 'earthquake', 'flare-blitz'],
            'ho-oh': ['sacred-fire', 'brave-bird', 'earthquake', 'flare-blitz'],
            '382': ['origin-pulse', 'water-spout', 'ice-beam', 'thunder'],
            'kyogre': ['origin-pulse', 'water-spout', 'ice-beam', 'thunder'],
            '383': ['precipice-blades', 'eruption', 'stone-edge', 'solar-beam'],
            'groudon': ['precipice-blades', 'eruption', 'stone-edge', 'solar-beam'],
            '386': ['psycho-boost', 'extreme-speed', 'ice-beam', 'thunderbolt'],
            'deoxys': ['psycho-boost', 'extreme-speed', 'ice-beam', 'thunderbolt'],
            'deoxys-normal': ['psycho-boost', 'extreme-speed', 'ice-beam', 'thunderbolt'],
            '385': ['doom-desire', 'psychic', 'flash-cannon', 'thunderbolt'],
            'jirachi': ['doom-desire', 'psychic', 'flash-cannon', 'thunderbolt'],
            '381': ['luster-purge', 'draco-meteor', 'psychic', 'thunderbolt'],
            'latios': ['luster-purge', 'draco-meteor', 'psychic', 'thunderbolt'],
            '380': ['mist-ball', 'dragon-pulse', 'psychic', 'surf'],
            'latias': ['mist-ball', 'dragon-pulse', 'psychic', 'surf'],
            '491': ['dark-void', 'dark-pulse', 'sludge-bomb', 'ice-beam'],
            'darkrai': ['dark-void', 'dark-pulse', 'sludge-bomb', 'ice-beam'],
            '485': ['magma-storm', 'flash-cannon', 'earth-power', 'stone-edge'],
            'heatran': ['magma-storm', 'flash-cannon', 'earth-power', 'stone-edge'],
            '486': ['crush-grip', 'earthquake', 'ice-punch', 'stone-edge'],
            'regigigas': ['crush-grip', 'earthquake', 'ice-punch', 'stone-edge'],
            '492': ['seed-flare', 'air-slash', 'earth-power', 'dazzling-gleam'],
            'shaymin': ['seed-flare', 'air-slash', 'earth-power', 'dazzling-gleam'],
            'shaymin-land': ['seed-flare', 'air-slash', 'earth-power', 'dazzling-gleam'],
            '494': ['v-create', 'searing-shot', 'psychic', 'thunderbolt'],
            'victini': ['v-create', 'searing-shot', 'psychic', 'thunderbolt'],
            '643': ['blue-flare', 'fusion-flare', 'draco-meteor', 'earth-power'],
            'reshiram': ['blue-flare', 'fusion-flare', 'draco-meteor', 'earth-power'],
            '644': ['bolt-strike', 'fusion-bolt', 'dragon-claw', 'stone-edge'],
            'zekrom': ['bolt-strike', 'fusion-bolt', 'dragon-claw', 'stone-edge'],
            '646': ['glaciate', 'ice-beam', 'draco-meteor', 'earth-power'],
            'kyurem': ['glaciate', 'ice-beam', 'draco-meteor', 'earth-power'],
            '647': ['secret-sword', 'hydro-pump', 'air-slash', 'close-combat'],
            'keldeo': ['secret-sword', 'hydro-pump', 'air-slash', 'close-combat'],
            'keldeo-ordinary': ['secret-sword', 'hydro-pump', 'air-slash', 'close-combat'],
            '648': ['relic-song', 'psychic', 'close-combat', 'dazzling-gleam'],
            'meloetta': ['relic-song', 'psychic', 'close-combat', 'dazzling-gleam'],
            'meloetta-aria': ['relic-song', 'psychic', 'close-combat', 'dazzling-gleam'],
            '649': ['techno-blast', 'flash-cannon', 'flamethrower', 'extreme-speed'],
            'genesect': ['techno-blast', 'flash-cannon', 'flamethrower', 'extreme-speed'],
            '716': ['moonblast', 'dazzling-gleam', 'thunderbolt', 'psychic'],
            'xerneas': ['moonblast', 'dazzling-gleam', 'thunderbolt', 'psychic'],
            '717': ['oblivion-wing', 'dark-pulse', 'air-slash', 'dragon-pulse'],
            'yveltal': ['oblivion-wing', 'dark-pulse', 'air-slash', 'dragon-pulse'],
            '718': ['thousand-arrows', 'core-enforcer', 'extreme-speed', 'earthquake'],
            'zygarde': ['thousand-arrows', 'core-enforcer', 'extreme-speed', 'earthquake'],
            'zygarde-50': ['thousand-arrows', 'core-enforcer', 'extreme-speed', 'earthquake'],
            '791': ['sunsteel-strike', 'flare-blitz', 'earthquake', 'flash-cannon'],
            'solgaleo': ['sunsteel-strike', 'flare-blitz', 'earthquake', 'flash-cannon'],
            '792': ['moongeist-beam', 'psychic', 'moonblast', 'ice-beam'],
            'lunala': ['moongeist-beam', 'psychic', 'moonblast', 'ice-beam'],
            '800': ['photon-geyser', 'prismatic-laser', 'earth-power', 'dark-pulse'],
            'necrozma': ['photon-geyser', 'prismatic-laser', 'earth-power', 'dark-pulse'],
            '888': ['behemoth-blade', 'close-combat', 'wild-charge', 'crunch'],
            'zacian': ['behemoth-blade', 'close-combat', 'wild-charge', 'crunch'],
            '890': ['dynamax-cannon', 'sludge-bomb', 'flamethrower', 'draco-meteor'],
            'eternatus': ['dynamax-cannon', 'sludge-bomb', 'flamethrower', 'draco-meteor'],
            '1007': ['collision-course', 'flare-blitz', 'dragon-claw', 'close-combat'],
            'koraidon': ['collision-course', 'flare-blitz', 'dragon-claw', 'close-combat'],
            '1008': ['electro-drift', 'draco-meteor', 'overheat', 'dazzling-gleam'],
            'miraidon': ['electro-drift', 'draco-meteor', 'overheat', 'dazzling-gleam'],
            '144': ['ice-beam', 'hurricane', 'water-pulse', 'aerial-ace'],
            'articuno': ['ice-beam', 'hurricane', 'water-pulse', 'aerial-ace'],
            '145': ['thunderbolt', 'thunder', 'air-slash', 'heat-wave'],
            'zapdos': ['thunderbolt', 'thunder', 'air-slash', 'heat-wave'],
            '146': ['sacred-fire', 'flamethrower', 'air-slash', 'solar-beam'],
            'moltres': ['sacred-fire', 'flamethrower', 'air-slash', 'solar-beam'],
            '243': ['thunderbolt', 'aura-sphere', 'extreme-speed', 'shadow-ball'],
            'raikou': ['thunderbolt', 'aura-sphere', 'extreme-speed', 'shadow-ball'],
            '244': ['sacred-fire', 'flare-blitz', 'extreme-speed', 'stone-edge'],
            'entei': ['sacred-fire', 'flare-blitz', 'extreme-speed', 'stone-edge'],
            '245': ['hydro-pump', 'ice-beam', 'air-slash', 'surf'],
            'suicune': ['hydro-pump', 'ice-beam', 'air-slash', 'surf'],
            // Iconic Starters & Anime Aces
            '25': ['thunderbolt', 'electro-ball', 'volt-tackle', 'iron-tail'],
            'pikachu': ['thunderbolt', 'electro-ball', 'volt-tackle', 'iron-tail'],
            '6': ['blast-burn', 'flamethrower', 'dragon-claw', 'air-slash'],
            'charizard': ['blast-burn', 'flamethrower', 'dragon-claw', 'air-slash'],
            '9': ['hydro-cannon', 'hydro-pump', 'ice-beam', 'flash-cannon'],
            'blastoise': ['hydro-cannon', 'hydro-pump', 'ice-beam', 'flash-cannon'],
            '3': ['frenzy-plant', 'sludge-bomb', 'earth-power', 'solar-beam'],
            'venusaur': ['frenzy-plant', 'sludge-bomb', 'earth-power', 'solar-beam'],
            '658': ['water-shuriken', 'hydro-pump', 'aerial-ace', 'night-slash'],
            'greninja': ['water-shuriken', 'hydro-pump', 'aerial-ace', 'night-slash'],
            '448': ['aura-sphere', 'close-combat', 'extreme-speed', 'flash-cannon'],
            'lucario': ['aura-sphere', 'close-combat', 'extreme-speed', 'flash-cannon'],
            '445': ['dragon-rush', 'earthquake', 'stone-edge', 'flamethrower'],
            'garchomp': ['dragon-rush', 'earthquake', 'stone-edge', 'flamethrower'],
            '392': ['flare-blitz', 'close-combat', 'mach-punch', 'flamethrower'],
            'infernape': ['flare-blitz', 'close-combat', 'mach-punch', 'flamethrower'],
            '254': ['leaf-blade', 'frenzy-plant', 'dragon-pulse', 'aerial-ace'],
            'sceptile': ['leaf-blade', 'frenzy-plant', 'dragon-pulse', 'aerial-ace'],
            '257': ['blaze-kick', 'flare-blitz', 'close-combat', 'brave-bird'],
            'blaziken': ['blaze-kick', 'flare-blitz', 'close-combat', 'brave-bird'],
            '94': ['shadow-ball', 'sludge-bomb', 'dark-pulse', 'thunderbolt'],
            'gengar': ['shadow-ball', 'sludge-bomb', 'dark-pulse', 'thunderbolt']
        };

        // Classify any PokéAPI move into one of 4 spatial real-time action archetypes:
        // 'BEAM' (telegraphed piercing line laser), 'PROJECTILE' (homing/spread orbs), 'BLITZ' (melee dash slam), 'AOE' (radial shockwave)
        export function classifyMoveSpatialArchetype(slug, damageClass, type, power) {
            const s = slug.toLowerCase();
            const beamKeywords = [
                'beam', 'thunderbolt', 'flamethrower', 'hydro-pump', 'flash-cannon', 'dragon-pulse', 'dark-pulse',
                'jet', 'laser', 'thunder', 'roar-of-time', 'spacial-rend', 'aeroblast', 'psystrike', 'psycho-boost',
                'luster-purge', 'core-enforcer', 'moongeist-beam', 'photon-geyser', 'dynamax-cannon', 'techno-blast',
                'oblivion-wing', 'solar-beam', 'hydro-cannon'
            ];
            const aoeKeywords = [
                'earthquake', 'surf', 'overheat', 'blast-burn', 'discharge', 'muddy-water', 'dazzling-gleam',
                'psychic', 'sludge-wave', 'blizzard', 'hurricane', 'judgment', 'origin-pulse', 'water-spout',
                'precipice-blades', 'eruption', 'dark-void', 'magma-storm', 'seed-flare', 'glaciate', 'relic-song',
                'earth-power', 'draco-meteor', 'doom-desire', 'searing-shot', 'frenzy-plant'
            ];
            const projectileKeywords = [
                'ball', 'shuriken', 'slash', 'sphere', 'bomb', 'edge', 'gleam', 'fang', 'rock', 'icy-wind',
                'water-pulse', 'sacred-fire', 'blue-flare', 'fusion-flare', 'secret-sword', 'thousand-arrows',
                'mist-ball', 'moonblast'
            ];

            if (beamKeywords.some(k => s.includes(k))) return 'BEAM';
            if (aoeKeywords.some(k => s.includes(k))) return 'AOE';
            if (projectileKeywords.some(k => s.includes(k))) return 'PROJECTILE';
            if (damageClass === 'physical') return 'BLITZ';
            return power >= 90 ? 'BEAM' : 'PROJECTILE';
        }

        export const FALLBACK_MOVES = {
            // ==================== LEGENDARY & MYTHICAL SIGNATURE MOVES ====================
            'judgment':         { name: 'Judgment', type: 'normal', power: 130, accuracy: 100, pp: 10, damageClass: 'special', isSignature: true, multiShot: 3 },
            'roar-of-time':     { name: 'Roar of Time', type: 'dragon', power: 150, accuracy: 90, pp: 5, damageClass: 'special', isSignature: true },
            'spacial-rend':     { name: 'Spacial Rend', type: 'dragon', power: 115, accuracy: 95, pp: 5, damageClass: 'special', isSignature: true },
            'shadow-force':     { name: 'Shadow Force', type: 'ghost', power: 125, accuracy: 100, pp: 5, damageClass: 'physical', isSignature: true },
            'dragon-ascent':    { name: 'Dragon Ascent', type: 'flying', power: 125, accuracy: 100, pp: 5, damageClass: 'physical', isSignature: true },
            'v-create':         { name: 'V-create', type: 'fire', power: 150, accuracy: 95, pp: 5, damageClass: 'physical', ailment: 'BRN', ailmentChance: 30, isSignature: true },
            'psystrike':        { name: 'Psystrike', type: 'psychic', power: 115, accuracy: 100, pp: 10, damageClass: 'special', isSignature: true },
            'aeroblast':        { name: 'Aeroblast', type: 'flying', power: 110, accuracy: 95, pp: 5, damageClass: 'special', isSignature: true },
            'sacred-fire':      { name: 'Sacred Fire', type: 'fire', power: 110, accuracy: 95, pp: 5, damageClass: 'physical', ailment: 'BRN', ailmentChance: 50, multiShot: 3, isSignature: true },
            'origin-pulse':     { name: 'Origin Pulse', type: 'water', power: 120, accuracy: 85, pp: 10, damageClass: 'special', multiShot: 3, isSignature: true },
            'water-spout':      { name: 'Water Spout', type: 'water', power: 135, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'precipice-blades': { name: 'Precipice Blades', type: 'ground', power: 125, accuracy: 85, pp: 10, damageClass: 'physical', isSignature: true },
            'eruption':         { name: 'Eruption', type: 'fire', power: 135, accuracy: 100, pp: 5, damageClass: 'special', ailment: 'BRN', ailmentChance: 30, isSignature: true },
            'psycho-boost':     { name: 'Psycho Boost', type: 'psychic', power: 140, accuracy: 90, pp: 5, damageClass: 'special', isSignature: true },
            'doom-desire':      { name: 'Doom Desire', type: 'steel', power: 140, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'luster-purge':     { name: 'Luster Purge', type: 'psychic', power: 95, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'mist-ball':        { name: 'Mist Ball', type: 'psychic', power: 95, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'dark-void':        { name: 'Dark Void', type: 'dark', power: 95, accuracy: 90, pp: 10, damageClass: 'special', ailment: 'PAR', ailmentChance: 60, isSignature: true },
            'magma-storm':      { name: 'Magma Storm', type: 'fire', power: 115, accuracy: 85, pp: 5, damageClass: 'special', ailment: 'BRN', ailmentChance: 40, isSignature: true },
            'crush-grip':       { name: 'Crush Grip', type: 'normal', power: 120, accuracy: 100, pp: 5, damageClass: 'physical', isSignature: true },
            'seed-flare':       { name: 'Seed Flare', type: 'grass', power: 120, accuracy: 85, pp: 5, damageClass: 'special', isSignature: true },
            'searing-shot':     { name: 'Searing Shot', type: 'fire', power: 105, accuracy: 100, pp: 5, damageClass: 'special', ailment: 'BRN', ailmentChance: 35, isSignature: true },
            'blue-flare':       { name: 'Blue Flare', type: 'fire', power: 130, accuracy: 85, pp: 5, damageClass: 'special', ailment: 'BRN', ailmentChance: 30, isSignature: true },
            'fusion-flare':     { name: 'Fusion Flare', type: 'fire', power: 105, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'bolt-strike':      { name: 'Bolt Strike', type: 'electric', power: 130, accuracy: 85, pp: 5, damageClass: 'physical', ailment: 'PAR', ailmentChance: 30, isSignature: true },
            'fusion-bolt':      { name: 'Fusion Bolt', type: 'electric', power: 105, accuracy: 100, pp: 5, damageClass: 'physical', isSignature: true },
            'glaciate':         { name: 'Glaciate', type: 'ice', power: 95, accuracy: 95, pp: 10, damageClass: 'special', ailment: 'FRZ', ailmentChance: 30, isSignature: true },
            'secret-sword':     { name: 'Secret Sword', type: 'fighting', power: 95, accuracy: 100, pp: 10, damageClass: 'special', isSignature: true },
            'relic-song':       { name: 'Relic Song', type: 'normal', power: 95, accuracy: 100, pp: 10, damageClass: 'special', isSignature: true },
            'techno-blast':     { name: 'Techno Blast', type: 'steel', power: 120, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'oblivion-wing':    { name: 'Oblivion Wing', type: 'flying', power: 100, accuracy: 100, pp: 10, damageClass: 'special', isSignature: true },
            'thousand-arrows':  { name: 'Thousand Arrows', type: 'ground', power: 100, accuracy: 100, pp: 10, damageClass: 'physical', multiShot: 3, isSignature: true },
            'core-enforcer':    { name: 'Core Enforcer', type: 'dragon', power: 110, accuracy: 100, pp: 10, damageClass: 'special', isSignature: true },
            'sunsteel-strike':  { name: 'Sunsteel Strike', type: 'steel', power: 115, accuracy: 100, pp: 5, damageClass: 'physical', isSignature: true },
            'moongeist-beam':   { name: 'Moongeist Beam', type: 'ghost', power: 115, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'photon-geyser':    { name: 'Photon Geyser', type: 'psychic', power: 115, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'prismatic-laser':  { name: 'Prismatic Laser', type: 'psychic', power: 145, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'behemoth-blade':   { name: 'Behemoth Blade', type: 'steel', power: 120, accuracy: 100, pp: 5, damageClass: 'physical', isSignature: true },
            'dynamax-cannon':   { name: 'Dynamax Cannon', type: 'dragon', power: 120, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'collision-course': { name: 'Collision Course', type: 'fighting', power: 120, accuracy: 100, pp: 5, damageClass: 'physical', isSignature: true },
            'electro-drift':    { name: 'Electro Drift', type: 'electric', power: 120, accuracy: 100, pp: 5, damageClass: 'special', isSignature: true },
            'draco-meteor':     { name: 'Draco Meteor', type: 'dragon', power: 130, accuracy: 90, pp: 5, damageClass: 'special', isSignature: true },
            'earth-power':      { name: 'Earth Power', type: 'ground', power: 90, accuracy: 100, pp: 10, damageClass: 'special' },
            'shadow-ball':      { name: 'Shadow Ball', type: 'ghost', power: 85, accuracy: 100, pp: 15, damageClass: 'special' },
            'brave-bird':       { name: 'Brave Bird', type: 'flying', power: 120, accuracy: 100, pp: 15, damageClass: 'physical' },
            'thunder':          { name: 'Thunder', type: 'electric', power: 110, accuracy: 85, pp: 10, damageClass: 'special', ailment: 'PAR', ailmentChance: 30 },
            'solar-beam':       { name: 'Solar Beam', type: 'grass', power: 120, accuracy: 100, pp: 10, damageClass: 'special' },
            'moonblast':        { name: 'Moonblast', type: 'fairy', power: 95, accuracy: 100, pp: 15, damageClass: 'special' },
            'wild-charge':      { name: 'Wild Charge', type: 'electric', power: 90, accuracy: 100, pp: 15, damageClass: 'physical' },
            'hydro-cannon':     { name: 'Hydro Cannon', type: 'water', power: 135, accuracy: 90, pp: 5, damageClass: 'special', isSignature: true },
            'frenzy-plant':     { name: 'Frenzy Plant', type: 'grass', power: 135, accuracy: 90, pp: 5, damageClass: 'special', isSignature: true },
            'leaf-blade':       { name: 'Leaf Blade', type: 'grass', power: 90, accuracy: 100, pp: 15, damageClass: 'physical', isSignature: true },
            'blaze-kick':       { name: 'Blaze Kick', type: 'fire', power: 85, accuracy: 90, pp: 10, damageClass: 'physical', ailment: 'BRN', ailmentChance: 20 },
            'mach-punch':       { name: 'Mach Punch', type: 'fighting', power: 60, accuracy: 100, pp: 25, damageClass: 'physical' },
            'hurricane':        { name: 'Hurricane', type: 'flying', power: 110, accuracy: 85, pp: 10, damageClass: 'special' },
            'heat-wave':        { name: 'Heat Wave', type: 'fire', power: 95, accuracy: 90, pp: 10, damageClass: 'special', ailment: 'BRN', ailmentChance: 20 },
            'water-pulse':      { name: 'Water Pulse', type: 'water', power: 70, accuracy: 100, pp: 20, damageClass: 'special' },
            // ==================== STANDARD ICONIC MOVES ====================
            'thunderbolt':    { name: 'Thunderbolt', type: 'electric', power: 90, accuracy: 100, pp: 15, damageClass: 'special', ailment: 'PAR', ailmentChance: 15 },
            'electro-ball':   { name: 'Electro Ball', type: 'electric', power: 80, accuracy: 100, pp: 15, damageClass: 'special', multiShot: 1 },
            'volt-tackle':    { name: 'Volt Tackle', type: 'electric', power: 110, accuracy: 100, pp: 10, damageClass: 'physical', ailment: 'PAR', ailmentChance: 15 },
            'iron-tail':      { name: 'Iron Tail', type: 'steel', power: 100, accuracy: 85, pp: 15, damageClass: 'physical' },
            'quick-attack':   { name: 'Quick Attack', type: 'normal', power: 55, accuracy: 100, pp: 25, damageClass: 'physical' },
            'flamethrower':   { name: 'Flamethrower', type: 'fire', power: 90, accuracy: 100, pp: 15, damageClass: 'special', ailment: 'BRN', ailmentChance: 15 },
            'dragon-claw':    { name: 'Dragon Claw', type: 'dragon', power: 80, accuracy: 100, pp: 15, damageClass: 'physical' },
            'air-slash':      { name: 'Air Slash', type: 'flying', power: 75, accuracy: 95, pp: 15, damageClass: 'special', multiShot: 3 },
            'overheat':       { name: 'Overheat', type: 'fire', power: 115, accuracy: 90, pp: 5, damageClass: 'special', ailment: 'BRN', ailmentChance: 25 },
            'water-shuriken': { name: 'Water Shuriken', type: 'water', power: 75, accuracy: 100, pp: 20, damageClass: 'special', multiShot: 3 },
            'hydro-pump':     { name: 'Hydro Pump', type: 'water', power: 110, accuracy: 85, pp: 5, damageClass: 'special' },
            'aerial-ace':     { name: 'Aerial Ace', type: 'flying', power: 65, accuracy: 100, pp: 20, damageClass: 'physical' },
            'night-slash':    { name: 'Night Slash', type: 'dark', power: 75, accuracy: 100, pp: 15, damageClass: 'physical' },
            'ice-beam':       { name: 'Ice Beam', type: 'ice', power: 90, accuracy: 100, pp: 10, damageClass: 'special', ailment: 'FRZ', ailmentChance: 12 },
            'flash-cannon':   { name: 'Flash Cannon', type: 'steel', power: 80, accuracy: 100, pp: 10, damageClass: 'special' },
            'skull-bash':     { name: 'Skull Bash', type: 'normal', power: 100, accuracy: 100, pp: 10, damageClass: 'physical' },
            'thunder-punch':  { name: 'Thunder Punch', type: 'electric', power: 75, accuracy: 100, pp: 15, damageClass: 'physical', ailment: 'PAR', ailmentChance: 15 },
            'ice-punch':      { name: 'Ice Punch', type: 'ice', power: 75, accuracy: 100, pp: 15, damageClass: 'physical' },
            'earthquake':     { name: 'Earthquake', type: 'ground', power: 100, accuracy: 100, pp: 10, damageClass: 'physical' },
            'bullet-punch':   { name: 'Bullet Punch', type: 'steel', power: 60, accuracy: 100, pp: 25, damageClass: 'physical' },
            'x-scissor':      { name: 'X-Scissor', type: 'bug', power: 80, accuracy: 100, pp: 15, damageClass: 'physical' },
            'blast-burn':     { name: 'Blast Burn', type: 'fire', power: 125, accuracy: 90, pp: 5, damageClass: 'special', ailment: 'BRN', ailmentChance: 30 },
            'dragon-pulse':   { name: 'Dragon Pulse', type: 'dragon', power: 85, accuracy: 100, pp: 10, damageClass: 'special' },
            'muddy-water':    { name: 'Muddy Water', type: 'water', power: 90, accuracy: 85, pp: 10, damageClass: 'special' },
            'sludge-bomb':    { name: 'Sludge Bomb', type: 'poison', power: 90, accuracy: 100, pp: 10, damageClass: 'special', ailment: 'PSN', ailmentChance: 25 },
            'meteor-mash':    { name: 'Meteor Mash', type: 'steel', power: 90, accuracy: 90, pp: 10, damageClass: 'physical' },
            'psychic':        { name: 'Psychic', type: 'psychic', power: 90, accuracy: 100, pp: 10, damageClass: 'special' },
            'stone-edge':     { name: 'Stone Edge', type: 'rock', power: 100, accuracy: 80, pp: 5, damageClass: 'physical', multiShot: 3 },
            'dark-pulse':     { name: 'Dark Pulse', type: 'dark', power: 80, accuracy: 100, pp: 15, damageClass: 'special' },
            'crunch':         { name: 'Crunch', type: 'dark', power: 80, accuracy: 100, pp: 15, damageClass: 'physical' },
            'flare-blitz':    { name: 'Flare Blitz', type: 'fire', power: 115, accuracy: 100, pp: 10, damageClass: 'physical', ailment: 'BRN', ailmentChance: 20 },
            'aura-sphere':    { name: 'Aura Sphere', type: 'fighting', power: 85, accuracy: 100, pp: 20, damageClass: 'special' },
            'close-combat':   { name: 'Close Combat', type: 'fighting', power: 115, accuracy: 100, pp: 5, damageClass: 'physical' },
            'extreme-speed':  { name: 'Extreme Speed', type: 'normal', power: 80, accuracy: 100, pp: 5, damageClass: 'physical' },
            'surf':           { name: 'Surf', type: 'water', power: 90, accuracy: 100, pp: 15, damageClass: 'special' },
            'dragon-rush':    { name: 'Dragon Rush', type: 'dragon', power: 100, accuracy: 85, pp: 10, damageClass: 'physical' },
            'dazzling-gleam': { name: 'Dazzling Gleam', type: 'fairy', power: 80, accuracy: 100, pp: 10, damageClass: 'special' }
        };

