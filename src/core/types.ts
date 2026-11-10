/**
 * [SPEC-MAP-001] à [SPEC-BLD-002] Définition des types et constantes formelles.
 */

export const MAP_CONFIG = {
  WIDTH: 54,           // [SPEC-MAP-001] 54 colonnes (3840 / 72 = 53.33)
  HEIGHT: 30,          // [SPEC-MAP-001] 30 lignes (2160 / 72 = 30)
  TILE_SIZE_PX: 72,    // Taille native en pixels 4K
  HERO_SIZE: 2,        // [SPEC-MAP-003] Empreinte du héros 2x2
  WATER_LEVEL: 0.22,   // [SPEC-WAT-001] Seuil niveau de la mer/eau
  CLIFF_THRESHOLD: 0.18 // [SPEC-NAV-001] Seuil de dénivelé critique falaise
} as const;

export type BiomeType = 'PLAINS' | 'FOREST' | 'HIGHLANDS' | 'SWAMP';

export type LithologyType = 
  | 'LITHO_GRANITE' 
  | 'LITHO_SANDSTONE' 
  | 'LITHO_ALLUVIUM' 
  | 'LITHO_VOLCANIC' 
  | 'LITHO_METEORIC';

export type CataclysmType = 'NONE' | 'CRATER' | 'VOLCANO' | 'RIFT';

export interface CataclysmFeature {
  type: CataclysmType;
  centerX: number;
  centerY: number;
  radius: number;
  intensity: number;
}

export interface FunctionalRoom {
  id: number;
  name: string;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  type: 'SPAWN' | 'CAMP_SITE' | 'SANCTUARY' | 'WILD_CLEARING' | 'CATACLYSM_ZONE';
}

export type PropType = 
  | 'TREE_DECIDUOUS' 
  | 'TREE_PINE' 
  | 'TREE_AUTUMN'
  | 'BOULDER' 
  | 'RUIN_COLUMN' 
  | 'CAMP_FIRE_SITE' 
  | 'FLOWER_CLUSTER'
  | 'REEDS';

export interface TileData {
  x: number;
  y: number;
  elevation: number;       // [SPEC-GEO-004] Hauteur continue [0, 1]
  stepLevel: number;       // [SPEC-GEO-004] Palier discret [0, 7]
  temperature: number;     // [0, 1]
  moisture: number;        // [0, 1]
  biome: BiomeType;        // Biome dominant
  biomeWeights: Record<BiomeType, number>; // [SPEC-BIO-002] Poids pour le blending
  lithology: LithologyType; // [SPEC-GEO-005] Type géologique du sous-sol
  roomId?: number;         // [SPEC-TOP-001] Salle HeroQuest d'appartenance
  isChokePoint?: boolean;  // [SPEC-TOP-001] Défilé ou passage stratégique
  isWater: boolean;        // [SPEC-WAT-001]
  isShallowWater: boolean; // Gué franchissable
  isRiver: boolean;        // [SPEC-WAT-002]
  slope: number;           // Gradient max avec les 4 voisins orthogonaux
  isCliff: boolean;        // [SPEC-NAV-001] Infranchissable si pente trop forte
  prop: PropType | null;   // Élément décoratif / ressource
  walkable: boolean;       // [SPEC-NAV-001]
  clearance: number;       // [SPEC-NAV-002] Dégagement pour entités NxN
  buildable: boolean;      // [SPEC-BLD-002] Zone plate constructible
}

export interface MapExit {
  direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
  x: number;
  y: number;
  elevation: number;
  biome: BiomeType;
}

export type ObjectiveType = 'CAMP' | 'PIROGUE' | 'AIRSHIP' | 'SHELTER';

export type StructureType = 
  | 'STRUCTURE_CAMP' 
  | 'STRUCTURE_PIROGUE' 
  | 'STRUCTURE_AIRSHIP' 
  | 'STRUCTURE_PALISADE';

export interface StructureDefinition {
  type: StructureType;
  name: string;
  width: number;
  height: number;
  requiresWater?: boolean;
  minElevation?: number;
}

export interface PlacedBuilding {
  id: string;
  type: StructureType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapObjective {
  type: ObjectiveType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface GeneratedMap {
  seed: string;
  chunkX: number;
  chunkY: number;
  width: number;
  height: number;
  tiles: TileData[][];
  exits: MapExit[];
  heroSpawn: { x: number; y: number };
  objective: MapObjective;
  cataclysm: CataclysmFeature;
  rooms: FunctionalRoom[];
  generationDurationMs: number;
}

export interface MapGenOptions {
  seed?: string | number;
  chunkX?: number;
  chunkY?: number;
  activeBiomes?: BiomeType[];
  cataclysm?: CataclysmType;
  waterLevel?: number;
  thermalErosionPasses?: number;
  hydraulicDroplets?: number;
  roughness?: number;
  treeDensity?: number;
  terraceMode?: boolean;
  terraceSteps?: number;
}

