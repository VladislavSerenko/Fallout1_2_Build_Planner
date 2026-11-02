/* Original Fallout 1 and 2 rules. UI and persistence are separate from calculations. */
(function (root) {
  'use strict';
  const STATS = ['ST', 'PE', 'EN', 'CH', 'IN', 'AG', 'LK'];
  const SKILLS = [
    ['Small Guns', 'Small Guns', 5, 4, ['AG']], ['Big Guns', 'Big Guns', 0, 2, ['AG']],
    ['Energy Weapons', 'Energy Weapons', 0, 2, ['AG']], ['Unarmed', 'Unarmed', 30, 2, ['AG', 'ST']],
    ['Melee Weapons', 'Melee Weapons', 20, 2, ['AG', 'ST']], ['Throwing', 'Throwing', 0, 4, ['AG']],
    ['First Aid', 'First Aid', 0, 2, ['PE', 'IN']], ['Doctor', 'Doctor', 5, 1, ['PE', 'IN']],
    ['Sneak', 'Sneak', 5, 3, ['AG']], ['Lockpick', 'Lockpick', 10, 1, ['PE', 'AG']],
    ['Steal', 'Steal', 0, 3, ['AG']], ['Traps', 'Traps', 10, 1, ['PE', 'AG']],
    ['Science', 'Science', 0, 4, ['IN']], ['Repair', 'Repair', 0, 3, ['IN']],
    ['Speech', 'Speech', 0, 5, ['CH']], ['Barter', 'Barter', 0, 4, ['CH']],
    ['Gambling', 'Gambling', 0, 5, ['LK']], ['Outdoorsman', 'Outdoorsman', 0, 2, ['EN', 'IN']]
  ];
  const TRAITS = [
    ['gifted', 'Gifted', 'Gifted', '+1 to all SPECIAL stats; −10% to skills and −5 skill points per level.'],
    ['skilled', 'Skilled', 'Skilled', '+5 skill points per level; a perk every 4 levels.'],
    ['small-frame', 'Small Frame', 'Small Frame', '+1 Agility; reduced carry weight.'],
    ['bruiser', 'Bruiser', 'Bruiser', '+2 Strength; −2 Action Points.'],
    ['fast-shot', 'Fast Shot', 'Fast Shot', 'Ranged and throwing attacks cost 1 fewer AP; aimed attacks are unavailable.'],
    ['finesse', 'Finesse', 'Finesse', '+10% critical hit chance; reduced normal damage.'],
    ['good-natured', 'Good Natured', 'Good Natured', '+15% First Aid, Doctor, Speech and Barter; −10% to combat skills.'],
    ['heavy-handed', 'Heavy Handed', 'Heavy Handed', '+4 melee damage; −30 to the critical effect roll.'],
    ['kamikaze', 'Kamikaze', 'Kamikaze', '+5 Sequence; no natural Armor Class.'],
    ['bloody-mess', 'Bloody Mess', 'Bloody Mess', 'More violent death animations.'],
    ['chem-reliant', 'Chem Reliant', 'Chem Reliant', 'Twice the addiction risk; faster recovery from withdrawal.'],
    ['chem-resistant', 'Chem Resistant', 'Chem Resistant', 'Half the addiction risk; chems last half as long.'],
    ['fast-metabolism', 'Fast Metabolism', 'Fast Metabolism', '+2 Healing Rate; base Poison and Radiation Resistance become zero.'],
    ['jinxed', 'Jinxed', 'Jinxed', 'More critical failures for everyone, including you.'],
    ['one-hander', 'One Hander', 'One Hander', '+20% accuracy with one-handed weapons; −40% with two-handed weapons.'],
    ['sex-appeal', 'Sex Appeal', 'Sex Appeal', 'Changes dialogue reactions based on sex.']
  ];
  const BOOSTS = [
    {id: 'buffout', name: 'Buffout', kind: 'chem', stats: {ST: 2, EN: 3, AG: 2}, max: 2, note: '6 hours; 25% addiction chance.', source: 'Buffout_(Fallout_2)'},
    {id: 'mentats', name: 'Mentats', kind: 'chem', stats: {PE: 2, IN: 2, CH: 1}, max: 2, note: '24 hours; 15% addiction chance.', source: 'Mentats_(Fallout_2)'},
    {id: 'psycho', name: 'Psycho', kind: 'chem', stats: {AG: 3, IN: -3}, max: 2, note: 'AG +3, IN −3; 20% addiction chance.', source: 'Psycho_(Fallout_2)'}
  ];
  const OPERATIONS = [
    {id: 'ace-st', name: 'ACE · Red memory module', stats: {ST: 1}, note: 'Vault 8 → Brotherhood, San Francisco. ST +1.', source: 'Red_memory_module'},
    {id: 'ace-pe', name: 'ACE · Green memory module', stats: {PE: 1}, note: 'Mariposa → Brotherhood, San Francisco. PE +1.', source: 'Green_memory_module'},
    {id: 'ace-in', name: 'ACE · Yellow memory module', stats: {IN: 1}, note: 'Sierra Army Depot → Brotherhood, San Francisco. IN +1.', source: 'Yellow_memory_module'},
    {id: 'ace-ch', name: 'ACE · Blue memory module', stats: {CH: 1}, note: 'Navarro → Brotherhood, San Francisco. CH +1.', source: 'Blue_memory_module'},
    {id: 'zeta-ncr', name: 'Zeta scan · NCR', stats: {LK: 2}, group: 'zeta', note: 'Successful outcome: LK +2. 50% chance; failure gives LK −1. NCR and SF scans are mutually exclusive.', source: 'Zeta_scan'},
    {id: 'zeta-sf', name: 'Zeta scan · San Francisco', stats: {IN: 1, LK: 1}, group: 'zeta', note: 'Successful outcome: IN +1, LK +1. 50% chance; failure gives LK −1.', source: 'Zeta_scan'},
    {id: 'dermal', name: 'Dermal Assault · CH penalty', stats: {CH: -1}, note: 'The enhanced dermal implant reduces CH by 1.', source: 'Dermal_Impact_Assault_Enhancement'},
    {id: 'phoenix', name: 'Phoenix Assault · CH penalty', stats: {CH: -1}, note: 'The enhanced Phoenix implant reduces CH by 1.', source: 'Phoenix_Assault_Enhancement'}
  ];
  const SKILL_BONUSES = {
    gambler: {'Gambling': 20}, harmless: {'Steal': 20}, 'living-anatomy': {'Doctor': 10},
    'master-thief': {'Lockpick': 15, 'Steal': 15}, medic: {'First Aid': 10, 'Doctor': 10},
    'mr-fixit': {'Science': 10, 'Repair': 10}, negotiator: {'Speech': 10, 'Barter': 10},
    ranger: {'Outdoorsman': 15}, salesman: {'Barter': 20}, speaker: {'Speech': 20},
    survivalist: {'Outdoorsman': 25}, thief: {'Sneak': 10, 'Lockpick': 10, 'Steal': 10, 'Traps': 10}
  };
  const FO1_SKILLS = [
    [35, 1, ['AG']], [10, 1, ['AG']], [10, 1, ['AG']],
    [65, 1, ['AG', 'ST']], [55, 1, ['AG', 'ST']], [40, 1, ['AG']],
    [30, 1, ['PE', 'IN']], [15, 1, ['PE', 'IN']], [25, 1, ['AG']],
    [20, 1, ['PE', 'AG']], [20, 1, ['AG']], [20, 1, ['PE', 'AG']],
    [25, 2, ['IN']], [20, 1, ['IN']], [25, 2, ['CH']],
    [20, 2, ['CH']], [20, 3, ['LK']], [5, 1, ['EN', 'IN']]
  ];
  const FO1_SKILL_BONUSES = {
    medic: {'First Aid': 20, Doctor: 20}, 'mr-fixit': {Science: 20, Repair: 20},
    speaker: {Speech: 20, Barter: 20}, 'master-thief': {Sneak: 10, Lockpick: 10, Steal: 10, Traps: 10}
  };
  function gameRules(value) {
    const game = typeof value === 'string' ? value : value?.game;
    return game === 'fallout1'
      ? {id: 'fallout1', title: 'Fallout 1', hero: 'Vault Dweller', maxLevel: 21, skillCap: 200}
      : {id: 'fallout2', title: 'Fallout 2', hero: 'Chosen One', maxLevel: 99, skillCap: 300};
  }
  const catalogFor = value => gameRules(value).id === 'fallout1' ? root.FO1_DATA : root.FO2_DATA;
  const operationsFor = value => gameRules(value).id === 'fallout1' ? root.FO1_DATA.operations : OPERATIONS;
  const boostsFor = () => BOOSTS;
  function traitsFor(value) {
    if (gameRules(value).id !== 'fallout1') return TRAITS;
    return TRAITS.filter(t => t[0] !== 'sex-appeal').map(t => t[0] === 'skilled'
      ? ['skilled', 'Skilled', 'Skilled', '+10% to all skills; a perk every 4 levels. No extra skill points per level.'] : t)
      .concat([['night-person', 'Night Person', 'Night_Person_(Fallout)', '+1 Perception and Intelligence at night, −1 during the day. Choose the planning time below.']]);
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const perkById = (id, game) => catalogFor(game).perks.find(perk => perk.id === id);
  function defaults(game) {
    const rules = gameRules(game);
    const value = {version: 2, game: rules.id, time: 'day', name: rules.hero, target: rules.id === 'fallout1' ? 21 : 24, goal: 'sniper', mode: 'sfall',
      base: {ST: 5, PE: 6, EN: 4, CH: 2, IN: 7, AG: 9, LK: 7}, traits: ['gifted', 'fast-shot'],
      tags: ['Small Guns', 'Speech', 'Lockpick'], karma: 0, operations: [], picks: [
        {id: 'awareness', at: 3, boosts: {}}, {id: 'more-criticals', at: 6, boosts: {}},
        {id: 'better-criticals', at: 9, boosts: {}}, {id: 'action-boy', at: 12, boosts: {}},
        {id: 'bonus-rate-of-fire', at: 15, boosts: {}}, {id: 'action-boy', at: 18, boosts: {}}
      ], wanted: [], secrets: [], skillGoals: {}};
    if (rules.id === 'fallout1') value.picks = [];
    return value;
  }
  function cleanState(input) {
    if (!input || ![1, 2].includes(input.version) || !input.base || !Array.isArray(input.picks)) return null;
    const value = defaults(input.game);
    const rules = gameRules(value), traits = traitsFor(value), operations = operationsFor(value);
    value.time = input.time === 'night' ? 'night' : 'day';
    value.name = typeof input.name === 'string' ? input.name.slice(0, 60) : value.name;
    if (value.name.trim().toLowerCase() === '\u0438\u0437\u0431\u0440\u0430\u043d\u043d\u044b\u0439') value.name = 'Chosen One';
    value.target = clamp(Math.trunc(Number(input.target) || value.target), 2, rules.maxLevel);
    // Version 1 used the old default. Migrate it once; version 2 preserves an explicit original-game choice.
    value.mode = input.version === 2 && input.mode === 'vanilla' ? 'vanilla' : 'sfall';
    value.goal = perkById(input.goal, value) ? input.goal : 'sniper';
    STATS.forEach(stat => value.base[stat] = clamp(Math.trunc(Number(input.base[stat]) || 1), 1, 10));
    value.traits = [...new Set((Array.isArray(input.traits) ? input.traits : []).filter(id => traits.some(t => t[0] === id)))].slice(0, 2);
    value.tags = [...new Set((Array.isArray(input.tags) ? input.tags : []).filter(id => SKILLS.some(s => s[0] === id)))].slice(0, 3);
    value.karma = clamp(Math.trunc(Number(input.karma) || 0), -1000, 1000);
    value.operations = [];
    for (const op of (Array.isArray(input.operations) ? input.operations : [])) {
      const definition = operations.find(x => x.id === op.id);
      if (!definition || value.operations.some(x => x.id === op.id || (definition.group && operations.find(d => d.id === x.id).group === definition.group))) continue;
      value.operations.push({id: op.id, at: clamp(Math.trunc(Number(op.at) || 1), 1, rules.maxLevel)});
    }
    value.picks = input.picks.slice(0, 33).map(pick => {
      if (!pick || !perkById(pick.id, value)) return null;
      const result = {id: pick.id, at: clamp(Math.trunc(Number(pick.at) || 3), 1, rules.maxLevel), boosts: {}};
      if (typeof pick.manualLevel === 'boolean') result.manualLevel = pick.manualLevel;
      for (const boost of boostsFor(value)) result.boosts[boost.id] = clamp(Math.trunc(Number(pick.boosts?.[boost.id]) || 0), 0, boost.max);
      result.tag = SKILLS.some(s => s[0] === pick.tag) ? pick.tag : '';
      result.removeTrait = traits.some(t => t[0] === pick.removeTrait) ? pick.removeTrait : '';
      result.addTrait = traits.some(t => t[0] === pick.addTrait) ? pick.addTrait : '';
      return result;
    });
    value.secrets = [...new Set((Array.isArray(input.secrets) ? input.secrets : []).filter(id => catalogFor(value).specials.some(s => s.id === id)))];
    value.wanted = [...new Set((Array.isArray(input.wanted) ? input.wanted : []).filter(id => perkById(id, value) && !value.picks.some(pick => pick?.id === id)))];
    value.skillGoals = {};
    for (const [id] of SKILLS) if (input.skillGoals?.[id]) value.skillGoals[id] = clamp(Math.trunc(Number(input.skillGoals[id]) || 0), 0, rules.skillCap);
    return value;
  }
  function schedule(state) {
    // Mutate! can replace Skilled. Future perk events use the new trait.
    let traits = [...state.traits];
    const levels = [];
    for (let level = 2; level <= Math.min(state.target, gameRules(state).maxLevel); level++) {
      if (level % (traits.includes('skilled') ? 4 : 3) === 0) levels.push(level);
      state.picks.forEach((pick, index) => {
        if (pick?.id === 'mutate' && pick.at === level && levels[index] && pick.at >= levels[index] && traits.includes(pick.removeTrait) && pick.addTrait !== pick.removeTrait && !traits.includes(pick.addTrait)) {
          traits = traits.filter(t => t !== pick.removeTrait).concat(pick.addTrait);
        }
      });
    }
    return levels;
  }
  function arrangePicks(state) {
    const originalLevels = schedule(state);
    const entries = state.picks.flatMap((pick, index) => {
      if (!pick) return [];
      const minimum = perkById(pick.id, state).level;
      const manualLevel = pick.manualLevel ?? (!!originalLevels[index] && pick.at >= Math.max(originalLevels[index], minimum) && pick.at !== Math.max(originalLevels[index], minimum) && (!originalLevels[index + 1] || pick.at < originalLevels[index + 1]));
      return [{pick: {...pick, manualLevel}, index}];
    });
    for (const id of state.wanted || []) if (!entries.some(entry => entry.pick.id === id)) entries.push({pick: {id, boosts: {}, manualLevel: false}, index: null});
    // Reserve explicitly chosen levels; automatic picks follow their unlock levels.
    entries.sort((a, b) => Number(b.pick.manualLevel) - Number(a.pick.manualLevel) || perkById(a.pick.id, state).level - perkById(b.pick.id, state).level);
    let levels = originalLevels, arranged;
    for (let pass = 0; pass < 34; pass++) {
      const picks = Array(levels.length).fill(null), wanted = [], slots = {}, rejected = [];
      for (const entry of entries) {
        const minimum = perkById(entry.pick.id, state).level;
        const index = levels.findIndex((level, slot) => {
          const at = entry.pick.manualLevel ? entry.pick.at : Math.max(level, minimum);
          return !picks[slot] && at >= level && at <= state.target && (state.mode === 'sfall' || !levels[slot + 1] || at < levels[slot + 1]);
        });
        if (index < 0) {rejected.push(entry); continue;}
        picks[index] = {...entry.pick, at: entry.pick.manualLevel ? entry.pick.at : Math.max(levels[index], minimum)};
        if (entry.index !== null) slots[entry.index] = index;
      }
      for (const entry of rejected) {
        if (entry.index === null) {wanted.push(entry.pick.id); continue;}
        // Keep every rank and its configuration when the target has too few valid picks.
        const empty = picks.findIndex(pick => !pick), index = empty < 0 ? picks.length : empty;
        picks[index] = {...entry.pick, at: entry.pick.manualLevel ? entry.pick.at : Math.max(levels[index] || 0, perkById(entry.pick.id, state).level)};
        slots[entry.index] = index;
      }
      while (picks.length && !picks[picks.length - 1]) picks.pop();
      arranged = {picks, wanted, slots};
      const updated = schedule({...state, picks});
      if (JSON.stringify(updated) === JSON.stringify(levels)) break;
      levels = updated;
    }
    return arranged;
  }
  function statsAt(state, context, level, boosts = {}) {
    const result = {...state.base};
    for (const stat of STATS) {
      if (context.traits.includes('gifted')) result[stat]++;
      if (context.traits.includes('bruiser') && stat === 'ST') result[stat] += 2;
      if (context.traits.includes('small-frame') && stat === 'AG') result[stat]++;
      if (context.traits.includes('night-person') && ['PE', 'IN'].includes(stat)) result[stat] += state.time === 'night' ? 1 : -1;
      result[stat] += context.gains[stat] || 0;
    }
    for (const op of state.operations) if (op.at <= level) {
      const definition = operationsFor(state).find(x => x.id === op.id);
      if (!definition) continue;
      for (const [stat, amount] of Object.entries(definition.stats)) result[stat] += amount;
    }
    // Clamp permanent stats to 1..10 before applying temporary modifiers.
    STATS.forEach(stat => result[stat] = clamp(result[stat], 1, 10));
    for (const boost of boostsFor(state)) for (const [stat, amount] of Object.entries(boost.stats)) result[stat] += amount * (boosts[boost.id] || 0);
    STATS.forEach(stat => result[stat] = clamp(result[stat], 1, 10));
    return result;
  }
  function skillValue(state, context, id, stats) {
    const definition = SKILLS.find(s => s[0] === id);
    const isTag = context.tags.includes(id);
    const isFirstGame = gameRules(state).id === 'fallout1';
    let result = definition[2] + definition[3] * definition[4].reduce((sum, stat) => sum + stats[stat], 0);
    if (isFirstGame) {
      const [base, multiplier, attributes] = FO1_SKILLS[SKILLS.findIndex(s => s[0] === id)];
      result = base + Math.floor(multiplier * attributes.reduce((sum, stat) => sum + stats[stat], 0) / attributes.length);
      if (context.traits.includes('skilled')) result += 10;
    }
    result += (context.units[id] || 0) * (isTag ? 2 : 1);
    if (isFirstGame ? isTag : state.tags.includes(id)) result += 20;
    if (context.traits.includes('gifted')) result -= 10;
    if (context.traits.includes('good-natured')) {
      if (SKILLS.findIndex(s => s[0] === id) < 6) result -= 10;
      if (['First Aid', 'Doctor', 'Speech', 'Barter'].includes(id)) result += 15;
    }
    for (const [perk, count] of Object.entries(context.ranks)) result += ((isFirstGame ? FO1_SKILL_BONUSES : SKILL_BONUSES)[perk]?.[id] || 0) * count;
    return Math.min(gameRules(state).skillCap, result);
  }
  function skillCost(value, state) {
    if (gameRules(state).id === 'fallout1') return 1;
    if (value <= 100) return 1;
    if (value <= 125) return 2;
    if (value <= 150) return 3;
    if (value <= 175) return 4;
    if (value <= 200) return 5;
    return 6;
  }
  function trainingNeeds(state, context, perk, stats) {
    let requirements = perk.skills;
    if (perk.skillMode === 'or' && requirements.length) {
      requirements = [...requirements].sort((a, b) => estimate(a) - estimate(b)).slice(0, 1);
    }
    function estimate(req) {
      let value = skillValue(state, context, req.id, stats), cost = 0;
      while (value < req.min) {cost += skillCost(value, state); value += context.tags.includes(req.id) ? 2 : 1;}
      return cost;
    }
    return requirements.map(req => ({id: req.id, units: Math.max(0, Math.ceil((req.min - skillValue(state, context, req.id, stats)) / (context.tags.includes(req.id) ? 2 : 1)))}));
  }
  function applyPerk(context, perk, pick) {
    context.ranks[perk.id] = (context.ranks[perk.id] || 0) + 1;
    if (perk.gain) context.gains[perk.gain] = (context.gains[perk.gain] || 0) + 1;
    if (perk.id === 'tag' && pick.tag && !context.tags.includes(pick.tag)) context.tags.push(pick.tag);
    if (perk.id === 'mutate' && context.traits.includes(pick.removeTrait) && !context.traits.includes(pick.addTrait) && pick.addTrait) {
      context.traits = context.traits.filter(t => t !== pick.removeTrait).concat(pick.addTrait);
    }
  }
  function check(state, context, perk, pick, earned, nextEarned, level, bank, scheduleMode) {
    const stats = statsAt(state, context, level, pick.boosts);
    const permanent = statsAt(state, context, level);
    const requirements = [];
    const add = (kind, name, actual, expected, ok) => requirements.push({kind, name, actual, expected, ok});
    add('level', 'Level', level, perk.level, level >= perk.level);
    add('rank', 'Ranks', context.ranks[perk.id] || 0, perk.ranks, (context.ranks[perk.id] || 0) < perk.ranks);
    add('slot', 'Perk pick', earned || 0, level, !!earned && level >= earned && (scheduleMode === 'sfall' || !nextEarned || level < nextEarned));
    for (const [stat, min] of Object.entries(perk.stats)) if (min) add('stat', stat, stats[stat], min, min < 0 ? stats[stat] < -min : stats[stat] >= min);
    const skillChecks = perk.skills.map(req => ({kind: 'skill', name: req.id, actual: skillValue(state, context, req.id, stats), expected: req.min}));
    const orMet = perk.skillMode === 'or' && skillChecks.some(req => req.actual >= req.expected);
    skillChecks.forEach(req => requirements.push({...req, ok: orMet || req.actual >= req.expected, or: perk.skillMode === 'or'}));
    if (perk.karma) add('karma', 'Karma', state.karma, perk.karma, state.karma >= perk.karma);
    if (perk.id === 'tag') add('config', 'Fourth tag skill', pick.tag || 'not selected', 'new skill', !!pick.tag && !context.tags.includes(pick.tag));
    if (perk.id === 'mutate') add('config', 'Trait replacement', pick.addTrait || 'not selected', 'one new trait', context.traits.includes(pick.removeTrait) && !!pick.addTrait && !context.traits.includes(pick.addTrait));
    return {ok: requirements.every(req => req.ok), requirements, stats, permanent, bank, traits: [...context.traits], skills: Object.fromEntries(SKILLS.map(([id]) => [id, skillValue(state, context, id, stats)]))};
  }
  function simulate(state, override) {
    const picks = clone(state.picks);
    if (override) picks[override.index] = clone(override.pick);
    const working = {...state, picks};
    const earned = schedule(working);
    const context = {ranks: {}, gains: {}, units: {}, traits: [...state.traits], tags: [...state.tags]};
    let bank = 0, income = 0, spent = 0, lost = 0;
    const reports = {}, ledger = [];
    const events = picks.map((pick, index) => ({pick, index})).filter(e => e.pick && e.pick.at <= state.target).sort((a, b) => a.pick.at - b.pick.at || a.index - b.index);
    for (let level = 1; level <= state.target; level++) {
      const trained = {};
      const before = statsAt(state, context, level);
      if (level > 1) {
        const amount = 5 + 2 * before.IN + (gameRules(state).id === 'fallout2' && context.traits.includes('skilled') ? 5 : 0) - (context.traits.includes('gifted') ? 5 : 0) + 2 * (context.ranks.educated || 0);
        income += amount;
        lost += Math.max(0, bank + amount - 99);
        bank = Math.min(99, bank + amount);
      }
      // Train ahead to avoid losing needed points to the 99-point bank cap.
      const projection = clone(context);
      for (const event of events.filter(e => e.pick.at >= level)) {
        const perk = perkById(event.pick.id, state);
        const stats = statsAt(state, projection, event.pick.at, event.pick.boosts);
        for (const need of trainingNeeds(state, projection, perk, stats)) {
          for (let unit = 0; unit < need.units; unit++) {
            const cost = skillCost(skillValue(state, context, need.id, before), state);
            if (bank < cost || level === 1) break;
            context.units[need.id] = (context.units[need.id] || 0) + 1;
            trained[need.id] = (trained[need.id] || 0) + (context.tags.includes(need.id) ? 2 : 1);
            projection.units[need.id] = (projection.units[need.id] || 0) + 1;
            bank -= cost; spent += cost;
          }
        }
        const preview = check(working, projection, perk, event.pick, earned[event.index], earned[event.index + 1], event.pick.at, bank, state.mode);
        if (preview.ok) applyPerk(projection, perk, event.pick);
      }
      // Optional skill goals use the budget left after perk requirements.
      if (level > 1) for (const [id, target] of Object.entries(state.skillGoals)) {
        while (skillValue(state, context, id, before) < target) {
          const cost = skillCost(skillValue(state, context, id, before), state);
          if (bank < cost) break;
          context.units[id] = (context.units[id] || 0) + 1;
          trained[id] = (trained[id] || 0) + (context.tags.includes(id) ? 2 : 1);
          bank -= cost; spent += cost;
        }
      }
      for (const event of events.filter(e => e.pick.at === level)) {
        const perk = perkById(event.pick.id, state);
        reports[event.index] = {...check(working, context, perk, event.pick, earned[event.index], earned[event.index + 1], level, bank, state.mode), spent, income, level, perk};
        if (reports[event.index].ok) {
          applyPerk(context, perk, event.pick);
          if (gameRules(state).id === 'fallout1' && perk.id === 'educated') {bank += 2; income += 2;}
        }
      }
      ledger.push({level, bank, income, spent, lost, trained});
    }
    const stats = statsAt(state, context, state.target);
    const skillValues = Object.fromEntries(SKILLS.map(([id]) => [id, skillValue(state, context, id, stats)]));
    const creationPoints = STATS.reduce((sum, stat) => sum + state.base[stat], 0);
    const issues = [];
    if (creationPoints !== 40) issues.push('Starting SPECIAL: ' + creationPoints + '/40. Allocate exactly 40 points before trait bonuses.');
    if (state.tags.length !== 3) issues.push('Select three tag skills.');
    for (const [index, pick] of picks.entries()) if (pick && (!earned[index] || pick.at > state.target)) issues.push(perkById(pick.id, state).name + ': pick outside the target level.');
    for (const [index, report] of Object.entries(reports)) if (!report.ok) issues.push('Lv. ' + report.level + ' · ' + report.perk.name + ': requirements not met.');
    for (const [id, target] of Object.entries(state.skillGoals)) if (skillValues[id] < target) issues.push(id + ': missing ' + (target - skillValues[id]) + '%.');
    return {earned, reports, stats, skills: skillValues, ranks: context.ranks, traits: context.traits, bank, income, spent, lost, issues, creationPoints, ledger};
  }
  function goalCheck(state) {
    const baseline = simulate(state);
    const existing = Object.entries(baseline.reports).find(([, report]) => report.ok && report.perk.id === state.goal);
    if (existing) return {already: true, hasSlot: true, index: Number(existing[0]), pick: state.picks[Number(existing[0])], report: existing[1], result: baseline, ok: baseline.issues.length === 0};
    const earned = schedule(state);
    let index = earned.length - 1;
    if (state.mode === 'sfall') {
      const empty = earned.map((_, i) => i).filter(i => !state.picks[i]);
      if (empty.length) index = empty[empty.length - 1];
    }
    const hasSlot = index >= 0 && !state.picks[index];
    const pick = {id: state.goal, at: state.target, boosts: hasSlot ? state.picks[index]?.boosts || {} : {}};
    const result = simulate(state, index >= 0 ? {index, pick} : undefined);
    return {hasSlot, index, pick, report: result.reports[index], result, ok: hasSlot && !!result.reports[index]?.ok && result.issues.length === 0};
  }
  function suggestions(requirement, state) {
    if (requirement.kind !== 'stat' || requirement.ok) return [];
    return [...boostsFor(state), ...operationsFor(state)].filter(item => requirement.expected > 0 ? (item.stats[requirement.name] || 0) > 0 : (item.stats[requirement.name] || 0) < 0);
  }
  root.FO2 = {STATS, SKILLS, TRAITS, BOOSTS, OPERATIONS, defaults, cleanState, schedule, arrangePicks, simulate, goalCheck, statsAt, skillValue, skillCost, suggestions, perkById, clone, gameRules, catalogFor, traitsFor, boostsFor, operationsFor};
  if (typeof module !== 'undefined') module.exports = root.FO2;
})(globalThis);
