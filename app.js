(function () {
  'use strict';
  const E = globalThis.FO2;
  let DATA = globalThis.FO2_DATA;
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const STORAGE_KEY = 'fallout2-planner-v1';
  const names = {ST: ['S', 'Strength'], PE: ['P', 'Perception'], EN: ['E', 'Endurance'], CH: ['C', 'Charisma'], IN: ['I', 'Intelligence'], AG: ['A', 'Agility'], LK: ['L', 'Luck']};
  function newBuild(game) {
    return {...E.defaults(game), base: {ST: 5, PE: 5, EN: 5, CH: 5, IN: 5, AG: 5, LK: 5}, traits: [], tags: [], picks: [], wanted: []};
  }
  let state = newBuild(), activeSlot = 0, inspected = 'awareness', draft = {id: 'awareness', at: 3, boosts: {}};
  const perkById = id => E.perkById(id, state);
  const storageFor = game => game === 'fallout1' ? STORAGE_KEY + '-fallout1' : STORAGE_KEY;
  let result, previews = new Map(), zoom = 1, toastTimer;
  let category = 'all', gainExpanded = false;
  const expandedTraits = new Set();
  let expandedPlan = '';
  let mechanicsLuck = null, mechanicsCritical = 10;
  const CATEGORIES = [
    {id: 'combat', name: 'COMBAT', columns: 3}, {id: 'skills', name: 'DEVELOPMENT', columns: 3},
    {id: 'survival', name: 'SURVIVAL', columns: 2}, {id: 'social', name: 'SOCIAL', columns: 2},
    {id: 'travel', name: 'TRAVEL', columns: 2}
  ];
  function notify(text) {
    (document.querySelector('dialog[open]') || document.body).append($('toast'));
    $('toast').textContent = text;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4200);
  }
  function save() {
    try {
      localStorage.setItem(storageFor(state.game), JSON.stringify(state));
      localStorage.setItem(STORAGE_KEY + '-active-game', E.gameRules(state).id);
      $('save-status').textContent = '● BUILD SAVED';
    } catch (_) {
      $('save-status').textContent = '○ SAVE USING JSON';
    }
  }
  function load() {
    try {
      const hash = location.hash.match(/^#build=(.+)$/);
      if (hash) {
        const bytes = Uint8Array.from(atob(decodeURIComponent(hash[1])), char => char.charCodeAt(0));
        const loaded = E.cleanState(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)));
        if (loaded) {state = loaded; return;}
        notify('This link has no supported build. Your local plan was loaded.');
      }
      const game = localStorage.getItem(STORAGE_KEY + '-active-game') === 'fallout1' ? 'fallout1' : 'fallout2';
      state = newBuild(game);
      const stored = localStorage.getItem(storageFor(game));
      if (stored) state = E.cleanState(JSON.parse(stored)) || state;
    } catch (_) {notify('Could not read the save. A new tree has been opened.');}
  }
  function freeSlot(id) {
    const perk = perkById(id), levels = E.schedule(state);
    return levels.findIndex((level, index) => !state.picks[index] && Math.max(level, perk.level) <= state.target && (state.mode === 'sfall' || !levels[index + 1] || perk.level < levels[index + 1]));
  }
  function noFreePickMessage() {
    const hint = state.game === 'fallout2' && state.mode === 'vanilla' && perkBudget().remaining > 0
      ? ' Original rules do not accumulate earlier picks. For sfall, select Accumulate unused picks under SPECIAL → Planned perks.'
      : '';
    return 'No suitable free pick for another rank. Raise the target level or remove a perk.' + hint;
  }
  function perkBudget() {
    const capacity = E.schedule(state).length;
    const used = state.picks.filter(Boolean).length + state.wanted.length;
    return {capacity, used, remaining: Math.max(0, capacity - used)};
  }
  function canCommit(id, index) {
    if (state.picks[index] || state.wanted.includes(id) || perkBudget().remaining > 0) return true;
    notify('All perk picks are used. Remove a perk or raise the target level.');
    return false;
  }
  function setBaseStat(stat, value) {
    const current = state.base[stat];
    const spent = E.STATS.reduce((sum, id) => sum + state.base[id], 0);
    const maximum = Math.min(10, Math.max(current, 40 - spent + current));
    const requested = Math.max(1, Math.min(10, Math.trunc(Number(value) || 1)));
    state.base[stat] = Math.min(requested, maximum);
    if (requested > maximum) notify('No SPECIAL points left. Lower another stat to free a point.');
    refresh();
  }
  function creationStats(base = state.base) {
    return E.statsAt({...state, base, operations: []}, {traits: state.traits, gains: {}}, 1);
  }
  function traitBonuses() {
    const neutral = creationStats(Object.fromEntries(E.STATS.map(stat => [stat, 5])));
    return Object.fromEntries(E.STATS.map(stat => [stat, neutral[stat] - 5]));
  }
  function setCreationStat(stat, value) {
    const current = creationStats()[stat];
    const requested = Math.max(1, Math.min(10, Math.trunc(Number(value) || 1)));
    if (requested === current) {refresh(); return;}
    const bonus = traitBonuses()[stat];
    setBaseStat(stat, requested - bonus);
  }
  function setSkillGoal(id, value) {
    const target = Math.max(0, Math.min(E.gameRules(state).skillCap, Math.trunc(Number(value) || 0)));
    if (target) state.skillGoals[id] = target;
    else delete state.skillGoals[id];
    refresh();
  }
  function reconcileWanted() {
    const selected = state.picks[activeSlot], previous = activeSlot;
    const arranged = E.arrangePicks(state);
    state.picks = arranged.picks; state.wanted = arranged.wanted;
    if (selected && arranged.slots[previous] !== undefined) {
      activeSlot = arranged.slots[previous];
      if (expandedPlan === 'slot-' + previous) expandedPlan = 'slot-' + activeSlot;
      if (selected.id === inspected) draft = E.clone(state.picks[activeSlot]);
    } else if (expandedPlan.startsWith('wanted-') && !state.wanted.includes(inspected)) {
      const index = state.picks.findIndex(pick => pick?.id === inspected);
      if (index >= 0) {activeSlot = index; draft = E.clone(state.picks[index]); expandedPlan = 'slot-' + index;}
    }
  }
  function togglePerk(id) {
    const selected = state.picks.some(pick => pick?.id === id) || state.wanted.includes(id);
    if (selected) {
      state.picks = state.picks.map(pick => pick?.id === id ? null : pick);
      state.wanted = state.wanted.filter(wanted => wanted !== id);
    } else {
      if (!canCommit(id)) return;
      state.wanted.push(id);
    }
    refresh();
    document.querySelector(`[data-tree-perk="${id}"]`)?.focus({preventScroll: true});
  }
  function changePerkRanks(id, step, fromTree = false) {
    const perk = perkById(id);
    const entries = state.picks.map((pick, index) => ({pick, index})).filter(entry => entry.pick?.id === id).sort((a, b) => a.pick.at - b.pick.at || a.index - b.index);
    const pending = state.wanted.includes(id), count = entries.length + Number(pending);
    if (step > 0) {
      if (!count || count >= perk.ranks || perkBudget().remaining <= 0) return;
      const index = freeSlot(id);
      if (index < 0) {notify(noFreePickMessage()); return;}
      const source = entries.find(entry => entry.index === activeSlot)?.pick || entries.at(-1)?.pick;
      state.picks[index] = {id, at: Math.max(E.schedule(state)[index], perk.level), boosts: E.clone(source?.boosts || {}), manualLevel: false};
    } else {
      if (count <= (fromTree ? 0 : 1)) return;
      if (pending) {
        state.wanted = state.wanted.filter(wanted => wanted !== id);
        if (expandedPlan === 'wanted-' + id) expandedPlan = '';
      } else {
        const latest = entries.pop();
        state.picks[latest.index] = null;
        if (activeSlot === latest.index) {
          if (entries.length) {
            activeSlot = entries.at(-1).index;
            inspected = id;
            draft = E.clone(state.picks[activeSlot]);
            expandedPlan = 'slot-' + activeSlot;
          } else {
            activeSlot = 0; inspected = 'awareness'; expandedPlan = '';
            draft = {id: inspected, at: E.schedule(state)[0] || state.target, boosts: {}};
          }
        }
      }
    }
    refresh();
    const control = fromTree ? 'data-tree-rank' : 'data-rank';
    const focus = document.querySelector(`[${control}-perk="${id}"][${control}-step="${step}"]:not(:disabled)`) || document.querySelector(`[${control}-perk="${id}"]:not(:disabled)`) || (fromTree ? document.querySelector(`[data-tree-perk="${id}"]`) : null);
    focus?.focus({preventScroll: true});
  }
  function openPanel(id) {
    const panel = $(id);
    if (!panel) return;
    document.querySelectorAll('dialog[open]').forEach(dialog => {if (dialog !== panel) dialog.close();});
    if (!panel.open) panel.showModal();
  }
  function switchGame(game) {
    if (game === state.game) return;
    save();
    let loaded;
    try {loaded = E.cleanState(JSON.parse(localStorage.getItem(storageFor(game)) || 'null'));} catch (_) {}
    state = loaded?.game === game ? loaded : newBuild(game);
    mechanicsLuck = null;
    activeSlot = 0; inspected = state.picks[0]?.id || 'awareness'; expandedPlan = '';
    draft = state.picks[0] ? E.clone(state.picks[0]) : {id: inspected, at: E.schedule(state)[0] || state.target, boosts: {}};
    expandedTraits.clear(); category = 'all'; gainExpanded = false;
    $('perk-search').value = ''; $('secret-search').value = '';
    zoom = 1; $('level-map').style.zoom = 1; $('zoom-label').textContent = '100%';
    if (location.hash.startsWith('#build=')) history.replaceState(null, '', location.href.split('#')[0]);
    refresh(); renderSecrets();
    $('map-scroll').scrollTo(0, 0);
  }
  function renderGame() {
    const rules = E.gameRules(state), first = rules.id === 'fallout1';
    document.title = rules.title + ' · Perk Planner';
    $('game-select').value = rules.id;
    $('fallout1-logo').hidden = !first; $('fallout2-logo').hidden = first;
    document.querySelector('.brand').setAttribute('aria-label', rules.title + ' perk planner');
    $('target-level').max = rules.maxLevel;
    $('night-person-settings').hidden = !first || !state.traits.includes('night-person');
    $('planning-time').value = state.time || 'day';
    $('perk-saving-settings').hidden = first;
    $('perk-saving-mode').value = state.mode;
    $('perk-saving-note').textContent = state.mode === 'sfall'
      ? 'Every unused pick stays available. Spend it at any later level, including alongside another pick. Use this for games with sfall perk accumulation.'
      : 'You can postpone a choice, but only one pick is saved. The next perk award replaces an unused pick instead of adding to it.';
    $('fallout1-manual').hidden = !first; $('fallout2-manual').hidden = first;
    $('manual-game').textContent = 'FIELD MANUAL / ' + rules.title.toUpperCase();
    $('archive-title').textContent = first ? 'Every advantage has a story.' : 'The wasteland has its own rewards.';
    $('archive-description').textContent = first
      ? 'Permanent stat upgrades in Fallout 1. Mark discoveries here and schedule their bonuses in SPECIAL → Operations and upgrades.'
      : 'Event perks, implants and unusual reputations. These use no perk picks. Mark what you find in this separate checklist.';
  }
  function showPerkDetails(id, index) {
    const selected = index ?? state.picks.findIndex(pick => pick?.id === id);
    const available = freeSlot(id);
    const slot = selected >= 0 ? selected : available >= 0 ? available : Math.max(0, result.earned.length - 1);
    expandedPlan = selected >= 0 ? 'slot-' + slot : state.wanted.includes(id) ? 'wanted-' + id : 'preview';
    changeSlot(slot, id);
    if (!state.picks[slot] || selected < 0) draft.at = Math.max(result.earned[slot] || state.target, perkById(id).level);
    previews.clear();
    renderPlanned();
    openPanel('character-dialog');
    document.querySelector(`[data-plan-key="${expandedPlan}"]`)?.scrollIntoView({block: 'nearest'});
  }
  function refresh() {
    DATA = E.catalogFor(state);
    renderGame();
    reconcileWanted();
    result = E.simulate(state);
    renderMechanics();
    previews.clear();
    renderCharacter();
    renderMap();
    renderSkills();
    renderPlanned();
    $('target-level').value = state.target;
    save();
  }
  function changeSlot(index, perkId) {
    activeSlot = Number(index);
    const pick = state.picks[activeSlot];
    inspected = perkId || pick?.id || (activeSlot === result.earned.length - 1 ? state.goal : 'awareness');
    draft = pick?.id === inspected ? E.clone(pick) : {id: inspected, at: pick?.at || result.earned[activeSlot] || state.target, boosts: {}};
    previews.clear();
    renderMap(); renderPlanned();
  }
  function preview(id = inspected) {
    if (previews.has(id)) return previews.get(id);
    const pick = id === inspected ? draft : {id, at: draft.at, boosts: draft.boosts || {}};
    const simulated = E.simulate(state, {index: activeSlot, pick});
    const report = simulated.reports[activeSlot];
    const value = {simulated, report, pick};
    previews.set(id, value);
    return value;
  }
  function renderCharacter() {
    $('character-name').value = state.name;
    const remaining = 40 - result.creationPoints;
    $('special-budget').textContent = remaining >= 0 ? 'Unspent: ' + remaining : 'Over budget: ' + -remaining;
    $('special-budget').title = `${result.creationPoints} of 40 base points allocated`;
    $('special-budget').className = remaining < 0 ? 'danger-text' : '';
    $('reset-special').disabled = E.STATS.every(stat => state.base[stat] === 5);
    $('reset-traits').disabled = !state.traits.length;
    $('reset-upgrades').disabled = !state.operations.length;
    const starting = creationStats(), bonuses = traitBonuses();
    $('special-controls').innerHTML = E.STATS.map(stat => {
      const bonus = bonuses[stat];
      const note = bonus ? `Base ${state.base[stat]} ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)} from traits${state.base[stat] + bonus > 10 ? ' · capped at 10' : state.base[stat] + bonus < 1 ? ' · capped at 1' : ''}` : '';
      return `<div class="special-row"><span class="special-letter">${names[stat][0]}</span><span class="special-name">${names[stat][1]}${note ? `<small>${note}</small>` : ''}${result.stats[stat] !== starting[stat] ? `<small class="target-stat">At level ${state.target}: ${result.stats[stat]}</small>` : ''}</span><button data-stat="${stat}" data-step="-1" aria-label="Decrease ${names[stat][1]}" ${state.base[stat] === 1 ? 'disabled' : ''}>−</button><input type="number" data-base="${stat}" min="${Math.max(1, 1 + bonus)}" max="${Math.min(10, starting[stat] + Math.max(0, remaining))}" value="${starting[stat]}" class="${bonus ? 'stat-improved' : ''}" aria-label="Starting ${names[stat][1]} including traits" title="${note || 'Starting ' + names[stat][1]}"><button data-stat="${stat}" data-step="1" aria-label="Increase ${names[stat][1]}" ${starting[stat] === 10 || remaining <= 0 ? 'disabled' : ''}>+</button></div>`;
    }).join('');
    const trait = t => `<div class="trait-entry"><div class="trait-row"><label class="trait-option ${state.traits.includes(t[0]) ? 'trait-selected' : ''}"><input type="checkbox" data-trait="${t[0]}" ${state.traits.includes(t[0]) ? 'checked' : ''}><span>${t[1]}</span></label><button class="trait-info" data-trait-info="${t[0]}" aria-label="About ${t[1]}" aria-controls="trait-description-${t[0]}" aria-expanded="${expandedTraits.has(t[0])}" title="Trait description">i</button></div><p class="trait-description" id="trait-description-${t[0]}" ${expandedTraits.has(t[0]) ? '' : 'hidden'}>${escape(t[3])}</p></div>`;
    $('trait-controls').innerHTML = E.traitsFor(state).map(trait).join('');
    $('trait-count').textContent = state.traits.length + ' / 2';
    $('tag-count').textContent = state.tags.length + ' / 3 tagged';
    $('operation-controls').innerHTML = E.operationsFor(state).map(op => {
      const selected = state.operations.find(o => o.id === op.id);
      return `<div class="operation-option"><div class="operation-main"><label><input type="checkbox" data-operation="${op.id}" ${selected ? 'checked' : ''}>${op.name}</label>${selected ? `<label class="op-level">Level<input data-operation-level="${op.id}" type="number" min="1" max="${E.gameRules(state).maxLevel}" value="${selected.at}" aria-label="Upgrade level: ${op.name}"></label>` : ''}</div><small>${op.note} <a href="https://fallout.fandom.com/wiki/${op.source}" target="_blank" rel="noopener noreferrer" aria-label="Source: ${op.name}">↗</a></small></div>`;
    }).join('');
  }
  function renderMap() {
    const scroller = $('map-scroll'), left = scroller.scrollLeft, top = scroller.scrollTop;
    const budget = perkBudget();
    $('perk-available').textContent = budget.remaining;
    $('reset-perks').disabled = !budget.used;
    $('reset-planned-perks').disabled = !budget.used;
    $('perk-budget').title = `${budget.used} of ${budget.capacity} picks used. Wanted perks also reserve a pick. ${state.mode === 'sfall' ? 'Unused picks accumulate and can be spent at later levels.' : 'Original rules: earlier free picks cannot be carried past the next perk award.'}`;
    $('perk-budget').classList.toggle('budget-empty', !budget.remaining);
    const search = $('perk-search').value.trim().toLocaleLowerCase('en');
    const levels = E.schedule({...state, target: Math.min(E.gameRules(state).maxLevel, Math.max(24, state.target))});
    let perks = DATA.perks.filter(perk => (category === 'all' || perk.category === category) && (!search || [perk.name, perk.description].join(' ').toLocaleLowerCase('en').includes(search)));
    const selectedIds = new Set([...state.picks.filter(Boolean).map(pick => pick.id), ...state.wanted]);
    const gainPerks = perks.filter(perk => perk.gain);
    if (gainPerks.length && !gainExpanded && !search) {
      perks = perks.filter(perk => !perk.gain);
      perks.push({id: 'gain-family', name: 'Gain SPECIAL', level: 12, category: 'skills', image: perkById('gain-strength').image, family: true});
    }
    const lanes = CATEGORIES.filter(lane => category === 'all' || lane.id === category).map(lane => ({...lane, width: lane.columns * 108 - 8}));
    let width = 18;
    lanes.forEach(lane => {lane.x = width; lane.center = width + lane.width / 2; width += lane.width + 30;});
    width += 4;
    let y = 60;
    const rows = levels.map((level, index) => {
      const items = perks.filter(perk => perk.level <= level && (!index || perk.level > levels[index - 1]));
      const count = Math.max(1, ...lanes.map(lane => Math.ceil(items.filter(perk => perk.category === lane.id).length / lane.columns)));
      const step = items.some(perk => perk.ranks > 1 && selectedIds.has(perk.id)) ? 110 : 86;
      const row = {level, index, y, height: count * step + 42, step, items};
      y += row.height;
      return row;
    });
    const height = y + 20;
    const paths = [], nodes = [];
    const line = (d, selected = false) => `<path class="tree-edge ${selected ? 'selected-edge' : ''}" d="${d}"/>`;
    for (const lane of lanes) {
      paths.push(line(`M ${lane.center} 40 V ${height - 35}`));
      for (const row of rows) {
        const items = row.items.filter(perk => perk.category === lane.id);
        items.forEach((perk, index) => {
          const gridRow = Math.floor(index / lane.columns), column = index % lane.columns;
          const inRow = Math.min(lane.columns, items.length - gridRow * lane.columns);
          const x = lane.x + (lane.columns - inRow) * 54 + column * 108;
          const nodeY = row.y + gridRow * row.step + 26;
          const selected = perk.family ? gainPerks.some(p => selectedIds.has(p.id)) : selectedIds.has(perk.id);
          const picks = state.picks.map((pick, slot) => ({pick, slot})).filter(entry => entry.pick?.id === perk.id);
          const pending = state.wanted.includes(perk.id);
          const hasProblem = pending || picks.some(entry => !result.reports[entry.slot]?.ok);
          const rankCount = picks.length + Number(pending);
          const showRanks = selected && perk.ranks > 1;
          const canAddRank = showRanks && rankCount < perk.ranks && budget.remaining > 0 && freeSlot(perk.id) >= 0;
          const rankReason = rankCount >= perk.ranks ? 'All ranks selected' : !budget.remaining ? 'No perk picks left. Remove a perk or raise the target level.' : noFreePickMessage();
          const rankControls = showRanks ? `<div class="tree-rank-control" role="group" aria-label="Ranks: ${escape(perk.name)}"><button class="metal-button" data-tree-rank-perk="${perk.id}" data-tree-rank-step="-1" aria-label="Remove rank: ${escape(perk.name)}" title="Remove the latest planned rank">−</button><output aria-label="${rankCount} of ${perk.ranks} ranks selected">${rankCount}/${perk.ranks}</output><button class="metal-button" data-tree-rank-perk="${perk.id}" data-tree-rank-step="1" aria-label="Add rank: ${escape(perk.name)}" title="${canAddRank ? 'Add a rank at the next suitable free pick' : rankReason}" ${canAddRank ? '' : 'disabled'}>+</button></div>` : '';
          paths.push(line(`M ${lane.center} ${nodeY - 22} C ${lane.center} ${nodeY - 8}, ${x + 50} ${nodeY - 15}, ${x + 50} ${nodeY + 4}`, selected));
          const badge = perk.family ? `${gainPerks.filter(p => selectedIds.has(p.id)).length || '+'} / 7` : selected ? pending ? 'wanted' : hasProblem ? '!' : picks.length > 1 ? '×' + picks.length : '✓' : '';
          nodes.push(`<div class="tree-node ${selected ? 'selected-node' : ''} ${showRanks ? 'ranked-node' : ''} ${hasProblem ? 'needs-preparation' : ''} ${row.level > state.target ? 'future-node' : ''} ${!selected && !budget.remaining && !perk.family ? 'quota-blocked' : ''}" style="left:${x}px;top:${nodeY}px"><button class="tree-perk" ${perk.family ? 'data-gain-family' : `data-tree-perk="${perk.id}" aria-pressed="${selected}" aria-disabled="${!selected && !budget.remaining}"`} title="${escape(perk.family ? 'Expand all seven Gain SPECIAL perks' : perk.name + ' · Lv. ' + perk.level + '+. ' + perk.description)}" aria-label="${escape(perk.name)}${perk.family ? ': expand seven perks' : selected ? ', selected' : ', select'}"><img src="${perk.image}" alt="" loading="lazy"><span>${perk.name}</span>${badge ? `<small class="node-badge">${badge}</small>` : ''}</button>${rankControls}${perk.family ? '' : `<button class="node-details" data-perk-info="${perk.id}" aria-label="Requirements: ${perk.name}" title="Perk details">i</button>`}</div>`);
        });
      }
    }
    const axis = rows.map(row => {
      const picks = state.picks[row.index];
      const current = row.level <= state.target;
      return `<div class="axis-stop ${picks && current ? 'axis-selected' : ''} ${current ? '' : 'axis-future'}" style="top:${row.y + 32}px"><button data-level-info="${row.index}" class="level-badge" aria-label="Level ${row.level}: ${picks ? escape(perkById(picks.id).name) : 'free pick'}">${row.level}</button></div>`;
    }).join('');
    $('level-map').style.width = width + 78 + 'px';
    $('level-map').style.height = height + 'px';
    $('level-map').innerHTML = `<div class="level-axis" style="height:${height}px"><span class="axis-heading">LV.</span><div class="axis-line" style="top:114px;height:${Math.max(0, (rows.at(-1)?.y || 60) - 60)}px"></div>${axis}</div><div class="tree-board" style="width:${width}px;height:${height}px"><svg class="tree-lines" width="${width}" height="${height}" aria-hidden="true">${paths.join('')}</svg>${lanes.map(lane => `<button class="lane-heading ${category === lane.id ? 'lane-filtered' : ''}" style="left:${lane.x}px;width:${lane.width}px" data-category="${lane.id}" title="${category === lane.id ? 'Show all branches' : 'Show only this branch'}">${lane.name}${category === lane.id ? ' ×' : ''}</button>`).join('')}${nodes.join('')}${!perks.length ? '<p class="no-results">No perks found. Try another search.</p>' : ''}</div>`;
    scroller.scrollLeft = left; scroller.scrollTop = top;
    const count = budget.used;
    $('selected-count').textContent = count;
    const needsPreparation = Object.values(result.reports).filter(report => !report.ok).length;
    $('tree-selection-hint').textContent = !count ? 'Select perks to build your path.' : `Selected: ${count} of ${budget.capacity} · ${count > budget.capacity ? 'over the limit: remove extra perks' : state.wanted.length ? 'waiting for a suitable level: ' + state.wanted.length : needsPreparation ? 'needs preparation: ' + needsPreparation + ' → SPECIAL' : 'levels and requirements → SPECIAL'}`;
    $('open-build').classList.toggle('has-selection', count > 0);
  }
  function requirementHTML(req) {
    if (req.kind === 'slot' && !req.ok) {
      const next = result.earned[activeSlot + 1];
      const reason = req.name === 'Free perk pick' ? 'No suitable free perk pick' : !result.earned[activeSlot] ? `No pick earned by target level ${state.target}` : draft.at < result.earned[activeSlot] ? `Pick earned at level ${result.earned[activeSlot]}` : `Use the level ${result.earned[activeSlot]} pick before level ${next}`;
      return `<div class="requirement unmet"><span class="req-icon">×</span><span class="req-name">Perk pick</span><span class="req-values req-explanation">${reason}</span></div>`;
    }
    let expected = req.expected < 0 ? '&lt; ' + -req.expected : '≥ ' + escape(req.expected);
    if (req.kind === 'rank') expected = '&lt; ' + req.expected;
    if (req.kind === 'slot') expected = req.ok ? 'available' : 'no pick';
    if (req.kind === 'config') expected = 'required';
    return `<div class="requirement ${req.ok ? '' : 'unmet'}"><span class="req-icon">${req.ok ? '✓' : '×'}</span><span class="req-name">${escape(req.kind === 'stat' ? names[req.name][1] + ' (' + req.name + ')' : req.name)}${req.or ? ' ∨' : ''}</span><span class="req-values"><span class="req-actual">${req.kind === 'slot' ? 'Lv. ' : ''}${escape(req.actual)}${req.kind === 'skill' ? '%' : ''}</span> / ${expected}${req.kind === 'skill' ? '%' : ''}</span></div>`;
  }
  function preparationHTML(report) {
    const missing = (report?.requirements || []).filter(req => !req.ok);
    const stats = missing.filter(req => req.kind === 'stat');
    const help = [...new Set(stats.flatMap(req => E.suggestions(req, state).map(option => option.name)))];
    const skillHelp = missing.some(req => req.kind === 'skill') ? '<p class="small-note">Raise this skill before taking the perk, tag it or choose a later level. Temporary stat bonuses can also help some skills.</p>' : '';
    const statHelp = stats.length ? `<p class="small-note">${help.length ? 'Bonuses that may help: ' + help.map(escape).join(', ') + '. ' : ''}You can also raise starting SPECIAL or schedule a permanent upgrade before this pick.</p>` : '';
    const selected = E.boostsFor(state).filter(boost => Number(draft.boosts?.[boost.id] || 0));
    let baseline;
    if (selected.length && report) baseline = E.simulate(state, {index: activeSlot, pick: {...draft, boosts: {}}}).reports[activeSlot];
    const dependent = baseline?.requirements.filter(req => !req.ok && ['stat', 'skill'].includes(req.kind)) || [];
    const using = selected.map(boost => escape(boost.name) + (boost.kind === 'chem' ? ' ×' + draft.boosts[boost.id] : '')).join(', ');
    const baselineMessage = selected.length && baseline?.ok ? '<p class="small-note">No chems are needed for these requirements. The selected bonuses are optional.</p>' : '';
    const support = selected.length && dependent.length ? `<div class="plan-support"><strong>Active bonuses: ${using}</strong>${dependent.map(req => `<div>${escape(req.name)}: ${req.actual}${req.kind === 'skill' ? '%' : ''} without bonuses → ${report.requirements.find(item => item.kind === req.kind && item.name === req.name)?.actual ?? req.actual}${req.kind === 'skill' ? '%' : ''} / ${req.expected < 0 ? '&lt; ' + -req.expected : req.expected}${req.kind === 'skill' ? '%' : ''}</div>`).join('')}</div>` : '';
    return `${report?.ok ? `<p class="plan-ready">✓ Requirements met${support ? ' with the selected preparation' : ''}.</p>` : ''}${missing.length ? '<div class="requirements-title">STILL NEEDED</div>' + missing.map(requirementHTML).join('') : ''}${statHelp}${skillHelp}${support}${baselineMessage}`;
  }
  function planExtensionHTML(kind) {
    const perk = perkById(inspected);
    if (!perk) return '';
    let {report} = preview();
    const pick = state.picks[activeSlot];
    const assigned = kind === 'slot' && pick?.id === inspected;
    const hasFree = freeSlot(inspected) >= 0;
    if (!assigned && !hasFree && report) {
      report = {...report, ok: false, requirements: [...report.requirements.filter(req => req.kind !== 'slot'), {kind: 'slot', name: 'Free perk pick', actual: 0, expected: draft.at, ok: false}]};
    }
    const minimum = result.earned[activeSlot] || 1;
    const configs = inspected === 'tag' ? `<label class="stack-label">Fourth tag skill<select id="pick-tag"><option value="">Select a skill</option>${E.SKILLS.filter(([id]) => !state.tags.includes(id)).map(([id]) => `<option value="${id}" ${draft.tag === id ? 'selected' : ''}>${id}</option>`).join('')}</select></label>` : inspected === 'mutate' ? `<label class="stack-label">Remove trait<select id="mutate-remove"><option value="">Select a trait</option>${E.traitsFor(state).filter(([id]) => (report?.traits || state.traits).includes(id)).map(([id, name]) => `<option value="${id}" ${draft.removeTrait === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label><label class="stack-label">Add trait<select id="mutate-add"><option value="">Select a trait</option>${E.traitsFor(state).filter(([id]) => !(report?.traits || state.traits).includes(id)).map(([id, name]) => `<option value="${id}" ${draft.addTrait === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>` : '';
    const existingCount = state.picks.filter(item => item?.id === inspected).length + Number(state.wanted.includes(inspected));
    const canAddRank = existingCount > 0 && existingCount < perk.ranks && hasFree && perkBudget().remaining > 0;
    const rankLimit = existingCount >= perk.ranks ? 'All ranks selected.' : !perkBudget().remaining ? 'No perk picks left. Remove a perk or raise the target level.' : !hasFree ? noFreePickMessage() : '';
    const rankControls = perk.ranks > 1 && existingCount ? `<div class="perk-rank-control"><span class="perk-rank-label">Planned ranks<small>Each rank uses one perk pick.</small></span><div class="perk-rank-stepper" role="group" aria-label="Planned ranks: ${escape(perk.name)}"><button class="metal-button" data-rank-perk="${perk.id}" data-rank-step="-1" aria-label="Remove last rank: ${escape(perk.name)}" title="Remove the latest planned rank" ${existingCount > 1 ? '' : 'disabled'}>−</button><output class="perk-rank-value" aria-label="${existingCount} of ${perk.ranks} ranks selected">${existingCount} <span>of ${perk.ranks}</span></output><button class="metal-button" data-rank-perk="${perk.id}" data-rank-step="1" aria-label="Add rank: ${escape(perk.name)}" title="${rankLimit || 'Add a rank at the next suitable free pick'}" ${canAddRank ? '' : 'disabled'}>+</button></div>${!canAddRank && existingCount < perk.ranks ? `<p class="perk-rank-note">${rankLimit}</p>` : ''}</div>` : '';
    const boostsOpen = E.boostsFor(state).some(boost => Number(draft.boosts?.[boost.id] || 0));
    return `<p class="plan-description">${escape(perk.description)}</p>${rankControls}${!assigned && !hasFree ? `<div class="remedy">${perk.level > state.target ? `Requires level ${perk.level}; your target is ${state.target}. ` : ''}No suitable free perk pick. Raise the target level or remove another perk.</div>` : ''}${kind === 'slot' && !assigned ? `<label class="stack-label">Perk<select id="inspect-perk">${DATA.perks.map(p => `<option value="${p.id}" ${p.id === inspected ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label>` : ''}<div class="plan-level-settings"><label class="inline-label">Take at level<input id="pick-level" type="number" min="${minimum}" max="${E.gameRules(state).maxLevel}" value="${draft.at}" aria-label="Level when taking ${perk.name}"></label><span class="small-note">Pick earned at level ${result.earned[activeSlot] || '—'}</span></div>${configs ? `<div class="plan-configs">${configs}</div>` : ''}${report ? preparationHTML(report) : `<div class="remedy">${draft.at > state.target ? `This perk is planned at level ${draft.at}, above your target of ${state.target}.` : 'No perk pick is available at this level.'}</div>`}<details class="boost-options" ${boostsOpen ? 'open' : ''}><summary>Chems</summary><p class="small-note">Only active when taking this perk. Chems count toward ${E.gameRules(state).title} perk requirements.</p>${E.boostsFor(state).map(boost => `<label class="boost-row"><span title="${escape(boost.note)}">${boost.name}<small>${Object.entries(boost.stats).map(([s, n]) => s + (n > 0 ? ' +' : ' ') + n).join(' · ')}</small></span><select data-boost="${boost.id}" aria-label="Quantity: ${boost.name}">${Array.from({length: boost.max + 1}, (_, n) => `<option value="${n}" ${Number(draft.boosts?.[boost.id] || 0) === n ? 'selected' : ''}>${n}${boost.kind === 'chem' ? '×' : ''}</option>`).join('')}</select></label>`).join('')}</details><div class="plan-actions">${!assigned ? `<button id="choose-perk" class="metal-button" ${hasFree && perkBudget().remaining > 0 ? '' : 'disabled'}>Add perk</button>` : ''}${assigned || kind === 'wanted' ? '<button data-remove-plan class="text-button">Remove perk ×</button>' : ''}<a href="${perk.source}" target="_blank" rel="noopener noreferrer">Wiki ↗</a></div>`;
  }
  function renderPlanned() {
    const entries = Array.from({length: Math.max(result.earned.length, state.picks.length)}, (_, index) => ({index, level: state.picks[index]?.at || result.earned[index]})).filter(entry => entry.level).sort((a, b) => a.level - b.level || a.index - b.index);
    const rankNumbers = new Map(), rankCounts = {};
    for (const {index} of entries) {
      const pick = state.picks[index];
      if (pick) {rankCounts[pick.id] = (rankCounts[pick.id] || 0) + 1; rankNumbers.set(index, rankCounts[pick.id]);}
    }
    const card = (key, level, perk, report, kind, index) => {
      const open = expandedPlan === key;
      const status = perk ? report?.ok ? 'ready' : 'warning' : 'empty';
      const symbol = perk ? report?.ok ? '✓' : '!' : '+';
      const label = perk ? report?.ok ? 'Requirements met' : 'Needs preparation' : 'Choose a perk';
      return `<article class="planned-card ${status} ${open ? 'plan-expanded' : ''}" data-plan-key="${key}" data-plan-level="${level}"><button class="planned-row ${perk ? 'is-planned' : ''} ${status === 'warning' ? 'plan-warning' : ''}" ${kind === 'slot' ? `data-edit-slot="${index}"` : `data-plan-wanted="${perk.id}"`} aria-expanded="${open}" aria-controls="plan-extension-${key}"><span class="planned-level">${level}</span>${perk ? `<img src="${perk.image}" alt=""><span class="planned-name"><strong>${escape(perk.name)}</strong>${perk.ranks > 1 ? `<small class="planned-rank">Rank ${rankNumbers.get(index) || 1} / ${perk.ranks}</small>` : ''}</span>` : '<span class="free-plan-slot">Choose a perk</span>'}<span class="plan-status status-${status}" role="img" aria-label="${label}" title="${label}">${symbol}</span><span class="plan-chevron" aria-hidden="true">${open ? '▾' : '▸'}</span></button><div class="plan-extension" id="plan-extension-${key}" ${open ? '' : 'hidden'}>${open ? planExtensionHTML(kind) : ''}</div></article>`;
    };
    const rows = entries.map(({index, level}) => {
      const pick = state.picks[index];
      return card('slot-' + index, level, pick && perkById(pick.id), result.reports[index], 'slot', index);
    }).join('');
    const pending = [...state.wanted].sort((a, b) => perkById(a).level - perkById(b).level).map(id => card('wanted-' + id, perkById(id).level, perkById(id), null, 'wanted')).join('');
    const previewCard = expandedPlan === 'preview' ? `<article class="planned-card plan-expanded preview-plan" data-plan-key="preview"><div class="preview-heading">${escape(perkById(inspected).name)}<button class="text-button" data-close-preview aria-label="Close perk preview">×</button></div><div class="plan-extension">${planExtensionHTML('preview')}</div></article>` : '';
    $('planned-picks').innerHTML = `<div class="plan-intro"><span>Assigned: ${state.picks.filter(Boolean).length} of ${result.earned.length} · available: ${perkBudget().remaining}</span></div>${previewCard}${rows}${pending ? '<div class="pending-heading">WANTED · WAITING FOR A SUITABLE LEVEL</div>' + pending : ''}`;
  }
  function renderMechanics() {
    const opened = new Set([...$('mechanics-grid').querySelectorAll('details[open]')].map(card => card.dataset.mechanic));
    const first = state.game === 'fallout1', title = E.gameRules(state).title;
    const engineRoot = 'https://github.com/alexbatalov/' + state.game + '-ce/blob/main/src/' + (first ? 'game/' : '');
    $('mechanics-description').textContent = title + ' · Open a topic for the hidden rules behind range, critical chance, damage and armor.';
    $('mechanics-grid').innerHTML = globalThis.FO_MECHANICS.map(topic => {
      const perk = perkById(topic.perk);
      const body = topic[state.game] || topic.body;
      const files = topic.engine.map(file => file === 'roll' && !first ? 'random' : file);
      const sources = topic.wiki.map(page => `<a href="https://fallout.fandom.com/wiki/${page}" target="_blank" rel="noopener noreferrer">${page.replace(/_\(Fallout\)$/, '').replaceAll('_', ' ')} ↗</a>`).concat(files.map(file => `<a href="${engineRoot + file}.cc" target="_blank" rel="noopener noreferrer">${title} / ${file} ↗</a>`));
      return `<details class="mechanics-card" data-mechanic="${topic.id}" ${opened.has(topic.id) ? 'open' : ''}><summary><img src="${perk.image}" alt=""><span><strong>${topic.title}</strong><small>${first && topic.fallout1Summary ? topic.fallout1Summary : topic.summary}</small></span><span class="mechanic-toggle" aria-hidden="true"></span></summary><div class="mechanic-body">${body}<div class="mechanic-sources">${sources.join('')}</div></div></details>`;
    }).join('');
    renderSniperExample();
  }
  function renderSniperExample() {
    const luck = mechanicsLuck ?? result.stats.LK;
    const perHit = mechanicsCritical + (100 - mechanicsCritical) * luck / 10;
    const percent = value => value.toFixed(1).replace(/\.0$/, '') + '%';
    $('mechanic-luck').value = luck;
    $('mechanic-critical').value = mechanicsCritical;
    $('sniper-hit-chance').textContent = percent(perHit);
    $('sniper-attack-chance').textContent = percent(perHit * .95);
  }
  function renderSkills() {
    $('skill-points-level').textContent = 'At level ' + state.target;
    $('skill-points-available').textContent = result.bank;
    $('skill-points-remaining').textContent = String(Math.max(0, result.income - result.spent)).padStart(3, '0');
    $('skill-points-earned').textContent = result.income;
    $('skill-points-spent').textContent = result.spent;
    $('skill-points-lost').textContent = result.lost;
    $('skill-points-loss').hidden = !result.lost;
    $('reset-skills').disabled = !Object.keys(state.skillGoals).length;
    $('skills-grid').innerHTML = E.SKILLS.map(([id]) => `<div class="skill-row"><label class="skill-label ${state.tags.includes(id) ? 'skill-tag' : ''}"><input type="checkbox" data-tag="${id}" ${state.tags.includes(id) ? 'checked' : ''} aria-label="Tag ${id}"><span>${id}</span></label><span class="skill-values"><strong class="${state.skillGoals[id] > result.skills[id] ? 'skill-missing' : ''}" title="Calculated at level ${state.target}">${result.skills[id]}%</strong><span aria-hidden="true">→</span><button data-skill="${id}" data-skill-step="-1" aria-label="Lower target: ${id}" ${state.skillGoals[id] ? '' : 'disabled'}>−</button><input type="number" min="0" max="${E.gameRules(state).skillCap}" data-skill-goal="${id}" value="${state.skillGoals[id] || ''}" placeholder="—" title="Desired value at the target level; leave empty to train only for perks" aria-label="Skill target: ${id}"><button data-skill="${id}" data-skill-step="1" aria-label="Raise target: ${id}" ${(state.skillGoals[id] || result.skills[id]) >= E.gameRules(state).skillCap ? 'disabled' : ''}>+</button></span></div>`).join('');
    $('training-plan').innerHTML = `<table><thead><tr><th>Lv.</th><th>Skill training</th><th>Cost</th><th>Bank</th></tr></thead><tbody>${result.ledger.filter(row => row.level > 1).map(row => `<tr><td>${row.level}</td><td>${Object.entries(row.trained).map(([id, amount]) => escape(id) + ' +' + amount + '%').join(', ') || 'Bank points'}${row.lost > result.ledger[row.level - 2].lost ? '<span class="danger-text"> · lost ' + (row.lost - result.ledger[row.level - 2].lost) + ' points above the 99-point limit</span>' : ''}</td><td>${row.spent - result.ledger[row.level - 2].spent}</td><td>${row.bank}</td></tr>`).join('')}</tbody></table>`;
  }
  function renderSecrets() {
    const search = $('secret-search').value.toLocaleLowerCase('en').trim();
    const items = DATA.specials.filter(perk => [perk.name, perk.location, perk.how].join(' ').toLocaleLowerCase('en').includes(search));
    $('secret-counter').textContent = 'FOUND ' + state.secrets.length + ' / ' + DATA.specials.length;
    $('reset-secrets').disabled = !state.secrets.length;
    $('secret-grid').innerHTML = items.map(perk => `<article class="secret-card ${state.secrets.includes(perk.id) ? 'collected' : ''}"><span class="secret-type">${perk.type === 'upgrade' ? 'STAT UPGRADE' : perk.type === 'reputation' ? 'SPECIAL REPUTATION' : perk.id.includes('assault') || perk.id.includes('armor') || perk.id.includes('dermal') ? 'IMPLANT' : 'EVENT PERK'}</span><div class="secret-top"><img src="${perk.image}" alt="${perk.name}" loading="lazy"><div><h3>${perk.name}</h3></div></div><div class="location">⌖ ${perk.location}</div><p>${perk.how}</p><p class="secret-effect">${perk.effect}</p><div class="secret-actions"><label><input type="checkbox" data-secret="${perk.id}" ${state.secrets.includes(perk.id) ? 'checked' : ''}>Found in the wasteland</label><a href="${perk.source}" target="_blank" rel="noopener noreferrer">Wiki ↗</a></div></article>`).join('') || '<p class="no-results">No matching entries in the archive.</p>';
  }
  function commitDraft() {
    if (!result.earned[activeSlot]) return;
    if (!canCommit(draft.id, activeSlot)) return;
    state.picks[activeSlot] = E.clone(draft);
    state.wanted = state.wanted.filter(id => id !== draft.id);
    expandedPlan = 'slot-' + activeSlot;
    refresh();
    notify('Perk saved in the node for level ' + result.earned[activeSlot] + '.');
  }
  function synchronizeDraft() {
    previews.clear();
    if (state.picks[activeSlot]?.id === inspected) state.picks[activeSlot] = E.clone(draft);
    refresh();
  }
  function setTarget(value) {
    state.target = Math.max(2, Math.min(E.gameRules(state).maxLevel, Math.trunc(Number(value) || 2)));
    const levels = E.schedule(state);
    if (activeSlot >= levels.length && !state.picks[activeSlot]) {
      expandedPlan = '';
      activeSlot = Math.max(0, levels.length - 1);
      const pick = state.picks[activeSlot];
      inspected = pick?.id || state.goal;
      draft = pick ? E.clone(pick) : {id: inspected, at: levels[activeSlot] || state.target, boosts: {}};
    }
    refresh();
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.open) {
      openPanel(button.dataset.open);
    } else if (button.hasAttribute('data-close')) {
      button.closest('dialog')?.close();
    } else if (button.dataset.treePerk) {
      togglePerk(button.dataset.treePerk);
    } else if (button.dataset.perkInfo) {
      showPerkDetails(button.dataset.perkInfo);
    } else if (button.dataset.traitInfo) {
      const id = button.dataset.traitInfo;
      if (expandedTraits.has(id)) expandedTraits.delete(id);
      else expandedTraits.add(id);
      button.setAttribute('aria-expanded', String(expandedTraits.has(id)));
      $('trait-description-' + id).hidden = !expandedTraits.has(id);
    } else if (button.dataset.skillStep) {
      const id = button.dataset.skill;
      const value = state.skillGoals[id] || result.skills[id];
      setSkillGoal(id, value + Number(button.dataset.skillStep));
      document.querySelector(`[data-skill="${id}"][data-skill-step="${button.dataset.skillStep}"]`)?.focus({preventScroll: true});
    } else if (button.id === 'reset-special') {
      state.base = newBuild(state.game).base;
      refresh();
      notify('Base SPECIAL reset to 5 in each attribute.');
    } else if (button.id === 'reset-traits') {
      state.traits = [];
      refresh();
      notify('Starting traits reset.');
    } else if (button.id === 'reset-upgrades') {
      event.preventDefault();
      state.operations = [];
      refresh();
      notify('Operations and upgrades reset.');
    } else if (button.id === 'reset-secrets') {
      state.secrets = [];
      save(); renderSecrets();
      notify('Wasteland secrets checklist reset.');
    } else if (button.id === 'reset-skills') {
      state.skillGoals = {};
      refresh();
      notify('Skill goals reset. Training required for selected perks is still included.');
    } else if (button.id === 'reset-perks' || button.id === 'reset-planned-perks') {
      state.picks = []; state.wanted = [];
      activeSlot = 0; inspected = 'awareness'; expandedPlan = '';
      draft = {id: inspected, at: E.schedule(state)[0] || state.target, boosts: {}};
      refresh();
      notify('Perk selections reset.');
    } else if (button.dataset.editSlot !== undefined || button.dataset.levelInfo !== undefined) {
      const index = Number(button.dataset.editSlot ?? button.dataset.levelInfo);
      if (!result.earned[index] && !state.picks[index]) {notify('This level is above your target. Raise the target level to plan a perk here.'); return;}
      if (expandedPlan === 'slot-' + index && button.dataset.editSlot !== undefined) {expandedPlan = ''; renderPlanned();}
      else showPerkDetails(state.picks[index]?.id || 'awareness', index);
    } else if (button.dataset.planWanted) {
      if (expandedPlan === 'wanted-' + button.dataset.planWanted) {expandedPlan = ''; renderPlanned();}
      else showPerkDetails(button.dataset.planWanted);
    } else if (button.hasAttribute('data-remove-plan')) {
      if (expandedPlan.startsWith('wanted-')) state.wanted = state.wanted.filter(id => id !== inspected);
      else state.picks[activeSlot] = null;
      expandedPlan = '';
      refresh();
    } else if (button.dataset.treeRankStep) {
      changePerkRanks(button.dataset.treeRankPerk, Number(button.dataset.treeRankStep), true);
    } else if (button.dataset.rankStep) {
      changePerkRanks(button.dataset.rankPerk, Number(button.dataset.rankStep));
    } else if (button.hasAttribute('data-close-preview')) {
      expandedPlan = ''; renderPlanned();
    } else if (button.hasAttribute('data-gain-family')) {
      gainExpanded = !gainExpanded; renderMap();
    } else if (button.dataset.category) {
      category = category === button.dataset.category ? 'all' : button.dataset.category;
      $('map-scroll').scrollLeft = 0;
      renderMap();
    } else if (button.dataset.stat) {
      const stat = button.dataset.stat, step = Number(button.dataset.step), current = creationStats()[stat];
      if (step < 0 && current === 1 && state.base[stat] > 1) setBaseStat(stat, state.base[stat] - 1);
      else setCreationStat(stat, current + step);
    } else if (button.dataset.targetStep) {
      setTarget(state.target + Number(button.dataset.targetStep));
    } else if (button.dataset.tab) {
      document.querySelectorAll('[data-tab]').forEach(tab => {tab.classList.toggle('active', tab === button); tab.setAttribute('aria-selected', tab === button ? 'true' : 'false');});
      ['build', 'secrets', 'mechanics'].forEach(tab => $(tab + '-view').hidden = tab !== button.dataset.tab);
      if (button.dataset.tab === 'secrets') renderSecrets();
    } else if (button.id === 'choose-perk') {
      commitDraft();
    } else if (['zoom-in', 'zoom-out', 'zoom-reset'].includes(button.id)) {
      zoom = button.id === 'zoom-reset' ? 1 : Math.max(.5, Math.min(1.5, Math.round((zoom + (button.id === 'zoom-in' ? .1 : -.1)) * 100) / 100));
      $('level-map').style.zoom = zoom;
      $('zoom-label').textContent = Math.round(zoom * 100) + '%';
    } else if (button.id === 'new-build') {
      state = newBuild(state.game); activeSlot = 0; inspected = 'awareness';
      if (location.hash.startsWith('#build=')) history.replaceState(null, '', location.href.split('#')[0]);
      expandedTraits.clear(); expandedPlan = '';
      draft = {id: inspected, at: E.schedule(state)[0], boosts: {}};
      refresh(); renderSecrets();
      openPanel('character-dialog');
      $('character-dialog').querySelector('.drawer-body').scrollTop = 0;
      notify('New character: 5 unspent SPECIAL points, no traits or tag skills selected.');
    } else if (button.id === 'export') {
      const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json;charset=utf-8'});
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = state.game + '-build.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Build saved as JSON.');
    } else if (button.id === 'import') {
      $('import-file').click();
    } else if (button.id === 'share') {
      const bytes = new TextEncoder().encode(JSON.stringify(state));
      const code = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
      const url = location.href.split('#')[0] + '#build=' + encodeURIComponent(code);
      try {
        await navigator.clipboard.writeText(url);
        notify(location.protocol === 'file:' ? 'Link copied. A JSON build file is easier to share with another device.' : 'Build link copied.');
      } catch (_) {
        const field = document.createElement('textarea');
        field.value = url; document.body.appendChild(field); field.select();
        const copied = document.execCommand('copy'); field.remove();
        notify(copied ? 'Build link copied.' : 'Clipboard unavailable. Save the build as JSON.');
      }
    }
  });
  document.addEventListener('change', async event => {
    const input = event.target;
    if (input.id === 'game-select') {
      switchGame(input.value);
    } else if (input.id === 'perk-saving-mode') {
      if (state.game !== 'fallout2') return;
      state.mode = input.value === 'sfall' ? 'sfall' : 'vanilla';
      refresh();
    } else if (input.id === 'mechanic-luck' || input.id === 'mechanic-critical') {
      if (input.id === 'mechanic-luck') mechanicsLuck = Math.max(1, Math.min(10, Math.trunc(Number(input.value) || 1)));
      else mechanicsCritical = Math.max(0, Math.min(100, Number(input.value) || 0));
      renderSniperExample();
    } else if (input.id === 'planning-time') {
      state.time = input.value === 'night' ? 'night' : 'day';
      refresh();
    } else if (input.dataset.base) {
      setCreationStat(input.dataset.base, input.value);
    } else if (input.dataset.trait) {
      const id = input.dataset.trait;
      if (input.checked && state.traits.length >= 2) {input.checked = false; notify('You can select up to two traits.'); return;}
      state.traits = input.checked ? [...state.traits, id] : state.traits.filter(t => t !== id);
      refresh();
    } else if (input.dataset.tag) {
      const id = input.dataset.tag;
      if (input.checked && state.tags.length >= 3) {input.checked = false; notify('Select three tag skills. The Tag! perk adds a fourth.'); return;}
      state.tags = input.checked ? [...state.tags, id] : state.tags.filter(t => t !== id);
      refresh();
    } else if (input.dataset.operation) {
      const id = input.dataset.operation, op = E.operationsFor(state).find(o => o.id === id);
      if (input.checked) {
        state.operations = state.operations.filter(o => !op.group || E.operationsFor(state).find(d => d.id === o.id).group !== op.group);
        state.operations.push({id, at: state.target});
      } else state.operations = state.operations.filter(o => o.id !== id);
      refresh();
    } else if (input.dataset.operationLevel) {
      state.operations.find(o => o.id === input.dataset.operationLevel).at = Math.max(1, Math.min(E.gameRules(state).maxLevel, Math.trunc(Number(input.value) || 1)));
      refresh();
    } else if (input.dataset.boost) {
      draft.boosts ||= {};
      draft.boosts[input.dataset.boost] = Number(input.value);
      synchronizeDraft();
    } else if (input.dataset.skillGoal) {
      setSkillGoal(input.dataset.skillGoal, input.value);
    } else if (input.dataset.secret) {
      state.secrets = input.checked ? [...state.secrets, input.dataset.secret] : state.secrets.filter(s => s !== input.dataset.secret);
      save(); renderSecrets();
    } else if (input.id === 'target-level') {
      setTarget(input.value);
    } else if (input.id === 'character-name') {
      state.name = input.value; save();
    } else if (input.id === 'inspect-perk') {
      changeSlot(activeSlot, input.value);
      draft.manualLevel = false;
      draft.at = Math.max(draft.at, perkById(inspected).level);
      previews.clear(); renderPlanned();
    } else if (input.id === 'pick-level') {
      draft.at = Math.max(1, Math.min(E.gameRules(state).maxLevel, Math.trunc(Number(input.value) || 1))); draft.manualLevel = true; synchronizeDraft();
    } else if (input.id === 'pick-tag') {
      draft.tag = input.value; synchronizeDraft();
    } else if (input.id === 'mutate-remove' || input.id === 'mutate-add') {
      draft[input.id === 'mutate-remove' ? 'removeTrait' : 'addTrait'] = input.value; synchronizeDraft();
    } else if (input.id === 'import-file' && input.files[0]) {
      try {
        const loaded = E.cleanState(JSON.parse(await input.files[0].text()));
        if (!loaded) {notify('Unsupported build format. Your current plan is unchanged.'); return;}
        save();
        if (location.hash.startsWith('#build=')) history.replaceState(null, '', location.href.split('#')[0]);
        state = loaded; activeSlot = 0; expandedPlan = ''; inspected = state.picks[0]?.id || state.goal;
        draft = state.picks[0] ? E.clone(state.picks[0]) : {id: inspected, at: E.schedule(state)[0] || state.target, boosts: {}};
        refresh(); renderSecrets(); notify('Build loaded.');
      } catch (_) {notify('Could not read the JSON file. Your current plan is unchanged.');}
      finally {input.value = '';}
    }
  });
  $('perk-search').addEventListener('input', () => {
    renderMap();
    const nodes = document.querySelectorAll('[data-tree-perk]');
    if (nodes.length === 1) nodes[0].scrollIntoView({block: 'center', inline: 'center'});
  });
  $('secret-search').addEventListener('input', renderSecrets);
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  });
  $('source-links').innerHTML = globalThis.FO2_DATA.sources.map(url => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${url.includes('github') ? 'fallout2-ce / ' + url.split('/').pop() : url.split('/').pop().replaceAll('_', ' ')} ↗</a></li>`).join('');
  $('source-links-fo1').innerHTML = globalThis.FO1_DATA.sources.map(url => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${url.includes('github') ? 'fallout1-ce / ' + url.split('/').pop() : url.split('/').pop().replaceAll('_', ' ')} ↗</a></li>`).join('');
  load();
  inspected = state.picks[0]?.id || state.goal;
  draft = state.picks[0] ? E.clone(state.picks[0]) : {id: inspected, at: E.schedule(state)[0] || state.target, boosts: {}};
  refresh(); renderSecrets();
  // Read-only access for reproducible browser checks.
  globalThis.FO2_APP = {getState: () => E.clone(state), getResult: () => E.clone(result)};
})();
