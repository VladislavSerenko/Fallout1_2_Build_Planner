"""Extract the original Fallout 1 ink for the CRT screen (requires Pillow).

Unmodified downloads stay in artwork-originals; assets contains display copies.
Run only when updating these five original illustrations.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
originals = root / 'artwork-originals'
originals.mkdir(exist_ok=True)
for name in ['friendly-foe', 'mental-block', 'scrounger', 'flower-child', 'animal-friend']:
    source = originals / (name + '.png')
    target = root / 'assets' / (name + '.png')
    if not source.exists():
        source.write_bytes(target.read_bytes())
    with Image.open(source) as image:
        image = image.convert('RGBA')
        pixels = []
        for red, green, blue, alpha in image.get_flattened_data():
            lightness = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
            ink = max(0, min(1, (0.25 - lightness) / 0.14))
            pixels.append((255, 255, 255, round(alpha * ink)))
        image.putdata(pixels)
        image.save(target)
    print(target.name)
