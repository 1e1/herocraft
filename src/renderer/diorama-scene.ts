/**
 * [SPEC-SYS-001] & [SPEC-RND-001] Scène 3D Babylon.js & Caméra Diorama TV
 */
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4, Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { GeneratedMap } from '../core/types';
import { TerrainMeshBuilder, DisplayMode } from './terrain-mesh';
import { PropsRenderer } from './props-mesh';

export class DioramaScene {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private currentTerrainMesh: Mesh | null = null;
  private propsRenderer: PropsRenderer;
  private currentMap: GeneratedMap | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.07, 0.1, 1.0); // Fond sombre élégant

    // Lumière ambiante zénithale (ciel / terre)
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    hemiLight.diffuse = new Color3(1.0, 0.98, 0.95);
    hemiLight.groundColor = new Color3(0.2, 0.22, 0.25);
    hemiLight.intensity = 0.85;

    // Lumière solaire directionnelle (Zelda BotW soleil chaud)
    const dirLight = new DirectionalLight('sunLight', new Vector3(-1, -2, -1), this.scene);
    dirLight.diffuse = new Color3(1.0, 0.92, 0.8);
    dirLight.intensity = 0.95;

    // [SPEC-SYS-001] Caméra diorama calibrée pour englober la grille 54x30 en 16:9
    this.camera = new ArcRotateCamera(
      'diorama_camera',
      -Math.PI / 2.3,   // Angle horizontal
      Math.PI / 3.2,    // Plongée ~56°
      46,               // Distance
      new Vector3(0, 0.8, 0),
      this.scene
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 15;
    this.camera.upperRadiusLimit = 85;
    this.camera.lowerBetaLimit = 0.2;
    this.camera.upperBetaLimit = Math.PI / 2.1;

    this.propsRenderer = new PropsRenderer(this.scene);

    window.addEventListener('resize', () => {
      this.engine.resize();
    });

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  public resetToDefaultView(): void {
    this.camera.alpha = -Math.PI / 2.3;
    this.camera.beta = Math.PI / 3.2;
    this.camera.radius = 46;
    this.camera.target.set(0, 0.8, 0);
  }

  public loadMap(
    mapData: GeneratedMap, 
    mode: DisplayMode = 'BOTW_DIORAMA',
    terraceMode = true,
    terraceSteps = 7
  ): void {
    this.currentMap = mapData;

    // Nettoyage ancien maillage
    if (this.currentTerrainMesh) {
      this.currentTerrainMesh.dispose();
      this.currentTerrainMesh = null;
    }
    this.propsRenderer.clear();

    // Construction du nouveau diorama
    this.currentTerrainMesh = TerrainMeshBuilder.createTerrainMesh(
      this.scene, 
      mapData, 
      mode, 
      3.8, 
      1.0, 
      terraceMode, 
      terraceSteps
    );

    // Si on est en mode BotW standard, on affiche la végétation et les accessoires
    if (mode === 'BOTW_DIORAMA') {
      this.propsRenderer.renderProps(mapData);
    }

    // Affichage du héros 2x2 à sa position de spawn
    this.propsRenderer.renderHeroPawn(mapData.heroSpawn.x, mapData.heroSpawn.y, mapData);
  }

  public getPropsRenderer(): PropsRenderer {
    return this.propsRenderer;
  }

  public getScene(): Scene {
    return this.scene;
  }

  /**
   * Convertit un clic 3D sur le terrain en coordonnées de grille discrète (x, y)
   */
  public pickGridCoordinates(pointerX: number, pointerY: number): { x: number; y: number } | null {
    if (!this.currentMap) return null;

    const pickInfo = this.scene.pick(pointerX, pointerY);
    if (pickInfo.hit && pickInfo.pickedPoint) {
      const halfW = (this.currentMap.width - 1) * 0.5;
      const halfH = (this.currentMap.height - 1) * 0.5;

      const gridX = Math.round(pickInfo.pickedPoint.x + halfW);
      const gridY = Math.round(-pickInfo.pickedPoint.z + halfH);

      if (gridX >= 0 && gridX < this.currentMap.width && gridY >= 0 && gridY < this.currentMap.height) {
        return { x: gridX, y: gridY };
      }
    }
    return null;
  }
}
