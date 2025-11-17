/**
 * Language Engine
 * Manages evolving dialects and slang for faction-specific communication
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Entry in the lexicon mapping a base concept to variants
 */
export interface LexiconEntry {
  base: string; // Base concept: "food", "ally", "enemy", "attack", etc.
  variants: string[]; // Synonyms/slang for different factions/families
}

/**
 * Dialect for a specific faction
 */
export interface FactionDialect {
  factionId: string;
  lexicon: Record<string, LexiconEntry>; // Keyed by base concept
  mutationCount: number; // How many times this dialect has mutated
  lastMutation: number; // Turn when last mutation occurred
}

/**
 * Configuration for language evolution
 */
export interface LanguageConfig {
  mutationRate: number; // Probability of mutation per turn (0-1)
  variantsPerConcept: number; // Max variants to maintain per concept
  mergeBlendRate: number; // How much of dialect B to blend into A when merging (0-1)
}

/**
 * Base lexicon of common concepts
 * Each faction starts with these and evolves their own variants
 */
const BASE_LEXICON: Record<string, LexiconEntry> = {
  food: {
    base: 'food',
    variants: ['food', 'grub', 'sustenance', 'provisions', 'rations'],
  },
  water: {
    base: 'water',
    variants: ['water', 'hydration', 'aqua', 'fluid', 'drink'],
  },
  material: {
    base: 'material',
    variants: ['material', 'resources', 'supplies', 'goods', 'stock'],
  },
  ally: {
    base: 'ally',
    variants: ['ally', 'friend', 'comrade', 'partner', 'companion'],
  },
  enemy: {
    base: 'enemy',
    variants: ['enemy', 'foe', 'adversary', 'rival', 'opponent'],
  },
  attack: {
    base: 'attack',
    variants: ['attack', 'strike', 'assault', 'engage', 'clash'],
  },
  defend: {
    base: 'defend',
    variants: ['defend', 'protect', 'guard', 'shield', 'secure'],
  },
  trade: {
    base: 'trade',
    variants: ['trade', 'exchange', 'barter', 'swap', 'deal'],
  },
  alliance: {
    base: 'alliance',
    variants: ['alliance', 'pact', 'coalition', 'bond', 'union'],
  },
  faction: {
    base: 'faction',
    variants: ['faction', 'group', 'clan', 'tribe', 'house'],
  },
  leader: {
    base: 'leader',
    variants: ['leader', 'chief', 'boss', 'commander', 'head'],
  },
  territory: {
    base: 'territory',
    variants: ['territory', 'land', 'domain', 'realm', 'turf'],
  },
  danger: {
    base: 'danger',
    variants: ['danger', 'threat', 'peril', 'hazard', 'risk'],
  },
  peace: {
    base: 'peace',
    variants: ['peace', 'calm', 'truce', 'harmony', 'rest'],
  },
  war: {
    base: 'war',
    variants: ['war', 'conflict', 'battle', 'combat', 'strife'],
  },
  trust: {
    base: 'trust',
    variants: ['trust', 'faith', 'confidence', 'belief', 'reliance'],
  },
  betrayal: {
    base: 'betrayal',
    variants: ['betrayal', 'treachery', 'deception', 'backstab', 'disloyalty'],
  },
  honor: {
    base: 'honor',
    variants: ['honor', 'respect', 'dignity', 'prestige', 'glory'],
  },
  survival: {
    base: 'survival',
    variants: ['survival', 'endurance', 'persistence', 'resilience', 'fortitude'],
  },
  victory: {
    base: 'victory',
    variants: ['victory', 'triumph', 'conquest', 'success', 'win'],
  },
};

/**
 * Pool of creative variant generators
 * Used to create new slang/dialect terms through mutation
 */
const VARIANT_GENERATORS: Record<string, string[]> = {
  food: ['chow', 'eats', 'vittles', 'fare', 'feed', 'nosh', 'bounty', 'harvest'],
  water: ['lifeblood', 'essence', 'nectar', 'flow', 'tide', 'spring', 'wellspring'],
  material: ['cache', 'hoard', 'stash', 'treasure', 'arsenal', 'stockpile'],
  ally: ['kin', 'brother', 'sister', 'cohort', 'confederate', 'blood', 'packmate'],
  enemy: ['hostile', 'aggressor', 'menace', 'scourge', 'plague', 'bane', 'nemesis'],
  attack: ['raid', 'charge', 'blitz', 'surge', 'onslaught', 'offensive', 'storm'],
  defend: ['fortify', 'hold', 'stand', 'wall', 'bulwark', 'bastion', 'rampart'],
  trade: ['commerce', 'haggle', 'negotiate', 'parley', 'transaction'],
  alliance: ['accord', 'compact', 'treaty', 'confederacy', 'league', 'fellowship'],
  faction: ['order', 'sect', 'family', 'dynasty', 'brotherhood', 'sisterhood'],
  leader: ['sovereign', 'warlord', 'elder', 'alpha', 'patriarch', 'matriarch'],
  territory: ['grounds', 'holdings', 'estate', 'province', 'region', 'zone'],
  danger: ['doom', 'curse', 'shadow', 'omen', 'blight', 'menace'],
  peace: ['serenity', 'sanctuary', 'respite', 'armistice', 'ceasefire'],
  war: ['carnage', 'bloodshed', 'warfare', 'crusade', 'campaign', 'struggle'],
  trust: ['loyalty', 'fidelity', 'allegiance', 'devotion', 'fealty'],
  betrayal: ['turncoat', 'duplicity', 'perfidy', 'treason', 'sedition'],
  honor: ['valor', 'nobility', 'virtue', 'integrity', 'renown'],
  survival: ['grit', 'tenacity', 'mettle', 'backbone', 'steel'],
  victory: ['dominance', 'supremacy', 'mastery', 'ascendancy', 'glory'],
};

/**
 * Language Engine
 * Manages faction-specific dialects and their evolution over time
 */
export class LanguageEngine {
  private dialects: Map<string, FactionDialect> = new Map();
  private config: LanguageConfig;
  private currentTurn: number = 0;

  constructor(config?: Partial<LanguageConfig>) {
    this.config = {
      mutationRate: config?.mutationRate ?? 0.1, // 10% chance per turn
      variantsPerConcept: config?.variantsPerConcept ?? 5,
      mergeBlendRate: config?.mergeBlendRate ?? 0.3, // 30% blend from other dialect
    };
  }

  /**
   * Initialize a dialect for a new faction
   */
  initializeFactionDialect(factionId: string): FactionDialect {
    // Deep copy base lexicon
    const lexicon: Record<string, LexiconEntry> = {};
    Object.entries(BASE_LEXICON).forEach(([concept, entry]) => {
      lexicon[concept] = {
        base: entry.base,
        variants: [...entry.variants], // Copy array
      };
    });

    const dialect: FactionDialect = {
      factionId,
      lexicon,
      mutationCount: 0,
      lastMutation: 0,
    };

    this.dialects.set(factionId, dialect);
    console.log(`[LanguageEngine] Initialized dialect for faction ${factionId}`);

    return dialect;
  }

  /**
   * Get a phrase/term for a concept, using faction's dialect if available
   */
  getPhrase(factionId: string | null, concept: string): string {
    // If no faction or concept not in base lexicon, return concept as-is
    if (!factionId || !BASE_LEXICON[concept]) {
      return concept;
    }

    const dialect = this.dialects.get(factionId);
    if (!dialect || !dialect.lexicon[concept]) {
      // No dialect or concept not in lexicon, use base
      return BASE_LEXICON[concept]?.base || concept;
    }

    // Get variants for this faction's dialect
    const variants = dialect.lexicon[concept].variants;

    // Return a random variant (biased toward first few = most common usage)
    // Weight: first variant has highest probability
    const weights = variants.map((_, i) => Math.pow(0.7, i)); // Exponential decay
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const random = Math.random() * totalWeight;

    let cumulative = 0;
    for (let i = 0; i < variants.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return variants[i];
      }
    }

    // Fallback (shouldn't reach here)
    return variants[0] || concept;
  }

  /**
   * Mutate a faction's dialect by introducing new variants
   */
  mutateDialect(factionId: string): void {
    const dialect = this.dialects.get(factionId);
    if (!dialect) {
      console.warn(`[LanguageEngine] No dialect found for faction ${factionId}`);
      return;
    }

    // Randomly select a concept to mutate
    const concepts = Object.keys(dialect.lexicon);
    if (concepts.length === 0) return;

    const concept = concepts[Math.floor(Math.random() * concepts.length)];
    const entry = dialect.lexicon[concept];

    // Choose mutation type
    const mutationType = Math.random();

    if (mutationType < 0.6) {
      // 60%: Add a new variant from the generator pool
      const generators = VARIANT_GENERATORS[concept];
      if (generators && generators.length > 0) {
        // Pick a variant not already in use
        const availableVariants = generators.filter(v => !entry.variants.includes(v));
        if (availableVariants.length > 0) {
          const newVariant = availableVariants[Math.floor(Math.random() * availableVariants.length)];
          entry.variants.push(newVariant);

          // Trim if exceeds max variants
          if (entry.variants.length > this.config.variantsPerConcept) {
            entry.variants.shift(); // Remove oldest variant
          }

          console.log(
            `[LanguageEngine] Faction ${factionId} adopted new word for "${concept}": "${newVariant}"`
          );
        }
      }
    } else if (mutationType < 0.85) {
      // 25%: Promote a variant to primary position (becomes most common)
      if (entry.variants.length > 1) {
        const randomIndex = 1 + Math.floor(Math.random() * (entry.variants.length - 1));
        const promoted = entry.variants.splice(randomIndex, 1)[0];
        entry.variants.unshift(promoted);

        console.log(
          `[LanguageEngine] Faction ${factionId} now prefers "${promoted}" for "${concept}"`
        );
      }
    } else {
      // 15%: Create a portmanteau/blend from two variants
      if (entry.variants.length >= 2) {
        const v1 = entry.variants[Math.floor(Math.random() * entry.variants.length)];
        const v2 = entry.variants[Math.floor(Math.random() * entry.variants.length)];

        if (v1 !== v2) {
          // Simple blend: first half of v1 + second half of v2
          const blend = v1.slice(0, Math.ceil(v1.length / 2)) + v2.slice(Math.floor(v2.length / 2));

          if (!entry.variants.includes(blend)) {
            entry.variants.push(blend);

            if (entry.variants.length > this.config.variantsPerConcept) {
              entry.variants.shift();
            }

            console.log(
              `[LanguageEngine] Faction ${factionId} created portmanteau "${blend}" from "${v1}" + "${v2}"`
            );
          }
        }
      }
    }

    dialect.mutationCount++;
    dialect.lastMutation = this.currentTurn;
  }

  /**
   * Merge two faction dialects (used when factions merge or form long alliances)
   * Blends dialect B into dialect A
   */
  mergeDialects(factionAId: string, factionBId: string): void {
    const dialectA = this.dialects.get(factionAId);
    const dialectB = this.dialects.get(factionBId);

    if (!dialectA || !dialectB) {
      console.warn(`[LanguageEngine] Cannot merge: missing dialect(s)`);
      return;
    }

    // For each concept, blend variants from B into A
    Object.keys(dialectA.lexicon).forEach(concept => {
      const entryA = dialectA.lexicon[concept];
      const entryB = dialectB.lexicon[concept];

      if (!entryB) return;

      // Take some variants from B and add to A
      const blendCount = Math.ceil(entryB.variants.length * this.config.mergeBlendRate);

      for (let i = 0; i < blendCount && i < entryB.variants.length; i++) {
        const variantB = entryB.variants[i];

        // Add if not already present
        if (!entryA.variants.includes(variantB)) {
          entryA.variants.push(variantB);
        }
      }

      // Trim if exceeds max variants
      while (entryA.variants.length > this.config.variantsPerConcept) {
        entryA.variants.shift();
      }
    });

    console.log(
      `[LanguageEngine] Merged dialect from faction ${factionBId} into ${factionAId} (blend rate: ${this.config.mergeBlendRate})`
    );
  }

  /**
   * Get all dialects
   */
  getAllDialects(): FactionDialect[] {
    return Array.from(this.dialects.values());
  }

  /**
   * Get dialect for a specific faction
   */
  getDialect(factionId: string): FactionDialect | null {
    return this.dialects.get(factionId) || null;
  }

  /**
   * Remove a faction's dialect (e.g., when faction is destroyed)
   */
  removeDialect(factionId: string): void {
    this.dialects.delete(factionId);
    console.log(`[LanguageEngine] Removed dialect for faction ${factionId}`);
  }

  /**
   * Update turn counter and trigger mutations based on mutation rate
   */
  advanceTurn(turn: number): void {
    this.currentTurn = turn;

    // Each faction has a chance to mutate this turn
    for (const dialect of this.dialects.values()) {
      if (Math.random() < this.config.mutationRate) {
        this.mutateDialect(dialect.factionId);
      }
    }
  }

  /**
   * Get statistics about language evolution
   */
  getStats() {
    const totalDialects = this.dialects.size;
    const totalMutations = Array.from(this.dialects.values()).reduce(
      (sum, d) => sum + d.mutationCount,
      0
    );

    const avgMutations = totalDialects > 0 ? totalMutations / totalDialects : 0;

    // Find most divergent dialect (most mutations)
    let mostDivergent: { factionId: string; mutations: number } | null = null;
    for (const dialect of this.dialects.values()) {
      if (!mostDivergent || dialect.mutationCount > mostDivergent.mutations) {
        mostDivergent = {
          factionId: dialect.factionId,
          mutations: dialect.mutationCount,
        };
      }
    }

    return {
      totalDialects,
      totalMutations,
      avgMutations,
      mostDivergent,
      currentTurn: this.currentTurn,
    };
  }
}

/**
 * Global language engine instance
 */
let globalLanguageEngine: LanguageEngine | null = null;

/**
 * Get the global language engine
 */
export function getLanguageEngine(): LanguageEngine {
  if (!globalLanguageEngine) {
    globalLanguageEngine = new LanguageEngine();
  }
  return globalLanguageEngine;
}

/**
 * Set the global language engine (for testing)
 */
export function setLanguageEngine(engine: LanguageEngine): void {
  globalLanguageEngine = engine;
}
