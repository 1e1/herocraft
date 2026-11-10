/**
 * [SPEC-TRN-001] & [SPEC-TRN-002] Continuité & Graphe Macro du Monde
 * Assure le raccordement physique des bordures lors du passage d'une carte à l'autre.
 */
import { PRNG } from '../math/prng';
import { BiomeType, MAP_CONFIG } from '../types';

export interface BorderSeamData {
  elevations: number[];       // Hauteurs sur le bord (longueur 30 pour N/S ou 54 pour E/W)
  riverIndex?: number;        // Indice de passage de la rivière
  dominantBiome: BiomeType;
}

export class WorldGraph {
  public static deriveChunkSeed(globalSeed: string | number, chunkX: number, chunkY: number): number {
    const baseHash = typeof globalSeed === 'number' ? globalSeed >>> 0 : PRNG.hashString(globalSeed);
    // Combinaison non linéaire de coordonnées
    const xPart = Math.imul(chunkX, 73856093) >>> 0;
    const yPart = Math.imul(chunkY, 19349663) >>> 0;
    return (baseHash ^ xPart ^ yPart) >>> 0;
  }

  /**
   * [SPEC-TRN-002] Raccordement hermitien des bordures avec la carte voisine
   */
  public static stitchBorder(
    heightmap: number[][],
    border: 'WEST' | 'EAST' | 'NORTH' | 'SOUTH',
    seam: BorderSeamData,
    blendMargin = 5
  ): void {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    if (border === 'WEST') {
      // La bordure x = 0 doit correspondre à seam.elevations[y]
      for (let y = 0; y < height; y++) {
        const targetH = seam.elevations[y] ?? heightmap[y][0];
        for (let x = 0; x < blendMargin; x++) {
          const t = x / blendMargin;
          // Spline cubique Hermite : S(t) = 3t^2 - 2t^3
          const blend = 3 * t * t - 2 * t * t * t;
          heightmap[y][x] = targetH * (1 - blend) + heightmap[y][x] * blend;
        }
      }
    } else if (border === 'EAST') {
      for (let y = 0; y < height; y++) {
        const targetH = seam.elevations[y] ?? heightmap[y][width - 1];
        for (let i = 0; i < blendMargin; i++) {
          const x = width - 1 - i;
          const t = i / blendMargin;
          const blend = 3 * t * t - 2 * t * t * t;
          heightmap[y][x] = targetH * (1 - blend) + heightmap[y][x] * blend;
        }
      }
    } else if (border === 'NORTH') {
      for (let x = 0; x < width; x++) {
        const targetH = seam.elevations[x] ?? heightmap[0][x];
        for (let y = 0; y < blendMargin; y++) {
          const t = y / blendMargin;
          const blend = 3 * t * t - 2 * t * t * t;
          heightmap[y][x] = targetH * (1 - blend) + heightmap[y][x] * blend;
        }
      }
    } else if (border === 'SOUTH') {
      for (let x = 0; x < width; x++) {
        const targetH = seam.elevations[x] ?? heightmap[height - 1][x];
        for (let i = 0; i < blendMargin; i++) {
          const y = height - 1 - i;
          const t = i / blendMargin;
          const blend = 3 * t * t - 2 * t * t * t;
          heightmap[y][x] = targetH * (1 - blend) + heightmap[y][x] * blend;
        }
      }
    }
  }
}
