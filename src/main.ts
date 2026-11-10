/**
 * HERO CRAFT — Workbench & Visual Testbed
 * Interface interactive Lil-GUI pour tester la génération déterministe, les biomes,
 * les couches de rendu et le pathfinding d'entité 2x2 en temps réel.
 */
import GUI from 'lil-gui';
import { MapGenerator } from './core/generator/map-generator';
import { AStarPathfinder } from './core/navigation/pathfinding';
import { DioramaScene } from './renderer/diorama-scene';
import { DisplayMode } from './renderer/terrain-mesh';
import { BiomeType, GeneratedMap } from './core/types';

// État global du workbench
const state = {
  seed: 'zelda-botw-warcraft-42',
  chunkX: 0,
  chunkY: 0,
  biomePreset: '4_BIOMES',
  waterLevel: 0.22,
  thermalPasses: 8,
  hydraulicDrops: 3000,
  roughness: 1.0,
  treeDensity: 0.12,
  displayMode: 'BOTW_DIORAMA' as DisplayMode,
  // Actions
  randomSeed: () => {
    state.seed = `seed-${Math.floor(Math.random() * 1000000)}`;
    guiControllers.seed.updateDisplay();
    regenerate();
  },
  resetCamera: () => {
    dioramaScene.resetToDefaultView();
  },
  nextChunkEast: () => {
    state.chunkX += 1;
    guiControllers.chunkX.updateDisplay();
    regenerate();
  },
  prevChunkWest: () => {
    state.chunkX -= 1;
    guiControllers.chunkX.updateDisplay();
    regenerate();
  }
};

let currentMap: GeneratedMap;
let heroPos = { x: 4, y: 15 };
let isHeroMoving = false;

// Initialisation de la scène Babylon.js
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const dioramaScene = new DioramaScene(canvas);

// Convertit le preset de biome en liste de BiomeType
function getActiveBiomesFromPreset(preset: string): BiomeType[] {
  switch (preset) {
    case 'PLAINS_ONLY': return ['PLAINS'];
    case 'FOREST_ONLY': return ['FOREST'];
    case 'HIGHLANDS_ONLY': return ['HIGHLANDS'];
    case 'SWAMP_ONLY': return ['SWAMP'];
    case 'PLAINS_HIGHLANDS': return ['PLAINS', 'HIGHLANDS'];
    case 'FOREST_SWAMP': return ['FOREST', 'SWAMP'];
    case '4_BIOMES':
    default:
      return ['PLAINS', 'FOREST', 'HIGHLANDS', 'SWAMP'];
  }
}

// Fonction de régénération complète
function regenerate(): void {
  const activeBiomes = getActiveBiomesFromPreset(state.biomePreset);

  currentMap = MapGenerator.generate({
    seed: state.seed,
    chunkX: state.chunkX,
    chunkY: state.chunkY,
    activeBiomes,
    waterLevel: state.waterLevel,
    thermalErosionPasses: state.thermalPasses,
    hydraulicDroplets: state.hydraulicDrops,
    roughness: state.roughness,
    treeDensity: state.treeDensity
  });

  heroPos = { ...currentMap.heroSpawn };

  // Mise à jour de la scène 3D
  dioramaScene.loadMap(currentMap, state.displayMode);

  // Mise à jour HUD
  const hudGen = document.getElementById('hud-gen-time');
  if (hudGen) {
    hudGen.innerText = `${currentMap.generationDurationMs.toFixed(1)} ms`;
  }
}

// Configuration de Lil-GUI
const gui = new GUI({ title: '🕹️ HERO CRAFT — Contrôles' });
gui.domElement.style.width = '320px';

// Dossier 1 : Déterminisme & Graines
const fGen = gui.addFolder('1. Graine & Tectonique');
const guiControllers = {
  seed: fGen.add(state, 'seed').name('Graine (Seed)').listen().onFinishChange(regenerate),
  chunkX: fGen.add(state, 'chunkX', -20, 20, 1).name('Secteur Macro X').listen().onChange(regenerate),
  chunkY: fGen.add(state, 'chunkY', -20, 20, 1).name('Secteur Macro Y').listen().onChange(regenerate)
};
fGen.add(state, 'randomSeed').name('🎲 Nouvelle Graine');
fGen.add(state, 'nextChunkEast').name('➡️ Carte Suivante (Est)');
fGen.add(state, 'prevChunkWest').name('⬅️ Carte Précédente (Ouest)');

// Dossier 2 : Biomes & Climat
const fBio = gui.addFolder('2. Biomes & Climat');
fBio.add(state, 'biomePreset', {
  'Tous les 4 Biomes': '4_BIOMES',
  '1 Biome : Plaines Zelda BotW': 'PLAINS_ONLY',
  '1 Biome : Forêt d\'Automne': 'FOREST_ONLY',
  '1 Biome : Hauts-Plateaux Warcraft': 'HIGHLANDS_ONLY',
  '1 Biome : Marais Mystique': 'SWAMP_ONLY',
  '2 Biomes : Plaines & Hauts-Plateaux': 'PLAINS_HIGHLANDS',
  '2 Biomes : Forêt & Marais': 'FOREST_SWAMP'
}).name('Sélection Biomes').onChange(regenerate);

// Dossier 3 : Érosion & Relief
const fPhys = gui.addFolder('3. Érosion & Relief');
fPhys.add(state, 'waterLevel', 0.12, 0.38, 0.01).name('Niveau de l\'eau').onChange(regenerate);
fPhys.add(state, 'thermalPasses', 0, 15, 1).name('Érosion Thermique').onChange(regenerate);
fPhys.add(state, 'hydraulicDrops', 0, 6000, 500).name('Pluie Hydraulique').onChange(regenerate);
fPhys.add(state, 'roughness', 0.5, 1.8, 0.1).name('Rugosité Relief').onChange(regenerate);
fPhys.add(state, 'treeDensity', 0.02, 0.25, 0.01).name('Densité Arbres').onChange(regenerate);

// Dossier 4 : Calques de Débogage & Rendu
const fView = gui.addFolder('4. Calques de Rendu');
fView.add(state, 'displayMode', {
  '🎨 3D Diorama Zelda BotW': 'BOTW_DIORAMA',
  '🗺️ Topologie Heightmap': 'HEIGHTMAP',
  '🌿 Découpage Biomes': 'BIOMES',
  '⛰️ Pentes & Falaises': 'SLOPES',
  '🚶 NavGrid Franchissable': 'WALKABLE',
  '🛡️ Clearance 2x2 Héros': 'CLEARANCE'
}).name('Mode de Vue').onChange(() => {
  dioramaScene.loadMap(currentMap, state.displayMode);
});
fView.add(state, 'resetCamera').name('🎥 Vue TV Plein Écran');

// Gestion du clic pour le test interactif de Pathfinding A* 2x2
canvas.addEventListener('pointerdown', (evt) => {
  if (evt.button !== 0 || isHeroMoving) return; // Seulement clic gauche

  const clickedCoord = dioramaScene.pickGridCoordinates(evt.clientX, evt.clientY);
  if (!clickedCoord) return;

  const targetX = clickedCoord.x;
  const targetY = clickedCoord.y;

  // Extraction des matrices pour le pathfinder
  const clearance = currentMap.tiles.map(row => row.map(t => t.clearance));
  const elevation = currentMap.tiles.map(row => row.map(t => t.elevation));
  const shallowWater = currentMap.tiles.map(row => row.map(t => t.isShallowWater));

  // Exécution du pathfinder A* pour Héros 2x2
  const pathResult = AStarPathfinder.findPath(
    heroPos.x,
    heroPos.y,
    targetX,
    targetY,
    clearance,
    elevation,
    shallowWater,
    2 // Empreinte 2x2 [SPEC-MAP-003]
  );

  const hudPath = document.getElementById('hud-path-time');
  if (hudPath) {
    if (pathResult.found) {
      hudPath.innerText = `${pathResult.durationMs.toFixed(2)} ms (${pathResult.path.length} pas)`;
      hudPath.style.color = '#7ee787';
    } else {
      hudPath.innerText = 'Bloqué (Aucun chemin 2x2)';
      hudPath.style.color = '#f85149';
    }
  }

  if (pathResult.found && pathResult.path.length > 1) {
    // Tracé du ruban 3D lumineux
    dioramaScene.getPropsRenderer().renderPathRibbon(pathResult.path, currentMap);

    // Déplacement animé du pion 2x2 pas à pas
    isHeroMoving = true;
    let stepIndex = 1;

    const interval = setInterval(() => {
      if (stepIndex >= pathResult.path.length) {
        clearInterval(interval);
        isHeroMoving = false;
        heroPos = pathResult.path[pathResult.path.length - 1];
        return;
      }

      const nextPos = pathResult.path[stepIndex];
      heroPos = nextPos;
      dioramaScene.getPropsRenderer().renderHeroPawn(nextPos.x, nextPos.y, currentMap);
      stepIndex++;
    }, 110);
  }
});

// Première génération au chargement
regenerate();
