import React, { useState } from 'react';
import { GameEngine } from '../../game/GameEngine.js';

export default function RosterModal({ isOpen, onClose }) {
    const [p1, setP1] = useState('pikachu');
    const [p2, setP2] = useState('charizard');
    const [p3, setP3] = useState('lucario');
    const [e1, setE1] = useState('blastoise');
    const [e2, setE2] = useState('electivire');
    const [e3, setE3] = useState('garchomp');

    const handlePreset = (pList, eList) => {
        setP1(pList[0]);
        setP2(pList[1]);
        setP3(pList[2]);
        setE1(eList[0]);
        setE2(eList[1]);
        setE3(eList[2]);
    };

    const handleLaunch = async () => {
        onClose();
        await GameEngine.initMatch('custom', {
            playerTrainer: 'CUSTOM TRAINER',
            enemyTrainer: 'CUSTOM RIVAL',
            playerTeam: [{ name: p1.trim() || 'pikachu' }, { name: p2.trim() || 'charizard' }, { name: p3.trim() || 'lucario' }],
            enemyTeam: [{ name: e1.trim() || 'blastoise' }, { name: e2.trim() || 'electivire' }, { name: e3.trim() || 'garchomp' }]
        });
    };

    if (!isOpen) return null;

    return (
        <div id="rosterModal" className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-slate-900 border-2 border-indigo-500 rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h2 className="font-anime-impact text-lg sm:text-xl text-indigo-400 tracking-wide">
                        <i aria-hidden="true" className="fa-solid fa-dna mr-2"></i>LIVE POKÉAPI SQUAD CUSTOMIZER
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">
                        <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <p className="text-xs text-slate-300">
                    Enter any Pokémon name or National Dex ID (every Legendary &amp; Mythical Pokémon automatically loads its authentic <b>★ Signature Moveset</b>, e.g. <code className="text-yellow-300">arceus</code>, <code className="text-yellow-300">dialga</code>, <code className="text-yellow-300">palkia</code>, <code className="text-yellow-300">giratina</code>, <code className="text-yellow-300">rayquaza</code>, <code className="text-yellow-300">mewtwo</code>, <code className="text-yellow-300">kyogre</code>, <code className="text-yellow-300">groudon</code>, <code className="text-yellow-300">zekrom</code>, <code className="text-yellow-300">reshiram</code>, <code className="text-yellow-300">darkrai</code>):
                </p>

                {/* Quick-Fill Legendary Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-black uppercase text-amber-400 mr-1">
                        <i aria-hidden="true" className="fa-solid fa-crown mr-1"></i>Quick Presets:
                    </span>
                    <button
                        type="button"
                        onClick={() => handlePreset(['arceus', 'dialga', 'palkia'], ['rayquaza', 'mewtwo', 'giratina'])}
                        className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-[10px] font-bold text-amber-300 transition"
                    >
                        ★ Arceus Creation Trio vs. Mega Legends
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePreset(['kyogre', 'groudon', 'ho-oh'], ['zekrom', 'reshiram', 'lugia'])}
                        className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-[10px] font-bold text-cyan-300 transition"
                    >
                        ★ Weather &amp; Tao Dragons
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePreset(['darkrai', 'deoxys', 'victini'], ['genesect', 'keldeo', 'shaymin'])}
                        className="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-[10px] font-bold text-purple-300 transition"
                    >
                        ★ Mythical Showdown
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-800/70 p-3 rounded-xl border border-cyan-500/40 space-y-2">
                        <h4 className="text-xs font-black uppercase text-cyan-400">YOUR 3v3 SQUAD</h4>
                        <input
                            id="customP1"
                            type="text"
                            value={p1}
                            onChange={(e) => setP1(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                            placeholder="Slot 1 Pokémon"
                        />
                        <input
                            id="customP2"
                            type="text"
                            value={p2}
                            onChange={(e) => setP2(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                            placeholder="Slot 2 Pokémon"
                        />
                        <input
                            id="customP3"
                            type="text"
                            value={p3}
                            onChange={(e) => setP3(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                            placeholder="Slot 3 Pokémon"
                        />
                    </div>

                    <div className="bg-slate-800/70 p-3 rounded-xl border border-red-500/40 space-y-2">
                        <h4 className="text-xs font-black uppercase text-red-400">OPPONENT 3v3 SQUAD</h4>
                        <input
                            id="customE1"
                            type="text"
                            value={e1}
                            onChange={(e) => setE1(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                            placeholder="Enemy 1 Pokémon"
                        />
                        <input
                            id="customE2"
                            type="text"
                            value={e2}
                            onChange={(e) => setE2(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                            placeholder="Enemy 2 Pokémon"
                        />
                        <input
                            id="customE3"
                            type="text"
                            value={e3}
                            onChange={(e) => setE3(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                            placeholder="Enemy 3 Pokémon"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleLaunch}
                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-lg transition"
                    >
                        FETCH FROM POKÉAPI &amp; LAUNCH!
                    </button>
                </div>
            </div>
        </div>
    );
}
