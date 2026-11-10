/**
 * [SPEC-NAV-001] & [SPEC-NAV-002] Calcul de franchissabilité et Matrice de Dégagement (Clearance Field)
 * Permet au pathfinding A* d'une entité 2x2 (héros) ou 3x3 (bâtiment) de s'exécuter en O(1) par tuile.
 */
import { MAP_CONFIG, PropType } from '../types';

export class NavigationAnalyzer {
  /**
   * Vérifie si un prop bloque physiquement le passage
   */
  public static isSolidObstacle(prop: PropType | null): boolean {
    if (!prop) return false;
    return (
      prop === 'TREE_DECIDUOUS' ||
      prop === 'TREE_PINE' ||
      prop === 'TREE_AUTUMN' ||
      prop === 'BOULDER' ||
      prop === 'RUIN_COLUMN'
    );
  }

  /**
   * Analyse les pentes et identifie les falaises infranchissables
   */
  public static computeSlopesAndCliffs(
    heightmap: number[][],
    cliffThreshold = MAP_CONFIG.CLIFF_THRESHOLD
  ): { slopeMap: number[][]; cliffMap: boolean[][] } {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    const slopeMap: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));
    const cliffMap: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));

    const neighbors = [
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const h = heightmap[y][x];
        let maxGrad = 0;

        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const diff = Math.abs(h - heightmap[ny][nx]);
            if (diff > maxGrad) {
              maxGrad = diff;
            }
          }
        }

        slopeMap[y][x] = maxGrad;
        if (maxGrad >= cliffThreshold) {
          cliffMap[y][x] = true;
        }
      }
    }

    return { slopeMap, cliffMap };
  }

  /**
   * [SPEC-NAV-001] Évalue la franchissabilité individuelle de chaque case 1x1
   */
  public static computeWalkability(
    waterMap: boolean[][],
    shallowWaterMap: boolean[][],
    cliffMap: boolean[][],
    props: (PropType | null)[][]
  ): boolean[][] {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    const walkable: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // [SPEC-NAV-001] Infranchissable si falaise
        if (cliffMap[y][x]) continue;

        // Infranchissable si eau profonde (sauf si gué peu profond)
        if (waterMap[y][x] && !shallowWaterMap[y][x]) continue;

        // Infranchissable si arbre ou rocher massif
        if (this.isSolidObstacle(props[y][x])) continue;

        walkable[y][x] = true;
      }
    }

    return walkable;
  }

  /**
   * [SPEC-NAV-002] Calcul Bottom-Up par programmation dynamique du champ de Clearance
   * Clearance C(x,y) = plus grand carré libre de coin supérieur gauche (x, y)
   */
  public static computeClearanceField(walkable: boolean[][]): number[][] {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    const clearance: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));

    // Parcours de bas en haut et de droite à gauche
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        if (!walkable[y][x]) {
          clearance[y][x] = 0;
          continue;
        }

        // Bords de la grille
        if (x === width - 1 || y === height - 1) {
          clearance[y][x] = 1;
        } else {
          const right = clearance[y][x + 1];
          const bottom = clearance[y + 1][x];
          const diag = clearance[y + 1][x + 1];
          clearance[y][x] = 1 + Math.min(right, bottom, diag);
        }
      }
    }

    return clearance;
  }
}

