"""Import selected SpriteCollab sheets, metadata and author credits at a fixed revision."""
import concurrent.futures
import json
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

REVISION = 'e7868e9a7f6b931d1fb826756a490d4633879d03'
BASE = f'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/{REVISION}/'
ROOT = Path(__file__).resolve().parents[1] / 'public' / 'pokemon-motion'
NAMES = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Hop', 'Cringe', 'Faint', 'Sleep']
IDS = [6, 9, 25, 131, 143, 150, 212, 248, 249, 250, 350, 376, 382, 383, 384,
       445, 448, 466, 468, 483, 484, 487, 493, 643, 644, 658, 706]

def get(path):
    with urllib.request.urlopen(BASE + path, timeout=25) as response:
        return response.read()

def import_species(number):
    folder = f'{number:04d}'
    target = ROOT / folder
    target.mkdir(parents=True, exist_ok=True)
    try:
        xml = (target / 'AnimData.xml').read_bytes() if (target / 'AnimData.xml').exists() else get(f'sprite/{folder}/AnimData.xml')
        tree = ET.fromstring(xml)
        animations = {a.findtext('Name'): a for a in tree.findall('./Anims/Anim')}
        sources = set()
        for name in NAMES:
            anim = animations.get(name)
            seen = set()
            while anim is not None and anim.findtext('CopyOf'):
                alias = anim.findtext('CopyOf')
                if alias in seen:
                    anim = None
                    break
                seen.add(alias)
                anim = animations.get(alias)
            if anim is not None:
                sources.add(anim.findtext('Name'))
        for name in sources:
            for suffix in ['Anim', 'Offsets']:
                path = target / f'{name}-{suffix}.png'
                if not path.exists():
                    path.write_bytes(get(f'sprite/{folder}/{name}-{suffix}.png'))
        (target / 'credits.txt').write_bytes(get(f'sprite/{folder}/credits.txt'))
        (target / 'AnimData.xml').write_bytes(xml)
        return folder
    except Exception as error:
        print(f'{folder}: {error}', flush=True)
        return None

if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'LICENSE.md').write_bytes(get('LICENSE.md'))
    (ROOT / 'credit_names.txt').write_bytes(get('credit_names.txt'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        available = list(filter(None, pool.map(import_species, IDS)))
    (ROOT / 'bundled.json').write_text(json.dumps({'revision': REVISION, 'species': available}, indent=2))
    print(f'Imported {len(available)}/{len(IDS)} species', flush=True)
