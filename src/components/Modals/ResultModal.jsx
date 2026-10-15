import React from 'react';
import { GameEngine } from '../../game/GameEngine.js';

export default function ResultModal({ selectedRivalry, onOpenStartMenu }) {
    const handleRematch = () => {
        const modal = document.getElementById('resultModal');
        if (modal) modal.classList.add('hidden');
        GameEngine.rematch();
    };

    const handleOpenStartMenu = () => {
        const modal = document.getElementById('resultModal');
        if (modal) modal.classList.add('hidden');
        if (onOpenStartMenu) onOpenStartMenu();
    };

    return (
        <div id="resultModal" className="hidden fixed inset-0 bg-slate-950/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 border-2 border-yellow-400 rounded-2xl p-6 text-center shadow-[0_0_60px_rgba(250,204,21,0.3)]">
                <div id="resultTrophyIcon" className="text-5xl text-yellow-400 mb-3">
                    <i aria-hidden="true" className="fa-solid fa-trophy"></i>
                </div>
                <h2 id="resultTitle" className="font-anime-impact text-3xl text-white tracking-wider mb-1">VICTORY!</h2>
                <p id="resultSubtitle" className="text-sm text-slate-300 mb-5">Ash Ketchum triumphs in an unforgettable stadium showdown!</p>
                <div className="flex flex-col gap-2.5">
                    <button
                        id="rematchBtn"
                        onClick={handleRematch}
                        className="w-full bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-slate-950 font-black py-3 rounded-xl shadow-lg transition transform active:scale-95 cursor-pointer"
                    >
                        PLAY REMATCH
                    </button>
                    <button
                        onClick={handleOpenStartMenu}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-2.5 rounded-xl shadow transition transform active:scale-95 cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                        <i aria-hidden="true" className="fa-solid fa-users text-cyan-400"></i>
                        SELECT SQUAD &amp; ARENA
                    </button>
                </div>
            </div>
        </div>
    );
}
