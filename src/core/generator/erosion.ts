/**
 * [SPEC-ERO-001] & [SPEC-ERO-002] Simulation physique d'érosion thermique & hydraulique
 */
import { PRNG } from '../math/prng';
import { MAP_CONFIG } from '../types';

export class ErosionSimulator {
  private prng: PRNG;

  constructor(prng: PRNG) {
    this.prng = prng;
  }

  /**
   * [SPEC-ERO-001] Érosion thermique par relaxation de talus
   * Adoucit les pentes excessives en transférant les débris rocheux vers le bas.
   */
  public simulateThermalErosion(
    heightmap: number[][],
    passes = 8,
    talusThreshold = 0.18
  ): number[][] {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    // Cloner la carte
    let current = heightmap.map(row => [...row]);

    const neighbors = [
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    for (let p = 0; p < passes; p++) {
      const next = current.map(row => [...row]);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const h = current[y][x];

          for (const [dx, dy] of neighbors) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const diff = h - current[ny][nx];
              if (diff > talusThreshold) {
                // Transfert d'une partie de l'excédent rocheux
                const transfer = (diff - talusThreshold) * 0.25;
                next[y][x] -= transfer;
                next[ny][nx] += transfer;
              }
            }
          }
        }
      }
      current = next;
    }

    return current;
  }

  /**
   * [SPEC-ERO-002] Érosion hydraulique par simulation de particules de pluie
   * Sculpte les lits de rivière et dépose des sédiments fertiles dans les dépressions.
   */
  public simulateHydraulicErosion(
    heightmap: number[][],
    dropletCount = 3000
  ): { heightmap: number[][]; sedimentMap: number[][] } {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    const map = heightmap.map(row => [...row]);
    const sedimentMap: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));

    const inertia = 0.1;
    const sedimentCapacityFactor = 4.0;
    const minSedimentCapacity = 0.01;
    const erodeSpeed = 0.3;
    const depositSpeed = 0.3;
    const evaporateSpeed = 0.05;
    const gravity = 4.0;
    const maxDropletLifetime = 30;

    for (let d = 0; d < dropletCount; d++) {
      let posX = this.prng.rangeFloat(1, width - 2);
      let posY = this.prng.rangeFloat(1, height - 2);
      let dirX = 0;
      let dirY = 0;
      let speed = 1.0;
      let water = 1.0;
      let sediment = 0;

      for (let step = 0; step < maxDropletLifetime; step++) {
        const nodeX = Math.floor(posX);
        const nodeY = Math.floor(posY);
        if (nodeX <= 0 || nodeX >= width - 1 || nodeY <= 0 || nodeY >= height - 1) {
          break;
        }

        const u = posX - nodeX;
        const v = posY - nodeY;

        // Gradient bilinéaire pour la direction de pente
        const h00 = map[nodeY][nodeX];
        const h10 = map[nodeY][nodeX + 1];
        const h01 = map[nodeY + 1][nodeX];
        const h11 = map[nodeY + 1][nodeX + 1];

        const gradX = (h10 - h00) * (1 - v) + (h11 - h01) * v;
        const gradY = (h01 - h00) * (1 - u) + (h11 - h10) * u;

        // Direction d'écoulement avec inertie
        dirX = dirX * inertia - gradX * (1 - inertia);
        dirY = dirY * inertia - gradY * (1 - inertia);

        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len !== 0) {
          dirX /= len;
          dirY /= len;
        } else {
          break;
        }

        const nextPosX = posX + dirX;
        const nextPosY = posY + dirY;
        const nextNodeX = Math.floor(nextPosX);
        const nextNodeY = Math.floor(nextPosY);

        if (nextNodeX <= 0 || nextNodeX >= width - 1 || nextNodeY <= 0 || nextNodeY >= height - 1) {
          break;
        }

        const nextH = map[nextNodeY][nextNodeX];
        const currentH = map[nodeY][nodeX];
        const deltaH = nextH - currentH;

        // Capacité de transport des sédiments
        const capacity = Math.max(-deltaH * speed * water * sedimentCapacityFactor, minSedimentCapacity);

        if (sediment > capacity || deltaH > 0) {
          // Dépôt de sédiment
          const amountToDeposit = deltaH > 0 
            ? Math.min(deltaH, sediment) 
            : (sediment - capacity) * depositSpeed;
          sediment -= amountToDeposit;
          map[nodeY][nodeX] += amountToDeposit * 0.5;
          sedimentMap[nodeY][nodeX] += amountToDeposit;
        } else {
          // Érosion de la roche
          const amountToErode = Math.min((capacity - sediment) * erodeSpeed, -deltaH);
          sediment += amountToErode;
          map[nodeY][nodeX] -= amountToErode * 0.5;
        }

        // Accélération et évaporation
        speed = Math.sqrt(Math.max(0.01, speed * speed + deltaH * gravity));
        water *= (1 - evaporateSpeed);
        posX = nextPosX;
        posY = nextPosY;
      }
    }

    return { heightmap: map, sedimentMap };
  }
}
