import React from 'react';
import { GameEngine } from '../game/GameEngine.js';

function FighterHud({ side, name }) {
    const player = side === 'player';
    return (
        <section className={'fighter-hud fighter-hud--' + side} aria-label={(player ? 'Your' : 'Opponent') + ' fighter status'}>
            <span className="hud-emblem" aria-hidden="true"><span /></span>
            <div className="fighter-hud-content">
                <div className="fighter-hud-title">
                    <strong id={side + 'NameHud'}>{name}</strong>
                    <span id={side + 'StatusHud'} className="hidden" />
                    <div id={side + 'PartyBalls'} className="party-dots" />
                </div>
                <div className="fighter-hud-health-row">
                    <div className="fighter-hud-health-track"><div id={side + 'HpBar'} className="fighter-hud-health-fill" /></div>
                    <span id={side + 'HpText'}>— / —</span>
                </div>
                <div className="fighter-hud-meta">
                    <span id={side + 'TrainerLabel'}>{player ? 'ASH KETCHUM (YOU)' : 'RIVAL GARY OAK'}</span>
                    <div id={side + 'TypesHud'} />
                </div>
                {!player && <div className="hud-opponent-stamina"><div id="enemyStaminaBar" /></div>}
            </div>
            {!player && <span className="sr-only" id="enemyStaminaText">100%</span>}
            {!player && <span className="sr-only" id="enemyAiStateBadge">AI: APPROACH</span>}
            {player && <span className="sr-only">Speed <b id="playerSpeedStat" /> Attack <b id="playerAtkStat" /></span>}
        </section>
    );
}

export default function StadiumViewport() {
    return (
        <div id="arenaViewport" className="arena-viewport">
            <canvas id="stadiumCanvas" className="arena-canvas" aria-label="Battlefield" />
            <div id="spriteStageLayer" className="sprite-stage">
                <div id="playerActor" className="world-sprite-actor"><img id="playerSpriteImg" src="" alt="Player" /></div>
                <div id="enemyActor" className="world-sprite-actor"><img id="enemySpriteImg" src="" alt="Enemy" /></div>
            </div>
            <canvas id="moveEffectsCanvas" className="move-effects-canvas" aria-hidden="true" />
            <div id="speedLinesOverlay" className="speed-lines arena-speed-lines" />
            <div id="perfectDodgeFlash" className="arena-dodge-flash" />
            <FighterHud side="player" name="PIKACHU" />
            <FighterHud side="enemy" name="BLASTOISE" />
            <div className="match-clock"><span className="live-dot" /><span id="matchClockHud">00:00</span></div>
            <div id="animeCalloutBanner" className="hidden anime-callout" aria-live="off">
                <div id="animeCalloutBg"><span id="animeCalloutSub" /><strong id="animeCalloutMain" /></div>
            </div>
            <div className="touch-movement">
                <div id="virtualJoystickZone" className="virtual-joystick" aria-label="Drag to move">
                    <div className="joystick-guide" /><div id="joystickKnob" />
                </div><span>MOVE</span>
            </div>
            <div className="arena-actions" aria-label="Defensive controls">
                <button id="btnFly" title="Flying types: hold H or this button to ascend"
                    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); GameEngine.flyHeld = GameEngine.canCommand(); }}
                    onPointerUp={() => { GameEngine.flyHeld = false; }} onPointerCancel={() => { GameEngine.flyHeld = false; }}>
                    <i aria-hidden="true" className="fa-solid fa-feather" /><span>FLY <kbd>H</kbd></span>
                </button>
                <button id="btnGuard" title="Hold to guard"
                    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); GameEngine.setGuard(true); }}
                    onPointerUp={() => GameEngine.setGuard(false)} onPointerCancel={() => GameEngine.setGuard(false)}>
                    <i aria-hidden="true" className="fa-solid fa-shield-halved" /><span>GUARD <kbd id="keyVis_Q">Q</kbd></span>
                </button>
                <button id="btnCounterShield" onClick={() => GameEngine.triggerCounterShield()} title="Counter-shield [E]">
                    <i aria-hidden="true" className="fa-solid fa-hurricane" /><span>COUNTER <kbd id="keyVis_E">E</kbd></span>
                </button>
                <button id="btnDodgeDash" onClick={() => GameEngine.triggerDodgeDash()} title="Dodge [Space]">
                    <i aria-hidden="true" className="fa-solid fa-wind" /><span>DODGE <kbd id="keyVis_SPACE">SPACE</kbd></span>
                </button>
            </div>
            <span id="fieldStatusSummary" className="stadium-caption">INDIGO GRASS COLOSSEUM</span>
            <span className="keyboard-hint">WASD / ARROWS · MOVE &nbsp; 1–4 · ATTACK &nbsp; SPACE · DODGE</span>
            <div id="loadingOverlay" className="arena-loading">
                <span className="loading-pokeball" /><strong>PREPARING THE STADIUM</strong>
                <span>Loading fighters and move animations…</span>
            </div>
        </div>
    );
}

