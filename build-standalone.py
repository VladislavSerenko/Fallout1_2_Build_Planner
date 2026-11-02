"""Version hosted assets and bundle the page and original artwork for offline use."""
import base64
import hashlib
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent
html = (root / 'index.html').read_text(encoding='utf-8')


def version_asset(match):
    name = match.group(2)
    content = (root / name).read_text(encoding='utf-8').encode('utf-8')
    digest = hashlib.sha256(content).hexdigest()[:12]
    return match.group(1) + name + '?v=' + digest + match.group(3)


# A changed script or stylesheet must not reuse a previous deployment's cached URL.
html = re.sub(r'((?:href|src)=")((?:styles|tree|pipboy)\.css|(?:data|fallout1-data|mechanics|engine|app)\.js)(?:\?[^" ]*)?(")', version_asset, html)
(root / 'index.html').write_text(html, encoding='utf-8')
# Keep the standalone bundling independent of the hosted asset URLs.
html = re.sub(r'((?:href|src)="[^"]+\.(?:css|js))\?v=[a-f0-9]+(")', r'\1\2', html)
css = (root / 'styles.css').read_text(encoding='utf-8')
css += '\n' + (root / 'tree.css').read_text(encoding='utf-8')
theme = (root / 'pipboy.css').read_text(encoding='utf-8')
data = (root / 'data.js').read_text(encoding='utf-8')
data += '\n' + (root / 'fallout1-data.js').read_text(encoding='utf-8')
data += '\n' + (root / 'mechanics.js').read_text(encoding='utf-8')

# Replace filename selectors with a class before converting asset paths to data URLs.
inverted = ['gain-perception', 'gain-endurance', 'gain-charisma', 'gain-intelligence', 'gain-agility', 'gain-luck', 'master-trader', 'sniper']
css = re.sub(r'img\[src\$="(?:' + '|'.join(inverted) + r')\.png"\]', 'img.art-invert', css)
theme = re.sub(r'img\[src\$="(?:' + '|'.join(inverted) + r')\.png"\]', 'img.art-invert', theme)
for asset in (root / 'assets').glob('*.png'):
    encoded = base64.b64encode(asset.read_bytes()).decode('ascii')
    data = data.replace('"assets/' + asset.name + '"', '"data:image/png;base64,' + encoded + '"')

for asset in (root / 'branding').glob('*.png'):
    encoded = base64.b64encode(asset.read_bytes()).decode('ascii')
    html = html.replace('src="branding/' + asset.name + '"', 'src="data:image/png;base64,' + encoded + '"')

html = html.replace('  <link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
html = html.replace('  <link rel="stylesheet" href="tree.css">\n', '')
html = html.replace('  <link rel="stylesheet" href="pipboy.css">', '<style id="pipboy-theme">\n' + theme + '\n</style>')
html = re.sub(r'  <script defer src="(?:data|fallout1-data|mechanics|engine|app)\.js"></script>\n', '', html)
engine = (root / 'engine.js').read_text(encoding='utf-8')
app = (root / 'app.js').read_text(encoding='utf-8')
# Assign the contrast class by perk ID so it works independently of image URLs.
data += '\nFO2_DATA.perks.forEach(perk => { if (' + repr(inverted).replace("'", '"') + '.includes(perk.id)) perk.invert = true; });\n'
data += '\nFO1_DATA.perks.forEach(perk => { if (' + repr(inverted).replace("'", '"') + '.includes(perk.id)) perk.invert = true; });\n'
app = app.replace('src="${perk.image}"', 'class="${perk.invert ? \'art-invert\' : \'\'}" src="${perk.image}"')
app = app.replace('src="${p.image}"', 'class="${p.invert ? \'art-invert\' : \'\'}" src="${p.image}"')
html = html.replace('</body>', '<script>\n' + data + '\n</script>\n<script>\n' + engine + '\n</script>\n<script>\n' + app + '\n</script>\n</body>')
output = root / 'Fallout2-Planner.html'
output.write_text(html, encoding='utf-8')
print(str(output) + ' (' + str(output.stat().st_size) + ' bytes)')
