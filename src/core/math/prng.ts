/**
 * [SPEC-GEO-001] PRNG Déterministe 32-bit (Mulberry32)
 * Garantit une reproductibilité bit-exacte entre Node.js et WebGL/Browser.
 */

export class PRNG {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : PRNG.hashString(seed);
  }

  /**
   * MurmurHash3 32-bit pour transformer n'importe quel string en seed entière.
   */
  public static hashString(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  /**
   * Génère un nombre pseudo-aléatoire dans [0, 1)
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Entier dans [min, max] inclus
   */
  public rangeInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Flottant dans [min, max)
   */
  public rangeFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Tire un élément au hasard dans un tableau
   */
  public pick<T>(array: readonly T[]): T {
    return array[this.rangeInt(0, array.length - 1)];
  }

  /**
   * Mélange un tableau en place (Fisher-Yates)
   */
  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
