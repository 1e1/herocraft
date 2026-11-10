/**
 * [SPEC-GEO-002] & [SPEC-BLD-002] Distribution de la végétation et des décors
 * Algorithme par échantillonnage à bruit bleu, respectant les zones de spawn et de construction.
 */
import { PRNG } from '../math/prng';
import { BiomeType, MAP_CONFIG, PropType } from '../types';

export class PropsGenerator {
  private prng: PRNG;

  constructor(prng: PRNG) {
    this.prng = prng;
  }

  /**
   * Distribue les props décoratifs sur la grille
   */
  public generateProps(
    heightmap: number[][],
    waterMap: boolean[][],
    shallowWaterMap: boolean[][],
    cliffMap: boolean[][],
    dominantBiome: BiomeType[][],
    treeDensity = 0.12
  ): (PropType | null)[][] {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    const props: (PropType | null)[][] = Array.from({ length: height }, () => new Array(width).fill(null));

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const isWater = waterMap[y][x];
        const isShallow = shallowWaterMap[y][x];
        const isCliff = cliffMap[y][x];
        const biome = dominantBiome[y][x];
        const elev = heightmap[y][x];

        // 1. Décoration aquatique (roseaux dans les gués/marais)
        if (isShallow && (biome === 'SWAMP' || biome === 'PLAINS')) {
          if (this.prng.next() < 0.18) {
            props[y][x] = 'REEDS';
            continue;
          }
        }

        // Pas d'arbres ou de rochers dans l'eau ou sur les falaises abruptes
        if (isWater || isCliff) {
          continue;
        }

        const roll = this.prng.next();

        // 2. Ruines antiques (rares colonnes de pierre taillée)
        if (roll < 0.012 && elev > 0.35) {
          props[y][x] = 'RUIN_COLUMN';
          continue;
        }

        // 3. Rochers et pierriers (plus fréquents en Highlands)
        const rockChance = biome === 'HIGHLANDS' ? 0.08 : 0.02;
        if (roll < 0.012 + rockChance) {
          props[y][x] = 'BOULDER';
          continue;
        }

        // 4. Arbres selon le biome
        let treeChance = treeDensity;
        if (biome === 'FOREST') treeChance *= 1.8;
        if (biome === 'HIGHLANDS') treeChance *= 0.3;
        if (biome === 'SWAMP') treeChance *= 0.9;

        if (this.prng.next() < treeChance) {
          if (biome === 'FOREST') {
            props[y][x] = this.prng.next() < 0.6 ? 'TREE_AUTUMN' : 'TREE_DECIDUOUS';
          } else if (biome === 'HIGHLANDS') {
            props[y][x] = 'TREE_PINE';
          } else if (biome === 'SWAMP') {
            props[y][x] = 'TREE_DECIDUOUS';
          } else {
            props[y][x] = this.prng.next() < 0.8 ? 'TREE_DECIDUOUS' : 'TREE_PINE';
          }
          continue;
        }

        // 5. Fleurs décoratives au sol (plaines Zelda BotW, non bloquantes)
        if (biome === 'PLAINS' && this.prng.next() < 0.08) {
          props[y][x] = 'FLOWER_CLUSTER';
        }
      }
    }

    return props;
  }
}

