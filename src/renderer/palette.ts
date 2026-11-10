/**
 * [SPEC-RND-002] Palette de couleurs Zelda BotW & Warcraft III
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { BiomeType } from '../core/types';

export interface BiomePalette {
  groundLow: Color3;
  groundHigh: Color3;
  rock: Color3;
  accent: Color3;
}

export const BIOME_PALETTES: Record<BiomeType, BiomePalette> = {
  PLAINS: {
    groundLow: Color3.FromHexString('#5fa338'),   // Vert herbe fraîche BotW
    groundHigh: Color3.FromHexString('#86cf4c'),  // Vert clair zénithal
    rock: Color3.FromHexString('#878278'),        // Calcaire doux
    accent: Color3.FromHexString('#e6c86e')       // Fleurs bouton d'or
  },
  FOREST: {
    groundLow: Color3.FromHexString('#6b4226'),   // Humus d'automne
    groundHigh: Color3.FromHexString('#c26a2b'),  // Ocre rouille
    rock: Color3.FromHexString('#59524b'),        // Granit sombre
    accent: Color3.FromHexString('#d94d26')       // Feuilles flamboyantes
  },
  HIGHLANDS: {
    groundLow: Color3.FromHexString('#948b7b'),   // Terre pierreuse
    groundHigh: Color3.FromHexString('#b5aa98'),  // Plateau aride Warcraft III
    rock: Color3.FromHexString('#57525e'),        // Ardoise et falaise abrupte
    accent: Color3.FromHexString('#d4b479')       // Herbe sèche de steppe
  },
  SWAMP: {
    groundLow: Color3.FromHexString('#2f4233'),   // Vase tourbeuse
    groundHigh: Color3.FromHexString('#44614b'),  // Mousse sombre
    rock: Color3.FromHexString('#3a3d3c'),        // Pierre humide recouverte de lichens
    accent: Color3.FromHexString('#3c7873')       // Joncs et saules
  }
};

export const COMMON_COLORS = {
  WATER_SURFACE: Color3.FromHexString('#2db8b8'), // Eau turquoise cristalline
  WATER_SHALLOW: Color3.FromHexString('#42d4cf'), // Gué peu profond
  WATER_DEEP: Color3.FromHexString('#166b73'),    // Eau profonde
  ROCK_SLAB: Color3.FromHexString('#1a1a22'),     // Tranche géologique socle sous-terrain
  PATH_WAY: Color3.FromHexString('#d6ae74'),      // Sentier battu
  CLIFF_EDGE: Color3.FromHexString('#423e47'),    // Ligne de crête falaise
  HERO_COLOR: Color3.FromHexString('#3b82f6'),    // Bleu azur du héros
  HERO_ACCENT: Color3.FromHexString('#fbbf24'),   // Or / doré
  OBJECTIVE_COLOR: Color3.FromHexString('#ef4444'),// Rouge balise objectif
  PATH_RIBBON: Color3.FromHexString('#38bdf8'),   // Tracé de pathfinding 2x2
  // Lithologie [SPEC-GEO-005]
  LITHO_GRANITE: Color3.FromHexString('#4a4752'),
  LITHO_SANDSTONE: Color3.FromHexString('#b88e58'),
  LITHO_ALLUVIUM: Color3.FromHexString('#5c853e'),
  LITHO_VOLCANIC: Color3.FromHexString('#241d21'),
  LITHO_METEORIC: Color3.FromHexString('#2a5578'),
  // Cataclysme accents
  LAVA_GLOW: Color3.FromHexString('#e04b16'),
  METEOR_CORE: Color3.FromHexString('#00f2fe')
};

