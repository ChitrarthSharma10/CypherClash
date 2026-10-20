import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Procedural Texture Generator for Ancient Stone Walls & Floors
 */
function createStoneWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base stone color
  ctx.fillStyle = '#3a4454';
  ctx.fillRect(0, 0, 512, 512);

  // Stone brick pattern
  const rows = 8;
  const cols = 4;
  const rh = 512 / rows;
  const cw = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const shift = (r % 2) * (cw / 2);
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + shift;
      const y = r * rh;

      // Varied stone brick tones
      const tone = 50 + Math.floor(Math.random() * 25);
      ctx.fillStyle = `rgb(${tone}, ${tone + 4}, ${tone + 8})`;
      ctx.fillRect(x + 2, y + 2, cw - 4, rh - 4);

      // Bevel highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, cw - 6, rh - 6);

      // Mortar shadow
      ctx.strokeStyle = '#1e2430';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1, y + 1, cw - 2, rh - 2);

      // Ancient stone cracks
      if (Math.random() > 0.6) {
        ctx.strokeStyle = 'rgba(15, 18, 24, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + cw * 0.3, y + rh * 0.2);
        ctx.lineTo(x + cw * 0.45, y + rh * 0.55);
        ctx.lineTo(x + cw * 0.7, y + rh * 0.8);
        ctx.stroke();
      }
    }
  }

  // Moss patches near bottom and edges
  ctx.fillStyle = 'rgba(74, 122, 52, 0.45)';
  for (let i = 0; i < 40; i++) {
    const mx = Math.random() * 512;
    const my = 300 + Math.random() * 212;
    const mr = 8 + Math.random() * 22;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createStoneFloorTexture(cols = 17, rows = 13) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base mortar joint
  ctx.fillStyle = '#141310';
  ctx.fillRect(0, 0, 512, 512);

  // 2x2 Flagstone Pavers per grid cell
  const slabs = 2;
  const sw = 512 / slabs;

  for (let r = 0; r < slabs; r++) {
    for (let c = 0; c < slabs; c++) {
      const x = c * sw;
      const y = r * sw;

      const seed = (r * 7 + c * 11) % 4;
      const baseTone = 64 + seed * 6;
      ctx.fillStyle = `rgb(${baseTone}, ${baseTone - 3}, ${baseTone - 9})`;
      ctx.fillRect(x + 4, y + 4, sw - 8, sw - 8);

      // Bevel top/left
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + sw - 5);
      ctx.lineTo(x + 5, y + 5);
      ctx.lineTo(x + sw - 5, y + 5);
      ctx.stroke();

      // Deep groove
      ctx.strokeStyle = '#0f0e0c';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, sw - 4, sw - 4);

      // Lush moss patches
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = 'rgba(68, 115, 48, 0.32)';
        ctx.beginPath();
        ctx.arc(x + sw * 0.5, y + sw * 0.5, sw * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Cell border groove to cleanly frame each corridor block
  ctx.strokeStyle = '#0b0a08';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(cols, rows);
  return texture;
}

/**
 * 3D Chibi Adventurer Model (Explorer with safari fedora hat, vest, backpack, torch)
 */
function createAdventurerMesh() {
  const adventurer = new THREE.Group();

  // Hat
  const hatBrimGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.04, 16);
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
  const hatBrim = new THREE.Mesh(hatBrimGeo, hatMat);
  hatBrim.position.y = 1.05;
  adventurer.add(hatBrim);

  const hatCrownGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.22, 16);
  const hatCrown = new THREE.Mesh(hatCrownGeo, hatMat);
  hatCrown.position.y = 1.16;
  adventurer.add(hatCrown);

  // Hat dark band
  const hatBandGeo = new THREE.CylinderGeometry(0.262, 0.262, 0.05, 16);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x3f1d0b, roughness: 0.9 });
  const hatBand = new THREE.Mesh(hatBandGeo, bandMat);
  hatBand.position.y = 1.08;
  adventurer.add(hatBand);

  // Head
  const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.88;
  adventurer.add(head);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
  eyeL.position.set(-0.09, 0.9, 0.22);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
  eyeR.position.set(0.09, 0.9, 0.22);
  adventurer.add(eyeL, eyeR);

  // Torso / Khaki Vest
  const vestGeo = new THREE.BoxGeometry(0.38, 0.42, 0.26);
  const vestMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });
  const vest = new THREE.Mesh(vestGeo, vestMat);
  vest.position.y = 0.55;
  adventurer.add(vest);

  // Backpack on back
  const packGeo = new THREE.BoxGeometry(0.28, 0.34, 0.16);
  const packMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
  const backpack = new THREE.Mesh(packGeo, packMat);
  backpack.position.set(0, 0.58, -0.19);
  adventurer.add(backpack);

  // Legs / Boots
  const legMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.8 });
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 10), legMat);
  legL.position.set(-0.11, 0.18, 0);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 10), legMat);
  legR.position.set(0.11, 0.18, 0);
  adventurer.add(legL, legR);

  // Handheld Torch
  const torchHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8),
    new THREE.MeshStandardMaterial({ color: 0x582914, roughness: 0.9 })
  );
  torchHandle.position.set(0.28, 0.65, 0.15);
  torchHandle.rotation.x = Math.PI / 8;
  adventurer.add(torchHandle);

  const flameGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0.28, 0.9, 0.24);
  adventurer.add(flame);

  // Prominent explorer avatar calibrated to corridor width with zero wall clipping
  adventurer.scale.set(1.95, 1.95, 1.95);

  return adventurer;
}

/**
 * 3D Hunter Mesh - Chaser avatar with ominous dark obsidian armor, glowing crimson horns & visor, and red aura
 */
function createHunterMesh() {
  const hunter = new THREE.Group();

  // Dark obsidian helmet/hood
  const hoodGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.38, 16);
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.85,
  });
  const hood = new THREE.Mesh(hoodGeo, armorMat);
  hood.position.y = 1.05;
  hunter.add(hood);

  // Horns / Spikes on helmet
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.2, metalness: 0.9 });
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), hornMat);
  hornL.position.set(-0.2, 1.25, 0);
  hornL.rotation.z = 0.4;
  const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), hornMat);
  hornR.position.set(0.2, 1.25, 0);
  hornR.rotation.z = -0.4;
  hunter.add(hornL, hornR);

  // Glowing Crimson Visor / Eyes
  const visorMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.12), visorMat);
  visor.position.set(0, 0.98, 0.22);
  hunter.add(visor);

  // Torso / Heavy Cyber Armor
  const torsoMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    roughness: 0.4,
    metalness: 0.7,
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.28), torsoMat);
  torso.position.y = 0.58;
  hunter.add(torso);

  // Crimson Core Reactor on Chest
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), coreMat);
  core.position.set(0, 0.62, 0.15);
  hunter.add(core);

  // Legs / Armored Greaves
  const greaveMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.34, 10), greaveMat);
  legL.position.set(-0.12, 0.17, 0);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.34, 10), greaveMat);
  legR.position.set(0.12, 0.17, 0);
  hunter.add(legL, legR);

  // Menacing Red Aura Point Light
  const hunterLight = new THREE.PointLight(0xff0044, 2.8, 6.0, 1.2);
  hunterLight.position.set(0, 1.2, 0);
  hunter.add(hunterLight);

  // Ground Warning Beacon Ring
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.65 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  hunter.add(ring);

  hunter.scale.set(1.95, 1.95, 1.95);
  return hunter;
}

/**
 * 3D Golden Treasure Vault Chest with sparkling gem mounds
 */
function createTreasureVaultMesh() {
  const vault = new THREE.Group();

  // Chest base box
  const chestMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.55,
    metalness: 0.25,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.3,
    metalness: 0.85,
  });

  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.85), chestMat);
  baseMesh.position.y = 0.325;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  vault.add(baseMesh);

  // Arched Lid
  const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.425, 1.2, 16, 1, false, 0, Math.PI), chestMat);
  lidMesh.rotation.z = Math.PI / 2;
  lidMesh.position.set(0, 0.65, 0);
  lidMesh.castShadow = true;
  vault.add(lidMesh);

  // Gold Straps
  [-0.45, 0.45].forEach((gx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.68, 0.88), goldTrimMat);
    strap.position.set(gx, 0.34, 0);
    vault.add(strap);

    const lidStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 16, 1, false, 0, Math.PI), goldTrimMat);
    lidStrap.rotation.z = Math.PI / 2;
    lidStrap.position.set(gx, 0.65, 0);
    vault.add(lidStrap);
  });

  // Golden Lock Plate
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.08), goldTrimMat);
  lock.position.set(0, 0.48, 0.44);
  vault.add(lock);

  // Mounds of Gold Coins & Rubies surrounding chest
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.85 });
  const rubyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.15, metalness: 0.4 });
  const sapphireMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.4 });

  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const dist = 0.75 + Math.sin(i * 3) * 0.25;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    if (i % 3 === 0) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), i % 2 === 0 ? rubyMat : sapphireMat);
      gem.position.set(px, 0.08, pz);
      gem.rotation.set(Math.random(), Math.random(), Math.random());
      vault.add(gem);
    } else {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), coinMat);
      coin.position.set(px, 0.04, pz);
      coin.rotation.set(Math.random() * 0.4, Math.random() * 2, Math.random() * 0.4);
      vault.add(coin);
    }
  }

  // Radiating Golden Beacon Light
  const vaultLight = new THREE.PointLight(0xfacc15, 3.2, 12.0, 1.2);
  vaultLight.position.set(0, 1.4, 0);
  vault.add(vaultLight);

  // Towering Golden Holographic Light Pillar (clearly visible from upper angle top-view)
  const pillarGeo = new THREE.CylinderGeometry(0.35, 0.75, 14.0, 16, 1, true);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
  pillarMesh.position.y = 7.0;
  pillarMesh.name = 'beaconPillar';
  vault.add(pillarMesh);

  // Concentric rotating beacon halo rings
  const ringGeo = new THREE.TorusGeometry(0.95, 0.045, 8, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = 1.35;
  ring1.name = 'beaconRing1';
  vault.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 8, 24), ringMat);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 1.75;
  ring2.name = 'beaconRing2';
  vault.add(ring2);

  // Floating Golden Star / Crown Emblem above the vault
  const crownGeo = new THREE.OctahedronGeometry(0.36);
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.9,
  });
  const crown = new THREE.Mesh(crownGeo, crownMat);
  crown.position.y = 2.4;
  crown.name = 'beaconCrown';
  vault.add(crown);

  return vault;
}

/**
 * 3D Red Iron Portcullis Gate
 */
function createRedGateMesh() {
  const gateGroup = new THREE.Group();

  // Stone Archway Frame
  const archMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.8, 0.4), archMat);
  leftPillar.position.set(-1.35, 1.4, 0);
  const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.8, 0.4), archMat);
  rightPillar.position.set(1.35, 1.4, 0);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.45, 0.45), archMat);
  lintel.position.set(0, 2.65, 0);

  // Stone Floor Threshold Slab
  const threshMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const threshold = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.8), threshMat);
  threshold.position.set(0, 0.04, 0);

  gateGroup.add(leftPillar, rightPillar, lintel, threshold);

  // Moving Portcullis Bars
  const barsGroup = new THREE.Group();
  barsGroup.name = 'portcullisBars';

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.7,
    roughness: 0.35,
  });

  // Vertical iron bars
  const barCount = 7;
  const barSpacing = 2.3 / (barCount - 1);
  for (let i = 0; i < barCount; i++) {
    const bx = -1.15 + i * barSpacing;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 10), ironMat);
    bar.position.set(bx, 1.15, 0);

    // Sharp bottom spike
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 10), ironMat);
    spike.position.set(bx, 0.05, 0);
    spike.rotation.x = Math.PI;

    barsGroup.add(bar, spike);
  }

  // Horizontal crossbeams
  [0.7, 1.6].forEach((by) => {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 0.09), ironMat);
    cross.position.set(0, by, 0);
    barsGroup.add(cross);
  });

  gateGroup.add(barsGroup);

  // Ominous Red / Emerald Green Warning Beacon
  const warnLight = new THREE.PointLight(0xef4444, 1.4, 5.0, 1.5);
  warnLight.position.set(0, 2.45, 0);
  warnLight.name = 'warnLight';
  gateGroup.add(warnLight);

  return gateGroup;
}

/**
 * 3D Sunken Excavation Pit (Dig Trap with upward spikes & danger hazard rim)
 */
function createDigPitMesh() {
  const pitGroup = new THREE.Group();

  // 1. Excavation Pit Cavity (Dark void well below the floor level)
  const pitDepth = 0.5;
  const pitGeo = new THREE.BoxGeometry(2.1, pitDepth, 2.1);
  const pitMat = new THREE.MeshStandardMaterial({
    color: 0x05070c,
    roughness: 0.98,
    metalness: 0.1,
  });
  const cavity = new THREE.Mesh(pitGeo, pitMat);
  cavity.position.y = -pitDepth / 2 + 0.02;
  pitGroup.add(cavity);

  // 2. Chiseled Stone Hazard Curb / Warning Rim around the pit
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.8,
  });
  const rimGeo = new THREE.BoxGeometry(2.3, 0.08, 0.12);

  // North, South, East, West curb borders
  const rimN = new THREE.Mesh(rimGeo, rimMat);
  rimN.position.set(0, 0.04, -1.06);
  pitGroup.add(rimN);

  const rimS = new THREE.Mesh(rimGeo, rimMat);
  rimS.position.set(0, 0.04, 1.06);
  pitGroup.add(rimS);

  const rimE = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 2.3), rimMat);
  rimE.position.set(1.06, 0.04, 0);
  pitGroup.add(rimE);

  const rimW = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 2.3), rimMat);
  rimW.position.set(-1.06, 0.04, 0);
  pitGroup.add(rimW);

  // 3. Glowing Red Caution Strip / Danger Runes
  const cautionMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const cautionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1.05, 4),
    cautionMat
  );
  cautionRing.rotation.x = -Math.PI / 2;
  cautionRing.rotation.z = Math.PI / 4;
  cautionRing.position.y = 0.05;
  pitGroup.add(cautionRing);

  // 4. Sharp Impaling Spikes rising from the bottom of the dig pit
  const spikeGroup = new THREE.Group();
  spikeGroup.name = 'pitSpikes';
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.85,
  });

  const spikePositions = [
    [-0.55, -0.55],
    [0.55, -0.55],
    [-0.55, 0.55],
    [0.55, 0.55],
    [0, 0],
    [-0.45, 0],
    [0.45, 0],
    [0, -0.45],
    [0, 0.45],
  ];

  spikePositions.forEach(([sx, sz]) => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52, 5), spikeMat);
    spike.position.set(sx, -0.05, sz);
    spikeGroup.add(spike);
  });
  pitGroup.add(spikeGroup);

  // 5. Pulsing Danger Ember Light from deep in the pit
  const pitLight = new THREE.PointLight(0xef4444, 1.2, 3.2);
  pitLight.position.set(0, 0.1, 0);
  pitLight.name = 'pitLight';
  pitGroup.add(pitLight);

  return pitGroup;
}

/**
 * 3D RUNE Pedestal (Ancient Altar with Glowing Sun Rune)
 */
function createRunePedestalMesh() {
  const runeGroup = new THREE.Group();

  // Stone stepped base
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 1.3), baseMat);
  step1.position.y = 0.1;
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 1.0), baseMat);
  step2.position.y = 0.3;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), baseMat);
  shaft.position.y = 0.65;
  const topSlab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), baseMat);
  topSlab.position.y = 0.95;

  runeGroup.add(step1, step2, shaft, topSlab);

  // Glowing Sun Rune Medallion on Top
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });
  const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16), runeMat);
  medallion.position.y = 1.03;
  medallion.name = 'medallion';
  runeGroup.add(medallion);

  // Mystic Amber Aura Light
  const runeLight = new THREE.PointLight(0xf59e0b, 1.8, 4.5, 1.2);
  runeLight.position.set(0, 1.3, 0);
  runeLight.name = 'runeLight';
  runeGroup.add(runeLight);

  return runeGroup;
}

/**
 * 3D WAY Marker Checkpoint (Compass Dais with Rotating Holographic Arrow)
 */
function createWayMarkerMesh() {
  const wayGroup = new THREE.Group();

  // Floor Dais
  const daisMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.1, 24), daisMat);
  dais.position.y = 0.05;
  wayGroup.add(dais);

  // Golden Ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.035, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.11;
  wayGroup.add(ring);

  // Floating Rotating Holographic WAY Arrow
  const arrowGroup = new THREE.Group();
  arrowGroup.name = 'wayArrow';
  arrowGroup.position.y = 0.9;

  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xeab308,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const arrowCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 12), arrowMat);
  arrowCone.position.set(0, 0, 0.25);
  arrowCone.rotation.x = Math.PI / 2;

  const arrowTail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.4), arrowMat);
  arrowTail.position.set(0, 0, -0.15);

  arrowGroup.add(arrowCone, arrowTail);
  wayGroup.add(arrowGroup);

  // Floating Checkpoint Beacon Diamond
  const diamondMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.9,
    roughness: 0.15,
    metalness: 0.3,
  });
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), diamondMat);
  diamond.position.y = 1.6;
  diamond.name = 'wayDiamond';
  wayGroup.add(diamond);

  // Concentric checkpoint pulse ring
  const pulseRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.025, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
  );
  pulseRing.rotation.x = Math.PI / 2;
  pulseRing.position.y = 0.5;
  pulseRing.name = 'wayPulseRing';
  wayGroup.add(pulseRing);

  // Checkpoint Beacon Light
  const glow = new THREE.PointLight(0x38bdf8, 1.8, 4.5, 1.2);
  glow.position.set(0, 1.1, 0);
  glow.name = 'wayGlow';
  wayGroup.add(glow);

  return wayGroup;
}

/**
 * 3D Base Camp (Expedition Tent & Campfire)
 */
function createBaseCampMesh() {
  const camp = new THREE.Group();

  // Canvas Tent (pyramid)
  const tentMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
  const tent = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 4), tentMat);
  tent.position.set(-0.5, 0.7, -0.5);
  tent.rotation.y = Math.PI / 4;
  camp.add(tent);

  // Campfire stone ring & flame
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), stoneMat);
    stone.position.set(0.6 + Math.cos(a) * 0.35, 0.08, 0.6 + Math.sin(a) * 0.35);
    camp.add(stone);
  }

  // Flame mesh
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.45, 8),
    new THREE.MeshBasicMaterial({ color: 0xf97316 })
  );
  flame.position.set(0.6, 0.28, 0.6);
  camp.add(flame);

  const fireLight = new THREE.PointLight(0xf97316, 2.0, 5.0, 1.2);
  fireLight.position.set(0.6, 0.5, 0.6);
  camp.add(fireLight);

  return camp;
}

/**
 * 3D Ancient Temple Torch Brazier (Decorative ambient light & flame)
 */
function createTorchBrazierMesh() {
  const brazier = new THREE.Group();
  const standMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.7 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 12), standMat);
  base.position.y = 0.125;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.1, 12), standMat);
  pole.position.y = 0.8;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.22, 0.35, 12), standMat);
  bowl.position.y = 1.5;
  brazier.add(base, pole, bowl);

  // Burning Embers & Flame
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xfbbf24,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 8), flameMat);
  flame.position.y = 1.85;
  flame.name = 'brazierFlame';
  brazier.add(flame);

  const flameLight = new THREE.PointLight(0xf59e0b, 1.4, 6.0, 1.5);
  flameLight.position.y = 2.0;
  flameLight.name = 'brazierLight';
  brazier.add(flameLight);

  return brazier;
}

/**
 * Main 3D Maze Canvas Component
 */
export default function MazeCanvas({ state, gameState, playerId }) {
  const mountRef = useRef(null);
  const currentGameState = state || gameState;
  const stateRef = useRef(currentGameState);
  stateRef.current = currentGameState;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Atmosphere (Ancient Jungle Ruins Courtyard)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c141c); // Deep twilight ruin sky
    scene.fog = new THREE.FogExp2(0x0a121a, 0.015); // Subtle atmospheric depth with clear visibility

    const width = container.clientWidth || 800;
    const height = Math.round(width * (9 / 16)) || 480;

    // 2. Dedicated Upper-Angle Top-View Camera (TPP)
    // Elevated perspective clearly framing the enlarged adventurer, corridors, 3D stone walls, and all obstacles
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 150);
    camera.position.set(1.5 * 3.0, 15.5, 1.5 * 3.0 + 8.5);
    camera.lookAt(1.5 * 3.0, 0.4, 1.5 * 3.0 - 0.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    container.appendChild(renderer.domElement);

    // 3. High-Clarity Lighting:
    // - Hemisphere light provides ambient sky + ground bounce so all walls and floors are clearly visible
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x243b30, 1.35);
    scene.add(hemiLight);

    // - Warm directional sunlight casting crisp shadows from walls and obstacles
    const sunLight = new THREE.DirectionalLight(0xfffaee, 1.6);
    sunLight.position.set(20, 38, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // - Player Torch / Lantern Light: Bright amber glow illuminating the immediate surrounding corridors
    const torchLight = new THREE.PointLight(0xffb84d, 2.2, 20.0, 1.2);
    torchLight.castShadow = false;
    scene.add(torchLight);

    const forwardFlashLight = new THREE.PointLight(0x93c5fd, 0.8, 14.0, 1.5);
    scene.add(forwardFlashLight);

    // 4. Procedural Textures & Materials
    const CELL_SIZE = 3.0; // 3 meters per maze grid cell
    const WALL_HEIGHT = 2.8;

    const DEFAULT_GRID = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
      [1, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1],
      [1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
      [1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];

    let mazeCols = 31;
    let mazeRows = 17;
    const initialGrid = stateRef.current?.layout?.grid || DEFAULT_GRID;
    if (stateRef.current?.layout) {
      mazeCols = stateRef.current.layout.width || 31;
      mazeRows = stateRef.current.layout.height || 17;
    }

    const stoneWallTex = createStoneWallTexture();
    const stoneFloorTex = createStoneFloorTexture(mazeCols, mazeRows);

    const wallMat = new THREE.MeshStandardMaterial({
      map: stoneWallTex,
      roughness: 0.8,
      metalness: 0.1,
    });

    const floorMat = new THREE.MeshStandardMaterial({
      map: stoneFloorTex,
      roughness: 0.75,
      metalness: 0.15,
    });

    // Outer Temple Ceiling Trim
    const wallBoxGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallCapGeo = new THREE.BoxGeometry(CELL_SIZE, 0.18, CELL_SIZE);
    const wallCapMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });

    // 5. Build Maze Grid Structure
    // Floor Mesh spanning full maze perfectly with matching texture mapping
    const floorGeo = new THREE.PlaneGeometry(mazeCols * CELL_SIZE, mazeRows * CELL_SIZE);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((mazeCols * CELL_SIZE) / 2, 0, (mazeRows * CELL_SIZE) / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls Instancing / Placement: Centered on (c + 0.5) * CELL_SIZE, (r + 0.5) * CELL_SIZE
    const wallsGroup = new THREE.Group();
    function buildWalls(grid) {
      while (wallsGroup.children.length > 0) {
        wallsGroup.remove(wallsGroup.children[0]);
      }
      const rCount = grid.length;
      const cCount = grid[0].length;
      for (let r = 0; r < rCount; r++) {
        for (let c = 0; c < cCount; c++) {
          if (grid[r][c] === 1) {
            const wx = (c + 0.5) * CELL_SIZE;
            const wz = (r + 0.5) * CELL_SIZE;

            const wallMesh = new THREE.Mesh(wallBoxGeo, wallMat);
            wallMesh.position.set(wx, WALL_HEIGHT / 2, wz);
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            wallsGroup.add(wallMesh);

            const wallCap = new THREE.Mesh(wallCapGeo, wallCapMat);
            wallCap.position.set(wx, WALL_HEIGHT + 0.09, wz);
            wallsGroup.add(wallCap);
          }
        }
      }
    }
    buildWalls(initialGrid);
    scene.add(wallsGroup);

    // 6. Interactive Objects Map & Tracking
    const collectiblesMap = new Map();
    const checkpointsMap = new Map();
    const switchesMap = new Map();
    const barriersMap = new Map();
    const hazardsMap = new Map();
    const braziersList = [];

    const initialStart = stateRef.current?.layout?.start || { x: 1.5, y: 1.5 };
    const initialExit = stateRef.current?.layout?.exit || { x: 28.5, y: 14.5 };

    // Base Camp (Start: 1.5, 1.5)
    const baseCamp = createBaseCampMesh();
    baseCamp.position.set(initialStart.x * CELL_SIZE, 0, initialStart.y * CELL_SIZE);
    scene.add(baseCamp);

    // Treasure Vault (Exit: cleanly situated inside open 3x3 vault chamber)
    const treasureVault = createTreasureVaultMesh();
    treasureVault.position.set(initialExit.x * CELL_SIZE, 0, initialExit.y * CELL_SIZE);
    scene.add(treasureVault);

    // 3D Player Adventurer Mesh (visible in TPP mode, hidden in pure FPV mode)
    const playerAdventurer = createAdventurerMesh();
    scene.add(playerAdventurer);

    // 3D Hunter Mesh (server-authoritative hunter chasing player)
    const hunterMesh = createHunterMesh();
    hunterMesh.visible = false;
    scene.add(hunterMesh);

    // Gem Geometries & Materials
    const sapphireMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.3,
    });
    const rubyMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xbe123c,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.3,
    });
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.8,
    });

    // Populate Dynamic Items function (can be called whenever state arrives)
    function populateItems(st) {
      if (!st) return;

      // Dynamically reposition Exit and Start if layout specifies
      if (st.layout?.exit && treasureVault) {
        treasureVault.position.set(st.layout.exit.x * CELL_SIZE, 0, st.layout.exit.y * CELL_SIZE);
      }
      if (st.layout?.start && baseCamp) {
        baseCamp.position.set(st.layout.start.x * CELL_SIZE, 0, st.layout.start.y * CELL_SIZE);
      }

      // Front lantern and corridor braziers removed to ensure 100% open, unobstructed paths

      if (st.collectibles && collectiblesMap.size === 0) {
        st.collectibles.forEach((item) => {
          const gemGroup = new THREE.Group();
          let gemMesh;
          if (item.type === 'RUBY') {
            gemMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32), rubyMat);
          } else if (item.type === 'SAPPHIRE') {
            gemMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.36), sapphireMat);
          } else {
            gemMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), coinMat);
            gemMesh.rotation.x = Math.PI / 2;
          }
          gemMesh.castShadow = true;
          gemGroup.add(gemMesh);

          const lightColor = item.type === 'RUBY' ? 0xf43f5e : item.type === 'SAPPHIRE' ? 0x38bdf8 : 0xfacc15;
          const gemLight = new THREE.PointLight(lightColor, 1.2, 3.5, 1.4);
          gemGroup.add(gemLight);

          gemGroup.position.set(item.x * CELL_SIZE, 1.1, item.y * CELL_SIZE);
          scene.add(gemGroup);
          collectiblesMap.set(item.id, gemGroup);
        });
      }

      if (st.checkpoints && checkpointsMap.size === 0) {
        st.checkpoints.forEach((cp) => {
          const cpMesh = createWayMarkerMesh();
          cpMesh.position.set(cp.x * CELL_SIZE, 0, cp.y * CELL_SIZE);
          scene.add(cpMesh);
          checkpointsMap.set(cp.id, cpMesh);
        });
      }

      if (st.switches && switchesMap.size === 0) {
        st.switches.forEach((sw) => {
          const swMesh = createRunePedestalMesh();
          swMesh.position.set(sw.x * CELL_SIZE, 0, sw.y * CELL_SIZE);
          scene.add(swMesh);
          switchesMap.set(sw.id, swMesh);
        });
      }

      if (st.barriers && barriersMap.size === 0) {
        st.barriers.forEach((bar) => {
          const gateMesh = createRedGateMesh();
          const bx = (Math.floor(bar.x) + 0.5) * CELL_SIZE;
          const bz = (Math.floor(bar.y) + 0.5) * CELL_SIZE;
          gateMesh.position.set(bx, 0, bz);
          // Set gate orientation to span across corridor:
          if (bar.orientation === 'HORIZONTAL' || bar.orientation === 'E_W') {
            gateMesh.rotation.y = Math.PI / 2;
          } else {
            gateMesh.rotation.y = 0;
          }
          scene.add(gateMesh);
          barriersMap.set(bar.id, gateMesh);
        });
      }

      if (st.hazards && hazardsMap.size === 0) {
        st.hazards.forEach((hz) => {
          const hzMesh = createDigPitMesh();
          hzMesh.position.set(hz.x * CELL_SIZE, 0, hz.y * CELL_SIZE);
          scene.add(hzMesh);
          hazardsMap.set(hz.id, hzMesh);
        });
      }
    }

    // Populate initial items if state already present
    populateItems(stateRef.current);

    // 7. Navigation, Position Interpolation & Camera Smooth Follow
    let charX = 1.5 * CELL_SIZE;
    let charZ = 1.5 * CELL_SIZE;
    let targetX = charX;
    let targetZ = charZ;

    let hunterX = 1.5 * CELL_SIZE;
    let hunterZ = 1.5 * CELL_SIZE;
    let prevHunterX = hunterX;
    let prevHunterZ = hunterZ;
    let hunterYaw = 0;

    let currentYaw = 0; // Camera horizontal look angle
    let targetYaw = 0;
    let prevCharX = charX;
    let prevCharZ = charZ;
    let headBobTimer = 0;

    let animTime = 0;
    let frameId;

    // Render & Animation Loop
    function animate() {
      frameId = requestAnimationFrame(animate);
      animTime += 0.03;

      const stateNow = stateRef.current;
      if (!stateNow || !stateNow.character) return;

      // Ensure dynamic items and walls are populated if they arrived after mount
      populateItems(stateNow);
      if (stateNow.layout?.grid) {
        const targetCols = stateNow.layout.width || 31;
        const targetRows = stateNow.layout.height || 17;
        if (wallsGroup.children.length === 0 || mazeCols !== targetCols || mazeRows !== targetRows) {
          mazeCols = targetCols;
          mazeRows = targetRows;
          buildWalls(stateNow.layout.grid);
        }
      }

      const c = stateNow.character;
      targetX = c.x * CELL_SIZE;
      targetZ = c.y * CELL_SIZE;

      // Smooth Position Lerp
      const dx = targetX - charX;
      const dz = targetZ - charZ;
      charX += dx * 0.22;
      charZ += dz * 0.22;

      // Determine movement heading & target yaw angle
      const moveDist = Math.hypot(targetX - prevCharX, targetZ - prevCharZ);
      const isMoving = moveDist > 0.015;

      if (isMoving) {
        headBobTimer += 0.18;
        const moveAngle = Math.atan2(targetX - prevCharX, targetZ - prevCharZ);
        // Face moving direction
        targetYaw = moveAngle;
      }

      // Smooth Angular Slerp for Yaw (ensuring shortest turn path)
      let yawDiff = targetYaw - currentYaw;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      currentYaw += yawDiff * 0.12;

      prevCharX = targetX;
      prevCharZ = targetZ;

      // Head bobbing calculation for immersion
      const headBobY = isMoving ? Math.sin(headBobTimer) * 0.035 : 0;

      // Dedicated Upper-Angle Top-View Camera Follow (TPP)
      // Elevated perspective showing character, stone corridors, walls, and all obstacles with supreme clarity
      const camOffsetY = 15.5;
      const camOffsetZ = 8.5;
      camera.position.set(charX, camOffsetY, charZ + camOffsetZ);
      camera.lookAt(charX, 0.4, charZ - 0.8);

      // Player Adventurer model: always visible in top-view, animated walking bob
      playerAdventurer.visible = true;
      playerAdventurer.position.set(charX, isMoving ? Math.abs(Math.sin(animTime * 12)) * 0.08 : 0, charZ);
      playerAdventurer.rotation.y = currentYaw + Math.PI;

      // Player Torchlight: radiates warm light around character and corridor
      torchLight.position.set(charX, 3.5, charZ);
      forwardFlashLight.position.set(charX, 2.5, charZ);

      // Hunter model: rendered for both players with distinctive red glow
      if (stateNow.hunter) {
        hunterMesh.visible = true;
        const targetHX = stateNow.hunter.x * CELL_SIZE;
        const targetHZ = stateNow.hunter.y * CELL_SIZE;
        hunterX += (targetHX - hunterX) * 0.25;
        hunterZ += (targetHZ - hunterZ) * 0.25;

        const hMoveDist = Math.hypot(targetHX - prevHunterX, targetHZ - prevHunterZ);
        if (hMoveDist > 0.01) {
          hunterYaw = Math.atan2(targetHX - prevHunterX, targetHZ - prevHunterZ);
        }
        prevHunterX = targetHX;
        prevHunterZ = targetHZ;

        hunterMesh.position.set(hunterX, stateNow.hunter.active ? Math.abs(Math.sin(animTime * 14)) * 0.08 : 0, hunterZ);
        hunterMesh.rotation.y = hunterYaw + Math.PI;
      } else {
        hunterMesh.visible = false;
      }

      // Animate Collectibles (floating & rotating gems)
      stateNow.collectibles?.forEach((item) => {
        const gem = collectiblesMap.get(item.id);
        if (gem) {
          if (item.collected) {
            // Shrink collected gems
            gem.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), 0.15);
            if (gem.scale.x < 0.05) gem.visible = false;
          } else {
            gem.visible = true;
            gem.rotation.y += 0.04;
            gem.position.y = 1.1 + Math.sin(animTime * 3 + item.x) * 0.12;
          }
        }
      });

      // Animate Destination Exit Beacon (Golden Light Pillar & Orbiting Rings)
      if (treasureVault) {
        if (stateNow.layout?.exit) {
          treasureVault.position.set(stateNow.layout.exit.x * CELL_SIZE, 0, stateNow.layout.exit.y * CELL_SIZE);
        }
        const pillar = treasureVault.getObjectByName('beaconPillar');
        const ring1 = treasureVault.getObjectByName('beaconRing1');
        const ring2 = treasureVault.getObjectByName('beaconRing2');
        const crown = treasureVault.getObjectByName('beaconCrown');
        if (pillar) {
          pillar.rotation.y += 0.01;
          pillar.material.opacity = 0.32 + Math.sin(animTime * 3) * 0.08;
        }
        if (ring1) ring1.rotation.z += 0.035;
        if (ring2) ring2.rotation.z -= 0.025;
        if (crown) {
          crown.rotation.y += 0.04;
          crown.position.y = 2.4 + Math.sin(animTime * 2.5) * 0.12;
        }
      }

      // Animate Checkpoints (rotating WAY compass arrow & glowing beacon diamond)
      stateNow.checkpoints?.forEach((cp) => {
        const marker = checkpointsMap.get(cp.id);
        if (marker) {
          const arrow = marker.getObjectByName('wayArrow');
          const diamond = marker.getObjectByName('wayDiamond');
          const pulseRing = marker.getObjectByName('wayPulseRing');
          const glow = marker.getObjectByName('wayGlow');

          if (arrow) {
            arrow.rotation.y += 0.035;
            arrow.position.y = 0.9 + Math.sin(animTime * 2.5) * 0.08;
          }
          if (diamond) {
            diamond.rotation.y += 0.04;
            diamond.position.y = 1.6 + Math.sin(animTime * 3) * 0.08;
          }
          if (pulseRing) {
            pulseRing.scale.setScalar(1.0 + Math.sin(animTime * 3.5) * 0.1);
          }

          if (cp.passed) {
            if (diamond) diamond.material.emissive.setHex(0x10b981);
            if (glow) glow.color.setHex(0x10b981);
            if (pulseRing) pulseRing.material.color.setHex(0x10b981);
          } else {
            if (diamond) diamond.material.emissive.setHex(0x0284c7);
            if (glow) glow.color.setHex(0x38bdf8);
            if (pulseRing) pulseRing.material.color.setHex(0x38bdf8);
          }
        }
      });

      // Animate Switches (pulse altar rune)
      stateNow.switches?.forEach((sw) => {
        const pedestal = switchesMap.get(sw.id);
        if (pedestal) {
          const medallion = pedestal.getObjectByName('medallion');
          const runeLight = pedestal.getObjectByName('runeLight');
          if (sw.active) {
            if (medallion) medallion.material.emissive.setHex(0x22c55e);
            if (runeLight) {
              runeLight.color.setHex(0x22c55e);
              runeLight.intensity = 2.8;
            }
          } else {
            if (medallion) medallion.material.emissive.setHex(0xf59e0b);
            if (runeLight) {
              runeLight.color.setHex(0xf59e0b);
              runeLight.intensity = 1.6 + Math.sin(animTime * 4) * 0.4;
            }
          }
        }
      });

      // Animate Barriers (portcullis red iron bars sliding open)
      stateNow.barriers?.forEach((bar) => {
        const gate = barriersMap.get(bar.id);
        if (gate) {
          const bars = gate.getObjectByName('portcullisBars');
          const warnLight = gate.getObjectByName('warnLight');
          if (bars) {
            const targetBarY = bar.open ? 2.5 : 0;
            bars.position.y += (targetBarY - bars.position.y) * 0.12;
          }
          if (warnLight) {
            warnLight.color.setHex(bar.open ? 0x22c55e : 0xef4444);
            warnLight.intensity = bar.open ? 0.6 : 1.4;
          }
        }
      });

      // Animate Dig / Spike Pits (pulsing danger glow & menacing thrusting spikes)
      stateNow.hazards?.forEach((hz) => {
        const pit = hazardsMap.get(hz.id);
        if (pit) {
          const pitLight = pit.getObjectByName('pitLight');
          if (pitLight) {
            pitLight.intensity = 1.1 + Math.sin(animTime * 4.0 + hz.x) * 0.5;
          }
          const spikes = pit.getObjectByName('pitSpikes');
          if (spikes) {
            spikes.position.y = -0.05 + Math.sin(animTime * 3.5 + hz.x) * 0.05;
          }
        }
      });



      // Render 3D Scene
      renderer.render(scene, camera);
    }

    animate();

    // 8. Window Resize Handling
    function handleResize() {
      if (!container) return;
      const nw = container.clientWidth || 800;
      const nh = Math.round(nw * (9 / 16)) || 480;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    }
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75)',
        background: '#090d16',
        userSelect: 'none',
      }}
    >
      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          display: 'block',
        }}
      />

      {/* Top-Left Top-View Indicator */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontSize: '11px',
            padding: '5px 14px',
            borderRadius: '999px',
            background: 'rgba(9, 12, 18, 0.88)',
            color: '#ffffff',
            fontWeight: 700,
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} />
          🗺️ 3D Top-View Arena
        </span>
      </div>

      {/* Bottom Status / Navigation Hints */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '12px',
          display: 'flex',
          gap: '12px',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.75)',
          background: 'rgba(9, 12, 18, 0.8)',
          backdropFilter: 'blur(6px)',
          padding: '4px 12px',
          borderRadius: '999px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <span>
          <strong style={{ color: '#ffffff' }}>P1:</strong> W/S (Vertical)
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span>
        <span>
          <strong style={{ color: '#ffffff' }}>P2:</strong> A/D (Horizontal)
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span>
        <span style={{ color: '#facc15' }}>★ Goal: Treasure Vault</span>
      </div>
    </div>
  );
}
