function buildHero() {
  const g = new THREE.Group();
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x6a2018, roughness: 0.86, metalness: 0.05, flatShading: true, map: texCloth(2, 2), envMapIntensity: 0.5 })); cloak.position.y = 1.7; cloak.castShadow = true; g.add(cloak); g.userData.cloak = cloak;
  /* PBR metal armor over the robe — reads the shared scene.environment env map (same treatment as the sword blade / loot) */
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.95, 0.34), new THREE.MeshStandardMaterial({ color: 0x6b727e, roughness: 0.42, metalness: 0.82, map: texMetal(1, 2), envMapIntensity: 1.15 })); chest.position.set(0, 2.05, 0.42); chest.castShadow = true; g.add(chest); g.userData.chest = chest;
  const pmat = new THREE.MeshStandardMaterial({ color: 0x7a818c, roughness: 0.4, metalness: 0.85, map: texMetal(1, 1), envMapIntensity: 1.2 }); const pgeo = new THREE.SphereGeometry(0.42, 10, 8);
  const pL = new THREE.Mesh(pgeo, pmat); pL.position.set(-0.4, 2.55, 0); pL.scale.set(1, 0.62, 1); pL.castShadow = true; g.add(pL);
  const pR = new THREE.Mesh(pgeo, pmat); pR.position.set(0.4, 2.55, 0); pR.scale.set(1, 0.62, 1); pR.castShadow = true; g.add(pR);
  /* sleeved arms + hands + waist belt + gorget — articulate the robed silhouette */
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x5a1a12, roughness: 0.85, metalness: 0.05, flatShading: true, map: texCloth(1, 2), envMapIntensity: 0.4 }); const armGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.5, 6);
  const aL = new THREE.Mesh(armGeo, sleeveMat); aL.position.set(-0.62, 1.95, 0.06); aL.rotation.z = 0.16; aL.castShadow = true; g.add(aL);
  const aR = new THREE.Mesh(armGeo, sleeveMat); aR.position.set(0.62, 1.95, 0.12); aR.rotation.z = -0.16; aR.castShadow = true; g.add(aR);
  const handMat = new THREE.MeshStandardMaterial({ color: 0xc9a36a, roughness: 0.8, metalness: 0, map: texSkin(1, 1) }); const handGeo = new THREE.SphereGeometry(0.17, 8, 6);
  const hL = new THREE.Mesh(handGeo, handMat); hL.position.set(-0.72, 1.2, 0.08); g.add(hL); const hR = new THREE.Mesh(handGeo, handMat); hR.position.set(0.82, 1.25, 0.2); g.add(hR);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.1, 6, 16), new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.6, metalness: 0.25, map: texWood(2, 1), envMapIntensity: 0.5 })); belt.rotation.x = Math.PI / 2; belt.position.y = 1.55; g.add(belt);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.5, metalness: 0.6, map: texMetal(1, 1), envMapIntensity: 0.9 })); neck.position.y = 2.95; neck.castShadow = true; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc9a36a, roughness: 0.82, metalness: 0.0, map: texSkin(1, 1) })); head.position.y = 3.4; head.castShadow = true; g.add(head);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a1810, roughness: 0.9, metalness: 0.05, flatShading: true, map: texCloth(2, 2), envMapIntensity: 0.4 })); hood.position.y = 3.9; g.add(hood);
  const sword = new THREE.Group(); const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3, 0.16), new THREE.MeshStandardMaterial({ color: 0xd8e0ec, metalness: 0.92, roughness: 0.34, map: texMetal(1, 3), envMapIntensity: 1.25 })); blade.position.y = 1.5; sword.add(blade);
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.55, metalness: 0.35, map: texWood(1, 2), envMapIntensity: 0.6 })); sword.add(hilt); sword.position.set(1.1, 2, 0.4); g.add(sword); g.userData.sword = sword; return g;
}
const hero = buildHero(); scene.add(hero);
loadRoster();

const player = { x: 0, z: 0, r: 1.4, speed: 0.32, hp: 100, hpMax: 100, mp: 50, mpMax: 50, level: 1, xp: 0, xpNext: 30, gold: 0, kills: 0, dmg: 14, attackCd: 0, attackRate: 420, range: 3.2, potions: 4, dir: 0, swing: 0, bob: 0, armor: 0, crit: 0.05, mpRegen: 0.004, chillUntil: 0, effects: { lifesteal: 0, thorns: 0, allskills: 0, movespeed: 0, critdmg: false, pierce: 0, dodge: 0, flatDR: 0, lifeOnHit: 0 }, goldFind: 0, cdr: 0, meleeMult: 1, spellMult: 1, buffs: { cryUntil: 0, cryMul: 1, cryDR: 0, empUntil: 0, empMul: 1, fleetUntil: 0, fleetMul: 1 } };
const empowerMul = () => (player.buffs.empUntil > now() ? player.buffs.empMul : 1); // shrine "Empowered" damage buff (timer-read, like War Cry)
// Effective skill cooldown after Cooldown Reduction. MUST be used by both the cast gate and the cooldown
// swirl render, or the on-screen timer desyncs from when the skill actually re-fires.
const skillCd = (def, id) => def.cd * (1 - (player.cdr || 0)) * (id ? resolveSkill(id).cdrMult : 1);

function recompute() {
  const b = character.base, st = character.stats, eq = character.equipment, sk = character.skills; const cls = CLASSES[character.class] || CLASSES.warrior;
  let dmg = b.dmg, hp = b.hpMax, mp = b.mpMax, armor = 0, crit = 5; const bonus = { dmg: 0, hp: 0, mp: 0, armor: 0, str: 0, vit: 0, eng: 0, crit: 0 };
  const eff = { lifesteal: 0, manaleech: 0, thorns: 0, allskills: 0, movespeed: 0, critdmg: false, critDmgPct: 0, pierce: 0, deathnova: 0, manaShield: 0, haste: 0, chillaura: false, echo: false, fireRes: 0, frostRes: 0, poisonRes: 0, lightningRes: 0, allRes: 0, burnProc: 0, bleedProc: 0, dodge: 0, flatDR: 0, lifeOnHit: 0 }; const setCount = {};
  for (const s of SLOTS) {
    const it = eq[s]; if (!it) continue; const uf = upFactor(it); if (it.slot === 'weapon') bonus.dmg += it.baseStat * uf; else bonus.armor += it.baseStat * uf; for (const k in it.affixes) bonus[k] = (bonus[k] || 0) + it.affixes[k] * uf; gemFold(it, bonus);
    if (it.enchant && it.enchant.key) bonus[it.enchant.key] = (bonus[it.enchant.key] || 0) + (it.enchant.val || 0) * uf;
    if (it.effect) { if (it.effect === 'critdmg') eff.critdmg = true; else eff[it.effect] = (eff[it.effect] || 0) + it.effVal; }
    if (it.set) { setCount[it.set] = (setCount[it.set] || 0) + 1; }
  }
  for (const sid in setCount) { const sd = SET_DEFS[sid]; if (!sd) continue; for (const thr in sd.bonuses) { if (setCount[sid] >= +thr) { const bb = sd.bonuses[thr]; for (const k in bb) { if (k === 'effect') { if (bb.effect === 'critdmg') eff.critdmg = true; else eff[bb.effect] = (eff[bb.effect] || 0) + (bb.effVal || 0); } else if (k !== 'effVal') bonus[k] = (bonus[k] || 0) + bb[k]; } } } }
  // allocated forest nodes
  const pm = { meleePct: 0, spellPct: 0, armorPct: 0, hpPct: 0, dmgPct: 0 };
  for (const pid of (character.passives || [])) {
    const nd = PTREE.nodes[pid]; if (!nd) continue; for (const k in nd.mods) {
      const v = nd.mods[k];
      if (k === 'critdmg') eff.critdmg = true; else if (k === 'chillaura') eff.chillaura = true; else if (k === 'echo') eff.echo = true;
      else if (k === 'allskills' || k === 'pierce' || k === 'lifesteal' || k === 'movespeed' || k === 'thorns' || k === 'deathnova' || k === 'manaShield' || k === 'haste') eff[k] = (eff[k] || 0) + v;
      else if (k === 'meleePct' || k === 'spellPct' || k === 'armorPct' || k === 'hpPct' || k === 'dmgPct') pm[k] += v;
      else bonus[k] = (bonus[k] || 0) + v;
    }
  }
  eff.allskills = (eff.allskills || 0) + Math.round(bonus.skillranks || 0);
  const all = eff.allskills || 0; const as = bonus.allstats || 0;
  const str = st.str + (bonus.str || 0) + as, dex = st.dex + (bonus.dex || 0) + as, vit = st.vit + (bonus.vit || 0) + as, eng = st.eng + (bonus.eng || 0) + as;
  dmg += bonus.dmg + Math.floor(str * 0.5); hp += bonus.hp + vit * 4; mp += bonus.mp + eng * 3; armor += bonus.armor; crit += (bonus.crit || 0) + dex * 0.1 + (cls.critBonus ? cls.critBonus * 100 : 0);
  const tough = sk.toughness > 0 ? sk.toughness + all : 0, prec = sk.precision > 0 ? sk.precision + all : 0, med = sk.meditation > 0 ? sk.meditation + all : 0;
  const ber = sk.berserk > 0 ? sk.berserk + all : 0, arc = sk.arcanemind > 0 ? sk.arcanemind + all : 0, swi = sk.swiftness > 0 ? sk.swiftness + all : 0;
  const iron = sk.ironskin > 0 ? sk.ironskin + all : 0, blood = sk.bloodlust > 0 ? sk.bloodlust + all : 0, pierce = sk.piercing > 0 ? sk.piercing + all : 0, deadly = sk.deadlyaim > 0 ? sk.deadlyaim + all : 0;
  hp = Math.round(hp * Math.max(0.2, 1 + 0.08 * tough + pm.hpPct / 100)); crit += 2 * prec + 2 * deadly; armor = Math.round(armor * (1 + 0.10 * iron + pm.armorPct / 100)); player.mpRegen = 0.004 * (1 + 0.4 * med) + (bonus.mpregen || 0) * 0.001 + eng * 0.0002; player.hpRegen = (bonus.hpregen || 0) * 0.001 + vit * 0.0003;
  player.attackRate = clamp((420 - dex * 1.2) * (1 - (eff.haste || 0)) * (1 - (bonus.ias || 0) / 100), 150, 420);
  eff.movespeed = (eff.movespeed || 0) + 0.04 * swi + (bonus.ms || 0) / 100; eff.lifesteal = (eff.lifesteal || 0) + 0.02 * blood + (bonus.leech || 0) / 100; eff.pierce = (eff.pierce || 0) + pierce; eff.thorns = (eff.thorns || 0) + (bonus.thorns || 0);
  // unit 4 affixes: resists (% taken reduction), leech variants, crit-dmg %, on-hit procs (% chance)
  eff.fireRes = (eff.fireRes || 0) + (bonus.fireRes || 0); eff.frostRes = (eff.frostRes || 0) + (bonus.coldRes || 0); eff.poisonRes = (eff.poisonRes || 0) + (bonus.poisonRes || 0); eff.lightningRes = (eff.lightningRes || 0) + (bonus.lightRes || 0); eff.allRes = (eff.allRes || 0) + (bonus.allRes || 0);
  eff.lifesteal += (bonus.leechAll || 0) / 100; eff.manaleech = (eff.manaleech || 0) + (bonus.manaLeech || 0) / 100 + (bonus.leechAll || 0) / 100;
  eff.critDmgPct = (eff.critDmgPct || 0) + (bonus.critDmg || 0);
  eff.burnProc = (eff.burnProc || 0) + (bonus.burnOnHit || 0); eff.bleedProc = (eff.bleedProc || 0) + (bonus.bleedOnHit || 0);
  // unit 5 affixes: avoidance + farming. dodge/flatDR capped; mf overwrites the global lootLuck (composes additively with depthQuality/quality in luckyRarity).
  eff.dodge = Math.min((bonus.dodge || 0) / 100, 0.6); eff.flatDR = Math.min((bonus.flatDR || 0) / 100, 0.5); eff.lifeOnHit = (bonus.lifeOnHit || 0);
  player.cdr = Math.min((bonus.cdr || 0) / 100, 0.5); player.goldFind = (bonus.gf || 0) / 100; lootLuck = (bonus.mf || 0) / 100;
  player.meleeMult = (cls.dmgMult || 1) * (1 + (0.06 * ber) + (pm.meleePct + pm.dmgPct) / 100); player.spellMult = (cls.spellMult || 1) * (1 + (0.06 * arc) + (pm.spellPct + pm.dmgPct) / 100); player.skillMult = 1 + (bonus.skilldmg || 0) / 100; player.activeSkillDmg = 1 + (bonus.activeskill || 0) / 100; player.elemMult = { fire: 1 + (bonus.fireDmg || 0) / 100, frost: 1 + (bonus.coldDmg || 0) / 100, lightning: 1 + (bonus.lightDmg || 0) / 100, poison: 1 + (bonus.poisonDmg || 0) / 100, phys: 1 }; player.effects = eff; player.speed = 0.32 * (1 + Math.min(eff.movespeed || 0, 0.75));
  player.str = str; player.dex = dex; player.vit = vit; player.eng = eng;
  player.dmg = Math.round(dmg); player.hpMax = Math.round(hp); player.mpMax = Math.round(mp); player.armor = armor; player.crit = clamp(crit / 100, 0, 0.9);
  player.hp = Math.min(player.hp, player.hpMax); player.mp = Math.min(player.mp, player.mpMax); updateGlobes(); updatePips();
}
