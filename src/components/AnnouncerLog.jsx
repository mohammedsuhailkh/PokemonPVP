import React from 'react';

export default function AnnouncerLog() {
    return (
        <details className="battle-log">
            <summary><i aria-hidden="true" className="fa-solid fa-comment-dots" /> BATTLE LOG</summary>
            <div className="battle-log-panel"><h3>Stadium commentary</h3><div id="announcerLog" role="log" aria-live="off" /></div>
        </details>
    );
}

