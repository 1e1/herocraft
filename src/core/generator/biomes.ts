/**
 * [SPEC-BIO-001] & [SPEC-BIO-002] Système de biomes & transitions frontalières naturelles
 * Supporte de 1 à 4 biomes avec blending pondéré (Zelda BotW / Warcraft III palette).
 */
import { SimplexNoise } from '../math/noise';
import { BiomeType, MAP_CONFIG } from '../types';

export interface BiomeResult {
  dominantBiome: BiomeType[][];
  weights: Record<BiomeType, number>[][];
  temperatureMap: number[][];
  moistureMap: number[][];
}

export class BiomeGenerator {
  private noise: SimplexNoise;

  constructor(noise: SimplexNoise) {
    this.noise = noise;
  }

  /**
   * Calcule les cartes de température et d'humidité
   */
  public generateBiomes(
    heightmap: number[][],
    waterMap: boolean[][],
    activeBiomes: BiomeType[] = ['PLAINS', 'FOREST', 'HIGHLANDS', 'SWAMP'],
    chunkX = 0,
    chunkY = 0
  ): BiomeResult {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    const dominantBiome: BiomeType[][] = Array.from({ length: height }, () => new Array(width));
    const weights: Record<BiomeType, number>[][] = Array.from({ length: height }, () => new Array(width));
    const temperatureMap: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));
    const moistureMap: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));

    const worldOffsetX = chunkX * width;
    const worldOffsetY = chunkY * height;

    // Prise en compte de 1 seul biome actif
    if (activeBiomes.length === 1) {
      const soleBiome = activeBiomes[0];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          dominantBiome[y][x] = soleBiome;
          weights[y][x] = {
            PLAINS: soleBiome === 'PLAINS' ? 1.0 : 0,
            FOREST: soleBiome === 'FOREST' ? 1.0 : 0,
            HIGHLANDS: soleBiome === 'HIGHLANDS' ? 1.0 : 0,
            SWAMP: soleBiome === 'SWAMP' ? 1.0 : 0
          };
          temperatureMap[y][x] = 0.5;
          moistureMap[y][x] = 0.5;
        }
      }
      return { dominantBiome, weights, temperatureMap, moistureMap };
    }

    // Calcul de la distance d'humidité à l'eau
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const wx = (x + worldOffsetX) * 0.05;
        const wy = (y + worldOffsetY) * 0.05;
        const elev = heightmap[y][x];

        // Température : diminue avec l'altitude + variation de bruit
        const tempNoise = this.noise.noise2D(wx * 0.8, wy * 0.8) * 0.25;
        const temp = Math.max(0, Math.min(1, 0.65 - elev * 0.45 + tempNoise));
        temperatureMap[y][x] = temp;

        // Humidité : élevée près de l'eau et dans les dépressions + bruit
        const moistNoise = this.noise.noise2D(wx * 0.7 + 10, wy * 0.7 + 10) * 0.25;
        let moist = 0.45 + moistNoise;
        if (waterMap[y][x]) {
          moist += 0.35;
        } else if (elev < 0.35) {
          moist += 0.15;
        }
        moist = Math.max(0, Math.min(1, moist));
        moistureMap[y][x] = moist;

        // Classification idéale des biomes selon Whittaker simplifié
        // Plains: Temp modérée, Humidité modérée
        // Forest: Temp fraîche/modérée, Humidité forte
        // Highlands: Temp fraîche, Haute altitude (elev > 0.55)
        // Swamp: Temp chaude/modérée, Eau / Humidité très forte, basse altitude

        const rawScores: Record<BiomeType, number> = {
          PLAINS: 0,
          FOREST: 0,
          HIGHLANDS: 0,
          SWAMP: 0
        };

        // Score Plains
        rawScores.PLAINS = Math.max(0, 1.0 - Math.hypot(temp - 0.55, moist - 0.45, elev - 0.35));

        // Score Forest
        rawScores.FOREST = Math.max(0, 1.0 - Math.hypot(temp - 0.45, moist - 0.75, elev - 0.40));

        // Score Highlands
        rawScores.HIGHLANDS = Math.max(0, 1.0 - Math.hypot(temp - 0.30, moist - 0.25, elev - 0.75));

        // Score Swamp
        rawScores.SWAMP = Math.max(0, 1.0 - Math.hypot(temp - 0.60, moist - 0.85, elev - 0.20));

        // Filtrer par les biomes autorisés
        let totalScore = 0;
        const filteredScores: Record<BiomeType, number> = {
          PLAINS: 0,
          FOREST: 0,
          HIGHLANDS: 0,
          SWAMP: 0
        };

        for (const b of activeBiomes) {
          filteredScores[b] = Math.pow(Math.max(0.001, rawScores[b]), 2.2); // Accentue les transitions
          totalScore += filteredScores[b];
        }

        // Normalisation des poids pour le blending de shader
        let maxWeight = -1;
        let dominant: BiomeType = activeBiomes[0];
        const normalizedWeights: Record<BiomeType, number> = {
          PLAINS: 0,
          FOREST: 0,
          HIGHLANDS: 0,
          SWAMP: 0
        };

        for (const b of activeBiomes) {
          const w = filteredScores[b] / totalScore;
          normalizedWeights[b] = w;
          if (w > maxWeight) {
            maxWeight = w;
            dominant = b;
          }
        }

        dominantBiome[y][x] = dominant;
        weights[y][x] = normalizedWeights;
      }
    }

    return { dominantBiome, weights, temperatureMap, moistureMap };
  }
}
