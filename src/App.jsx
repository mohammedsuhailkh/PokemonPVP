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

    useEffect(() => {
        // Expose engines globally for dynamic HTML callbacks (e.g., generated moves deck buttons)
        window.GameEngine = GameEngine;
        window.SoundEngine = SoundEngine;

        // Initialize 2.5D Real-Time Action Engine
        GameEngine.init();
        const onAimChange = e => setAimMode(e.detail);
        const onBattleStatus = e => setBattleError(e.detail.error);
        window.addEventListener('aimmodechange', onAimChange);
        window.addEventListener('battlestatus', onBattleStatus);

        return () => {
            GameEngine.cleanup();
            window.removeEventListener('aimmodechange', onAimChange);
            window.removeEventListener('battlestatus', onBattleStatus);
        };
    }, []);

    useEffect(() => {
        GameEngine.paused = isStartMenuOpen || isRosterModalOpen || isHelpModalOpen;
        if (GameEngine.paused) GameEngine.clearInput();
    }, [isStartMenuOpen, isRosterModalOpen, isHelpModalOpen]);

    const handleSelectStadium = (stadiumKey) => {
        setCurrentStadium(stadiumKey);
        GameEngine.setStadium(stadiumKey);
    };

    return (
        <div className="game-shell" data-stadium={currentStadium}>
            <HeaderBar
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
