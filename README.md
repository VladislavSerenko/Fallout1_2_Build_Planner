# Fallout 1 & 2 — Perk Planner

Open **Fallout2-Planner.html** in Edge, Chrome or Firefox. This single file works offline with no server or installation. Alternatively, open `index.html` with the other source files, `assets` and `branding` beside it.

Choose **Fallout 1** or **Fallout 2** in the header. The original logo, perk tree, requirements, traits, skills, upgrades and field manual switch with the game. Each game keeps its own saved build; switching back restores your character, perk picks, skill goals and archive checklist. Existing saves without a game field load as Fallout 2.

## Using the planner

1. Select perks directly in the tree; click again to remove them. Automatic picks are arranged by their unlock levels, so tree click order does not schedule a perk before it becomes available. Changes to Skilled recompute those assignments. A perk with no suitable level stays in the wanted list and reserves one pick. Each rank uses one pick. **Reset perks** clears all selected ranks and wanted perks while preserving your character and skill goals.
2. Set **Target level**. **Perks left** shows remaining picks. Choose Skilled under **SPECIAL → Traits** to change the schedule from 3–6–9 to 4–8–12. Search finds English perk names and descriptions. Click a branch heading to focus it; click again to restore all branches. Click Gain SPECIAL to expand its seven perks.
3. A perk's **i** button opens its inline details in **SPECIAL**. Large green **✓** indicators mark met requirements; amber **!** indicators mark picks that need preparation. Tree lines group development branches; they are not prerequisite links.
4. Open **SPECIAL** to edit your character. A new character starts with 5 in each stat and 5 unspent points. The creation budget is 40 base points. Trait bonuses appear immediately in the main stat values without consuming that budget. A small caption shows the base and trait bonus; a separate target-level value appears when surgery or valid Gain perks change the result.
5. All traits are visible in two columns, with a single column on narrow screens. Select up to two; their **i** buttons reveal descriptions on demand. The single **Skills** panel combines tag switches, calculated values at the target level and optional goals with **− / +** controls. Its large **Skill points left** counter shows total earned minus planned training costs, with at least three digits and room for totals above 999. It falls as you allocate training and rises when training is removed. Total earned, spending, the unspent bank and any points lost to the 99-point bank cap appear below. The planning budget includes points that earlier training can recover from cap losses; the separate bank is what you carry at the target level. These update with your target level, permanent Intelligence, traits and valid perks. Select three tag skills. The first goal increase starts from the calculated value; clear a goal or set it to 0 to remove it. **Reset skills** clears all optional targets, preserving tag skills and training required by perks. Perk requirements receive training points first, then optional goals use the remaining budget. The training plan expands below the same panel.
6. **Operations and upgrades** opens one shared panel. Set the first level at which an upgrade is active, before skill point income and the perk pick at that level. The planner assumes you can reach the required location in time.
7. The planned perk list automatically sorts assigned and free picks by increasing planned level. Wanted perks follow in minimum-level order. Automatic picks can move to another earned pick while preserving ranks, chems, Tag! choices and Mutate! configuration. Editing the take level pins that pick to the chosen level; manual timing survives later rearrangements. Valid deferred levels in older saves are preserved. Genuine shortages of eligible picks, stats or skills remain visible. Click a row to expand it in place: missing stats and skills, preparation, planned level and Tag! or Mutate! configuration stay in SPECIAL. Free rows offer a perk chooser; assigned rows offer removal and additional ranks. **Chems** expands on demand and applies only when taking that particular pick. The row compares requirements with and without selected bonuses and identifies optional preparation.

Your build saves automatically in the browser. The **···** menu offers JSON export/import, build links and **New character** for the selected game. JSON files and build links identify their game and switch the planner automatically when loaded. Local file links encode the build, but sending the JSON file is easier between devices. Existing saves remain supported; picks above the current quota block further selection until the plan is adjusted. Default hero names are **Vault Dweller** in Fallout 1 and **Chosen One** in Fallout 2, including migration of the old Russian Fallout 2 default in existing saves. Custom names preserve your own text. No build data is sent to a server.

**Wasteland secrets** lists seven permanent stat upgrades in Fallout 1, labeled **STAT UPGRADE**: five Brotherhood surgeries, Chuck's fortune and Patrick's song. Fallout 2 lists 16 event perks and implants plus two explicitly labeled reputations. Archive checkboxes form a separate progress checklist. Use **Operations and upgrades** to schedule stat bonuses and Fallout 2's enhanced implant Charisma penalties.

**Hidden mechanics** is the third tab. Six expandable topics explain scope range, Sniper and Slayer, ordinary critical chance, aimed shots, critical-effect thresholds, Better Criticals, armor bypass, Finesse and hidden accuracy modifiers. The Sniper example starts with target-level Luck and lets you compare ordinary and converted critical probabilities. Rules and source links switch with the game, including Fallout 1's full armor bypass and Fallout 2's one-fifth armor reduction. `Hidden-mechanics-preview.png` shows this panel.

Every editable section has its own reset: **Reset SPECIAL** restores base attributes to 5 (five unspent points), **Reset traits** clears starting traits, **Reset upgrades** clears scheduled operations, **Reset perks** is available both in the tree and the planned list, and **Reset secrets** clears the discoveries checklist. These actions affect only the selected section in the current game; calculations update and the changes save automatically. Empty sections have disabled reset buttons.

Perks with multiple ranks have a **− / current of maximum / +** control directly below their description in SPECIAL. **+** immediately schedules another rank in a suitable free pick and copies the selected rank's chems; each rank remains separately editable. **−** removes the latest planned rank while keeping the first. Each rank costs one perk pick, and the control explains when no suitable pick remains. Limits follow the selected game, including two Action Boy ranks in Fallout 2 and three in Fallout 1. Planned rows label each rank separately.

## Calculation rules and scope

| Rule | Fallout 1 | Fallout 2 |
| --- | --- | --- |
| Selectable perks | 53 | 76, including seven Gain SPECIAL perks |
| Maximum level | 21 | 99 |
| Sniper / Slayer | Level 18 | Level 24 |
| Bonus Rate of Fire | Level 9 | Level 15 |
| Action Boy / Bonus Move / Quick Pockets | 3 ranks | 2 ranks |
| Skill cap / training cost | 200%; 1 point per purchase | 300%; increasing cost above 100% |
| Skilled | +10% all skills; no extra income | +5 skill points per level |
| Tag! | +20% and doubles invested gains | Doubles invested gains |
| Educated | +2 points immediately, then +2 per level | +2 per level starting next level |
| Game-specific trait | Night Person | Sex Appeal |

- Requirements and ranks were checked against fallout1-ce and fallout2-ce. Fallout 1's Animal Friend requires IN 5 according to the engine table, despite a different requirement in the wiki. Rad Resistance uses the engine's +15% effect.
- A perk every 3 levels, or every 4 with Skilled. Mutate! explicitly replaces a trait and adjusts future perk events.
- SPECIAL is capped at 1–10. Requirements use current stats, including the chems configured for the specific pick. A perk remains after temporary effects end. Chem bonuses apply only when taking that pick.
- Skill points are granted for levels 2 through the target. Gifted, Educated and permanent Intelligence upgrades affect income; temporary chems do not. Fallout 2 also has Skilled income and Gain Intelligence. In Fallout 1, Night Person's day/night setting applies throughout the plan, including income; night is evaluated at 18:00.
- Training uses permanent stats and a bank capped at 99 when leveling. Fallout 1 Educated's immediate +2 can temporarily exceed the bank cap. Both games' initial formulas, tags, training costs, normal perk bonuses and Tag! are modeled. Fallout 1 uses its original skill formulas, rounding down the average for skills based on two attributes. Conditional bonuses from Ghost and Survivalist and Master Trader's hidden pricing bonus do not satisfy skill requirements.
- In vanilla, spend a saved pick before the next perk event. For Fallout 2, the JSON `mode` field also supports `sfall` for game setups with perk accumulation enabled. Fallout 1 always uses the original pick schedule.
- Calculations assume normal difficulty and a new character starting at level 1. Books, NPC training, withdrawal, addiction and modded rules are not modeled. Zeta scans represent an explicitly selected successful outcome with a 50% chance.
- Here and Now grants a level already included in your target; it does not create a second pick at the same level.

The training route is a concrete automatic plan, not a proof of globally minimal cost across every possible training order, book or temporary effect.

## Sources and artwork

- [Fallout 1 perks](https://fallout.fandom.com/wiki/Fallout_perks)
- [Fallout 1 SPECIAL](https://fallout.wiki/wiki/Fallout_SPECIAL)
- [Fallout 1 skills](https://fallout.fandom.com/wiki/Fallout_skills)
- [Fallout 1 traits](https://fallout.fandom.com/wiki/Fallout_traits)
- [Fallout 1 perk requirements and effects](https://github.com/alexbatalov/fallout1-ce/blob/main/src/game/perk.cc)
- [Fallout 1 skills and training](https://github.com/alexbatalov/fallout1-ce/blob/main/src/game/skill.cc)
- [Fallout 1 leveling and saved picks](https://github.com/alexbatalov/fallout1-ce/blob/main/src/game/editor.cc)
- [Fallout 2 perks](https://fallout.fandom.com/wiki/Fallout_2_perks)
- [Fallout 2 SPECIAL](https://fallout.fandom.com/wiki/Fallout_2_SPECIAL)
- [Fallout 2 skills](https://fallout.fandom.com/wiki/Fallout_2_skills)
- [Numeric perk requirements and effects](https://github.com/alexbatalov/fallout2-ce/blob/main/src/perk.cc)
- [Current stats include active bonuses](https://github.com/alexbatalov/fallout2-ce/blob/main/src/stat.cc)
- [Skill points and saved picks](https://github.com/alexbatalov/fallout2-ce/blob/main/src/character_editor.cc)
- [Original Fallout 2 logo](https://fallout.wiki/wiki/File:FO2_Game_Logo_Transparent.webp)
- [Original Fallout 1 logo](https://fallout.wiki/wiki/File:FO1_Game_Logo_Transparent.webp)

The 99 original illustrations are stored locally; their source URLs are preserved in `data.js → artworkSources` and `fallout1-data.js → artworkSources`. White-background illustrations are inverted for legibility on the dark screen. For five Fallout 1 illustrations, `artwork-originals` retains the unmodified textured images and `assets` contains transparent ink copies for the CRT. Regenerate those copies with `prepare-artwork.py` (requires Pillow). Both transparent original logos are stored in `branding`, with provenance in `branding/source.json` and `branding/fallout1-source.json`. Fallout artwork belongs to its respective owners. Fallout 2 data was checked on October 30, 2026; Fallout 1 data on November 1, 2026.

Combat reference sources: [Critical Hit](https://fallout.fandom.com/wiki/Critical_Hit), [Critical Chance](https://fallout.fandom.com/wiki/Critical_Chance), [Sniper](https://fallout.fandom.com/wiki/Sniper_(Fallout)), [scoped hunting rifle](https://fallout.fandom.com/wiki/Scoped_hunting_rifle), [Fallout 1 combat](https://github.com/alexbatalov/fallout1-ce/blob/main/src/game/combat.cc) and [rolls](https://github.com/alexbatalov/fallout1-ce/blob/main/src/game/roll.cc), and [Fallout 2 combat](https://github.com/alexbatalov/fallout2-ce/blob/main/src/combat.cc) and [rolls](https://github.com/alexbatalov/fallout2-ce/blob/main/src/random.cc). Checked on November 1, 2026; original behavior is distinguished from patch-specific changes in the reference code.

## Development

Sources: `index.html`, `styles.css`, `tree.css`, `pipboy.css`, `data.js`, `fallout1-data.js`, `mechanics.js`, `engine.js` and `app.js`. The current theme combines the olive casing and clean display of preview B with recessed fields and tactile keys from A. SPECIAL shares the main casing's complete frame, inset corner geometry, screws, material and screen margins. Search fields use a subtle inset green focus indicator. The `FO2` engine namespace remains for compatibility; game-specific accessors route calculations through the selected catalog.

Build the standalone file with standard Python 3:

```text
python fallout2-planner/build-standalone.py
```

Run calculation tests with Node.js 22+; no packages are required:

```text
node --test --test-isolation=none fallout2-planner/engine.test.cjs
```

The original style directions remain in `previews/index.html`. They are working HTML/CSS previews with separate browser saves. Rebuild them after changing the standalone file:

```text
python fallout2-planner/previews/build-previews.py
```

`Pip-Boy-preview.png` shows the current tree; `SPECIAL-preview.png` shows the character panel. `Traits-preview.png` shows the complete trait grid, and `Skills-preview.png` shows the skill-point readout and training goals. `Planned-perks-preview.png` shows inline preparation and the larger status indicators. Demo selections exist only in the screenshots and isolated browser checks.

`Fallout1-preview.png` and `Fallout1-SPECIAL-preview.png` show the Fallout 1 tree and character panel with the original logo.
