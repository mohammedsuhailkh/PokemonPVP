import React from 'react';
import { GameEngine } from '../game/GameEngine.js';

export default function TacticalDeck() {
    return (
        <section className="battle-dock" aria-label="Battle commands">
            <div className="dock-status-row">
                <div className="trainer-resources">
                    <div className="resource-meter"><span>STAMINA <b id="playerStaminaText">100%</b></span><div><i id="playerStaminaBar" /></div></div>
                    <div className="resource-meter resource-meter--bond"><span>BOND <b id="playerBondText">0%</b></span><div><i id="playerBondBar" /></div></div>
                </div>
                <div id="partySwitchBar" className="party-switch-bar" aria-label="Switch Pokémon" />
                <button id="overdriveBtn" className="overdrive-button" disabled onClick={() => GameEngine.activateOverdrive()}>
                    <i aria-hidden="true" className="fa-solid fa-burst" /><span id="overdriveBtnLabel">OVERDRIVE [R]</span>
                </button>
            </div>
            <div id="movesGrid" className="moves-grid" />
            <p id="attackFeedback" role="status" aria-live="polite">Choose a move. Close the distance for melee attacks.</p>
        </section>
    );
}

