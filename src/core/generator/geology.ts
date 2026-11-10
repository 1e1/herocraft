/**
 * [SPEC-GEO-002] & [SPEC-GEO-003] Simulation géologique & topologique de base
 * Découpage tectonique Voronoi + Bruit de crête Simplex + Failles géologiques.
 */
import { PRNG } from '../math/prng';
import { SimplexNoise } from '../math/noise';
import { MAP_CONFIG } from '../types';

export interface PlatePoint {
  x: number;
  y: number;
  baseElevation: number;
}

export class GeologyGenerator {
  private prng: PRNG;
  private noise: SimplexNoise;

  constructor(prng: PRNG, noise: SimplexNoise) {
    this.prng = prng;
    this.noise = noise;
  }

  /**
   * Génère les plaques tectoniques avec hauteurs et centres Voronoi
   */
  private generatePlates(count: number): PlatePoint[] {
    const plates: PlatePoint[] = [];

    for (let i = 0; i < count; i++) {
      // Jitter déterministe
      const x = this.prng.rangeFloat(2, MAP_CONFIG.WIDTH - 3);
      const y = this.prng.rangeFloat(2, MAP_CONFIG.HEIGHT - 3);
      // Hauteur de base de la plaque
      const baseElevation = this.prng.rangeFloat(0.15, 0.75);
      plates.push({ x, y, baseElevation });
    }
    return plates;
  }

  /**
   * Génère la carte d'élévation brute avant érosion
   */
  public generateBaseElevation(
    chunkX: number, 
    chunkY: number, 
    roughness = 1.0
  ): number[][] {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    const elevation: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));

    // [SPEC-GEO-003] 5 à 7 plaques tectoniques
    const plateCount = this.prng.rangeInt(5, 7);
    const plates = this.generatePlates(plateCount);

    // Décalage pour macro-continuité spatiale
    const worldOffsetX = chunkX * (width - 1);
    const worldOffsetY = chunkY * (height - 1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const wx = (x + worldOffsetX) * 0.045;
        const wy = (y + worldOffsetY) * 0.045;

        // 1. Calcul de la distance aux plaques tectoniques les plus proches (Voronoi F1 & F2)
        let d1 = Infinity;
        let d2 = Infinity;
        let p1: PlatePoint = plates[0];

        for (const p of plates) {
          const dx = x - p.x;
          const dy = y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < d1) {
            d2 = d1;
            d1 = distSq;
            p1 = p;
          } else if (distSq < d2) {
            d2 = distSq;
          }
        }

        const dist1 = Math.sqrt(d1);
        const dist2 = Math.sqrt(d2);
        // Ligne de faille : quand dist2 - dist1 est très proche de 0
        const faultFactor = Math.exp(-Math.pow((dist2 - dist1) * 0.5, 2));

        // 2. Bruit multi-octaves (macro relief)
        const macroNoise = this.noise.fbm2D(wx, wy, 4, 0.52, 2.0);

        // 3. Crêtes de montagnes (Ridged noise)
        const ridgeNoise = this.noise.ridged2D(wx * 1.5, wy * 1.5, 3, 2.0);

        // 4. Synthèse géologique : plaque + relief fractal + surrection sur failles tectoniques
        let h = p1.baseElevation * 0.4 + macroNoise * 0.45 * roughness + ridgeNoise * 0.25 * faultFactor;

        // Bords de carte légèrement abaissés pour créer un effet de bordure naturelle
        // tout en préservant le centre
        const edgeDistX = Math.min(x, width - 1 - x);
        const edgeDistY = Math.min(y, height - 1 - y);
        const edgeFactor = Math.min(edgeDistX, edgeDistY) / 4.0;
        if (edgeFactor < 1.0) {
          // Atténuation douce sur les 3 premières bordures pour cadrer le diorama
          h *= (0.7 + 0.3 * edgeFactor);
        }

        elevation[y][x] = Math.max(0.02, Math.min(0.98, h));
      }
    }

    return elevation;
  }
}
