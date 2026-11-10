/**
 * [SPEC-GEO-002] & [SPEC-BLD-001] Générateur Principal de Carte Déterministe
 * Assemble le pipeline géologique, l'érosion, les biomes, le pathfinding et les objectifs.
 */
import { PRNG } from '../math/prng';
import { SimplexNoise } from '../math/noise';
import { FunctionalTopologyGenerator } from './functional-topology';
import { GeologyGenerator } from './geology';
import { ErosionSimulator } from './erosion';
import { HydrologyGenerator } from './water';
import { BiomeGenerator } from './biomes';
import { PropsGenerator } from './props';
import { NavigationAnalyzer } from '../navigation/clearance';
import { 
  GeneratedMap, 
  MapGenOptions, 
  MapObjective, 
  MapExit, 
  TileData, 
  MAP_CONFIG, 
  ObjectiveType 
} from '../types';

export class MapGenerator {
  /**
   * Génère une carte complète de façon 100% déterministe
   */
  public static generate(options: MapGenOptions = {}): GeneratedMap {
    const tStart = performance.now();
    const seed = options.seed !== undefined ? String(options.seed) : 'herocraft-seed-42';
    const chunkX = options.chunkX ?? 0;
    const chunkY = options.chunkY ?? 0;

    const prng = new PRNG(`${seed}:${chunkX},${chunkY}`);
    const noise = new SimplexNoise(prng);

    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    const waterLevel = options.waterLevel ?? MAP_CONFIG.WATER_LEVEL;
    const activeBiomes = options.activeBiomes ?? ['PLAINS', 'FOREST', 'HIGHLANDS', 'SWAMP'];
    const thermalPasses = options.thermalErosionPasses ?? 8;
    const hydraulicDrops = options.hydraulicDroplets ?? 3000;
    const treeDensity = options.treeDensity ?? 0.12;

    // 1. [SPEC-TOP-001] Topologie fonctionnelle HeroQuest (Salles & Couloirs)
    const topoGen = new FunctionalTopologyGenerator(prng);
    const topology = topoGen.generateLayout();

    // 2. [SPEC-GEO-002] & [SPEC-GEO-006] Géologie, Lithologie et Cataclysme remarquable
    const geology = new GeologyGenerator(prng, noise);
    const geoResult = geology.generateGeology(
      topology,
      chunkX,
      chunkY,
      options.cataclysm,
      options.roughness ?? 1.0
    );
    let elevation = geoResult.elevation;
    const lithology = geoResult.lithology;
    const cataclysm = geoResult.cataclysm;

    // 3. Érosion thermique
    const erosion = new ErosionSimulator(prng);
    if (thermalPasses > 0) {
      elevation = erosion.simulateThermalErosion(elevation, thermalPasses, MAP_CONFIG.CLIFF_THRESHOLD);
    }

    // 4. Érosion hydraulique
    if (hydraulicDrops > 0) {
      const erosionResult = erosion.simulateHydraulicErosion(elevation, hydraulicDrops);
      elevation = erosionResult.heightmap;
    }

    // 5. Hydrologie & masses d'eau
    const hydrology = new HydrologyGenerator(prng);
    const { waterMap, shallowWaterMap, riverMap } = hydrology.generateHydrology(elevation, waterLevel);

    // 6. Biomes & Climat (1 à 4 biomes)
    const biomes = new BiomeGenerator(noise);
    const { dominantBiome, weights, temperatureMap, moistureMap } = biomes.generateBiomes(
      elevation,
      waterMap,
      activeBiomes,
      chunkX,
      chunkY
    );

    // 7. Analyse des pentes & falaises
    const { slopeMap, cliffMap } = NavigationAnalyzer.computeSlopesAndCliffs(elevation, MAP_CONFIG.CLIFF_THRESHOLD);

    // 8. Végétation & Décors
    const propsGen = new PropsGenerator(prng);
    const props = propsGen.generateProps(
      elevation,
      waterMap,
      shallowWaterMap,
      cliffMap,
      dominantBiome,
      treeDensity
    );

    // 9. Franchissabilité & Clearance
    let walkable = NavigationAnalyzer.computeWalkability(waterMap, shallowWaterMap, cliffMap, props);
    let clearance = NavigationAnalyzer.computeClearanceField(walkable);

    // 10. Recherche d'une zone de Spawn pour le héros 2x2
    // On cible la salle identifiée 'SPAWN'
    const spawnRoom = topology.rooms.find(r => r.type === 'SPAWN') ?? topology.rooms[0];
    let heroSpawn = { x: spawnRoom.centerX, y: spawnRoom.centerY };
    let foundSpawn = false;

    // Recherche dans la zone de la salle de spawn
    for (let r = 0; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const sx = spawnRoom.centerX + dx;
          const sy = spawnRoom.centerY + dy;
          if (sx >= 1 && sx < width - 2 && sy >= 1 && sy < height - 2) {
            if (clearance[sy][sx] >= 2 && !waterMap[sy][sx]) {
              heroSpawn = { x: sx, y: sy };
              foundSpawn = true;
              break;
            }
          }
        }
        if (foundSpawn) break;
      }
      if (foundSpawn) break;
    }

    if (!foundSpawn) {
      // Dégagement forcé si nécessaire
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          props[heroSpawn.y + dy][heroSpawn.x + dx] = null;
          waterMap[heroSpawn.y + dy][heroSpawn.x + dx] = false;
        }
      }
      walkable = NavigationAnalyzer.computeWalkability(waterMap, shallowWaterMap, cliffMap, props);
      clearance = NavigationAnalyzer.computeClearanceField(walkable);
    }

    // 11. Emplacement de l'objectif de mission
    // Cible la salle 'CAMP_SITE'
    const campRoom = topology.rooms.find(r => r.type === 'CAMP_SITE') ?? topology.rooms[topology.rooms.length - 1];
    let objectiveType: ObjectiveType = 'CAMP';
    if (cataclysm.type === 'CRATER') {
      objectiveType = 'SHELTER';
    } else if (elevation[campRoom.centerY][campRoom.centerX] > 0.58) {
      objectiveType = 'AIRSHIP';
    } else if (elevation[campRoom.centerY][campRoom.centerX] < 0.35) {
      objectiveType = 'PIROGUE';
    }

    const objective: MapObjective = {
      type: objectiveType,
      x: campRoom.centerX - 1,
      y: campRoom.centerY - 1,
      width: 3,
      height: 3,
      label: objectiveType === 'PIROGUE' 
        ? 'Construction Pirogue côtière' 
        : objectiveType === 'AIRSHIP' 
        ? 'Assemblage Aéronef d\'évasion' 
        : 'Établissement du Campement Fortifié'
    };

    props[objective.y + 1][objective.x + 1] = 'CAMP_FIRE_SITE';

    // 12. Détection des sorties praticables
    const exits: MapExit[] = [];
    for (let y = 1; y < height - 2; y++) {
      if (clearance[y][width - 2] >= 2) {
        exits.push({
          direction: 'EAST',
          x: width - 1,
          y,
          elevation: elevation[y][width - 2],
          biome: dominantBiome[y][width - 2]
        });
        break;
      }
    }
    for (let y = 1; y < height - 2; y++) {
      if (clearance[y][1] >= 2) {
        exits.push({
          direction: 'WEST',
          x: 0,
          y,
          elevation: elevation[y][1],
          biome: dominantBiome[y][1]
        });
        break;
      }
    }

    // 13. Assemblage final
    const tiles: TileData[][] = [];
    const chokeSet = new Set(topology.chokePoints.map(p => `${p.x},${p.y}`));

    for (let y = 0; y < height; y++) {
      const row: TileData[] = [];
      for (let x = 0; x < width; x++) {
        const elev = elevation[y][x];
        const step = Math.min(7, Math.floor(elev * 8));

        const isBuildable = (
          walkable[y][x] && 
          !waterMap[y][x] && 
          slopeMap[y][x] <= 0.06 && 
          !NavigationAnalyzer.isSolidObstacle(props[y][x])
        );

        row.push({
          x,
          y,
          elevation: elev,
          stepLevel: step,
          temperature: temperatureMap[y][x],
          moisture: moistureMap[y][x],
          biome: dominantBiome[y][x],
          biomeWeights: weights[y][x],
          lithology: lithology[y][x],
          roomId: topology.roomMask[y][x] !== -1 ? topology.roomMask[y][x] : undefined,
          isChokePoint: chokeSet.has(`${x},${y}`),
          isWater: waterMap[y][x],
          isShallowWater: shallowWaterMap[y][x],
          isRiver: riverMap[y][x],
          slope: slopeMap[y][x],
          isCliff: cliffMap[y][x],
          prop: props[y][x],
          walkable: walkable[y][x],
          clearance: clearance[y][x],
          buildable: isBuildable
        });
      }
      tiles.push(row);
    }

    const durationMs = performance.now() - tStart;

    return {
      seed,
      chunkX,
      chunkY,
      width,
      height,
      tiles,
      exits,
      heroSpawn,
      objective,
      cataclysm,
      rooms: topology.rooms,
      generationDurationMs: durationMs
    };
  }
}
