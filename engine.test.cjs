const {test} = require('node:test');
const assert = require('node:assert/strict');
require('./data.js');
require('./fallout1-data.js');
const E = require('./engine.js');

function fresh(overrides = {}) {
  return {...E.defaults(), base: {ST: 5, PE: 5, EN: 5, CH: 5, IN: 5, AG: 5, LK: 10}, traits: [], tags: ['Small Guns', 'Repair', 'Speech'], picks: [], skillGoals: {}, operations: [], ...overrides};
}
const pick = (id, at, boosts = {}, extra = {}) => ({id, at, boosts, ...extra});

test('Automatic picks follow unlock levels regardless of tree selection order', () => {
  const ids = ['sniper', 'bonus-rate-of-fire', 'awareness', 'more-criticals', 'sharpshooter', 'action-boy'];
  for (const wanted of [ids, [...ids].reverse()]) {
    const input = fresh({target: 24, wanted});
    const actual = E.arrangePicks(input);
    assert.deepEqual(actual.wanted, []);
    const levels = E.schedule({...input, picks: actual.picks});
    for (const [index, selected] of actual.picks.entries()) if (selected) {
      assert.ok(selected.at >= E.perkById(selected.id).level);
      assert.ok(selected.at >= levels[index]);
      assert.ok(!levels[index + 1] || selected.at < levels[index + 1]);
    }
    assert.equal(actual.picks[7].id, 'sniper');
    assert.deepEqual(E.arrangePicks({...input, picks: actual.picks, wanted: []}).picks, actual.picks);
    assert.deepEqual(input.picks, []);
  }
});

test('Automatic scheduling repairs early saved picks and survives Skilled changes', () => {
  const input = fresh({target: 24, picks: [pick('sniper', 3), pick('sharpshooter', 6), pick('awareness', 9)]});
  const actual = E.arrangePicks(input);
  assert.equal(actual.picks[0].id, 'awareness');
  assert.equal(actual.picks[2].id, 'sharpshooter');
  assert.equal(actual.picks[7].id, 'sniper');
  assert.equal(actual.slots[0], 7);
  const skilled = {...input, traits: ['skilled'], picks: actual.picks};
  const adjusted = E.arrangePicks(skilled);
  assert.deepEqual(adjusted.picks.filter(Boolean).map(item => [item.id, item.at]), [['awareness',4],['sharpshooter',9],['sniper',24]]);
});

test('Manual perk levels and repeated-rank configuration survive automatic arrangement', () => {
  const input = fresh({target: 24, picks: [pick('action-boy', 3, {mentats:1}), pick('action-boy', 6, {buffout:1}), null, null, null, pick('awareness',20)]});
  const actual = E.arrangePicks(input);
  assert.equal(actual.picks[5].id, 'awareness');
  assert.equal(actual.picks[5].at, 20);
  assert.equal(actual.picks[5].manualLevel, true);
  assert.deepEqual(actual.picks.filter(item=>item?.id==='action-boy').map(item=>[item.at,item.boosts]), [[12,{mentats:1}],[15,{buffout:1}]]);
  assert.equal(E.cleanState({...input,picks:actual.picks}).picks[5].manualLevel, true);
});

test('An insufficient target keeps every selected rank and exposes genuine pick shortages', () => {
  const input = fresh({target: 12, picks: [pick('action-boy',3),pick('action-boy',6),pick('sniper',9,{mentats:2}),pick('awareness',12)], wanted:['slayer']});
  const actual = E.arrangePicks(input);
  assert.equal(actual.picks.filter(Boolean).length, 4);
  assert.deepEqual(actual.wanted, ['slayer']);
  assert.equal(actual.picks.find(item=>item?.id==='sniper').boosts.mentats, 2);
  assert.ok(E.simulate({...input,picks:actual.picks,wanted:actual.wanted}).issues.length > 0);
});

test('Arrangement recomputes perk events when Mutate replaces Skilled', () => {
  const input = fresh({target:24, traits:['skilled'], picks:[pick('awareness',4),null,pick('mutate',12,{}, {removeTrait:'skilled',addTrait:'small-frame'})]});
  const actual = E.arrangePicks(input);
  assert.deepEqual(E.schedule({...input,picks:actual.picks}), [4,8,12,15,18,21,24]);
  assert.equal(actual.picks.find(item=>item?.id==='mutate').removeTrait, 'skilled');
  assert.equal(actual.picks.find(item=>item?.id==='mutate').at, 9);
});

test('Catalog has 76 perks, unique IDs and original Fallout 2 ranks', () => {
  assert.equal(FO2_DATA.perks.length, 76);
  assert.equal(new Set(FO2_DATA.perks.map(p => p.id)).size, 76);
  assert.equal(E.perkById('action-boy').ranks, 2);
  assert.equal(E.perkById('sniper').level, 24);
  assert.equal(E.perkById('master-trader').level, 12);
  assert.equal(E.perkById('quick-pockets').ranks, 1);
});
test('Perk schedule: 3/6/9 and Skilled 4/8/12', () => {
  const input = fresh({target: 20});
  assert.deepEqual(E.schedule(input), [3, 6, 9, 12, 15, 18]);
  input.traits = ['skilled'];
  assert.deepEqual(E.schedule(input), [4, 8, 12, 16, 20]);
});
test('Sniper is unavailable at level 20 even with sufficient SPECIAL', () => {
  const input = fresh({target: 20, picks: [null, null, null, null, null, pick('sniper', 20, {buffout: 2, mentats: 2})]});
  const actual = E.simulate(input).reports[5];
  assert.equal(actual.ok, false);
  assert.equal(actual.requirements.find(r => r.kind === 'level').ok, false);
});
test('Vanilla allows deferring the level 18 pick to level 20', () => {
  const input = fresh({target: 20, picks: [null, null, null, null, null, pick('awareness', 20)]});
  assert.equal(E.simulate(input).reports[5].ok, true);
});
test('Vanilla loses a pick at the next event; sfall preserves it', () => {
  const input = fresh({target: 6, picks: [pick('awareness', 6)]});
  assert.equal(E.simulate(input).reports[0].ok, false);
  input.mode = 'sfall';
  assert.equal(E.simulate(input).reports[0].ok, true);
});
test('sfall permits two banked picks at the same level', () => {
  const input = fresh({target: 9, mode: 'sfall', picks: [pick('awareness', 9), pick('quick-pockets', 9)]});
  const actual = E.simulate(input);
  assert.equal(actual.reports[0].ok, true);
  assert.equal(actual.reports[1].ok, true);
});
test('A third Action Boy rank is rejected', () => {
  const input = fresh({target: 18, picks: [null, null, null, pick('action-boy', 12), pick('action-boy', 15), pick('action-boy', 18)]});
  const actual = E.simulate(input);
  assert.equal(actual.ranks['action-boy'], 2);
  assert.equal(actual.reports[5].requirements.find(r => r.kind === 'rank').ok, false);
});
test('Mentats enables Awareness without leaving permanent PE', () => {
  const input = fresh({target: 3, base: {ST: 5, PE: 3, EN: 5, CH: 7, IN: 5, AG: 5, LK: 10}, picks: [pick('awareness', 3, {mentats: 1})]});
  const actual = E.simulate(input);
  assert.equal(actual.reports[0].ok, true);
  assert.equal(actual.reports[0].stats.PE, 5);
  assert.equal(actual.stats.PE, 3);
  assert.equal(actual.ranks.awareness, 1);
});
test('Temporary IN does not increase skill point income', () => {
  const input = fresh({target: 3, picks: [pick('awareness', 3, {mentats: 2})]});
  assert.equal(E.simulate(input).income, 30);
});
test('Gifted, Small Frame and Bruiser affect SPECIAL', () => {
  const input = fresh({target: 2, traits: ['gifted', 'small-frame']});
  const actual = E.simulate(input);
  assert.equal(actual.stats.AG, 7);
  assert.equal(actual.stats.ST, 6);
  assert.equal(actual.stats.LK, 10);
  assert.equal(E.simulate(fresh({traits: ['bruiser']})).stats.ST, 7);
});
test('Skilled and Gifted produce correct skill point income', () => {
  const input = fresh({target: 4, traits: ['gifted', 'skilled']});
  assert.equal(E.simulate(input).income, (5 + 2 * 6 + 5 - 5) * 3);
});
test('Educated grants points from the next level', () => {
  const input = fresh({target: 9, picks: [null, pick('educated', 6)], base: {ST: 5, PE: 5, EN: 4, CH: 5, IN: 6, AG: 5, LK: 10}});
  assert.equal(E.simulate(input).income, 17 * 8 + 2 * 3);
});
test('Gain Intelligence grants points from the next level', () => {
  const input = fresh({target: 15, picks: [null, null, null, pick('gain-intelligence', 12)]});
  const actual = E.simulate(input);
  assert.equal(actual.stats.IN, 6);
  assert.equal(actual.income, 15 * 14 + 2 * 3);
});
test('Late surgery cannot unlock an earlier perk', () => {
  const input = fresh({target: 15, base: {ST: 5, PE: 4, EN: 5, CH: 6, IN: 5, AG: 5, LK: 10}, picks: [pick('awareness', 3)], operations: [{id: 'ace-pe', at: 12}]});
  const actual = E.simulate(input);
  assert.equal(actual.reports[0].ok, false);
  assert.equal(actual.stats.PE, 5);
  input.operations[0].at = 3;
  assert.equal(E.simulate(input).reports[0].ok, true);
});
test('Skill costs change correctly at thresholds', () => {
  const input = [-10, 0, 100, 101, 125, 126, 150, 151, 175, 176, 200, 201, 299];
  const expected = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];
  assert.deepEqual(input.map(E.skillCost), expected);
});
test('A tag skill gains +20 and trains twice as fast', () => {
  const input = fresh({target: 2, skillGoals: {'Small Guns': 49}});
  const actual = E.simulate(input);
  assert.equal(actual.skills['Small Guns'], 49);
  assert.equal(actual.spent, 2);
});
test('High skills need more points; the bank never exceeds 99', () => {
  const input = fresh({target: 10, skillGoals: {'Small Guns': 300}});
  const actual = E.simulate(input);
  assert.ok(actual.skills['Small Guns'] < 300);
  assert.ok(actual.issues.some(issue => issue.includes('Small Guns')));
  assert.equal(actual.income, actual.spent + actual.bank + actual.lost);
  assert.ok(actual.ledger.every(row => row.bank <= 99 && row.bank >= 0));
});
test('Automatic training spends ahead to avoid bank overflow', () => {
  const input = fresh({target: 20, skillGoals: {'Small Guns': 300}});
  const actual = E.simulate(input);
  assert.equal(actual.lost, 0);
  assert.ok(actual.spent > 99);
});
test('Insufficient skill points block perk effects', () => {
  const input = fresh({target: 9, traits: ['gifted'], base: {ST: 9, PE: 7, EN: 4, CH: 4, IN: 1, AG: 6, LK: 9}, picks: [null, null, pick('demolition-expert', 9)]});
  const actual = E.simulate(input);
  assert.equal(actual.reports[2].ok, false);
  assert.equal(actual.reports[2].requirements.find(r => r.kind === 'skill').ok, false);
  assert.equal(actual.ranks['demolition-expert'], undefined);
});
test('Medic and Mr. Fixit use logical OR', () => {
  const input = fresh({target: 12, picks: [null, null, null, pick('mr-fixit', 12)]});
  const actual = E.simulate(input);
  assert.equal(actual.reports[3].ok, true);
  const requirements = actual.reports[3].requirements.filter(r => r.kind === 'skill');
  assert.ok(requirements.some(r => r.actual < 40));
  assert.ok(requirements.every(r => r.ok));
  assert.equal(actual.skills.Repair, actual.reports[3].skills.Repair + 10);
});
test('Harmless requires both Steal and karma 50', () => {
  const input = fresh({target: 6, picks: [null, pick('harmless', 6)]});
  assert.equal(E.simulate(input).reports[1].ok, false);
  input.karma = 50;
  assert.equal(E.simulate(input).reports[1].ok, true);
});
test('Gain and Weapon Handling enforce SPECIAL upper limits', () => {
  const input = fresh({target: 12, picks: [null, null, null, pick('gain-luck', 12)]});
  assert.equal(E.simulate(input).reports[3].ok, false);
  input.picks[3] = pick('weapon-handling', 12, {buffout: 1});
  assert.equal(E.simulate(input).reports[3].ok, false);
  input.picks[3].boosts = {};
  assert.equal(E.simulate(input).reports[3].ok, true);
});
test('Tag! doubles invested units without another 20%', () => {
  const input = fresh({target: 12, picks: [null, null, null, pick('tag', 12, {}, {tag: 'Science'})], skillGoals: {Science: 30}});
  const actual = E.simulate(input);
  assert.equal(actual.spent, 10);
  assert.equal(actual.skills.Science, 40);
});
test('Mutate! changes Skilled and future perk events', () => {
  const input = fresh({target: 18, traits: ['skilled'], picks: [null, pick('mutate', 9, {}, {removeTrait: 'skilled', addTrait: 'fast-shot'})]});
  const actual = E.simulate(input);
  assert.deepEqual(actual.earned, [4, 8, 12, 15, 18]);
  assert.equal(actual.reports[1].ok, true);
  assert.deepEqual(actual.traits, ['fast-shot']);
  assert.equal(actual.income, 20 * 8 + 15 * 9);
});
test('An invalid early perk grants no bonuses to later levels', () => {
  const input = fresh({target: 6, picks: [pick('gain-perception', 3), pick('awareness', 6)]});
  const actual = E.simulate(input);
  assert.equal(actual.reports[0].ok, false);
  assert.equal(actual.stats.PE, 5);
  assert.equal(actual.ranks['gain-perception'], undefined);
});
test('A goal needs a free pick within its valid interval', () => {
  const input = fresh({target: 20, goal: 'awareness', picks: [null, null, null, null, null, pick('quick-pockets', 18)]});
  assert.equal(E.goalCheck(input).hasSlot, false);
  input.mode = 'sfall';
  assert.equal(E.goalCheck(input).hasSlot, true);
});
test('Import validation limits numbers, duplicates and mutually exclusive upgrades', () => {
  const input = {...fresh(), target: 9999, name: '<script>кириллица</script>', traits: ['gifted', 'gifted', 'fake'], operations: [{id: 'zeta-ncr', at: 2}, {id: 'zeta-sf', at: 3}], picks: [pick('awareness', 3, {'power-armor': 1, 'advanced-armor': 1, mentats: 99})]};
  const actual = E.cleanState(input);
  assert.equal(actual.target, 99);
  assert.deepEqual(actual.traits, ['gifted']);
  assert.equal(actual.operations.length, 1);
  assert.equal(actual.picks[0].boosts.mentats, 2);
  assert.equal(actual.picks[0].boosts['power-armor'], undefined);
  assert.equal(actual.picks[0].boosts['advanced-armor'], undefined);
  assert.equal(E.cleanState({version: 100}), null);
  assert.equal(E.cleanState(JSON.parse(JSON.stringify(fresh()))).name, 'Chosen One');
});
test('Catalog text and JSON preserve Unicode', () => {
  const input = fresh({name: 'Избранный — ☢'});
  const actual = E.cleanState(JSON.parse(JSON.stringify(input)));
  assert.equal(actual.name, input.name);
  assert.ok(FO2_DATA.perks.every(perk => perk.name && perk.description && !perk.description.includes('\uFFFD')));
});
test('Wanted perks survive export and exclude unknown, duplicate and assigned entries', () => {
  const input = fresh({picks: [pick('awareness', 3)], wanted: ['sniper', 'sniper', 'fake', null, 'awareness', 'slayer']});
  const actual = E.cleanState(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(actual.wanted, ['sniper', 'slayer']);
  assert.equal(actual.picks[0].id, 'awareness');
});
test('Legacy saves without wanted perks preserve assigned picks', () => {
  const input = fresh({picks: [pick('awareness', 3)]});
  delete input.wanted;
  const actual = E.cleanState(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(actual.wanted, []);
  assert.equal(actual.picks[0].id, 'awareness');
});

test('Legacy default names migrate while custom Unicode names are preserved', () => {
  const input = fresh({name: '\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u044b\u0439'});
  assert.equal(E.cleanState(input).name, 'Chosen One');
  input.name += ' — ☢';
  assert.equal(E.cleanState(input).name, input.name);
});

test('Removed armor bonuses cannot satisfy requirements in either game', () => {
  for (const game of ['fallout1', 'fallout2']) {
    const input = fresh({game, target: 3, base: {ST: 3, PE: 5, EN: 6, CH: 5, IN: 5, AG: 5, LK: 10}, picks: [pick('strong-back', 3)]});
    assert.equal(E.simulate(input).reports[0].ok, false);
    input.picks[0].boosts = {'power-armor': 1, 'advanced-armor': 1};
    const actual = E.simulate(input).reports[0];
    assert.equal(actual.ok, false);
    assert.equal(actual.stats.ST, 3);
    assert.equal(actual.permanent.ST, 3);
    assert.equal(E.simulate(input).stats.ST, 3);
    assert.equal(E.cleanState(input).picks[0].boosts['power-armor'], undefined);
    assert.equal(E.cleanState(input).picks[0].boosts['advanced-armor'], undefined);
  }
});

test('Removed shades are discarded from imported builds without affecting chems', () => {
  const input = fresh({target: 12, base: {ST: 5, PE: 5, EN: 5, CH: 6, IN: 5, AG: 5, LK: 9}, picks: [null, null, null, pick('master-trader', 12)]});
  assert.equal(E.simulate(input).reports[3].ok, false);
  input.picks[3].boosts.shades = 1;
  assert.equal(E.simulate(input).reports[3].ok, false);
  input.picks[3].boosts.mentats = 1;
  assert.equal(E.simulate(input).reports[3].ok, true);
  assert.equal(E.cleanState(input).picks[3].boosts.shades, undefined);
  assert.equal(E.cleanState(input).picks[3].boosts.mentats, 1);
  assert.equal(E.simulate(input).stats.CH, 6);
});

function firstGame(overrides = {}) {
  return fresh({game: 'fallout1', name: 'Vault Dweller', time: 'day', target: 21, base: {ST:5, PE:5, EN:5, CH:5, IN:5, AG:5, LK:5}, tags: [], ...overrides});
}

test('Fallout 1 has its original 53 perks and distinct levels and ranks', () => {
  const actual = E.catalogFor('fallout1');
  assert.equal(actual.perks.length, 53);
  assert.equal(new Set(actual.perks.map(p => p.id)).size, 53);
  assert.equal(E.perkById('sniper', 'fallout1').level, 18);
  assert.equal(E.perkById('bonus-rate-of-fire', 'fallout1').level, 9);
  assert.equal(E.perkById('action-boy', 'fallout1').ranks, 3);
  assert.equal(E.perkById('quick-pockets', 'fallout1').ranks, 3);
  assert.equal(E.perkById('gain-intelligence', 'fallout1'), undefined);
  assert.ok(E.perkById('friendly-foe', 'fallout1'));
  assert.ok(E.perkById('mental-block', 'fallout1'));
});

test('Fallout 1 levels stop at 21 and Skilled provides five picks', () => {
  assert.equal(E.cleanState(firstGame({target:99})).target, 21);
  assert.deepEqual(E.schedule(firstGame()), [3,6,9,12,15,18,21]);
  assert.deepEqual(E.schedule(firstGame({traits:['skilled']})), [4,8,12,16,20]);
  assert.equal(E.defaults('fallout1').name, 'Vault Dweller');
});

test('Fallout 1 uses all 18 original skill formulas', () => {
  const actual = E.simulate(firstGame({target:2})).skills;
  assert.deepEqual(Object.values(actual), [40,15,15,70,60,45,35,20,30,25,25,25,35,25,35,30,35,10]);
  const input = firstGame({base:{ST:5,PE:6,EN:5,CH:5,IN:5,AG:5,LK:5}});
  assert.equal(E.simulate(input).skills['First Aid'],35);
});

test('Fallout 1 Skilled adds 10 percent to skills without extra income', () => {
  const input = firstGame({target:6, traits:['skilled']});
  const actual = E.simulate(input);
  assert.equal(actual.income,75);
  assert.equal(actual.skills['Small Guns'],50);
});

test('Fallout 1 training has flat costs and a 200 percent cap', () => {
  const input = firstGame({skillGoals:{Science:200}});
  const actual = E.simulate(input);
  assert.equal(actual.skills.Science,200);
  assert.equal(actual.spent,165);
  assert.equal(E.skillCost(180,input),1);
  assert.equal(E.cleanState({...input,skillGoals:{Science:300}}).skillGoals.Science,200);
});

test('Fallout 1 Tag grants an additional 20 percent and doubles investment', () => {
  const input = firstGame({target:12, picks:[null,null,null,pick('tag',12,{}, {tag:'Science'})]});
  assert.equal(E.simulate(input).skills.Science,55);
  input.skillGoals.Science=55;
  const actual=E.simulate(input);
  assert.equal(actual.spent,20);
  assert.equal(actual.skills.Science,95);
});

test('Fallout 1 Educated grants two immediate points and subsequent income', () => {
  const input = firstGame({target:9,base:{ST:5,PE:5,EN:5,CH:5,IN:6,AG:5,LK:5},picks:[null,pick('educated',6)]});
  assert.equal(E.simulate(input).income,144);
});

test('Fallout 1 skill perks use its original bonuses', () => {
  for (const [id, skill, expected] of [['medic','Doctor',40],['mr-fixit','Science',55],['speaker','Barter',50],['master-thief','Sneak',40]]) {
    const input=firstGame({target:12,picks:[null,null,null,pick(id,12)]});
    assert.equal(E.simulate(input).skills[skill],expected);
  }
});

test('Fallout 1 Sniper can be selected at level 18', () => {
  const input=firstGame({base:{ST:5,PE:8,EN:5,CH:5,IN:5,AG:8,LK:5},tags:['Small Guns'],picks:[null,null,null,null,null,pick('sniper',18)]});
  assert.equal(E.simulate(input).reports[5].ok,true);
});

test('Fallout 1 Night Person changes current stats and planned skill income', () => {
  const input=firstGame({target:3,traits:['night-person']});
  assert.equal(E.simulate(input).stats.IN,4);
  assert.equal(E.simulate(input).income,26);
  input.time='night';
  assert.equal(E.simulate(input).stats.PE,6);
  assert.equal(E.simulate(input).income,34);
});

test('Fallout 1 offers its own traits and surgery, with chem-only preparation', () => {
  assert.ok(E.traitsFor('fallout1').some(t=>t[0]==='night-person'));
  assert.ok(!E.traitsFor('fallout1').some(t=>t[0]==='sex-appeal'));
  assert.deepEqual(E.boostsFor('fallout1').map(b=>b.id), ['buffout', 'mentats', 'psycho']);
  assert.equal(E.operationsFor('fallout1').length,7);
  const input=firstGame({target:6,operations:[{id:'bos-in',at:3}]});
  assert.equal(E.simulate(input).income,83);
});

test('Fallout 1 import removes Fallout 2-only fields and preserves game and time', () => {
  const input=firstGame({target:99,time:'night',mode:'sfall',traits:['sex-appeal','night-person'],picks:[pick('gain-luck',12),pick('awareness',6,{'advanced-armor':1,mentats:1})],operations:[{id:'ace-in',at:3},{id:'bos-in',at:3}]});
  const actual=E.cleanState(input);
  assert.equal(actual.game,'fallout1');
  assert.equal(actual.time,'night');
  assert.equal(actual.mode,'vanilla');
  assert.equal(actual.picks[0],null);
  assert.equal(actual.picks[1].boosts['advanced-armor'],undefined);
  assert.deepEqual(actual.traits,['night-person']);
  assert.deepEqual(actual.operations,[{id:'bos-in',at:3}]);
  const legacy=fresh(); delete legacy.game;
  assert.equal(E.cleanState(legacy).game,'fallout2');
});
