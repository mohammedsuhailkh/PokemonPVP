import React from 'react';

export default function HelpModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div id="helpModal" className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h2 className="font-anime-impact text-xl text-yellow-400 tracking-wide">
                        <i aria-hidden="true" className="fa-solid fa-gamepad mr-2"></i>2.5D REAL-TIME ANIME STADIUM CONTROLS
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">
                        <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                    <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                        <h4 className="font-bold text-cyan-400 uppercase mb-1">
                            <i aria-hidden="true" className="fa-solid fa-keyboard mr-1"></i>1. Full Two-Handed Keyboard Controls
                        </h4>
                        <ul className="space-y-1">
                            <li><b>Move (360°):</b> <kbd className="px-1 bg-slate-950 rounded text-cyan-300">W A S D</kbd> or <kbd className="px-1 bg-slate-950 rounded text-cyan-300">Arrow Keys</kbd></li>
                            <li><b>Unleash Moves 1–4:</b> <kbd className="px-1 bg-slate-950 rounded text-yellow-300">1 2 3 4</kbd> or Arcade Keys <kbd className="px-1 bg-slate-950 rounded text-yellow-300">J K L U</kbd></li>
                            <li><b>Dodge Dash (i-Frames):</b> <kbd className="px-1 bg-slate-950 rounded text-cyan-300">SPACE</kbd> or <kbd className="px-1 bg-slate-950 rounded text-cyan-300">SHIFT</kbd></li>
                            <li><b>Counter-Shield / Guard:</b> <kbd className="px-1 bg-slate-950 rounded text-purple-300">E</kbd> (Counter) • Hold <kbd className="px-1 bg-slate-950 rounded text-amber-300">Q</kbd> (Guard)</li>
                            <li><b>Switch Pokémon / Overdrive:</b> <kbd className="px-1 bg-slate-950 rounded text-emerald-300">Z X C</kbd> or <kbd className="px-1 bg-slate-950 rounded text-emerald-300">TAB</kbd> • <kbd className="px-1 bg-slate-950 rounded text-amber-300">R</kbd> (Overdrive) • <kbd className="px-1 bg-slate-950 rounded text-cyan-300">F</kbd> (Aim Mode)</li>
                        </ul>
                    </div>

                    <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                        <h4 className="font-bold text-purple-400 uppercase mb-1">
                            <i aria-hidden="true" className="fa-solid fa-hurricane mr-1"></i>2. Counter-Shield [E] &amp; Guard [Q]
                        </h4>
                        <p>Press <b>E</b> for a brief Counter-Shield that intercepts incoming attacks. Powerful hits can break it. Hold <b>Q</b> or right-click to guard: damage falls by 65%, but holding guard and blocking hits drain stamina. An empty stamina bar causes a guard break and leaves you exposed.</p>
                    </div>

                    <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                        <h4 className="font-bold text-amber-400 uppercase mb-1">
                            <i aria-hidden="true" className="fa-solid fa-meteor mr-1"></i>3. Spatial Move Archetypes [1-4]
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li><b>BEAM:</b> Projects a warning laser before firing a massive arena-spanning beam you can physically sidestep!</li>
                            <li><b>ORB / BARRAGE:</b> Tracking or spread shots can clash with opposing attacks. Strong shots continue with reduced power.</li>
                            <li><b>BLITZ:</b> A limited-range rush that must make contact. Dodging a rush creates a recovery opening.</li>
                            <li><b>AOE WAVE:</b> Detonates an expanding 360° stadium shockwave.</li>
                        </ul>
                    </div>

                    <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                        <h4 className="font-bold text-emerald-400 uppercase mb-1">
                            <i aria-hidden="true" className="fa-solid fa-water mr-1"></i>4. Interactive Stadium Hazards
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li><b>Water + Electric:</b> Conductive water damages either team. Ground and Electric types resist the hazard.</li>
                            <li><b>Water + Ice:</b> Frozen patches reduce traction. Fire melts ice into water and steam; water cools burning ground.</li>
                            <li><b>Steam:</b> Obscures fighters from tracking and the AI's targeting.</li>
                            <li><b>Rock Pillars:</b> Block attacks and movement. Heavy moves, especially Iron Tail, break cover.</li>
                        </ul>
                    </div>
                    <div className="bg-slate-800/70 p-3 rounded-xl border border-cyan-700">
                        <h4 className="font-bold text-cyan-300 uppercase mb-1">5. Timing, Flight &amp; Bond</h4>
                        <p>The first 90 milliseconds of a dash are the perfect-dodge window. Attacks have visible charging and recovery; taking a hit interrupts charging. Flying types can hold <b>H</b> or the FLY button to ascend and avoid ground hazards, at a stamina cost. Release to land.</p>
                        <p className="mt-2">Earn bond through hits, dodges, counters, terrain combinations, breaking cover, and clashes. At 100%, press <b>R</b> for 12 seconds of Overdrive; your next move becomes a larger signature burst. Casting alone earns no bond.</p>
                    </div>
                    <div className="bg-slate-800/70 p-3 rounded-xl border border-amber-700">
                        <h4 className="font-bold text-amber-300 uppercase mb-1">6. Beam Clashes &amp; Move Resources</h4>
                        <p>Opposing beams in the same corridor clash. Hold guard to add pressure, or move away to disengage. Both fighters spend stamina during the contest. Moves spend PP, respect accuracy, and have separate cooldowns. If every move runs out of PP, use the last-resort Struggle rush; successful hits cause recoil. Switching preserves each fighter's resources; rematch restores the same selected teams.</p>
                    </div>
                </div>

                <p className="text-xs text-slate-400">Directional character animations: <a href="https://github.com/PMDCollab/SpriteCollab" target="_blank" rel="noreferrer">PMDCollab / SpriteCollab</a>. <a href="/pokemon-motion/credits.html" target="_blank" rel="noreferrer">Artist credits and asset terms</a>.</p>
                <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs px-5 py-2 rounded-lg transition"
                    >
                        RESUME STADIUM BATTLE!
                    </button>
                </div>
            </div>
        </div>
    );
}
