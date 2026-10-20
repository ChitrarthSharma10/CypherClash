import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Enhanced 3D Runner Canvas (Talking Tom Gold Run & Subway Surfers Style)
 * - 3-Lane suburban city highway with asphalt, sidewalks, trees, streetlights
 * - 3D Human Runner character with athletic animations (run, jump, slide, bank)
 * - 3D Gold Bullion Ingots with Magnetic Flight Curve into player
 * - Golden Particle Bursts on collection
 * - Power-Ups (Magnet with visual attraction field, 2X Star with speed aura, Shield with electric bubble & shatter shockwave, Vault)
 * - 3D Roadblock Hurdles, Overhead Highway Signs, and Delivery Trucks
 */
export default function RunnerCanvas({ state, gameState, playerId, onGoldCollected, onAction }) {
  const mountRef = useRef(null);
  const currentGameState = state || gameState;
  const stateRef = useRef(currentGameState);
  stateRef.current = currentGameState;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Daylight Sky & Fog (Clear Top-View TPP with Wide Map Visibility)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x66a6ee); // Bright sunny clear blue sky
    scene.fog = new THREE.Fog(0x92c4f8, 120, 350); // Deep clear visibility ahead

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Dedicated Top-View TPP Camera: elevated overhead view showing player character and open highway ahead
    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 350);
    camera.position.set(0, 6.8, 6.2);
    camera.lookAt(0, 0.4, -13.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    container.appendChild(renderer.domElement);

    // 2. Lighting: Directional Sun Light (casting forward-right shadow) + Hemisphere
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x5a8ec6, 1.45);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaee, 2.05);
    sunLight.position.set(-10, 26, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 160;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 26;
    sunLight.shadow.camera.bottom = -12;
    scene.add(sunLight);

    const softFill = new THREE.DirectionalLight(0x90caf9, 0.55);
    softFill.position.set(15, 14, -12);
    scene.add(softFill);

    // 3. Track Dimensions & Road Architecture (3-Lane Elevated Bridge Highway)
    const LANE_WIDTH = 2.4; // -1: -2.4m, 0: 0m, 1: 2.4m
    const TRACK_LENGTH = 180;
    const ROAD_WIDTH = 7.6;

    // Asphalt Road Surface
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, TRACK_LENGTH);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2e333a,
      roughness: 0.8,
      metalness: 0.08,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -TRACK_LENGTH / 2 + 10);
    road.receiveShadow = true;
    scene.add(road);

    // White Dashed Lane Dividers (at -1.2m and +1.2m)
    const laneDashCount = 45;
    const laneDashes = [];
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const dashGeo = new THREE.BoxGeometry(0.18, 0.02, 1.8);

    [-1.2, 1.2].forEach((xLine) => {
      for (let i = 0; i < laneDashCount; i++) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.position.set(xLine, 0.015, -i * 4.0);
        dash.receiveShadow = true;
        scene.add(dash);
        laneDashes.push(dash);
      }
    });

    // Yellow Curbs & Light Grey Sidewalks with vertical drop-off (Elevated Bridge Highway)
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xb4bcc6, roughness: 0.85 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.5 });
    const dropEdgeMat = new THREE.MeshStandardMaterial({ color: 0x7c8590, roughness: 0.9 });

    [-1, 1].forEach((side) => {
      const curbX = side * (ROAD_WIDTH / 2 + 0.16);
      const sidewalkW = 3.8;
      const sidewalkX = side * (ROAD_WIDTH / 2 + 0.32 + sidewalkW / 2);

      // Yellow Curb Barrier
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, TRACK_LENGTH), curbMat);
      curb.position.set(curbX, 0.17, -TRACK_LENGTH / 2 + 10);
      curb.receiveShadow = true;
      scene.add(curb);

      // Sidewalk Verges
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(sidewalkW, 0.28, TRACK_LENGTH), sidewalkMat);
      sidewalk.position.set(sidewalkX, 0.14, -TRACK_LENGTH / 2 + 10);
      sidewalk.receiveShadow = true;
      scene.add(sidewalk);

      // Vertical outer bridge drop-off facade
      const dropEdge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.5, TRACK_LENGTH), dropEdgeMat);
      dropEdge.position.set(side * (ROAD_WIDTH / 2 + 0.32 + sidewalkW), -1.1, -TRACK_LENGTH / 2 + 10);
      scene.add(dropEdge);
    });

    // Roadside Scenery: Trees and Streetlights on BOTH sides!
    const sceneryTrees = [];
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 });
    const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x258b30, roughness: 0.75, metalness: 0.05 });
    const streetLightMat = new THREE.MeshStandardMaterial({ color: 0x526070, metalness: 0.6, roughness: 0.35 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfffff2 });

    for (let i = 0; i < 18; i++) {
      const zPos = -i * 12;

      // Tree on left and right sidewalks
      [-1, 1].forEach((side) => {
        if (i % 2 === 0) {
          const treeGroup = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 7), treeTrunkMat);
          trunk.position.y = 1.1;
          trunk.castShadow = true;
          treeGroup.add(trunk);

          const foliage = new THREE.Mesh(new THREE.SphereGeometry(1.35, 10, 8), treeFoliageMat);
          foliage.position.y = 2.8;
          foliage.scale.set(1.15, 1.25, 1.15);
          foliage.castShadow = true;
          treeGroup.add(foliage);

          treeGroup.position.set(side * 5.2, 0.28, zPos);
          scene.add(treeGroup);
          sceneryTrees.push(treeGroup);
        } else {
          // Street light on left and right
          const lampGroup = new THREE.Group();
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.8, 8), streetLightMat);
          pole.position.y = 2.4;
          pole.castShadow = true;
          lampGroup.add(pole);

          // Arm reaching towards road
          const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), streetLightMat);
          arm.position.set(-side * 0.55, 4.75, 0);
          lampGroup.add(arm);

          // Glowing white lamp orb
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lampGlowMat);
          bulb.position.set(-side * 1.1, 4.6, 0);
          lampGroup.add(bulb);

          lampGroup.position.set(side * 4.2, 0.28, zPos);
          scene.add(lampGroup);
          sceneryTrees.push(lampGroup);
        }
      });
    }

    // 4. Stylized 3D HUMAN RUNNER (Replacing Cat / Robot)
    const runnerRoot = new THREE.Group();
    scene.add(runnerRoot);

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
    });
    const groundShadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), shadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = 0.03;
    scene.add(groundShadow);

    const humanMesh = new THREE.Group();
    runnerRoot.add(humanMesh);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5b596, roughness: 0.6 });
    const hairCapMat = new THREE.MeshStandardMaterial({ color: 0x00c8e9, roughness: 0.4, metalness: 0.2 });
    const capVisorMat = new THREE.MeshStandardMaterial({ color: 0xffd13b, roughness: 0.4 });
    const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x1a2634, roughness: 0.6 });
    const hoodieTrimMat = new THREE.MeshStandardMaterial({ color: 0x00c8e9, roughness: 0.3 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x111922, roughness: 0.7 });
    const sneakerMat = new THREE.MeshStandardMaterial({ color: 0xff4d5e, roughness: 0.4 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
    head.position.y = 1.76;
    head.castShadow = true;
    humanMesh.add(head);

    // Backwards Baseball Cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.44), hairCapMat);
    cap.position.set(0, 1.88, 0);
    cap.castShadow = true;
    humanMesh.add(cap);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.24), capVisorMat);
    visor.position.set(0, 1.82, 0.28);
    humanMesh.add(visor);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.38), hoodieMat);
    torso.position.y = 1.18;
    torso.castShadow = true;
    humanMesh.add(torso);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.4), hoodieTrimMat);
    stripe.position.y = 1.28;
    humanMesh.add(stripe);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.16, 0.52, 0.18);
    const fistGeo = new THREE.BoxGeometry(0.14, 0.14, 0.16);

    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.42, 1.38, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, hoodieMat);
    leftArmMesh.position.y = -0.24;
    leftArmMesh.castShadow = true;
    leftArmGroup.add(leftArmMesh);
    const leftFist = new THREE.Mesh(fistGeo, skinMat);
    leftFist.position.y = -0.52;
    leftArmGroup.add(leftFist);
    humanMesh.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.42, 1.38, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, hoodieMat);
    rightArmMesh.position.y = -0.24;
    rightArmMesh.castShadow = true;
    rightArmGroup.add(rightArmMesh);
    const rightFist = new THREE.Mesh(fistGeo, skinMat);
    rightFist.position.y = -0.52;
    rightArmGroup.add(rightFist);
    humanMesh.add(rightArmGroup);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.56, 0.22);
    const sneakerGeo = new THREE.BoxGeometry(0.24, 0.16, 0.38);
    const soleGeo = new THREE.BoxGeometry(0.25, 0.05, 0.4);

    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.18, 0.85, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLegMesh.position.y = -0.26;
    leftLegMesh.castShadow = true;
    leftLegGroup.add(leftLegMesh);
    const leftShoe = new THREE.Mesh(sneakerGeo, sneakerMat);
    leftShoe.position.set(0, -0.58, -0.06);
    leftShoe.castShadow = true;
    leftLegGroup.add(leftShoe);
    const leftSole = new THREE.Mesh(soleGeo, soleMat);
    leftSole.position.set(0, -0.66, -0.06);
    leftLegGroup.add(leftSole);
    humanMesh.add(leftLegGroup);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.18, 0.85, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rightLegMesh.position.y = -0.26;
    rightLegMesh.castShadow = true;
    rightLegGroup.add(rightLegMesh);
    const rightShoe = new THREE.Mesh(sneakerGeo, sneakerMat);
    rightShoe.position.set(0, -0.58, -0.06);
    rightShoe.castShadow = true;
    rightLegGroup.add(rightShoe);
    const rightSole = new THREE.Mesh(soleGeo, soleMat);
    rightSole.position.set(0, -0.66, -0.06);
    rightLegGroup.add(rightSole);
    humanMesh.add(rightLegGroup);

    // Protective Shield Bubble
    const shieldGeo = new THREE.SphereGeometry(1.25, 18, 18);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00c8e9,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.y = 1.1;
    shieldMesh.visible = false;
    runnerRoot.add(shieldMesh);

    // Holographic Magnet Crown (shown when magnet is active)
    const magnetCrown = new THREE.Group();
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xff3d00, emissive: 0xff3d00, emissiveIntensity: 0.8 });
    const crownTipMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 });
    const crownArc = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.06, 8, 16, Math.PI), crownMat);
    crownArc.rotation.z = Math.PI;
    magnetCrown.add(crownArc);
    const cTipL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.12), crownTipMat);
    cTipL.position.set(-0.25, -0.08, 0);
    magnetCrown.add(cTipL);
    const cTipR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.12), crownTipMat);
    cTipR.position.set(0.25, -0.08, 0);
    magnetCrown.add(cTipR);
    magnetCrown.position.set(0, 2.3, 0);
    magnetCrown.visible = false;
    runnerRoot.add(magnetCrown);

    // 2X Star Crown (shown when 2X Star is active)
    const starCrown = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.9, metalness: 0.85 })
    );
    starCrown.position.set(0, 2.35, 0);
    starCrown.visible = false;
    runnerRoot.add(starCrown);

    // Magnetic Attraction Wave Ring
    const magnetWaveGeo = new THREE.RingGeometry(0.8, 1.1, 24);
    const magnetWaveMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const magnetWave = new THREE.Mesh(magnetWaveGeo, magnetWaveMat);
    magnetWave.rotation.x = -Math.PI / 2;
    magnetWave.position.y = 0.8;
    magnetWave.visible = false;
    runnerRoot.add(magnetWave);

    // 5. 3D Obstacle Builders
    const obstaclePool = new Map();

    function createTruckMesh() {
      const truck = new THREE.Group();
      const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      [
        [-0.92, 0.36, 1.3], [0.92, 0.36, 1.3],
        [-0.92, 0.36, -1.3], [0.92, 0.36, -1.3],
      ].forEach(([wx, wy, wz]) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, wy, wz);
        w.castShadow = true;
        truck.add(w);
      });

      // All-White Delivery Truck Cab
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 1.55, 1.3),
        new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.35 })
      );
      cab.position.set(0, 1.25, -1.2);
      cab.castShadow = true;
      truck.add(cab);

      const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.65, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x7faee5, roughness: 0.2, metalness: 0.6 })
      );
      windshield.position.set(0, 1.55, -0.5);
      truck.add(windshield);

      const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff59d });
      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.08), lightMat);
      hlL.position.set(-0.68, 0.95, -1.86);
      truck.add(hlL);
      const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.08), lightMat);
      hlR.position.set(0.68, 0.95, -1.86);
      truck.add(hlR);

      // All-White Cargo Box
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 2.25, 3.2),
        new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.4 })
      );
      box.position.set(0, 1.75, 1.0);
      box.castShadow = true;
      truck.add(box);

      // Yellow Rear Bumper
      const rearBumper = new THREE.Mesh(
        new THREE.BoxGeometry(1.95, 0.28, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xffc107, roughness: 0.5 })
      );
      rearBumper.position.set(0, 0.6, 2.62);
      truck.add(rearBumper);

      // Tail Lights
      const redLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      [-0.78, 0.78].forEach((lx) => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.05), redLightMat);
        tl.position.set(lx, 0.9, 2.61);
        truck.add(tl);
      });

      return truck;
    }

    function createHurdleMesh() {
      const hurdle = new THREE.Group();
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
      const strutMat = new THREE.MeshStandardMaterial({ color: 0x6d4420, roughness: 0.85 });

      // A-frame legs on both sides
      [-0.88, 0.88].forEach((fx) => {
        [-0.26, 0.26].forEach((zOff) => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.1), woodMat);
          leg.position.set(fx, 0.4, zOff);
          leg.rotation.x = zOff > 0 ? 0.22 : -0.22;
          leg.castShadow = true;
          hurdle.add(leg);
        });

        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.45), strutMat);
        tie.position.set(fx, 0.28, 0);
        hurdle.add(tie);
      });

      // Main Horizontal Wooden Crossbar
      const barTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.12), woodMat);
      barTop.position.set(0, 0.72, 0);
      barTop.castShadow = true;
      hurdle.add(barTop);

      // Center post / marker block
      const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.14), strutMat);
      centerBlock.position.set(0, 0.86, 0);
      hurdle.add(centerBlock);

      return hurdle;
    }

    function createHighSignMesh() {
      const gantry = new THREE.Group();
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.6, roughness: 0.4 });

      [-1.15, 1.15].forEach((px) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 10), steelMat);
        post.position.set(px, 1.7, 0);
        post.castShadow = true;
        gantry.add(post);
      });

      const clearBar = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.28, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xff8f00, emissiveIntensity: 0.6 })
      );
      clearBar.position.set(0, 1.72, 0);
      clearBar.castShadow = true;
      gantry.add(clearBar);

      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.75, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.5 })
      );
      signBoard.position.set(0, 2.35, 0);
      gantry.add(signBoard);

      return gantry;
    }

    // 6. 3D GOLD BULLION BARS & MAGNETIC COLLECTION SYSTEM
    const goldBarPool = new Map();
    const goldAnimState = new Map(); // id -> { flying: boolean, progress: number, startPos: Vector3 }

    const goldBarMat = new THREE.MeshStandardMaterial({
      color: 0xffc700,
      emissive: 0xff9500,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.18,
    });

    function createGoldBarMesh() {
      const barGroup = new THREE.Group();
      // Pyramid stack of 3 gold bullion ingots matching guidelines
      // Bottom left bar
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.22), goldBarMat);
      b1.position.set(-0.2, 0.07, 0);
      b1.castShadow = true;
      barGroup.add(b1);
      // Bottom right bar
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.22), goldBarMat);
      b2.position.set(0.2, 0.07, 0);
      b2.castShadow = true;
      barGroup.add(b2);
      // Top center bar
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.22), goldBarMat);
      top.position.set(0, 0.21, 0);
      top.castShadow = true;
      barGroup.add(top);

      return barGroup;
    }

    function getOrCreateGoldMesh(id) {
      if (goldBarPool.has(id)) return goldBarPool.get(id);
      const mesh = createGoldBarMesh();
      scene.add(mesh);
      goldBarPool.set(id, mesh);
      goldAnimState.set(id, { flying: false, progress: 0, startPos: new THREE.Vector3() });
      return mesh;
    }

    // 7. GOLD COLLECTION SPARKLE PARTICLE SYSTEM
    const particleCount = 28;
    const sparkleGeo = new THREE.OctahedronGeometry(0.08, 0);
    const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const sparklePool = [];

    for (let i = 0; i < particleCount; i++) {
      const sp = new THREE.Mesh(sparkleGeo, sparkleMat);
      sp.visible = false;
      scene.add(sp);
      sparklePool.push({
        mesh: sp,
        active: false,
        velocity: new THREE.Vector3(),
        life: 0,
      });
    }

    function triggerSparkleBurst(pos, colorHex = 0xffd700) {
      let spawned = 0;
      for (const sp of sparklePool) {
        if (!sp.active && spawned < 7) {
          sp.active = true;
          sp.life = 0.45;
          sp.mesh.visible = true;
          sp.mesh.material.color.setHex(colorHex);
          sp.mesh.position.copy(pos);
          sp.mesh.scale.setScalar(1.0);
          sp.velocity.set(
            (Math.random() - 0.5) * 3.5,
            Math.random() * 2.8 + 1.2,
            (Math.random() - 0.5) * 3.0
          );
          spawned++;
        }
      }
    }

    // 8. 3D POWER-UP ITEMS
    const powerUpPool = new Map();

    function createPowerUpMesh(type) {
      const group = new THREE.Group();

      if (type === 'MAGNET') {
        // Red Horseshoe Magnet with silver tips and blue magnetic energy arc
        const magnetMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.2 });
        const tipMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });

        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.11, 10, 20, Math.PI), magnetMat);
        arc.rotation.z = Math.PI;
        group.add(arc);

        const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), tipMat);
        tipL.position.set(-0.4, -0.15, 0);
        group.add(tipL);

        const tipR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), tipMat);
        tipR.position.set(0.4, -0.15, 0);
        group.add(tipR);

        // Cyan forcefield glow ring
        const fieldGeo = new THREE.TorusGeometry(0.44, 0.04, 8, 20);
        const fieldMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });
        const field = new THREE.Mesh(fieldGeo, fieldMat);
        field.position.set(0, -0.22, 0);
        group.add(field);
      } else if (type === 'DOUBLE_GOLD') {
        // 3D 5-Pointed 2X Star with golden bevels and central embossed core
        const starShape = new THREE.Shape();
        const points = 5;
        const outerR = 0.52;
        const innerR = 0.24;
        for (let i = 0; i < points * 2; i++) {
          const angle = (i * Math.PI) / points - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) starShape.moveTo(x, y);
          else starShape.lineTo(x, y);
        }
        starShape.closePath();

        const starGeo = new THREE.ExtrudeGeometry(starShape, {
          depth: 0.14,
          bevelEnabled: true,
          bevelThickness: 0.04,
          bevelSize: 0.03,
          bevelSegments: 3,
        });
        const starMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          emissive: 0xffaa00,
          emissiveIntensity: 0.75,
          metalness: 0.85,
          roughness: 0.2,
        });
        const starMesh = new THREE.Mesh(starGeo, starMat);
        starMesh.castShadow = true;
        group.add(starMesh);

        // Center circular gold badge
        const centerBadge = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 0.18, 16),
          new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffc107, emissiveIntensity: 0.8, metalness: 0.9 })
        );
        centerBadge.rotation.x = Math.PI / 2;
        group.add(centerBadge);
      } else if (type === 'SHIELD') {
        // 3D Medieval Blue Shield inside Luminous Protective Bubble
        const shieldShape = new THREE.Shape();
        shieldShape.moveTo(-0.28, 0.35);
        shieldShape.lineTo(0.28, 0.35);
        shieldShape.quadraticCurveTo(0.32, 0.0, 0.0, -0.42);
        shieldShape.quadraticCurveTo(-0.32, 0.0, -0.28, 0.35);
        shieldShape.closePath();

        const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
          depth: 0.08,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.02,
        });
        const shieldMat = new THREE.MeshStandardMaterial({
          color: 0x1d4ed8,
          emissive: 0x2563eb,
          emissiveIntensity: 0.65,
          metalness: 0.7,
          roughness: 0.25,
        });
        const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        shieldMesh.castShadow = true;
        group.add(shieldMesh);

        // White border trim on the shield
        const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 });
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.1), trimMat);
        trim.position.set(0, 0.35, 0);
        group.add(trim);

        // Glowing Translucent Protective Bubble Sphere
        const bubbleGeo = new THREE.SphereGeometry(0.58, 24, 24);
        const bubbleMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.38,
          roughness: 0.1,
          metalness: 0.1,
        });
        const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
        group.add(bubble);
      } else if (type === 'VAULT') {
        const vaultMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.85, roughness: 0.3 });
        const goldTrim = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9 });
        const safe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), vaultMat);
        group.add(safe);
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), goldTrim);
        dial.rotation.x = Math.PI / 2;
        dial.position.z = 0.38;
        group.add(dial);
      }

      return group;
    }

    function getOrCreatePowerUpMesh(id, type) {
      if (powerUpPool.has(id)) return powerUpPool.get(id);
      const mesh = createPowerUpMesh(type);
      scene.add(mesh);
      powerUpPool.set(id, mesh);
      return mesh;
    }

    // 9. Checkpoint Overhead Gate Arches
    const checkpointPool = new Map();
    function getOrCreateCheckpointGate(cpId) {
      if (checkpointPool.has(cpId)) return checkpointPool.get(cpId);
      const gate = new THREE.Group();
      const colGeo = new THREE.BoxGeometry(0.6, 6.2, 0.6);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.7 });

      const colL = new THREE.Mesh(colGeo, colMat);
      colL.position.set(-5.6, 3.1, 0);
      gate.add(colL);

      const colR = new THREE.Mesh(colGeo, colMat);
      colR.position.set(5.6, 3.1, 0);
      gate.add(colR);

      const arch = new THREE.Mesh(
        new THREE.BoxGeometry(11.8, 1.4, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xffc107, emissive: 0xff8f00, emissiveIntensity: 0.65 })
      );
      arch.position.set(0, 5.8, 0);
      gate.add(arch);

      scene.add(gate);
      checkpointPool.set(cpId, gate);
      return gate;
    }

    // 9b. 3D GRAND FINISH LINE STRUCTURE AT 1000M
    function createFinishBannerTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = '#ff2a44';
      ctx.lineWidth = 14;
      ctx.strokeRect(8, 8, 1008, 240);
      const sq = 32;
      for (let x = 0; x < 1024; x += sq) {
        ctx.fillStyle = (Math.floor(x / sq) % 2 === 0) ? '#ffffff' : '#ff2a44';
        ctx.fillRect(x, 14, sq, 24);
        ctx.fillStyle = (Math.floor(x / sq) % 2 === 0) ? '#ff2a44' : '#ffffff';
        ctx.fillRect(x, 218, sq, 24);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 84px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FINISH LINE', 512, 128);
      return new THREE.CanvasTexture(canvas);
    }

    function createCheckeredFloorTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const cols = 12;
      const rows = 4;
      const w = 512 / cols;
      const h = 256 / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
          ctx.fillRect(c * w, r * h, w, h);
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    const finishLineGroup = new THREE.Group();
    const pylonGeo = new THREE.BoxGeometry(0.8, 7.5, 0.8);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1a232e, metalness: 0.8, roughness: 0.2 });

    const pylonL = new THREE.Mesh(pylonGeo, pylonMat);
    pylonL.position.set(-5.6, 3.75, 0);
    finishLineGroup.add(pylonL);

    const pylonR = new THREE.Mesh(pylonGeo, pylonMat);
    pylonR.position.set(5.6, 3.75, 0);
    finishLineGroup.add(pylonR);

    // Hazard stripes rings on pylons
    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xff2a44 });
    [-5.6, 5.6].forEach((px) => {
      for (let y = 1.0; y < 7.0; y += 1.4) {
        const ring = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.3, 0.88), hazardMat);
        ring.position.set(px, y, 0);
        finishLineGroup.add(ring);
      }
    });

    // Beacon orbs on top of pylons
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a44 });
    const beaconL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), beaconMat);
    beaconL.position.set(-5.6, 7.8, 0);
    finishLineGroup.add(beaconL);

    const beaconR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), beaconMat);
    beaconR.position.set(5.6, 7.8, 0);
    finishLineGroup.add(beaconR);

    // Overhead Banner Arch
    const bannerTex = createFinishBannerTexture();
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.3,
      emissive: 0xffffff,
      emissiveMap: bannerTex,
      emissiveIntensity: 0.35
    });
    const bannerMesh = new THREE.Mesh(new THREE.BoxGeometry(11.8, 2.2, 0.4), bannerMat);
    bannerMesh.position.set(0, 6.8, 0);
    finishLineGroup.add(bannerMesh);

    // Checkered ground strip across the road
    const checkeredTex = createCheckeredFloorTexture();
    const checkeredMat = new THREE.MeshStandardMaterial({
      map: checkeredTex,
      roughness: 0.4,
      emissive: 0x333333,
      emissiveIntensity: 0.2
    });
    const checkeredGround = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 3.8), checkeredMat);
    checkeredGround.rotation.x = -Math.PI / 2;
    checkeredGround.position.set(0, 0.02, 0);
    checkeredGround.receiveShadow = true;
    finishLineGroup.add(checkeredGround);

    scene.add(finishLineGroup);

    // 10. ANIMATION & RENDER LOOP
    let animId;
    let clock = new THREE.Clock();
    let runnerVisualX = 0;
    let cameraShake = 0;
    let prevShieldTimer = 0;

    function animate() {
      animId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;

      const playerDist = st?.distanceMeters ?? 0;
      const targetLane = st?.currentLane ?? 0;
      const isStunned = st?.isStunned;
      const isJumping = st?.isJumping;
      const jumpY = st?.jumpY ?? 0;
      const isSliding = st?.isSliding;
      const isCountdown = st?.status === 'COUNTDOWN';
      const isReady = st?.status === 'READY';
      const isRunning = st?.status === 'IN_PROGRESS';

      const activePowerUps = st?.activePowerUps ?? {};
      const hasMagnet = (activePowerUps.magnetTimer ?? 0) > 0;
      const hasShield = (activePowerUps.shieldTimer ?? 0) > 0;
      const has2X = (activePowerUps.doubleGoldTimer ?? 0) > 0;

      // Detect shield break (e.g. from collision)
      if (prevShieldTimer > 0 && !hasShield && isStunned) {
        triggerSparkleBurst(new THREE.Vector3(runnerVisualX, 1.2, 0), 0x00e5ff);
      }
      prevShieldTimer = activePowerUps.shieldTimer ?? 0;

      // Smooth horizontal lane transition (Controlled by Player 2: Left/Right)
      runnerVisualX += (targetLane * LANE_WIDTH - runnerVisualX) * 0.22;
      runnerRoot.position.x = runnerVisualX;

      // Vertical position (Controlled by Player 1: Jump)
      runnerRoot.position.y = jumpY;

      // Dynamic ground shadow follows runner beneath feet
      groundShadow.position.x = runnerVisualX;
      groundShadow.scale.setScalar(Math.max(0.4, 1.0 - jumpY * 0.3));

      // Slide scale and posture (Controlled by Player 1: Slide)
      if (isSliding) {
        humanMesh.scale.set(1.15, 0.42, 1.25);
        humanMesh.position.y = -0.38;
        head.position.z = 0.35;
      } else {
        humanMesh.scale.set(1.0, 1.0, 1.0);
        humanMesh.position.y = 0;
        head.position.z = 0;
      }

      // Banking/Leaning when changing tracks
      const laneDelta = targetLane * LANE_WIDTH - runnerVisualX;
      runnerRoot.rotation.z = -laneDelta * 0.16;

      // Character Running / Warm-Up Gait Animation
      if (isReady || isCountdown) {
        // Pre-race ready warm-up bounce at starting line
        const bounce = Math.abs(Math.sin(elapsed * 6.0));
        humanMesh.position.y = bounce * 0.12;
        leftArmGroup.rotation.x = 0.3;
        rightArmGroup.rotation.x = -0.3;
        leftLegGroup.rotation.x = -0.2;
        rightLegGroup.rotation.x = 0.2;
      } else if (!isJumping && !isSliding) {
        const runCycle = Math.sin(elapsed * 13.0);
        leftLegGroup.rotation.x = runCycle * 0.65;
        rightLegGroup.rotation.x = -runCycle * 0.65;
        leftArmGroup.rotation.x = -runCycle * 0.65;
        rightArmGroup.rotation.x = runCycle * 0.65;
        head.position.y = 1.76 + Math.abs(Math.sin(elapsed * 13.0)) * 0.05;
      } else if (isJumping) {
        leftLegGroup.rotation.x = -0.55;
        rightLegGroup.rotation.x = -0.55;
        leftArmGroup.rotation.x = 0.85;
        rightArmGroup.rotation.x = 0.85;
      } else if (isSliding) {
        leftLegGroup.rotation.x = -1.2;
        rightLegGroup.rotation.x = -0.3;
        leftArmGroup.rotation.x = 0.3;
        rightArmGroup.rotation.x = -0.3;
      }

      // Power-Up Character Visuals
      shieldMesh.visible = hasShield;
      if (hasShield) {
        shieldMesh.scale.setScalar(1.0 + Math.sin(elapsed * 6) * 0.05);
        shieldMesh.rotation.y = elapsed * 1.5;
      }

      magnetCrown.visible = hasMagnet;
      if (hasMagnet) {
        magnetCrown.rotation.y = elapsed * 3.0;
        magnetCrown.position.y = 2.3 + Math.sin(elapsed * 5) * 0.08;
      }

      magnetWave.visible = hasMagnet;
      if (hasMagnet) {
        const waveScale = 1.0 + (elapsed * 2.5) % 1.5;
        magnetWave.scale.setScalar(waveScale);
        magnetWave.material.opacity = Math.max(0, 0.45 - (waveScale - 1.0) * 0.3);
      }

      // 2X Star Crown & Trail
      starCrown.visible = has2X;
      if (has2X) {
        starCrown.rotation.y = elapsed * 4.0;
        starCrown.rotation.z = Math.sin(elapsed * 5) * 0.2;
        starCrown.position.y = 2.35 + Math.sin(elapsed * 5) * 0.08;
      }
      if (has2X && isRunning && Math.random() < 0.3) {
        triggerSparkleBurst(new THREE.Vector3(runnerVisualX, 0.2, 0.2), 0xffd700);
      }

      // Collision Stun & Camera Shake
      if (isStunned) {
        cameraShake = 0.35;
        hoodieMat.color.setHex(0xd32f2f);
      } else {
        cameraShake = Math.max(0, cameraShake - delta * 1.5);
        hoodieMat.color.setHex(0x1a2634);
      }

      // Camera Position & Smooth Follow (Exact match to reference photo)
      camera.position.x = runnerVisualX * 0.35 + (Math.random() - 0.5) * cameraShake;
      camera.position.y = 2.3 + jumpY * 0.35 + (Math.random() - 0.5) * cameraShake;
      camera.position.z = 3.8;
      camera.lookAt(runnerVisualX * 0.2, 1.25 + jumpY * 0.3, -14);

      // Scroll Road Dashes (only when moving forward)
      const speedOffset = (playerDist * 0.8) % 4.0;
      laneDashes.forEach((dash, idx) => {
        const baseZ = -(idx % laneDashCount) * 4.0;
        dash.position.z = baseZ + speedOffset;
      });

      // Scroll Scenery Trees & Lights
      sceneryTrees.forEach((tree, idx) => {
        const treeBaseZ = -(idx * 13);
        const relZ = ((treeBaseZ + (playerDist % 182)) % 182);
        tree.position.z = relZ > 10 ? relZ - 182 : relZ;
      });

      // Synchronize Obstacles from Server
      const activeObs = st?.visibleObstacles ?? [];
      const activeObsIds = new Set(activeObs.map((o) => o.id));

      activeObs.forEach((obs) => {
        let mesh = obstaclePool.get(obs.id);
        if (!mesh) {
          if (obs.type === 'TRAIN') mesh = createTruckMesh();
          else if (obs.type === 'LOW_HURDLE') mesh = createHurdleMesh();
          else if (obs.type === 'HIGH_BARRIER') mesh = createHighSignMesh();
          scene.add(mesh);
          obstaclePool.set(obs.id, mesh);
        }

        const relZ = -(obs.distance - playerDist);
        mesh.position.set(obs.lane * LANE_WIDTH, 0, relZ);
        mesh.visible = relZ > -140 && relZ < 8.0;

        if (obs.hit) {
          mesh.rotation.y += delta * 4;
          mesh.position.y = Math.sin(elapsed * 8) * 0.2;
        }
      });

      obstaclePool.forEach((mesh, id) => {
        if (!activeObsIds.has(id)) {
          mesh.visible = false;
        }
      });

      // Synchronize 3D Gold Bars with Magnetic Flight Attraction & Visual Collection
      const activeGold = st?.visibleCoins ?? [];
      const activeGoldIds = new Set(activeGold.map((g) => g.id));
      const runnerPos = new THREE.Vector3(runnerVisualX, 1.2 + jumpY, 0);

      activeGold.forEach((g) => {
        const mesh = getOrCreateGoldMesh(g.id);
        const anim = goldAnimState.get(g.id);
        const targetRelZ = -(g.distance - playerDist);
        const normalPos = new THREE.Vector3(g.lane * LANE_WIDTH, 0.75, targetRelZ);

        if (g.collected && !anim.wasCollected) {
          anim.wasCollected = true;
          anim.collecting = true;
          anim.collectProgress = 0;
          mesh.visible = true;
        }

        if (!g.collected) {
          // Magnet attraction: if within 18 meters and magnet is active, visibly fly and curve towards runner
          if (hasMagnet && targetRelZ > -18.0 && targetRelZ < 2.5) {
            anim.flying = true;
            // Magnetic curved suction: pulls towards runner position across lanes
            mesh.position.x += (runnerVisualX - mesh.position.x) * 0.18;
            mesh.position.y += ((1.2 + jumpY) - mesh.position.y) * 0.15;
            mesh.position.z += (-playerDist - mesh.position.z) * 0.14;
            mesh.rotation.y += delta * 14;
            mesh.rotation.z += delta * 6;
            mesh.scale.setScalar(1.08);
            mesh.visible = true;
          } else {
            anim.flying = false;
            mesh.position.copy(normalPos);
            mesh.scale.setScalar(1.0);
            mesh.rotation.y = elapsed * 3.5;
            mesh.rotation.z = 0;
            mesh.visible = targetRelZ > -130 && targetRelZ < 8;
          }
        } else {
          // Guaranteed visible flight into runner chest when collected
          if (anim.collecting) {
            anim.collectProgress = (anim.collectProgress || 0) + delta * 4.5;
            mesh.visible = true;
            mesh.position.lerp(runnerPos, 0.32);
            mesh.scale.setScalar(Math.max(0.05, 1.0 - anim.collectProgress));
            mesh.rotation.y += delta * 18;
            mesh.rotation.x += delta * 8;

            if (anim.collectProgress >= 1.0 || mesh.position.distanceTo(runnerPos) < 0.6) {
              mesh.visible = false;
              anim.collecting = false;
              triggerSparkleBurst(runnerPos, has2X ? 0xffa000 : 0xffd700);
            }
          } else {
            mesh.visible = false;
          }
        }
      });

      goldBarPool.forEach((mesh, id) => {
        if (!activeGoldIds.has(id)) {
          mesh.visible = false;
        }
      });

      // Synchronize 3D Power-Ups
      const activePowerUpsList = st?.visiblePowerUps ?? [];
      const activePowerUpIds = new Set(activePowerUpsList.map((p) => p.id));

      activePowerUpsList.forEach((pu) => {
        const mesh = getOrCreatePowerUpMesh(pu.id, pu.type);
        const relZ = -(pu.distance - playerDist);
        mesh.position.set(pu.lane * LANE_WIDTH, 1.1 + Math.sin(elapsed * 4) * 0.15, relZ);
        mesh.rotation.y = elapsed * 2.8;
        mesh.visible = !pu.collected && relZ > -130 && relZ < 8;

        if (pu.collected && mesh.visible) {
          mesh.visible = false;
          triggerSparkleBurst(runnerPos, pu.type === 'SHIELD' ? 0x00e5ff : pu.type === 'MAGNET' ? 0xff3d00 : 0xffd700);
        }
      });

      powerUpPool.forEach((mesh, id) => {
        if (!activePowerUpIds.has(id)) {
          mesh.visible = false;
        }
      });

      // Update Active Sparkle Particles
      sparklePool.forEach((sp) => {
        if (sp.active) {
          sp.life -= delta;
          if (sp.life <= 0) {
            sp.active = false;
            sp.mesh.visible = false;
          } else {
            sp.mesh.position.addScaledVector(sp.velocity, delta);
            sp.velocity.y -= delta * 9.8; // gravity
            sp.mesh.scale.setScalar(sp.life / 0.45);
          }
        }
      });

      // Synchronize Checkpoint Arches (250m, 500m, 750m)
      const totalCp = st?.totalCheckpoints ?? 3;
      for (let c = 1; c <= totalCp; c++) {
        const cpDist = c * 250;
        const cpId = `cp-${cpDist}`;
        const gate = getOrCreateCheckpointGate(cpId);
        const relZ = -(cpDist - playerDist);
        gate.position.set(0, 0, relZ);
        gate.visible = relZ > -150 && relZ < 20;
      }

      // Synchronize 3D Grand Finish Line at 1000m
      const courseLength = st?.courseLengthMeters ?? 1000;
      const finishRelZ = -(courseLength - playerDist);
      finishLineGroup.position.set(0, 0, finishRelZ);
      finishLineGroup.visible = finishRelZ > -180 && finishRelZ < 25;
      if (beaconMat) {
        beaconMat.color.setHex(Math.sin(elapsed * 7) > 0 ? 0xff2a44 : 0xffffff);
      }

      // Smooth top-view TPP camera tracking with character lane banking
      camera.position.x = runnerVisualX * 0.18;
      camera.position.y = 6.8;
      camera.position.z = 6.2;
      camera.lookAt(runnerVisualX * 0.22, 0.4, -13.0);

      renderer.render(scene, camera);
    }

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="runner-canvas-container"
      style={{
        width: '100%',
        height: '520px',
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    />
  );
}
