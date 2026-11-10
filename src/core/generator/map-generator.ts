/**
 * [SPEC-GEO-002] & [SPEC-BLD-001] Générateur Principal de Carte Déterministe
 * Assemble le pipeline géologique, l'érosion, les biomes, le pathfinding et les objectifs.
 */
import { PRNG } from '../math/prng';
import { SimplexNoise } from '../math/noise';
import { GeologyGenerator } from './geology';
import { ErosionSimulator } from './erosion';
import { HydrologyGenerator } from './water';
import { BiomeGenerator } from './biomes';
import { PropsGenerator } from './props';
import { NavigationAnalyzer } from '../navigation/clearance';
import { AStarPathfinder } from '../navigation/pathfinding';
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

    // 1. Géologie de base
    const geology = new GeologyGenerator(prng, noise);
    let elevation = geology.generateBaseElevation(chunkX, chunkY, options.roughness ?? 1.0);

    // 2. Érosion thermique
    const erosion = new ErosionSimulator(prng);
    if (thermalPasses > 0) {
      elevation = erosion.simulateThermalErosion(elevation, thermalPasses, MAP_CONFIG.CLIFF_THRESHOLD);
    }

    // 3. Érosion hydraulique
    if (hydraulicDrops > 0) {
      const erosionResult = erosion.simulateHydraulicErosion(elevation, hydraulicDrops);
      elevation = erosionResult.heightmap;
    }

    // 4. Hydrologie & masses d'eau
    const hydrology = new HydrologyGenerator(prng);
    const { waterMap, shallowWaterMap, riverMap } = hydrology.generateHydrology(elevation, waterLevel);

    // 5. Biomes & Climat (1 à 4 biomes)
    const biomes = new BiomeGenerator(noise);
    const { dominantBiome, weights, temperatureMap, moistureMap } = biomes.generateBiomes(
      elevation,
      waterMap,
      activeBiomes,
      chunkX,
      chunkY
    );

    // 6. Analyse des pentes & falaises
    const { slopeMap, cliffMap } = NavigationAnalyzer.computeSlopesAndCliffs(elevation, MAP_CONFIG.CLIFF_THRESHOLD);

    // 7. Végétation & Décors
    const propsGen = new PropsGenerator(prng);
    const props = propsGen.generateProps(
      elevation,
      waterMap,
      shallowWaterMap,
      cliffMap,
      dominantBiome,
      treeDensity
    );

    // 8. Franchissabilité & Clearance
    let walkable = NavigationAnalyzer.computeWalkability(waterMap, shallowWaterMap, cliffMap, props);
    let clearance = NavigationAnalyzer.computeClearanceField(walkable);

    // 9. Recherche d'une zone de Spawn pour le héros 2x2
    // Idéalement sur le bord Ouest ou Sud-Ouest, sur une zone avec clearance >= 2
    let heroSpawn = { x: 4, y: Math.floor(height / 2) };
    let foundSpawn = false;

    for (let x = 3; x < 14; x++) {
      for (let y = 3; y < height - 4; y++) {
        if (clearance[y][x] >= 2 && !waterMap[y][x]) {
          heroSpawn = { x, y };
          foundSpawn = true;
          break;
        }
      }
      if (foundSpawn) break;
    }

    // Si aucun spawn naturel parfait, on dégage 2x2 cases
    if (!foundSpawn) {
      heroSpawn = { x: 4, y: 14 };
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          props[heroSpawn.y + dy][heroSpawn.x + dx] = null;
          waterMap[heroSpawn.y + dy][heroSpawn.x + dx] = false;
        }
      }
      walkable = NavigationAnalyzer.computeWalkability(waterMap, shallowWaterMap, cliffMap, props);
      clearance = NavigationAnalyzer.computeClearanceField(walkable);
    }

    // 10. Sélection de l'objectif de carte [SPEC-BLD-001]
    // Selon le relief dominant : si proche de l'eau -> PIROGUE, si haut plateau -> AIRSHIP, sinon CAMP
    let objectiveType: ObjectiveType = 'CAMP';
    let objectiveSize = { w: 3, h: 3 };
    let bestObjectivePos = { x: width - 10, y: Math.floor(height / 2) };

    // Recherche d'un emplacement constructible [SPEC-BLD-002] à l'Est/Nord-Est
    let maxClearanceFound = 0;
    for (let x = width - 18; x < width - 4; x++) {
      for (let y = 4; y < height - 6; y++) {
        if (clearance[y][x] >= 3 && !waterMap[y][x]) {
          const elev = elevation[y][x];
          // Vérifier si un chemin existe depuis le spawn
          const testPath = AStarPathfinder.findPath(
            heroSpawn.x, heroSpawn.y,
            x, y,
            clearance, elevation, shallowWaterMap, 2
          );

          if (testPath.found) {
            bestObjectivePos = { x, y };
            if (elev > 0.6) {
              objectiveType = 'AIRSHIP';
            } else if (elev < 0.35) {
              objectiveType = 'PIROGUE';
            } else {
              objectiveType = 'CAMP';
            }
            maxClearanceFound = clearance[y][x];
            break;
          }
        }
      }
      if (maxClearanceFound >= 3) break;
    }

    const objective: MapObjective = {
      type: objectiveType,
      x: bestObjectivePos.x,
      y: bestObjectivePos.y,
      width: objectiveSize.w,
      height: objectiveSize.h,
      label: objectiveType === 'PIROGUE' 
        ? 'Construction Pirogue côtière' 
        : objectiveType === 'AIRSHIP' 
        ? 'Assemblage Aéronef d\'évasion' 
        : 'Établissement du Campement Fortifié'
    };

    // Marquer l'emplacement du camp dans les props pour l'identifier visuellement
    props[objective.y + 1][objective.x + 1] = 'CAMP_FIRE_SITE';

    // 11. Détection des sorties praticables sur les 4 bordures
    const exits: MapExit[] = [];
    // Bordure Est (x = width - 2)
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
    // Bordure Ouest (x = 1)
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

    // 12. Assemblage du tableau 2D de TileData
    const tiles: TileData[][] = [];
    for (let y = 0; y < height; y++) {
      const row: TileData[] = [];
      for (let x = 0; x < width; x++) {
        const elev = elevation[y][x];
        const step = Math.min(7, Math.floor(elev * 8));

        // Détection de zone constructible [SPEC-BLD-002]
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
      generationDurationMs: durationMs
    };
  }
}
