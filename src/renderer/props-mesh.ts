/**
 * [SPEC-RND-002] & [SPEC-NAV-002] Rendu 3D des Props, du Héros 2x2 et du Tracé A*
 */
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GeneratedMap } from '../core/types';
import { COMMON_COLORS } from './palette';

export class PropsRenderer {
  private scene: Scene;
  private spawnedMeshes: Mesh[] = [];
  private heroPawn: Mesh | null = null;
  private pathMesh: Mesh | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public clear(): void {
    for (const m of this.spawnedMeshes) {
      m.dispose();
    }
    this.spawnedMeshes = [];
    if (this.heroPawn) {
      this.heroPawn.dispose();
      this.heroPawn = null;
    }
    if (this.pathMesh) {
      this.pathMesh.dispose();
      this.pathMesh = null;
    }
  }

  /**
   * Crée et instancie les modèles 3D pour la végétation, rochers et ruines
   */
  public renderProps(mapData: GeneratedMap, heightScale = 3.5, cellSize = 1.0): void {
    const width = mapData.width;
    const height = mapData.height;
    const halfW = (width - 1) * 0.5;
    const halfH = (height - 1) * 0.5;

    // Matériaux partagés
    const trunkMat = new StandardMaterial('trunkMat', this.scene);
    trunkMat.diffuseColor = Color3.FromHexString('#5c3a21');

    const foliageGreenMat = new StandardMaterial('foliageGreen', this.scene);
    foliageGreenMat.diffuseColor = Color3.FromHexString('#4a8f29');

    const foliageAutumnMat = new StandardMaterial('foliageAutumn', this.scene);
    foliageAutumnMat.diffuseColor = Color3.FromHexString('#d9531e');

    const foliagePineMat = new StandardMaterial('foliagePine', this.scene);
    foliagePineMat.diffuseColor = Color3.FromHexString('#255431');

    const rockMat = new StandardMaterial('rockMat', this.scene);
    rockMat.diffuseColor = Color3.FromHexString('#6b6770');

    const ruinMat = new StandardMaterial('ruinMat', this.scene);
    ruinMat.diffuseColor = Color3.FromHexString('#c2b8a3');

    // Modèles de base (gabarits)
    const baseDeciduous = MeshBuilder.CreateCylinder('base_deciduous_trunk', { height: 0.6, diameter: 0.2 }, this.scene);
    baseDeciduous.material = trunkMat;
    const foliageSphere = MeshBuilder.CreateSphere('foliage_sphere', { diameter: 0.85, segments: 4 }, this.scene);
    foliageSphere.position.y = 0.55;
    foliageSphere.parent = baseDeciduous;
    foliageSphere.material = foliageGreenMat;
    baseDeciduous.setEnabled(false);

    const basePine = MeshBuilder.CreateCylinder('base_pine_trunk', { height: 0.5, diameter: 0.16 }, this.scene);
    basePine.material = trunkMat;
    const pineCone = MeshBuilder.CreateCylinder('pine_cone', { height: 1.1, diameterTop: 0.05, diameterBottom: 0.8, tessellation: 5 }, this.scene);
    pineCone.position.y = 0.65;
    pineCone.parent = basePine;
    pineCone.material = foliagePineMat;
    basePine.setEnabled(false);

    const baseRock = MeshBuilder.CreatePolyhedron('base_rock', { type: 1, size: 0.35 }, this.scene);
    baseRock.material = rockMat;
    baseRock.setEnabled(false);

    const baseRuin = MeshBuilder.CreateCylinder('base_ruin', { height: 1.0, diameter: 0.35, tessellation: 6 }, this.scene);
    baseRuin.material = ruinMat;
    baseRuin.setEnabled(false);

    // Parcours des tuiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = mapData.tiles[y][x];
        const prop = tile.prop;
        if (!prop || prop === 'FLOWER_CLUSTER' || prop === 'REEDS') continue;

        const posX = (x - halfW) * cellSize;
        const posZ = -(y - halfH) * cellSize;
        const posY = tile.elevation * heightScale;

        let instance: Mesh | null = null;

        if (prop === 'TREE_DECIDUOUS') {
          instance = baseDeciduous.clone(`tree_${x}_${y}`);
          const s = 0.8 + (x * 7 + y * 13) % 5 * 0.1;
          instance.scaling.set(s, s, s);
        } else if (prop === 'TREE_AUTUMN') {
          instance = baseDeciduous.clone(`tree_aut_${x}_${y}`);
          const child = instance.getChildren()[0] as Mesh;
          if (child) child.material = foliageAutumnMat;
          const s = 0.85 + (x * 3 + y * 11) % 4 * 0.1;
          instance.scaling.set(s, s, s);
        } else if (prop === 'TREE_PINE') {
          instance = basePine.clone(`pine_${x}_${y}`);
          const s = 0.75 + (x * 5 + y * 17) % 6 * 0.1;
          instance.scaling.set(s, s, s);
        } else if (prop === 'BOULDER') {
          instance = baseRock.clone(`rock_${x}_${y}`);
          const s = 0.7 + (x * 9 + y * 23) % 5 * 0.15;
          instance.scaling.set(s * 1.2, s * 0.8, s);
        } else if (prop === 'RUIN_COLUMN') {
          instance = baseRuin.clone(`ruin_${x}_${y}`);
        } else if (prop === 'CAMP_FIRE_SITE') {
          // Balise visuelle de l'objectif de mission
          instance = MeshBuilder.CreateCylinder(`camp_${x}_${y}`, { height: 0.3, diameter: 1.8, tessellation: 8 }, this.scene);
          const campMat = new StandardMaterial('campMat', this.scene);
          campMat.diffuseColor = COMMON_COLORS.OBJECTIVE_COLOR;
          campMat.emissiveColor = new Color3(0.4, 0.1, 0.1);
          instance.material = campMat;
        }

        if (instance) {
          instance.setEnabled(true);
          instance.position.set(posX, posY, posZ);
          this.spawnedMeshes.push(instance);
        }
      }
    }

    baseDeciduous.dispose();
    basePine.dispose();
    baseRock.dispose();
    baseRuin.dispose();
  }

  /**
   * [SPEC-MAP-003] Rendu du pion de Héros miniature (socle 2x2 unités)
   */
  public renderHeroPawn(
    gridX: number,
    gridY: number,
    mapData: GeneratedMap,
    heightScale = 3.5,
    cellSize = 1.0
  ): Mesh {
    if (this.heroPawn) {
      this.heroPawn.dispose();
    }

    const halfW = (mapData.width - 1) * 0.5;
    const halfH = (mapData.height - 1) * 0.5;

    // Le héros 2x2 est centré entre (gridX, gridY) et (gridX + 1, gridY + 1)
    const centerX = gridX + 0.5;
    const centerY = gridY + 0.5;
    const posX = (centerX - halfW) * cellSize;
    const posZ = -(centerY - halfH) * cellSize;

    // Altitude moyenne sous le héros
    const t00 = mapData.tiles[gridY]?.[gridX]?.elevation ?? 0.3;
    const t10 = mapData.tiles[gridY]?.[gridX + 1]?.elevation ?? 0.3;
    const t01 = mapData.tiles[gridY + 1]?.[gridX]?.elevation ?? 0.3;
    const t11 = mapData.tiles[gridY + 1]?.[gridX + 1]?.elevation ?? 0.3;
    const avgElev = (t00 + t10 + t01 + t11) * 0.25;
    const posY = avgElev * heightScale;

    // Socle rond HeroQuest de 2 unités de diamètre
    const pawnBase = MeshBuilder.CreateCylinder('hero_pawn_base', {
      height: 0.25,
      diameter: 1.85,
      tessellation: 24
    }, this.scene);

    const baseMat = new StandardMaterial('pawn_base_mat', this.scene);
    baseMat.diffuseColor = COMMON_COLORS.HERO_COLOR;
    baseMat.emissiveColor = new Color3(0.1, 0.2, 0.5);
    pawnBase.material = baseMat;

    // Figurine stylisée (buste + casque à cornes/cimier doré)
    const body = MeshBuilder.CreateCylinder('hero_body', {
      height: 1.0,
      diameterTop: 0.5,
      diameterBottom: 0.7,
      tessellation: 12
    }, this.scene);
    body.position.y = 0.6;
    body.parent = pawnBase;

    const bodyMat = new StandardMaterial('hero_body_mat', this.scene);
    bodyMat.diffuseColor = Color3.FromHexString('#2563eb');
    body.material = bodyMat;

    const head = MeshBuilder.CreateSphere('hero_head', { diameter: 0.6, segments: 8 }, this.scene);
    head.position.y = 1.35;
    head.parent = pawnBase;

    const crest = MeshBuilder.CreateBox('hero_crest', { width: 0.15, height: 0.35, depth: 0.5 }, this.scene);
    crest.position.y = 1.65;
    crest.parent = pawnBase;
    const goldMat = new StandardMaterial('goldMat', this.scene);
    goldMat.diffuseColor = COMMON_COLORS.HERO_ACCENT;
    goldMat.emissiveColor = new Color3(0.3, 0.2, 0.05);
    crest.material = goldMat;

    pawnBase.position.set(posX, posY + 0.12, posZ);
    this.heroPawn = pawnBase;
    return pawnBase;
  }

  /**
   * [SPEC-NAV-003] Affiche le ruban lumineux du chemin A* 2x2
   */
  public renderPathRibbon(
    path: { x: number; y: number }[],
    mapData: GeneratedMap,
    heightScale = 3.5,
    cellSize = 1.0
  ): void {
    if (this.pathMesh) {
      this.pathMesh.dispose();
      this.pathMesh = null;
    }

    if (path.length <= 1) return;

    const halfW = (mapData.width - 1) * 0.5;
    const halfH = (mapData.height - 1) * 0.5;

    const points: Vector3[] = path.map(p => {
      const centerX = p.x + 0.5;
      const centerY = p.y + 0.5;
      const px = (centerX - halfW) * cellSize;
      const pz = -(centerY - halfH) * cellSize;
      const elev = mapData.tiles[Math.min(mapData.height - 1, p.y)][Math.min(mapData.width - 1, p.x)].elevation;
      return new Vector3(px, elev * heightScale + 0.22, pz);
    });

    const pathLine = MeshBuilder.CreateTube('astar_path_tube', {
      path: points,
      radius: 0.16,
      tessellation: 8,
      updatable: false
    }, this.scene);

    const pathMat = new StandardMaterial('path_mat', this.scene);
    pathMat.diffuseColor = COMMON_COLORS.PATH_RIBBON;
    pathMat.emissiveColor = new Color3(0.2, 0.6, 0.9);
    pathLine.material = pathMat;

    this.pathMesh = pathLine;
  }
}
