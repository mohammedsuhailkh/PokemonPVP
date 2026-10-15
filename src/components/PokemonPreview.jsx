import React, { useEffect, useState } from 'react';

const previewCache = new Map();

export default function PokemonPreview({ query }) {
    const key = query.trim().toLowerCase();
    const [result, setResult] = useState(null);
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setResult(null);
        setImageFailed(false);
        if (!key) return;
        const controller = new AbortController();
        let active = true;
        const timer = setTimeout(async () => {
            try {
                let pokemon = previewCache.get(key);
                if (!pokemon) {
                    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(key)}`, { signal: controller.signal });
                    if (!response.ok) throw new Error(response.status === 404 ? 'Pokémon not found' : 'Preview unavailable');
                    const data = await response.json();
                    pokemon = {
                        name: data.name,
                        sprite: data.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default ||
                            data.sprites?.other?.showdown?.front_default || data.sprites?.front_default
                    };
                    previewCache.set(key, pokemon);
                }
                if (active) setResult({ key, ...pokemon });
            } catch (error) {
                if (active && error.name !== 'AbortError') setResult({ key, error: error.message === 'Pokémon not found' ? error.message : 'Preview unavailable' });
            }
        }, 300);
        return () => { active = false; clearTimeout(timer); controller.abort(); };
    }, [key]);

    const current = result?.key === key ? result : null;
    const message = !key ? 'Enter a name or ID' : current?.error || (imageFailed || (current && !current.sprite) ? 'No preview image' : 'Loading…');
    return (
        <span className="w-14 h-14 my-1 flex items-center justify-center" aria-live="polite">
            {current?.sprite && !imageFailed ? (
                <img src={current.sprite} alt={current.name} className="w-14 h-14 object-contain sprite-pixelated" onError={() => setImageFailed(true)} />
            ) : <span className="text-[9px] text-slate-400">{message}</span>}
        </span>
    );
}
