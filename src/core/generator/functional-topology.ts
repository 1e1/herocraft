/**
 * [SPEC-TOP-001] Topologie Fonctionnelle HeroQuest (Salles, Couloirs & Goulots)
 * Structure le plateau en zones tactiques interconnectées pour éliminer la monotonie.
 */
import { PRNG } from '../math/prng';
import { FunctionalRoom, MAP_CONFIG } from '../types';

export interface TopologyLayout {
  rooms: FunctionalRoom[];
  roomMask: number[][];        // ID de salle (-1 si zone sauvage / mur)
  corridorMask: boolean[][];   // Passages praticables reliant les salles
  barrierMask: boolean[][];    // Murs de crêtes / falaises séparatrices
  chokePoints: { x: number; y: number }[];
}

export class FunctionalTopologyGenerator {
  private prng: PRNG;

  constructor(prng: PRNG) {
    this.prng = prng;
  }

  /**
   * Génère l'armature de salles et couloirs façon HeroQuest
   */
  public generateLayout(): TopologyLayout {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    const roomMask: number[][] = Array.from({ length: height }, () => new Array(width).fill(-1));
    const corridorMask: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
    const barrierMask: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
    const chokePoints: { x: number; y: number }[] = [];

    // Découpage en grille 3x2 ou 3x3 de quadrants pour répartir les 6 à 8 salles
    const cols = 3;
    const rows = 2;
    const cellW = (width - 4) / cols;
    const cellH = (height - 4) / rows;

    const rooms: FunctionalRoom[] = [];
    let roomId = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Jitter déterministe au sein du quadrant
        const minX = Math.floor(2 + c * cellW + 3);
        const maxX = Math.floor(2 + (c + 1) * cellW - 3);
        const minY = Math.floor(2 + r * cellH + 3);
        const maxY = Math.floor(2 + (r + 1) * cellH - 3);

        const cx = this.prng.rangeInt(minX, maxX);
        const cy = this.prng.rangeInt(minY, maxY);
        const rx = this.prng.rangeInt(3, 5);
        const ry = this.prng.rangeInt(3, 4);

        let type: FunctionalRoom['type'] = 'WILD_CLEARING';
        let name = `Clairière Sauvage #${roomId + 1}`;

        if (c === 0 && r === 1) {
          type = 'SPAWN';
          name = 'Point d\'Incursion (Départ)';
        } else if (c === 2 && r === 0) {
          type = 'CAMP_SITE';
          name = 'Plateau du Camp / Évacuation';
        } else if (c === 1 && r === 0) {
          type = 'SANCTUARY';
          name = 'Sanctuaire Antique';
        } else if (c === 1 && r === 1) {
          type = 'CATACLYSM_ZONE';
          name = 'Épicentre du Cataclysme';
        }

        const room: FunctionalRoom = {
          id: roomId,
          name,
          centerX: cx,
          centerY: cy,
          radiusX: rx,
          radiusY: ry,
          type
        };
        rooms.push(room);

        // Remplir le masque de salle (forme elliptique douce)
        for (let y = cy - ry; y <= cy + ry; y++) {
          for (let x = cx - rx; x <= cx + rx; x++) {
            if (x >= 1 && x < width - 1 && y >= 1 && y < height - 1) {
              const dx = (x - cx) / rx;
              const dy = (y - cy) / ry;
              if (dx * dx + dy * dy <= 1.0) {
                roomMask[y][x] = roomId;
              }
            }
          }
        }

        roomId++;
      }
    }

    // Connexion des salles voisines par des couloirs de 2-3 tuiles de large
    // Graphe de voisinage (grille 3x2)
    const connections: [number, number][] = [
      [0, 1], [1, 2],       // Ligne du haut
      [3, 4], [4, 5],       // Ligne du bas
      [0, 3], [1, 4], [2, 5], // Liaisons verticales
      [3, 1]                // Diagonale tactique
    ];

    for (const [idA, idB] of connections) {
      const roomA = rooms[idA];
      const roomB = rooms[idB];
      if (!roomA || !roomB) continue;

      // Tracer un couloir L-shaped ou direct avec point d'inflexion
      let x = roomA.centerX;
      let y = roomA.centerY;
      const targetX = roomB.centerX;
      const targetY = roomB.centerY;

      // Choke point au milieu du couloir
      const midX = Math.floor((x + targetX) * 0.5);
      const midY = Math.floor((y + targetY) * 0.5);
      chokePoints.push({ x: midX, y: midY });

      while (x !== targetX || y !== targetY) {
        // Élargissement à 2 ou 3 tuiles pour garantir le passage du héros 2x2
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 1 && px < width - 1 && py >= 1 && py < height - 1) {
              corridorMask[py][px] = true;
            }
          }
        }

        if (x !== targetX && (this.prng.next() < 0.6 || y === targetY)) {
          x += x < targetX ? 1 : -1;
        } else if (y !== targetY) {
          y += y < targetY ? 1 : -1;
        }
      }
    }

    // Tout ce qui n'est ni une salle ni un couloir devient une barrière naturelle
    // (crête montagneuse, falaise ou canyon infranchissable)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (roomMask[y][x] === -1 && !corridorMask[y][x]) {
          barrierMask[y][x] = true;
        }
      }
    }

    return {
      rooms,
      roomMask,
      corridorMask,
      barrierMask,
      chokePoints
    };
  }
}
