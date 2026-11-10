/**
 * [SPEC-WAT-001] & [SPEC-WAT-002] Système hydrographique : lacs, dépressions et cours d'eau
 */
import { PRNG } from '../math/prng';
import { MAP_CONFIG } from '../types';

export interface HydrologyResult {
  waterMap: boolean[][];
  shallowWaterMap: boolean[][];
  riverMap: boolean[][];
  waterDepth: number[][];
}

export class HydrologyGenerator {
  private prng: PRNG;

  constructor(prng: PRNG) {
    this.prng = prng;
  }

  /**
   * Identifie les masses d'eau et trace 1 ou 2 rivières naturelles
   */
  public generateHydrology(
    heightmap: number[][],
    waterLevel: number = MAP_CONFIG.WATER_LEVEL
  ): HydrologyResult {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    const waterMap: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
    const shallowWaterMap: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
    const riverMap: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
    const waterDepth: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));

    // 1. Détection des nappes d'eau
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const h = heightmap[y][x];
        if (h <= waterLevel) {
          waterMap[y][x] = true;
          const depth = waterLevel - h;
          waterDepth[y][x] = depth;
          // [SPEC-WAT-001] Eau peu profonde (gué praticable) si profondeur faible
          if (depth <= 0.05) {
            shallowWaterMap[y][x] = true;
          }
        }
      }
    }

    // 2. Traçage d'une rivière (des crêtes vers le niveau d'eau le plus bas)
    // On cherche une source en altitude (h > 0.55)
    let sourceCandidates: { x: number; y: number; h: number }[] = [];
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        if (heightmap[y][x] > 0.55 && !waterMap[y][x]) {
          sourceCandidates.push({ x, y, h: heightmap[y][x] });
        }
      }
    }

    if (sourceCandidates.length > 0) {
      sourceCandidates.sort((a, b) => b.h - a.h);
      const source = this.prng.pick(sourceCandidates.slice(0, 5));

      let cx = source.x;
      let cy = source.y;
      const visited = new Set<string>();

      for (let step = 0; step < 70; step++) {
        riverMap[cy][cx] = true;
        visited.add(`${cx},${cy}`);

        // Si on a atteint une étendue d'eau existante ou le bord de la carte
        if (waterMap[cy][cx] || cx <= 0 || cx >= width - 1 || cy <= 0 || cy >= height - 1) {
          break;
        }

        // Trouver le voisin de plus basse altitude
        let lowestNeighbor: { x: number; y: number; h: number } | null = null;
        const neighbors = [
          [1, 0], [-1, 0], [0, 1], [0, -1]
        ];

        for (const [dx, dy] of neighbors) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const key = `${nx},${ny}`;
            if (!visited.has(key)) {
              const nh = heightmap[ny][nx];
              if (!lowestNeighbor || nh < lowestNeighbor.h) {
                lowestNeighbor = { x: nx, y: ny, h: nh };
              }
            }
          }
        }

        if (lowestNeighbor) {
          cx = lowestNeighbor.x;
          cy = lowestNeighbor.y;
        } else {
          break;
        }
      }
    }

    // Synchronisation de la carte d'eau avec la rivière
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (riverMap[y][x]) {
          waterMap[y][x] = true;
          // Les rivières étroites sont considérées comme gués peu profonds par défaut
          shallowWaterMap[y][x] = true;
          waterDepth[y][x] = Math.max(waterDepth[y][x], 0.04);
        }
      }
    }

    return { waterMap, shallowWaterMap, riverMap, waterDepth };
  }
}
