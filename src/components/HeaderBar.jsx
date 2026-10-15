import React from 'react';
import { GameEngine } from '../game/GameEngine.js';
import { SoundEngine } from '../game/SoundEngine.js';
import { STADIUM_THEMES } from '../game/constants.js';

export default function HeaderBar({
    onOpenStartMenu, onOpenRosterModal, onOpenHelpModal, soundEnabled, setSoundEnabled,
    aimMode, setAimMode, selectedRivalry, setSelectedRivalry, currentStadium, onSelectStadium
}) {
    return (
        <header className="game-toolbar">
            <button className="game-brand" onClick={onOpenStartMenu} title="Open Pokemon & Stadium Select Menu">
                <span className="brand-pokeball" aria-hidden="true" /><strong>POKÉANIME</strong><small>STADIUM LEAGUE</small>
            </button>
            <nav className="toolbar-controls" aria-label="Game settings">
                <button className="toolbar-primary" onClick={onOpenStartMenu}>SELECT SQUAD</button>
                <label className="stadium-select-label"><i aria-hidden="true" className="fa-solid fa-earth-asia" />
                    <select id="stadiumSelect" aria-label="Stadium" value={currentStadium} onChange={e => onSelectStadium(e.target.value)}>
                        {Object.values(STADIUM_THEMES).map(theme => <option key={theme.id} value={theme.id}>{theme.shortName}</option>)}
                    </select>
                </label>
                <select id="rivalrySelect" aria-label="Match preset" className="toolbar-rivalry" value={selectedRivalry}
                    onChange={e => { setSelectedRivalry(e.target.value); GameEngine.initMatch(e.target.value); }}>
                    <option value="ash_gary">Ash vs. Gary</option><option value="ash_alain">Ash vs. Alain</option>
                    <option value="red_cynthia">Red vs. Cynthia</option><option value="arceus_legends">Creation Trio vs. Legends</option>
                    <option value="mythic_titans">Weather Titans vs. Tao Dragons</option>
                </select>
                <button id="aimModeBtn" className="toolbar-aim" title="Toggle cursor / auto aim [F]"
                    onClick={() => { GameEngine.toggleAimMode(); setAimMode(GameEngine.aimMode); }}>
                    <i aria-hidden="true" className="fa-solid fa-crosshairs" /><span id="aimModeText">{aimMode === 'cursor' ? 'AIM: CURSOR [F]' : 'AIM: AUTO-LOCK [F]'}</span>
                </button>
                <button onClick={onOpenRosterModal} title="Customize roster" aria-label="Customize roster"><i aria-hidden="true" className="fa-solid fa-dna" /></button>
                <button id="restartBtn" onClick={() => GameEngine.rematch()} title="Reset current teams" aria-label="Reset current teams"><i aria-hidden="true" className="fa-solid fa-rotate-right" /></button>
                <button id="soundToggleBtn" title="Toggle Sound & Cries" aria-label="Toggle sound"
                    onClick={() => { SoundEngine.enabled = !SoundEngine.enabled; setSoundEnabled(SoundEngine.enabled); }}>
                    <i aria-hidden="true" id="soundIcon" className={soundEnabled ? 'fa-solid fa-volume-high text-cyan-400' : 'fa-solid fa-volume-xmark text-slate-500'} />
                </button>
                <button id="mechanicsHelpBtn" onClick={onOpenHelpModal} title="Controls & Anime Tactics Guide" aria-label="Controls and help"><i aria-hidden="true" className="fa-solid fa-gamepad" /></button>
            </nav>
        </header>
    );
}

