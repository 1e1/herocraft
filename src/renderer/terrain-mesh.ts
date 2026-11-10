/**
 * [SPEC-RND-001], [SPEC-RND-002], [SPEC-RND-004] Rendu 3D Diorama & Terrasses Tabletop
 * Supporte le mode terrasses étagées (Warcraft III / HeroQuest) et les calques de diagnostic.
 */
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { GeneratedMap, MAP_CONFIG, TileData } from '../core/types';
import { BIOME_PALETTES, COMMON_COLORS } from './palette';

export type DisplayMode = 
  | 'BOTW_DIORAMA' 
  | 'HEROQUEST_ROOMS' 
  | 'LITHOLOGY' 
  | 'HEIGHTMAP' 
  | 'BIOMES' 
  | 'SLOPES' 
  | 'WALKABLE' 
  | 'CLEARANCE';

export class TerrainMeshBuilder {
  public static createTerrainMesh(
    scene: Scene,
    mapData: GeneratedMap,
    mode: DisplayMode = 'BOTW_DIORAMA',
    heightScale = 3.8,
    cellSize = 1.0,
    terraceMode = true,
    terraceSteps = 7
  ): Mesh {
    const width = mapData.width;
    const height = mapData.height;

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    const halfW = (width - 1) * 0.5;
    const halfH = (height - 1) * 0.5;
    const slabBottomY = -2.5;

    const getTile = (x: number, y: number): TileData => {
      const cx = Math.max(0, Math.min(width - 1, x));
      const cy = Math.max(0, Math.min(height - 1, y));
      return mapData.tiles[cy][cx];
    };

    // Calcul de l'altitude 3D avec option de terrasses Warcraft/HeroQuest [SPEC-RND-004]
    const computeMeshElevation = (rawElev: number): number => {
      if (!terraceMode) {
        return rawElev * heightScale;
      }
      // Mode terrasses : discrétisation en paliers avec biseau
      const stepVal = Math.floor(rawElev * terraceSteps) / terraceSteps;
      const frac = (rawElev * terraceSteps) - Math.floor(rawElev * terraceSteps);
      // Courbe en S pour créer des plateaux bien plats reliés par des montées franches
      const smoothFrac = frac * frac * (3 - 2 * frac);
      const blended = stepVal + (smoothFrac * 0.25) / terraceSteps;
      return blended * heightScale;
    };

    // Détermination de la couleur selon le mode
    const getVertexColor = (tile: TileData): Color3 => {
      switch (mode) {
        case 'HEROQUEST_ROOMS': {
          if (tile.isChokePoint) return new Color3(1.0, 0.85, 0.1); // Jaune or pour les goulots d'étranglement
          if (tile.roomId !== undefined) {
            const roomColors = [
              new Color3(0.2, 0.6, 0.9), // Salle 0 (Spawn)
              new Color3(0.8, 0.4, 0.8), // Salle 1
              new Color3(0.2, 0.8, 0.4), // Salle 2 (Camp)
              new Color3(0.9, 0.6, 0.2), // Salle 3
              new Color3(0.9, 0.3, 0.3), // Salle 4 (Cataclysme)
              new Color3(0.4, 0.5, 0.9)  // Salle 5
            ];
            return roomColors[tile.roomId % roomColors.length];
          }
          if (tile.walkable) return new Color3(0.65, 0.55, 0.45); // Couloir praticable
          return new Color3(0.2, 0.2, 0.25); // Mur / falaise
        }
        case 'LITHOLOGY': {
          switch (tile.lithology) {
            case 'LITHO_GRANITE': return COMMON_COLORS.LITHO_GRANITE;
            case 'LITHO_SANDSTONE': return COMMON_COLORS.LITHO_SANDSTONE;
            case 'LITHO_ALLUVIUM': return COMMON_COLORS.LITHO_ALLUVIUM;
            case 'LITHO_VOLCANIC': return COMMON_COLORS.LITHO_VOLCANIC;
            case 'LITHO_METEORIC': return COMMON_COLORS.LITHO_METEORIC;
          }
          break;
        }
        case 'HEIGHTMAP': {
          const h = tile.elevation;
          return new Color3(h, h, h);
        }
        case 'BIOMES': {
          switch (tile.biome) {
            case 'PLAINS': return new Color3(0.35, 0.85, 0.25);
            case 'FOREST': return new Color3(0.85, 0.45, 0.15);
            case 'HIGHLANDS': return new Color3(0.65, 0.6, 0.55);
            case 'SWAMP': return new Color3(0.2, 0.35, 0.3);
          }
          break;
        }
        case 'SLOPES': {
          if (tile.isCliff) return new Color3(0.95, 0.15, 0.15);
          const ratio = Math.min(1.0, tile.slope / MAP_CONFIG.CLIFF_THRESHOLD);
          return new Color3(ratio, 1.0 - ratio * 0.5, 0.15);
        }
        case 'WALKABLE': {
          return tile.walkable ? new Color3(0.2, 0.8, 0.35) : new Color3(0.9, 0.2, 0.2);
        }
        case 'CLEARANCE': {
          if (tile.clearance === 0) return new Color3(0.2, 0.2, 0.2);
          if (tile.clearance === 1) return new Color3(0.85, 0.65, 0.2);
          if (tile.clearance === 2) return new Color3(0.2, 0.75, 0.95); // Héros 2x2
          return new Color3(0.4, 0.45, 0.98); // 3+
        }
        case 'BOTW_DIORAMA':
        default: {
          if (tile.isWater && !tile.isShallowWater) {
            return COMMON_COLORS.WATER_DEEP;
          }
          if (tile.isShallowWater) {
            return COMMON_COLORS.WATER_SHALLOW;
          }

          // Effets cataclysmiques
          if (tile.lithology === 'LITHO_METEORIC') {
            return Color3.Lerp(COMMON_COLORS.LITHO_METEORIC, COMMON_COLORS.METEOR_CORE, 0.35);
          }
          if (tile.lithology === 'LITHO_VOLCANIC') {
            return tile.elevation > 0.55 ? COMMON_COLORS.LAVA_GLOW : COMMON_COLORS.LITHO_VOLCANIC;
          }

          if (tile.isCliff) {
            return COMMON_COLORS.CLIFF_EDGE;
          }

          // Blending multi-biomes
          let r = 0, g = 0, b = 0;
          for (const [biomeKey, w] of Object.entries(tile.biomeWeights)) {
            if (w <= 0) continue;
            const pal = BIOME_PALETTES[biomeKey as keyof typeof BIOME_PALETTES];
            const tElev = Math.min(1.0, tile.elevation * 1.3);
            const groundCol = Color3.Lerp(pal.groundLow, pal.groundHigh, tElev);
            r += groundCol.r * w;
            g += groundCol.g * w;
            b += groundCol.b * w;
          }

          // Si c'est un couloir battu
          if (tile.walkable && tile.roomId === undefined) {
            const pathTint = COMMON_COLORS.PATH_WAY;
            r = r * 0.7 + pathTint.r * 0.3;
            g = g * 0.7 + pathTint.g * 0.3;
            b = b * 0.7 + pathTint.b * 0.3;
          }

          return new Color3(r, g, b);
        }
      }
    };

    // 1. Surface de la grille
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = getTile(x, y);
        const posX = (x - halfW) * cellSize;
        const posZ = -(y - halfH) * cellSize;
        
        let posY = computeMeshElevation(tile.elevation);
        if (tile.isWater && !tile.isShallowWater) {
          posY = computeMeshElevation(MAP_CONFIG.WATER_LEVEL) * 0.95;
        }

        positions.push(posX, posY, posZ);
        uvs.push(x / (width - 1), y / (height - 1));

        const c = getVertexColor(tile);
        colors.push(c.r, c.g, c.b, 1.0);
      }
    }

    // Triangulation
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const i0 = y * width + x;
        const i1 = y * width + (x + 1);
        const i2 = (y + 1) * width + x;
        const i3 = (y + 1) * width + (x + 1);

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    // 2. Murs verticaux du diorama (tranche géologique)
    const addSideWall = (edgeCoords: [number, number][]) => {
      for (let i = 0; i < edgeCoords.length - 1; i++) {
        const [x0, y0] = edgeCoords[i];
        const [x1, y1] = edgeCoords[i + 1];

        const t0 = getTile(x0, y0);
        const t1 = getTile(x1, y1);

        const px0 = (x0 - halfW) * cellSize;
        const pz0 = -(y0 - halfH) * cellSize;
        const py0 = Math.max(computeMeshElevation(t0.elevation), 0);

        const px1 = (x1 - halfW) * cellSize;
        const pz1 = -(y1 - halfH) * cellSize;
        const py1 = Math.max(computeMeshElevation(t1.elevation), 0);

        const baseIdx = positions.length / 3;

        positions.push(px0, py0, pz0);
        positions.push(px1, py1, pz1);
        positions.push(px0, slabBottomY, pz0);
        positions.push(px1, slabBottomY, pz1);

        uvs.push(0, 1, 1, 1, 0, 0, 1, 0);

        const rockCol = COMMON_COLORS.ROCK_SLAB;
        for (let k = 0; k < 4; k++) {
          colors.push(rockCol.r, rockCol.g, rockCol.b, 1.0);
        }

        indices.push(baseIdx, baseIdx + 2, baseIdx + 1);
        indices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3);
      }
    };

    const northEdge: [number, number][] = [];
    for (let x = 0; x < width; x++) northEdge.push([x, 0]);
    addSideWall(northEdge);

    const southEdge: [number, number][] = [];
    for (let x = width - 1; x >= 0; x--) southEdge.push([x, height - 1]);
    addSideWall(southEdge);

    const eastEdge: [number, number][] = [];
    for (let y = 0; y < height; y++) eastEdge.push([width - 1, y]);
    addSideWall(eastEdge);

    const westEdge: [number, number][] = [];
    for (let y = height - 1; y >= 0; y--) westEdge.push([0, y]);
    addSideWall(westEdge);

    VertexData.ComputeNormals(positions, indices, normals);

    const customMesh = new Mesh('terrain_diorama', scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(customMesh);

    const mat = new StandardMaterial('terrain_mat', scene);
    mat.specularColor = new Color3(0.04, 0.04, 0.04);
    mat.ambientColor = new Color3(0.42, 0.42, 0.42);
    customMesh.material = mat;

    return customMesh;
  }
}
