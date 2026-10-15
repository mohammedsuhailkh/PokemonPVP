import React, { useEffect, useRef, useState } from 'react';
import { pvpClient as client } from '../../game/PvpClient.js';

export default function PvpModal({ open, onClose }) {
    const [, refresh] = useState(0);
    const [name, setName] = useState('Trainer'); const [code, setCode] = useState('');
    const [team, setTeam] = useState([25, 6, 448]); const [stadium, setStadium] = useState('grassy');
    const [roster, setRoster] = useState([]); const [error, setError] = useState('');
    const [search, setSearch] = useState(''); const [slot, setSlot] = useState(0);
    const previousRoom = useRef(null);
    const teamSize = client.room?.teamSize || 3;
    const roomCode = client.room?.code;
    useEffect(() => { const update = () => refresh(n => n + 1); client.addEventListener('change', update); return () => client.removeEventListener('change', update); }, []);
    useEffect(() => { if (open && !roster.length) fetch('/api/pvp/catalog').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setRoster).catch(() => setError('PvP server unavailable. Start npm run server locally, or use the deployed game.')); }, [open, roster.length]);
    useEffect(() => {
        if (!roomCode) return;
        const serverTeam = client.room.players[client.side]?.team || [];
        const changedRoom = previousRoom.current !== roomCode;
        previousRoom.current = roomCode;
        setTeam(previous => [...new Set([...(changedRoom ? serverTeam : previous), ...serverTeam, ...roster.map(p => p.id)])].slice(0, teamSize));
        setSlot(0);
    }, [roomCode, teamSize, roster]);
    if (!open) return null;
    const inRoom = !!client.room, mine = client.room?.players[client.side];
    const locked = mine?.ready || client.room?.phase !== 'lobby';
    const query = search.trim().toLowerCase().replace(/^#/, '');
    const results = roster.filter(p => `${p.name} ${p.id} ${p.types.join(' ')}`.toLowerCase().includes(query));
    const choose = id => { setTeam(team.map((value, index) => index === slot ? id : value)); setSlot((slot + 1) % teamSize); };
    return <div className="pvp-overlay" role="dialog" aria-modal="true" aria-label="Online PvP room">
        <section className="pvp-panel">
            <h2>ONLINE PvP</h2><p>Private 3v3 or 6v6 battles · share a room code with a friend</p>
            {(client.error || error) && <p role="alert">{client.error || error}</p>}
            {!inRoom ? <>
                <label>Trainer name<input aria-label="Online trainer name" maxLength={24} value={name} onChange={e => setName(e.target.value)} /></label>
                <div className="pvp-actions"><button onClick={() => { client.game ||= window.GameEngine; client.connect({ type: 'create', name }); }}>CREATE ROOM</button></div>
                <label>Friend's room code<input aria-label="Room code" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} /></label>
                <button onClick={() => { client.game ||= window.GameEngine; client.connect({ type: 'join', name, code }); }}>JOIN ROOM</button>
            </> : <>
                <p>Room code: <strong className="pvp-code">{client.room.code}</strong></p>
                <p>{client.room.players.map((p, i) => p ? `${p.name}${i === client.side ? ' (you)' : ''}: ${!p.connected ? 'disconnected' : p.ready ? 'ready' : 'choosing team'}` : 'Waiting for a friend…').join(' · ')}</p>
                <label>Battle format<select aria-label="Online battle format" disabled={client.side !== 0 || client.room.phase !== 'lobby'} value={teamSize} onChange={e => client.send({ type: 'format', teamSize: Number(e.target.value) })}>
                    <option value={3}>3 Pokémon · 3v3</option><option value={6}>6 Pokémon · 6v6</option>
                </select></label>
                <p className="pvp-hint">{client.side === 0 ? 'Changing format resets both ready checks.' : 'The host chooses the format for both trainers.'} Defeat the entire opposing team to win.</p>
                <div className="pvp-team">{team.map((id, i) => <label key={i} className={slot === i ? 'pvp-slot is-selected' : 'pvp-slot'}>Pokémon {i + 1}<select aria-label={`Online Pokemon ${i + 1}`} disabled={locked} value={id} onFocus={() => setSlot(i)} onChange={e => setTeam(team.map((v, n) => n === i ? Number(e.target.value) : v))}>{roster.map(p => <option key={p.id} value={p.id} disabled={team.includes(p.id) && p.id !== id}>{p.name}</option>)}</select><button type="button" aria-label={`Search for slot ${i + 1}`} aria-pressed={slot === i} disabled={locked} onClick={() => setSlot(i)}>EDIT SLOT {i + 1}</button></label>)}</div>
                <label>Search Pokémon<input type="search" aria-label="Search online Pokémon" placeholder="Name, Pokédex number, or type" value={search} onChange={e => setSearch(e.target.value)} /></label>
                <p className="pvp-hint" role="status">{results.length} of {roster.length} Pokémon · choosing for slot {slot + 1}</p>
                <div className="pvp-roster" aria-label="Pokémon search results">{results.map(p => {
                    const selected = team.includes(p.id);
                    return <button type="button" key={p.id} disabled={locked || selected} aria-label={`Choose ${p.name}`} onClick={() => choose(p.id)}><strong>{p.name}</strong><span>#{p.id} · {p.types.join(' / ')}</span><small>{selected ? `IN SLOT ${team.indexOf(p.id) + 1}` : `ADD TO SLOT ${slot + 1}`}</small></button>;
                })}{!results.length && <p>No matches in the online roster. Try another name, number, or type.</p>}</div>
                <label>Stadium<select aria-label="Online stadium" disabled={client.side !== 0 || mine?.ready} value={client.side === 0 ? stadium : client.room.stadium} onChange={e => setStadium(e.target.value)}><option value="grassy">Grass turf</option><option value="rocky">Rocky canyon</option><option value="magma">Magma crater</option><option value="ice_water">Ice & water</option></select></label>
                <button disabled={locked || team.length !== teamSize || new Set(team).size !== teamSize || !roster.length} onClick={() => client.send({ type: 'ready', team, stadium })}>{mine?.ready ? 'WAITING FOR OPPONENT' : 'READY TO BATTLE'}</button>
            </>}
            <p role="status">{client.status === 'connecting' ? 'Connecting… The free server may need time to wake up.' : client.status === 'reconnecting' ? 'Reconnecting… Your battle pauses for up to 30 seconds.' : client.status === 'loading' ? 'Loading both teams…' : ''}</p>
            <div className="pvp-actions">{client.active && <button onClick={() => client.leave()}>LEAVE ONLINE ROOM</button>}<button onClick={onClose}>CLOSE</button></div>
        </section>
    </div>;
}
