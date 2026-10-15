import React, { useEffect, useState } from 'react';
import HeaderBar from './components/HeaderBar.jsx';
import StadiumViewport from './components/StadiumViewport.jsx';
import TacticalDeck from './components/TacticalDeck.jsx';
import AnnouncerLog from './components/AnnouncerLog.jsx';
import StartMenuModal from './components/Modals/StartMenuModal.jsx';
import RosterModal from './components/Modals/RosterModal.jsx';
import HelpModal from './components/Modals/HelpModal.jsx';
import ResultModal from './components/Modals/ResultModal.jsx';
import { GameEngine } from './game/GameEngine.js';
import { SoundEngine } from './game/SoundEngine.js';
import PvpModal from './components/Modals/PvpModal.jsx';
import { pvpClient } from './game/PvpClient.js';

export default function App() {
    // Show start menu by default on initial launch
    const [isStartMenuOpen, setIsStartMenuOpen] = useState(true);
    const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [aimMode, setAimMode] = useState('auto');
    const [selectedRivalry, setSelectedRivalry] = useState('ash_gary');
    const [currentStadium, setCurrentStadium] = useState('grassy');
    const [battleError, setBattleError] = useState(null);
    const [pvpOpen, setPvpOpen] = useState(false);
    const [, setNetworkVersion] = useState(0);

    useEffect(() => {
        // Expose engines globally for dynamic HTML callbacks (e.g., generated moves deck buttons)
        window.GameEngine = GameEngine;
        window.SoundEngine = SoundEngine;

        // Initialize 2.5D Real-Time Action Engine
        GameEngine.init();
        pvpClient.restore(GameEngine);
        const onOnlineStart = () => { setIsStartMenuOpen(false); setPvpOpen(false); };
        const onOnlineLobby = () => setPvpOpen(true);
        const onOnlineLeave = () => { setPvpOpen(false); setIsStartMenuOpen(true); };
        const onNetwork = () => setNetworkVersion(n => n + 1);
        window.addEventListener('pvp:start', onOnlineStart); window.addEventListener('pvp:lobby', onOnlineLobby); window.addEventListener('pvp:leave', onOnlineLeave);
        window.addEventListener('pvp:open', onOnlineLobby);
        pvpClient.addEventListener('change', onNetwork);
        const onAimChange = e => setAimMode(e.detail);
        const onBattleStatus = e => setBattleError(e.detail.error);
        const onStadium = e => setCurrentStadium(e.detail);
        window.addEventListener('stadiumchange', onStadium);
        window.addEventListener('aimmodechange', onAimChange);
        window.addEventListener('battlestatus', onBattleStatus);

        return () => {
            window.removeEventListener('pvp:start', onOnlineStart); window.removeEventListener('pvp:lobby', onOnlineLobby); window.removeEventListener('pvp:leave', onOnlineLeave);
            window.removeEventListener('pvp:open', onOnlineLobby);
            pvpClient.removeEventListener('change', onNetwork);
            GameEngine.cleanup();
            window.removeEventListener('aimmodechange', onAimChange);
            window.removeEventListener('battlestatus', onBattleStatus);
            window.removeEventListener('stadiumchange', onStadium);
        };
    }, []);

    useEffect(() => {
        GameEngine.paused = isStartMenuOpen || isRosterModalOpen || isHelpModalOpen || pvpOpen;
        if (GameEngine.paused) GameEngine.clearInput();
    }, [isStartMenuOpen, isRosterModalOpen, isHelpModalOpen, pvpOpen]);

    const handleSelectStadium = (stadiumKey) => {
        setCurrentStadium(stadiumKey);
        GameEngine.setStadium(stadiumKey);
    };

    return (
        <div className="game-shell" data-stadium={currentStadium}>
            <HeaderBar
                onOpenPvp={() => setPvpOpen(true)} onlineActive={pvpClient.active}
                onOpenStartMenu={() => setIsStartMenuOpen(true)}
                onOpenRosterModal={() => setIsRosterModalOpen(true)}
                onOpenHelpModal={() => setIsHelpModalOpen(true)}
                soundEnabled={soundEnabled}
                setSoundEnabled={setSoundEnabled}
                aimMode={aimMode}
                setAimMode={setAimMode}
                selectedRivalry={selectedRivalry}
                setSelectedRivalry={setSelectedRivalry}
                currentStadium={currentStadium}
                onSelectStadium={handleSelectStadium}
            />

            <main className="arena-shell">
                {pvpClient.active && <div className="network-status" role="status">{pvpClient.status === 'reconnecting' || pvpClient.disconnected ? 'Connection interrupted · waiting for reconnect' : `ONLINE · ${pvpClient.room?.code || 'CONNECTING'} · ${pvpClient.ping} ms`}</div>}
                {battleError && (
                    <div role="alert" className="battle-error">
                        <span>{battleError} The previous battle is preserved; reopen Select Squad to try again.</span>
                        <button onClick={() => setBattleError(null)} aria-label="Dismiss loading error">×</button>
                    </div>
                )}
                <StadiumViewport />

                <TacticalDeck />
                <AnnouncerLog />
            </main>

            {/* Initial Launch & Team Selection Menu */}
            <PvpModal open={pvpOpen} onClose={() => setPvpOpen(false)} />
            <StartMenuModal
                isOpen={isStartMenuOpen}
                onClose={() => setIsStartMenuOpen(false)}
                currentStadium={currentStadium}
                onSelectStadium={handleSelectStadium}
            />

            <RosterModal
                isOpen={isRosterModalOpen}
                onClose={() => setIsRosterModalOpen(false)}
            />

            <HelpModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
            />

            <ResultModal
                selectedRivalry={selectedRivalry}
                onOpenStartMenu={() => setIsStartMenuOpen(true)}
            />
        </div>
    );
}
