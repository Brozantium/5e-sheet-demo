const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateMaximumHitPoints, applyHitPointDamage, applyHitPointHealing, grantTemporaryHitPoints,
} = require("../../.test-dist/engines/hit-point-engine.js");
const level=(characterLevel,classId,classLevel,hitDie,method,roll)=>({
  characterLevel,classId,classLevel,hitDie,method,...(roll===undefined?{}:{roll})
});

test("first character level uses maximum Hit Die plus Constitution modifier",()=>{
  const r=calculateMaximumHitPoints({constitutionScore:14,levels:[level(1,"fighter",1,10,"first-level")]});
  assert.equal(r.maximumHitPoints,12);assert.equal(r.constitutionModifier,2);
  assert.equal(r.levels[0].rollValue,10);assert.equal(r.levels[0].gainedHitPoints,12);
});
test("later levels use standard fixed averages for d6, d8, d10, and d12",()=>{
  for(const [die,average] of [[6,4],[8,5],[10,6],[12,7]]){
    const r=calculateMaximumHitPoints({constitutionScore:10,levels:[
      level(1,"test",1,die,"first-level"),level(2,"test",2,die,"average")
    ]});
    assert.equal(r.levels[1].rollValue,average);assert.equal(r.maximumHitPoints,die+average);
  }
});
test("rolled Hit Dice plus Constitution are calculated per multiclass level",()=>{
  const r=calculateMaximumHitPoints({constitutionScore:16,levels:[
    level(1,"fighter",1,10,"first-level"),level(2,"fighter",2,10,"roll",4),
    level(3,"rogue",1,8,"roll",6)
  ]});
  assert.deepEqual(r.levels.map(x=>x.gainedHitPoints),[13,7,9]);assert.equal(r.maximumHitPoints,29);
});
test("negative Constitution modifier never reduces a level gain below one HP",()=>{
  const r=calculateMaximumHitPoints({constitutionScore:6,levels:[
    level(1,"wizard",1,6,"first-level"),level(2,"wizard",2,6,"roll",1)
  ]});
  assert.deepEqual(r.levels.map(x=>x.gainedHitPoints),[1,1]);assert.equal(r.maximumHitPoints,2);
});
test("flat additional maximum HP is added after per-level gains",()=>{
  const r=calculateMaximumHitPoints({constitutionScore:12,additionalHitPoints:3,levels:[
    level(1,"fighter",1,10,"first-level"),level(2,"fighter",2,10,"average")
  ]});
  assert.equal(r.maximumHitPoints,18);assert.equal(r.additionalHitPoints,3);
});
test("multiclass Hit Point levels require consecutive character and class levels",()=>{
  assert.throws(()=>calculateMaximumHitPoints({constitutionScore:10,levels:[
    level(1,"fighter",1,10,"first-level"),level(3,"rogue",1,8,"average")
  ]}),/without gaps/);
  assert.throws(()=>calculateMaximumHitPoints({constitutionScore:10,levels:[
    level(1,"fighter",1,10,"first-level"),level(2,"fighter",3,10,"average")
  ]}),/must be consecutive/);
});
test("invalid Hit Point level data, roll results, and bonuses are rejected",()=>{
  assert.throws(()=>calculateMaximumHitPoints({constitutionScore:10,levels:[]}),/At least one/);
  assert.throws(()=>calculateMaximumHitPoints({constitutionScore:10,levels:[level(1,"fighter",1,10,"average")]}),/first-level maximum/);
  assert.throws(()=>calculateMaximumHitPoints({constitutionScore:10,levels:[level(1,"fighter",1,10,"first-level",5)]}),/not a roll/);
  assert.throws(()=>calculateMaximumHitPoints({constitutionScore:10,levels:[
    level(1,"fighter",1,10,"first-level"),level(2,"fighter",2,10,"first-level")
  ]}),/Only character level 1/);
  assert.throws(()=>calculateMaximumHitPoints({constitutionScore:10,levels:[
    level(1,"fighter",1,10,"first-level"),level(2,"fighter",2,10,"roll",11)
  ]}),/Rolled Hit Die/);
  assert.throws(()=>calculateMaximumHitPoints({constitutionScore:10,additionalHitPoints:-1,levels:[
    level(1,"fighter",1,10,"first-level")
  ]}),/non-negative integer/);
});
const state=(overrides={})=>({currentHitPoints:12,maximumHitPoints:20,temporaryHitPoints:0,...overrides});
test("damage removes Temporary HP before actual HP",()=>{
  const r=applyHitPointDamage(state({currentHitPoints:12,temporaryHitPoints:5}),7);
  assert.equal(r.damageAppliedToTemporaryHitPoints,5);assert.equal(r.damageAppliedToHitPoints,2);
  assert.equal(r.excessDamage,0);assert.deepEqual(r.state,state({currentHitPoints:10}));
  assert.equal(r.reachedZeroHitPoints,false);
});
test("damage to zero HP reports excess damage separately",()=>{
  const r=applyHitPointDamage(state({currentHitPoints:2}),8);
  assert.equal(r.state.currentHitPoints,0);assert.equal(r.excessDamage,6);assert.equal(r.reachedZeroHitPoints,true);
});
test("damage at zero HP never makes current HP negative",()=>{
  const r=applyHitPointDamage(state({currentHitPoints:0}),4);
  assert.equal(r.state.currentHitPoints,0);assert.equal(r.excessDamage,4);assert.equal(r.reachedZeroHitPoints,true);
});
test("healing restores HP up to maximum without changing Temporary HP",()=>{
  const r=applyHitPointHealing(state({currentHitPoints:18,temporaryHitPoints:5}),10);
  assert.equal(r.hitPointsRestored,2);assert.deepEqual(r.state,state({currentHitPoints:20,temporaryHitPoints:5}));
});
test("healing can restore a character from zero HP",()=>{
  const r=applyHitPointHealing(state({currentHitPoints:0}),5);
  assert.equal(r.state.currentHitPoints,5);assert.equal(r.hitPointsRestored,5);
});
test("Temporary HP does not stack and only replaces a smaller grant",()=>{
  const first=grantTemporaryHitPoints(state(),6);
  const smaller=grantTemporaryHitPoints(first.state,4);
  const larger=grantTemporaryHitPoints(smaller.state,9);
  assert.equal(first.state.temporaryHitPoints,6);
  assert.equal(smaller.state.temporaryHitPoints,6);
  assert.equal(smaller.temporaryHitPointsGained,0);
  assert.equal(smaller.replacedExistingTemporaryHitPoints,false);
  assert.equal(larger.state.temporaryHitPoints,9);
  assert.equal(larger.temporaryHitPointsGained,3);
  assert.equal(larger.replacedExistingTemporaryHitPoints,true);
});
test("zero Temporary HP grant leaves a larger current amount unchanged",()=>{
  const r=grantTemporaryHitPoints(state({temporaryHitPoints:3}),0);
  assert.equal(r.state.temporaryHitPoints,3);assert.equal(r.temporaryHitPointsGained,0);
});
test("damage, healing, and Temporary HP reject invalid states and amounts",()=>{
  assert.throws(()=>applyHitPointDamage(state(),-1),/non-negative integer/);
  assert.throws(()=>applyHitPointHealing(state(),1.5),/non-negative integer/);
  assert.throws(()=>grantTemporaryHitPoints(state(),-1),/non-negative integer/);
  assert.throws(()=>applyHitPointDamage(state({currentHitPoints:25}),1),/cannot exceed maximum/);
  assert.throws(()=>applyHitPointDamage(state({maximumHitPoints:0}),1),/at least 1/);
});
