import React, { useEffect, useState } from 'react';
import { pvpClient as client } from '../../game/PvpClient.js';

export default function PvpModal({ open, onClose }) {
    const [, refresh] = useState(0);
    const [name, setName] = useState('Trainer'); const [code, setCode] = useState('');
    const [team, setTeam] = useState([25, 6, 448]); const [stadium, setStadium] = useState('grassy');
    const [roster, setRoster] = useState([]); const [error, setError] = useState('');
    useEffect(() => { const update = () => refresh(n => n + 1); client.addEventListener('change', update); return () => client.removeEventListener('change', update); }, []);
    useEffect(() => { if (open && !roster.length) fetch('/api/pvp/catalog').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setRoster).catch(() => setError('PvP server unavailable. Start npm run server locally, or use the deployed game.')); }, [open, roster.length]);
    if (!open) return null;
    const inRoom = !!client.room, mine = client.room?.players[client.side];
    return <div className="pvp-overlay" role="dialog" aria-modal="true" aria-label="Online PvP room">
        <section className="pvp-panel">
            <h2>ONLINE PvP</h2><p>Private 3v3 battles · share a room code with a friend</p>
            {(client.error || error) && <p role="alert">{client.error || error}</p>}
            {!inRoom ? <>
                <label>Trainer name<input aria-label="Online trainer name" maxLength={24} value={name} onChange={e => setName(e.target.value)} /></label>
                <div className="pvp-actions"><button onClick={() => { client.game ||= window.GameEngine; client.connect({ type: 'create', name }); }}>CREATE ROOM</button></div>
                <label>Friend's room code<input aria-label="Room code" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} /></label>
                <button onClick={() => { client.game ||= window.GameEngine; client.connect({ type: 'join', name, code }); }}>JOIN ROOM</button>
            </> : <>
                <p>Room code: <strong className="pvp-code">{client.room.code}</strong></p>
                <p>{client.room.players.map((p, i) => p ? `${p.name}${i === client.side ? ' (you)' : ''}: ${!p.connected ? 'disconnected' : p.ready ? 'ready' : 'choosing team'}` : 'Waiting for a friend…').join(' · ')}</p>
                <div className="pvp-team">{team.map((id, i) => <label key={i}>Pokémon {i + 1}<select aria-label={`Online Pokemon ${i + 1}`} disabled={mine?.ready} value={id} onChange={e => setTeam(team.map((v, n) => n === i ? Number(e.target.value) : v))}>{roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}</div>
                <label>Stadium<select aria-label="Online stadium" disabled={client.side !== 0 || mine?.ready} value={client.side === 0 ? stadium : client.room.stadium} onChange={e => setStadium(e.target.value)}><option value="grassy">Grass turf</option><option value="rocky">Rocky canyon</option><option value="magma">Magma crater</option><option value="ice_water">Ice & water</option></select></label>
                <button disabled={mine?.ready || client.room.phase !== 'lobby'} onClick={() => client.send({ type: 'ready', team, stadium })}>{mine?.ready ? 'WAITING FOR OPPONENT' : 'READY TO BATTLE'}</button>
            </>}
            <p role="status">{client.status === 'connecting' ? 'Connecting… The free server may need time to wake up.' : client.status === 'reconnecting' ? 'Reconnecting… Your battle pauses for up to 30 seconds.' : client.status === 'loading' ? 'Loading both teams…' : ''}</p>
            <div className="pvp-actions">{client.active && <button onClick={() => client.leave()}>LEAVE ONLINE ROOM</button>}<button onClick={onClose}>CLOSE</button></div>
        </section>
    </div>;
}
