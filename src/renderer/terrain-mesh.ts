/**
 * [SPEC-RND-001] & [SPEC-RND-002] Génération du maillage 3D Diorama
 * Modélisation du terrain avec vertex colors multi-biomes et socle géologique taillé.
 */
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { GeneratedMap, MAP_CONFIG, TileData } from '../core/types';
import { BIOME_PALETTES, COMMON_COLORS } from './palette';

export type DisplayMode = 'BOTW_DIORAMA' | 'HEIGHTMAP' | 'BIOMES' | 'SLOPES' | 'WALKABLE' | 'CLEARANCE';

export class TerrainMeshBuilder {
  public static createTerrainMesh(
    scene: Scene,
    mapData: GeneratedMap,
    mode: DisplayMode = 'BOTW_DIORAMA',
    heightScale = 3.5,
    cellSize = 1.0
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
    const slabBottomY = -2.0; // Profondeur de la tranche géologique

    const getTile = (x: number, y: number): TileData => {
      const cx = Math.max(0, Math.min(width - 1, x));
      const cy = Math.max(0, Math.min(height - 1, y));
      return mapData.tiles[cy][cx];
    };

    // Détermination de la couleur d'une tuile selon le mode actif
    const getVertexColor = (tile: TileData): Color3 => {
      switch (mode) {
        case 'HEIGHTMAP': {
          const h = tile.elevation;
          return new Color3(h, h, h);
        }
        case 'BIOMES': {
          switch (tile.biome) {
            case 'PLAINS': return new Color3(0.3, 0.8, 0.2);
            case 'FOREST': return new Color3(0.85, 0.45, 0.15);
            case 'HIGHLANDS': return new Color3(0.65, 0.6, 0.55);
            case 'SWAMP': return new Color3(0.2, 0.35, 0.3);
          }
          break;
        }
        case 'SLOPES': {
          if (tile.isCliff) return new Color3(0.9, 0.15, 0.15); // Rouge vif falaise
          const ratio = Math.min(1.0, tile.slope / MAP_CONFIG.CLIFF_THRESHOLD);
          return new Color3(ratio, 1.0 - ratio * 0.5, 0.2);
        }
        case 'WALKABLE': {
          return tile.walkable ? new Color3(0.2, 0.75, 0.3) : new Color3(0.85, 0.2, 0.2);
        }
        case 'CLEARANCE': {
          if (tile.clearance === 0) return new Color3(0.2, 0.2, 0.2);
          if (tile.clearance === 1) return new Color3(0.8, 0.6, 0.2);
          if (tile.clearance === 2) return new Color3(0.2, 0.7, 0.9); // Héros 2x2
          return new Color3(0.4, 0.4, 0.95); // 3+
        }
        case 'BOTW_DIORAMA':
        default: {
          if (tile.isWater && !tile.isShallowWater) {
            return COMMON_COLORS.WATER_DEEP;
          }
          if (tile.isShallowWater) {
            return COMMON_COLORS.WATER_SHALLOW;
          }
          if (tile.isCliff) {
            return COMMON_COLORS.CLIFF_EDGE;
          }

          // Blending multi-biomes
          let r = 0, g = 0, b = 0;
          for (const [biomeKey, w] of Object.entries(tile.biomeWeights)) {
            if (w <= 0) continue;
            const pal = BIOME_PALETTES[biomeKey as keyof typeof BIOME_PALETTES];
            const tElev = Math.min(1.0, tile.elevation * 1.4);
            const groundCol = Color3.Lerp(pal.groundLow, pal.groundHigh, tElev);
            r += groundCol.r * w;
            g += groundCol.g * w;
            b += groundCol.b * w;
          }
          return new Color3(r, g, b);
        }
      }
    };

    // 1. Génération de la surface du plateau (grille triangulée)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = getTile(x, y);
        const posX = (x - halfW) * cellSize;
        const posZ = -(y - halfH) * cellSize;
        
        let posY = tile.elevation * heightScale;
        if (tile.isWater && !tile.isShallowWater) {
          // Eau plane
          posY = MAP_CONFIG.WATER_LEVEL * heightScale * 0.95;
        }

        positions.push(posX, posY, posZ);
        uvs.push(x / (width - 1), y / (height - 1));

        const c = getVertexColor(tile);
        colors.push(c.r, c.g, c.b, 1.0);
      }
    }

    // Triangulation de la surface
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const i0 = y * width + x;
        const i1 = y * width + (x + 1);
        const i2 = (y + 1) * width + x;
        const i3 = (y + 1) * width + (x + 1);

        // Deux triangles par quad
        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    // 2. [SPEC-RND-001] Tranche géologique : 4 murs verticaux qui tombent vers le socle
    const addSideWall = (edgeCoords: [number, number][]) => {
      for (let i = 0; i < edgeCoords.length - 1; i++) {
        const [x0, y0] = edgeCoords[i];
        const [x1, y1] = edgeCoords[i + 1];

        const t0 = getTile(x0, y0);
        const t1 = getTile(x1, y1);

        const px0 = (x0 - halfW) * cellSize;
        const pz0 = -(y0 - halfH) * cellSize;
        const py0 = Math.max(t0.elevation * heightScale, 0);

        const px1 = (x1 - halfW) * cellSize;
        const pz1 = -(y1 - halfH) * cellSize;
        const py1 = Math.max(t1.elevation * heightScale, 0);

        const baseIdx = positions.length / 3;

        // 4 sommets du quad vertical
        positions.push(px0, py0, pz0);           // Sommet haut 0
        positions.push(px1, py1, pz1);           // Sommet haut 1
        positions.push(px0, slabBottomY, pz0);   // Bas 0
        positions.push(px1, slabBottomY, pz1);   // Bas 1

        uvs.push(0, 1, 1, 1, 0, 0, 1, 0);

        const rockCol = COMMON_COLORS.ROCK_SLAB;
        for (let k = 0; k < 4; k++) {
          colors.push(rockCol.r, rockCol.g, rockCol.b, 1.0);
        }

        // Triangles du pan de mur
        indices.push(baseIdx, baseIdx + 2, baseIdx + 1);
        indices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3);
      }
    };

    // Bord Nord (y = 0, x croissant)
    const northEdge: [number, number][] = [];
    for (let x = 0; x < width; x++) northEdge.push([x, 0]);
    addSideWall(northEdge);

    // Bord Sud (y = height - 1, x décroissant)
    const southEdge: [number, number][] = [];
    for (let x = width - 1; x >= 0; x--) southEdge.push([x, height - 1]);
    addSideWall(southEdge);

    // Bord Est (x = width - 1, y croissant)
    const eastEdge: [number, number][] = [];
    for (let y = 0; y < height; y++) eastEdge.push([width - 1, y]);
    addSideWall(eastEdge);

    // Bord Ouest (x = 0, y décroissant)
    const westEdge: [number, number][] = [];
    for (let y = height - 1; y >= 0; y--) westEdge.push([0, y]);
    addSideWall(westEdge);

    // 3. Calcul automatique des normales
    VertexData.ComputeNormals(positions, indices, normals);

    const customMesh = new Mesh('terrain_diorama', scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(customMesh);

    // Matériau standard avec vertex colors actifs
    const mat = new StandardMaterial('terrain_mat', scene);
    mat.specularColor = new Color3(0.05, 0.05, 0.05); // Faible spécularité pour look mat/tabletop
    mat.ambientColor = new Color3(0.4, 0.4, 0.4);
    customMesh.material = mat;

    return customMesh;
  }
}
