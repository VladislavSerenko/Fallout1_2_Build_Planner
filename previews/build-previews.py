"""Build two standalone style previews from the current planner."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
source = (root.parent / 'Fallout2-Planner.html').read_text(encoding='utf-8')
source = re.sub(r'<style id="pipboy-theme">.*?</style>', '', source, flags=re.S)
source = re.sub(r'<span class="device-model">.*?</span>', '', source)
shared_css = '''
.brand-logo { width: 186px; height: 67px; object-fit: contain; display: block; }
.header-actions #game-select { width: 105px; height: 36px; padding: 4px 5px; font-size: 11px; }
.header-actions .more-button { width: 30px; flex-shrink: 0; padding: 0; font-size: 18px; letter-spacing: -2px; overflow: hidden; }
.tree-perk img.art-invert { filter: invert(1) sepia(1) saturate(1.5) hue-rotate(38deg); }
.selected-node .tree-perk img.art-invert { filter: invert(1) sepia(1) saturate(.9) hue-rotate(10deg); }
.drawer .skill-label { display: flex; gap: 5px; align-items: center; min-width: 0; }
.drawer .skill-label input { flex-shrink: 0; }
.drawer .skills-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.drawer .skill-values { gap: 4px; }
.drawer .skill-values input { width: 36px; }
.skills-panel-legend { display: flex; justify-content: space-between; padding: 12px 15px 0; font-size: 9px; }
.operation-main { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.drawer .special-name small { display: block; font-size: 8px; }
.planned-card { border: 1px solid #526c40; border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
.planned-card .planned-row { margin: 0; border: 0; border-radius: 0; }
.planned-name { min-width: 0; overflow-wrap: anywhere; }
.planned-card .plan-status { display: grid; place-items: center; flex-shrink: 0; width: 30px; height: 30px; border: 2px solid #68834b; border-radius: 50%; font: bold 20px/1 var(--mono); }
.planned-card .status-ready { color: #c0ff9b; background: #233e16; }
.planned-card .status-warning { color: #ffe08b; background: #4b3517; border-color: #b19250; }
.plan-chevron { font-size: 11px; color: #829f6a; }
.plan-extension { padding: 5px 14px 16px; font-size: 11px; }
.plan-description { line-height: 1.8; border-top: 1px solid #526c4055; padding-top: 12px; }
.plan-level-settings { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0 12px; }
.plan-level-settings .inline-label input { width: 50px; }
.plan-configs { display: grid; gap: 12px; }
.plan-ready { color: #c0ff9b; }
.plan-support { padding: 10px 12px; margin-top: 12px; border-left: 2px solid #baa666; font-size: 10px; line-height: 1.8; }
.plan-support strong { display: block; color: var(--amber); }
.plan-actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 15px; }
.plan-actions .metal-button { width: auto; font-size: 10px; }
.plan-actions .text-button, .plan-actions a { font-size: 10px; }
.plan-actions a { margin-left: auto; }
.preview-heading { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px 0; color: var(--amber); }
.preview-heading .text-button { font-size: 20px; }
@media(max-width:760px) { .brand-logo { width: 134px; height: 48px; } .header-actions #game-select { width: 90px; height: 32px; font-size: 10px; } .drawer .skills-grid { grid-template-columns: 1fr; } .operation-main { flex-wrap: wrap; } }
@media(max-width:420px) { .brand-logo { width: 104px; height: 38px; } .masthead { gap: 6px; padding-left: 5px; padding-right: 5px; } .header-actions { gap: 4px; } .header-actions #game-select { width: 82px; } .header-actions .metal-button { padding: 0 6px; gap: 4px; font-size: 11px; letter-spacing: 0; } }
'''
for theme, title in [('classic', 'A · Character screen'), ('pipboy', 'B · Pip-Boy 2000')]:
    css = (root / (theme + '.css')).read_text(encoding='utf-8')
    page = source.replace('</head>', '<style>\n' + css + '\n' + shared_css + '\n</style>\n</head>')
    page = page.replace('<title>Fallout 2 · Perk Planner</title>', '<title>Fallout 2 · ' + title + '</title>')
    page = page.replace("const STORAGE_KEY = 'fallout2-planner-v1';", "const STORAGE_KEY = 'fallout2-preview-" + theme + "-v1';")
    page = page.replace('let state = newBuild(),', "let state = {...E.defaults(), traits: ['gifted']},")
    (root / (theme + '.html')).write_text(page, encoding='utf-8')
    print(theme + '.html')
