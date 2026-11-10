/**
 * [SPEC-NAV-003] Algorithme de Pathfinding A* avec gestion d'empreinte multi-tuiles (Héros 2x2)
 * et interdiction stricte de coupe d'angle (No Corner Cutting).
 */
import { MAP_CONFIG } from '../types';

export interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export interface PathResult {
  found: boolean;
  path: { x: number; y: number }[];
  cost: number;
  visitedNodesCount: number;
  durationMs: number;
}

export class AStarPathfinder {
  /**
   * Calcule le chemin le plus court pour une entité de taille `footprintSize` (ex: 2 pour Héros 2x2)
   */
  public static findPath(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    clearance: number[][],
    heightmap: number[][],
    shallowWaterMap: boolean[][],
    footprintSize = MAP_CONFIG.HERO_SIZE
  ): PathResult {
    const t0 = performance.now();
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    // Vérification de validité départ et arrivée
    const isTargetValid = (
      targetX >= 0 && targetX <= width - footprintSize &&
      targetY >= 0 && targetY <= height - footprintSize &&
      clearance[targetY][targetX] >= footprintSize
    );

    if (!isTargetValid) {
      return {
        found: false,
        path: [],
        cost: 0,
        visitedNodesCount: 0,
        durationMs: performance.now() - t0
      };
    }

    const openSet: PathNode[] = [];
    const openSetLookup = new Map<string, PathNode>();
    const closedSet = new Set<string>();

    const makeKey = (x: number, y: number) => `${x},${y}`;

    // Heuristique Octile admissible
    const heuristic = (x: number, y: number): number => {
      const dx = Math.abs(x - targetX);
      const dy = Math.abs(y - targetY);
      return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };

    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: heuristic(startX, startY),
      f: heuristic(startX, startY),
      parent: null
    };

    openSet.push(startNode);
    openSetLookup.set(makeKey(startX, startY), startNode);

    // Déplacements possibles : 4 orthogonaux + 4 diagonaux
    const directions = [
      { dx: 1, dy: 0, cost: 1.0, isDiag: false },
      { dx: -1, dy: 0, cost: 1.0, isDiag: false },
      { dx: 0, dy: 1, cost: 1.0, isDiag: false },
      { dx: 0, dy: -1, cost: 1.0, isDiag: false },
      { dx: 1, dy: 1, cost: Math.SQRT2, isDiag: true, c1: [1, 0], c2: [0, 1] },
      { dx: -1, dy: 1, cost: Math.SQRT2, isDiag: true, c1: [-1, 0], c2: [0, 1] },
      { dx: 1, dy: -1, cost: Math.SQRT2, isDiag: true, c1: [1, 0], c2: [0, -1] },
      { dx: -1, dy: -1, cost: Math.SQRT2, isDiag: true, c1: [-1, 0], c2: [0, -1] }
    ];

    let visitedCount = 0;

    while (openSet.length > 0) {
      // Extraction du nœud au f-score le plus faible
      let lowestIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIndex].f) {
          lowestIndex = i;
        }
      }

      const current = openSet.splice(lowestIndex, 1)[0];
      const currentKey = makeKey(current.x, current.y);
      openSetLookup.delete(currentKey);
      closedSet.add(currentKey);
      visitedCount++;

      // Arrivée atteinte
      if (current.x === targetX && current.y === targetY) {
        const path: { x: number; y: number }[] = [];
        let curr: PathNode | null = current;
        while (curr) {
          path.unshift({ x: curr.x, y: curr.y });
          curr = curr.parent;
        }

        return {
          found: true,
          path,
          cost: current.g,
          visitedNodesCount: visitedCount,
          durationMs: performance.now() - t0
        };
      }

      // Exploration des voisins
      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;

        // Limites de la grille pour l'empreinte NxN
        if (nx < 0 || nx > width - footprintSize || ny < 0 || ny > height - footprintSize) {
          continue;
        }

        // Clearance requise
        if (clearance[ny][nx] < footprintSize) {
          continue;
        }

        // [SPEC-NAV-003] Interdiction stricte de couper les coins en diagonale
        if (dir.isDiag && dir.c1 && dir.c2) {
          const corner1X = current.x + dir.c1[0];
          const corner1Y = current.y + dir.c1[1];
          const corner2X = current.x + dir.c2[0];
          const corner2Y = current.y + dir.c2[1];

          if (clearance[corner1Y]?.[corner1X] < footprintSize || clearance[corner2Y]?.[corner2X] < footprintSize) {
            continue;
          }
        }

        const neighborKey = makeKey(nx, ny);
        if (closedSet.has(neighborKey)) {
          continue;
        }

        // Calcul des coûts de terrain
        let stepCost = dir.cost;
        if (shallowWaterMap[ny][nx]) {
          stepCost *= 2.0; // Ralentissement dans l'eau
        }
        // Pénalité d'altitude montante
        const elevDiff = heightmap[ny][nx] - heightmap[current.y][current.x];
        if (elevDiff > 0) {
          stepCost += elevDiff * 2.5;
        }

        const tentativeG = current.g + stepCost;
        let neighborNode = openSetLookup.get(neighborKey);

        if (!neighborNode) {
          neighborNode = {
            x: nx,
            y: ny,
            g: tentativeG,
            h: heuristic(nx, ny),
            f: tentativeG + heuristic(nx, ny),
            parent: current
          };
          openSet.push(neighborNode);
          openSetLookup.set(neighborKey, neighborNode);
        } else if (tentativeG < neighborNode.g) {
          neighborNode.g = tentativeG;
          neighborNode.f = tentativeG + neighborNode.h;
          neighborNode.parent = current;
        }
      }
    }

    // Aucun chemin trouvé
    return {
      found: false,
      path: [],
      cost: 0,
      visitedNodesCount: visitedCount,
      durationMs: performance.now() - t0
    };
  }
}
