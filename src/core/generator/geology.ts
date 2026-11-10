/**
 * [SPEC-GEO-002], [SPEC-GEO-005], [SPEC-GEO-006] Simulation géologique avancée
 * Intègre la lithologie, les failles tectoniques, la topologie HeroQuest et les cataclysmes.
 */
import { PRNG } from '../math/prng';
import { SimplexNoise } from '../math/noise';
import { CataclysmFeature, CataclysmType, LithologyType, MAP_CONFIG } from '../types';
import { TopologyLayout } from './functional-topology';

export interface GeologyResult {
  elevation: number[][];
  lithology: LithologyType[][];
  cataclysm: CataclysmFeature;
}

export class GeologyGenerator {
  private prng: PRNG;
  private noise: SimplexNoise;

  constructor(prng: PRNG, noise: SimplexNoise) {
    this.prng = prng;
    this.noise = noise;
  }

  /**
   * Génère le cataclysme géologique remarquable
   */
  public selectCataclysm(requested?: CataclysmType): CataclysmFeature {
    let type: CataclysmType = requested ?? 'NONE';

    if (!requested) {
      const roll = this.prng.next();
      if (roll < 0.35) {
        type = 'CRATER';
      } else if (roll < 0.65) {
        type = 'VOLCANO';
      } else if (roll < 0.90) {
        type = 'RIFT';
      } else {
        type = 'NONE';
      }
    }

    const cx = this.prng.rangeInt(Math.floor(MAP_CONFIG.WIDTH * 0.35), Math.floor(MAP_CONFIG.WIDTH * 0.65));
    const cy = this.prng.rangeInt(Math.floor(MAP_CONFIG.HEIGHT * 0.3), Math.floor(MAP_CONFIG.HEIGHT * 0.7));
    const radius = type === 'RIFT' ? 14 : this.prng.rangeFloat(6.5, 9.5);
    const intensity = this.prng.rangeFloat(0.75, 1.0);

    return { type, centerX: cx, centerY: cy, radius, intensity };
  }

  /**
   * Synthèse géologique complète combinant :
   * 1. Topologie des salles & couloirs (HeroQuest)
   * 2. Lithologie (dureté des roches)
   * 3. Cataclysme rare (Cratère / Volcan / Faille)
   * 4. Relief tectonique et failles
   */
  public generateGeology(
    topology: TopologyLayout,
    chunkX = 0,
    chunkY = 0,
    requestedCataclysm?: CataclysmType,
    roughness = 1.0
  ): GeologyResult {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    const elevation: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));
    const lithology: LithologyType[][] = Array.from({ length: height }, () => new Array(width).fill('LITHO_SANDSTONE'));

    const cataclysm = this.selectCataclysm(requestedCataclysm);
    const worldOffsetX = chunkX * (width - 1);
    const worldOffsetY = chunkY * (height - 1);

    // 1. Définition des altitudes de base pour chaque salle HeroQuest
    const roomElevations = new Map<number, number>();
    for (const room of topology.rooms) {
      if (room.type === 'SPAWN') {
        roomElevations.set(room.id, 0.28); // Vallon d'entrée
      } else if (room.type === 'CAMP_SITE') {
        roomElevations.set(room.id, 0.52); // Plateau fortifiable
      } else if (room.type === 'SANCTUARY') {
        roomElevations.set(room.id, 0.65); // Éperon rocheux haut
      } else {
        roomElevations.set(room.id, this.prng.rangeFloat(0.30, 0.58));
      }
    }

    // 2. Calcul du relief cellule par cellule
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const wx = (x + worldOffsetX) * 0.045;
        const wy = (y + worldOffsetY) * 0.045;

        // Bruit fractal multi-octaves pour les micro-variations
        const microNoise = this.noise.fbm2D(wx * 2.0, wy * 2.0, 3, 0.5, 2.0) * 0.12 * roughness;
        const ridgeNoise = this.noise.ridged2D(wx * 1.4, wy * 1.4, 3, 2.0) * 0.25;

        const roomId = topology.roomMask[y][x];
        const isCorridor = topology.corridorMask[y][x];
        const isBarrier = topology.barrierMask[y][x];

        let baseH = 0.35;
        let litho: LithologyType = 'LITHO_SANDSTONE';

        if (roomId !== -1) {
          // Dans une salle : sol plan, alluvions ou grès meuble
          const targetRoomH = roomElevations.get(roomId) ?? 0.35;
          baseH = targetRoomH + microNoise * 0.4;
          litho = 'LITHO_ALLUVIUM';
        } else if (isCorridor) {
          // Dans un couloir : chemin dégagé reliant les salles
          baseH = 0.38 + microNoise * 0.5;
          litho = 'LITHO_SANDSTONE';
        } else if (isBarrier) {
          // Mur montagneux séparateur : granit dur, crêtes escarpées infranchissables
          baseH = 0.68 + ridgeNoise * 0.4 + microNoise;
          litho = 'LITHO_GRANITE';
        }

        // 3. Application du Cataclysme Géologique [SPEC-GEO-006]
        if (cataclysm.type !== 'NONE') {
          const dx = x - cataclysm.centerX;
          const dy = y - cataclysm.centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const R = cataclysm.radius;

          if (cataclysm.type === 'CRATER') {
            // Cratère d'impact météoritique
            if (dist < R * 1.4) {
              const normDist = dist / R;
              if (normDist < 0.75) {
                // Cuvette centrale creusée
                const excavation = (1.0 - Math.pow(normDist / 0.75, 2)) * 0.38 * cataclysm.intensity;
                baseH -= excavation;
                litho = 'LITHO_METEORIC';
              } else if (normDist <= 1.25) {
                // Bourrelet annulaire d'éjectas surélevé
                const rimFactor = Math.sin((normDist - 0.75) / 0.5 * Math.PI);
                baseH += rimFactor * 0.28 * cataclysm.intensity;
                litho = 'LITHO_GRANITE';
              }
            }
          } else if (cataclysm.type === 'VOLCANO') {
            // Cône volcanique et caldeira effondrée
            if (dist < R * 1.5) {
              const normDist = dist / (R * 1.5);
              if (normDist < 0.28) {
                // Caldeira centrale affaissée (cratère de lave)
                baseH = 0.50 - normDist * 0.2;
                litho = 'LITHO_VOLCANIC';
              } else {
                // Cône montagneux abrupt
                const coneFactor = Math.cos(normDist * (Math.PI * 0.5));
                baseH += coneFactor * 0.55 * cataclysm.intensity;
                litho = 'LITHO_VOLCANIC';
              }
            }
          } else if (cataclysm.type === 'RIFT') {
            // Faille de rift diagonale fendant la carte
            // Équation de droite de faille : dx + dy * 0.6 = 0
            const faultDist = Math.abs((x - cataclysm.centerX) + (y - cataclysm.centerY) * 0.75);
            // Pont naturel conservé à un endroit pour permettre le passage tactique
            const isBridge = Math.abs(y - cataclysm.centerY) < 2;

            if (faultDist < 3.5 && !isBridge) {
              // Gouffre profond
              baseH -= 0.32 * cataclysm.intensity;
              litho = 'LITHO_GRANITE';
            } else if (faultDist < 5.0 && !isBridge) {
              // Lèvre de faille surélevée
              baseH += 0.15;
            }
          }
        }

        // Bords de carte légèrement sécurisés pour le cadrage du diorama
        const edgeDistX = Math.min(x, width - 1 - x);
        const edgeDistY = Math.min(y, height - 1 - y);
        const edgeFactor = Math.min(edgeDistX, edgeDistY) / 3.0;
        if (edgeFactor < 1.0) {
          baseH *= (0.75 + 0.25 * edgeFactor);
        }

        elevation[y][x] = Math.max(0.04, Math.min(0.96, baseH));
        lithology[y][x] = litho;
      }
    }

    return {
      elevation,
      lithology,
      cataclysm
    };
  }
}
