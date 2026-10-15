import React, { useState } from 'react';
import { GameEngine } from '../../game/GameEngine.js';
import { STADIUM_THEMES } from '../../game/constants.js';
import PokemonPreview from '../PokemonPreview.jsx';

const QUICK_ROSTER = [
    { name: 'pikachu', id: 25, type: 'electric' },
    { name: 'charizard', id: 6, type: 'fire' },
    { name: 'lucario', id: 448, type: 'fighting' },
    { name: 'greninja', id: 658, type: 'water' },
    { name: 'garchomp', id: 445, type: 'dragon' },
    { name: 'mewtwo', id: 150, type: 'psychic' },
    { name: 'snorlax', id: 143, type: 'normal' },
    { name: 'rayquaza', id: 384, type: 'flying' }
];

const PRESET_OPPONENTS = [
    { id: 'gary', name: 'Rival Gary Oak', team: ['blastoise', 'electivire', 'garchomp'] },
    { id: 'cynthia', name: 'Champion Cynthia', team: ['garchomp', 'lucario', 'milotic'] },
    { id: 'alain', name: 'Alain (Kalos League)', team: ['charizard', 'tyranitar', 'metagross'] },
    { id: 'legends', name: 'Creation Trio', team: ['dialga', 'palkia', 'giratina'] },
    { id: 'titans', name: 'Weather Titans', team: ['kyogre', 'groudon', 'rayquaza'] }
];

export default function StartMenuModal({ isOpen, onClose, currentStadium, onSelectStadium }) {
    const [p1, setP1] = useState('pikachu');
    const [p2, setP2] = useState('charizard');
    const [p3, setP3] = useState('lucario');
    const [activeSlot, setActiveSlot] = useState(0);

    const [oppPreset, setOppPreset] = useState('gary');
    const [e1, setE1] = useState('blastoise');
    const [e2, setE2] = useState('electivire');
    const [e3, setE3] = useState('garchomp');

    const [selectedStadium, setSelectedStadium] = useState(currentStadium || 'grassy');

    const handleQuickPick = (pkName) => {
        if (activeSlot === 0) setP1(pkName);
        else if (activeSlot === 1) setP2(pkName);
        else setP3(pkName);
        setActiveSlot((prev) => (prev + 1) % 3);
    };

    const handleOpponentPresetChange = (presetId) => {
        setOppPreset(presetId);
        const preset = PRESET_OPPONENTS.find(p => p.id === presetId);
        if (preset) {
            setE1(preset.team[0]);
            setE2(preset.team[1]);
            setE3(preset.team[2]);
        }
    };

    const handleStartBattle = async () => {
        const resModal = document.getElementById('resultModal');
        if (resModal) resModal.classList.add('hidden');
        onSelectStadium(selectedStadium);
        onClose();

        const opp = PRESET_OPPONENTS.find(p => p.id === oppPreset);
        await GameEngine.initMatch('custom', {
            playerTrainer: 'ASH KETCHUM',
            enemyTrainer: opp ? opp.name.toUpperCase() : 'RIVAL TRAINER',
            playerTeam: [
                { name: p1.trim() || 'pikachu' },
                { name: p2.trim() || 'charizard' },
                { name: p3.trim() || 'lucario' }
            ],
            enemyTeam: [
                { name: e1.trim() || 'blastoise' },
                { name: e2.trim() || 'electivire' },
                { name: e3.trim() || 'garchomp' }
            ]
        });
    };

    const handleTrainingBattle = async () => {
        onSelectStadium('grassy');
        onClose();
        await GameEngine.initMatch('custom', {
            playerTrainer: 'ASH KETCHUM', enemyTrainer: 'RIVAL GARY OAK',
            playerTeam: [{ name: 'pikachu', moves: ['thunderbolt', 'electro-ball', 'iron-tail'] }],
            enemyTeam: [{ name: 'blastoise', moves: ['hydro-pump', 'ice-beam', 'skull-bash'] }]
        });
    };

    if (!isOpen) return null;

    const playerTeamList = [p1, p2, p3];

    return (
        <div id="startMenuModal" className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="max-w-4xl w-full bg-slate-900 border-2 border-yellow-400 rounded-3xl p-4 sm:p-6 shadow-[0_0_80px_rgba(250,204,21,0.25)] space-y-4 my-auto">
                {/* Header Title */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-amber-400 p-0.5 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                            <i aria-hidden="true" className="fa-solid fa-gamepad text-slate-950 text-sm"></i>
                        </div>
                        <div>
                            <h2 className="font-anime-impact text-lg sm:text-2xl text-white tracking-wide">
                                BATTLE PREPARATION &amp; ARENA SELECTION
                            </h2>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                Choose your 3v3 team, select opponent, and pick stadium terrain
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close squad selection" className="text-slate-400 hover:text-white text-xl px-2 py-1 transition">
                        <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* LEFT COLUMN: PLAYER TEAM ROSTER (7 COLS) */}
                    <div className="lg:col-span-7 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1.5">
                                <i aria-hidden="true" className="fa-solid fa-crown text-amber-400"></i>1. CHOOSE YOUR 3 SQUAD POKÉMON
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                                Tap slot to replace
                            </span>
                        </div>

                        {/* Selected 3 Active Slots */}
                        <div className="grid grid-cols-3 gap-2">
                            {playerTeamList.map((pk, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setActiveSlot(idx)}
                                    className={`relative p-2.5 rounded-2xl border-2 transition flex flex-col items-center justify-center text-center ${
                                        activeSlot === idx
                                            ? 'bg-cyan-950/70 border-cyan-400 shadow-lg shadow-cyan-500/30'
                                            : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                                    }`}
                                >
                                    <span className="absolute top-1.5 left-2 text-[9px] font-black uppercase px-1 rounded bg-slate-950/80 text-cyan-300">
                                        Slot {idx + 1}
                                    </span>
                                    <PokemonPreview query={pk} />
                                    <span className="font-extrabold text-xs uppercase text-white truncate max-w-full">
                                        {pk}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Quick Selection Hero Pokémon Cards */}
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">
                                Quick Select (Tap to place into active Slot {activeSlot + 1}):
                            </span>
                            <div className="grid grid-cols-4 gap-1.5">
                                {QUICK_ROSTER.map((pk) => (
                                    <button
                                        key={pk.name}
                                        type="button"
                                        onClick={() => handleQuickPick(pk.name)}
                                        className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700 hover:border-cyan-400/80 flex flex-col items-center justify-center transition group active:scale-95"
                                    >
                                        <img
                                            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pk.id}.gif`}
                                            alt={pk.name}
                                            className="w-10 h-10 object-contain sprite-pixelated"
                                        />
                                        <span className="text-[10px] font-bold uppercase text-slate-200 mt-1 truncate">
                                            {pk.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Input for any Dex Pokemon */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                            <div>
                                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Slot 1 Name/ID</label>
                                <input
                                    type="text"
                                    value={p1}
                                    onChange={(e) => setP1(e.target.value.toLowerCase())}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Slot 2 Name/ID</label>
                                <input
                                    type="text"
                                    value={p2}
                                    onChange={(e) => setP2(e.target.value.toLowerCase())}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Slot 3 Name/ID</label>
                                <input
                                    type="text"
                                    value={p3}
                                    onChange={(e) => setP3(e.target.value.toLowerCase())}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: OPPONENT & STADIUM TERRAIN (5 COLS) */}
                    <div className="lg:col-span-5 space-y-3">
                        {/* Opponent Presets */}
                        <div>
                            <span className="text-xs font-black uppercase text-red-400 flex items-center gap-1.5 mb-1.5">
                                <i aria-hidden="true" className="fa-solid fa-skull"></i>2. CHOOSE OPPONENT RIVAL
                            </span>
                            <div className="grid grid-cols-1 gap-1">
                                {PRESET_OPPONENTS.map((opp) => (
                                    <button
                                        key={opp.id}
                                        type="button"
                                        onClick={() => handleOpponentPresetChange(opp.id)}
                                        className={`px-3 py-1.5 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                                            oppPreset === opp.id
                                                ? 'bg-red-950/70 border-red-500 text-white shadow-md shadow-red-500/20'
                                                : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 text-slate-300'
                                        }`}
                                    >
                                        <span>{opp.name}</span>
                                        <span className="text-[9px] uppercase text-slate-400 font-mono">
                                            {opp.team.join(' • ')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* STADIUM GROUND SELECTOR */}
                        <div>
                            <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5 mb-1.5">
                                <i aria-hidden="true" className="fa-solid fa-earth-americas"></i>3. SELECT STADIUM GROUND TERRAIN
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(STADIUM_THEMES).map((theme) => (
                                    <button
                                        key={theme.id}
                                        type="button"
                                        onClick={() => setSelectedStadium(theme.id)}
                                        className={`relative overflow-hidden rounded-2xl border-2 transition group flex flex-col justify-end p-2 h-20 text-left ${
                                            selectedStadium === theme.id
                                                ? 'border-yellow-400 shadow-lg shadow-yellow-500/30 ring-2 ring-yellow-400/40'
                                                : 'border-slate-700 hover:border-slate-500'
                                        }`}
                                    >
                                        <img
                                            src={theme.image}
                                            alt={theme.name}
                                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                                        <div className="relative z-10">
                                            <span className="font-anime-impact text-[11px] text-white tracking-wide block leading-none">
                                                {theme.shortName}
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-300 block truncate mt-0.5">
                                                {theme.tagline}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <i aria-hidden="true" className="fa-solid fa-circle-info text-cyan-400"></i>
                        <span>Controls: <kbd className="bg-slate-800 px-1 rounded text-cyan-300">WASD</kbd> Move • <kbd className="bg-slate-800 px-1 rounded text-yellow-300">1-4</kbd> Moves • <kbd className="bg-slate-800 px-1 rounded text-white">SPACE</kbd> Dodge • <kbd className="bg-slate-800 px-1 rounded text-purple-300">E</kbd> Counter</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleTrainingBattle}
                            className="px-3 py-2 rounded-xl bg-cyan-950 border border-cyan-500 text-xs font-bold text-cyan-200 hover:bg-cyan-900"
                        >
                            PIKACHU vs BLASTOISE · TRAINING DUEL
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
                        >
                            CLOSE
                        </button>
                        <button
                            type="button"
                            onClick={handleStartBattle}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl shadow-yellow-500/25 transition transform active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                            <i aria-hidden="true" className="fa-solid fa-play"></i>
                            <span>ENTER STADIUM &amp; BATTLE!</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
