/**
 * Culture Packs
 * High-level scenario descriptors that define cultural biases, laws, and beliefs
 */

/**
 * Cultural trait biases that influence agent personalities and faction behavior
 */
export interface CultureTraits {
  aggressionBias: number; // -50 to +50: adjustment to base aggression
  cooperationBias: number; // -50 to +50: adjustment to base cooperation
  lawfulnessBias: number; // 0 to 100: tendency to create/enforce laws
  religiosityBias: number; // 0 to 100: tendency to form beliefs/rituals
  explorationBias: number; // -50 to +50: adjustment to curiosity
}

/**
 * A culture pack defining a thematic cultural identity
 */
export interface CulturePack {
  id: string;
  name: string;
  description: string;
  defaultTraits: CultureTraits;
  defaultLaws: string[]; // Law type identifiers or descriptions
  startingBeliefs?: string[]; // Myth/belief templates
  resourcePreferences?: string[]; // Preferred resources: "food", "water", "material"
  dialectVariantBias?: Record<string, string[]>; // Preferred language variants
}

/**
 * Culture Pack Registry
 * Defines pre-configured cultural themes for simulations
 */
export const CULTURE_PACKS: CulturePack[] = [
  {
    id: 'neutral',
    name: 'Neutral (Default)',
    description: 'No cultural biases. Agents develop organically based on experiences.',
    defaultTraits: {
      aggressionBias: 0,
      cooperationBias: 0,
      lawfulnessBias: 50,
      religiosityBias: 50,
      explorationBias: 0,
    },
    defaultLaws: [],
    resourcePreferences: ['food', 'water', 'material'],
  },

  {
    id: 'warrior_culture',
    name: 'Warrior Culture',
    description:
      'Honor-bound warriors who value strength, combat prowess, and personal glory. Hierarchical society with strict codes of conduct.',
    defaultTraits: {
      aggressionBias: 30,
      cooperationBias: -10,
      lawfulnessBias: 70,
      religiosityBias: 60,
      explorationBias: 10,
    },
    defaultLaws: ['NO_BETRAYAL', 'TRIBUTE_TO_LEADER', 'MUTUAL_DEFENSE'],
    startingBeliefs: [
      'The Way of Steel',
      'Honor Above All',
      'Victory Through Strength',
    ],
    resourcePreferences: ['material', 'food', 'water'],
    dialectVariantBias: {
      attack: ['strike', 'clash', 'engage', 'assault'],
      honor: ['glory', 'valor', 'prestige', 'renown'],
      leader: ['warlord', 'commander', 'chief'],
      enemy: ['foe', 'adversary', 'rival'],
    },
  },

  {
    id: 'merchant_guild',
    name: 'Merchant Guild',
    description:
      'Trade-focused society valuing commerce, negotiation, and mutual benefit. Peaceful but shrewd.',
    defaultTraits: {
      aggressionBias: -20,
      cooperationBias: 30,
      lawfulnessBias: 80,
      religiosityBias: 30,
      explorationBias: 20,
    },
    defaultLaws: ['RESOURCE_SHARING', 'FAIR_TRADE', 'NO_ATTACK'],
    startingBeliefs: ['The Merchant\'s Code', 'Prosperity Through Exchange'],
    resourcePreferences: ['material', 'water', 'food'],
    dialectVariantBias: {
      trade: ['commerce', 'exchange', 'barter', 'deal'],
      ally: ['partner', 'associate', 'confederate'],
      material: ['goods', 'wares', 'stock', 'merchandise'],
      water: ['commodity', 'resource'],
    },
  },

  {
    id: 'monastic_order',
    name: 'Monastic Order',
    description:
      'Deeply religious and contemplative society. Peaceful, lawful, and focused on spiritual enlightenment.',
    defaultTraits: {
      aggressionBias: -30,
      cooperationBias: 40,
      lawfulnessBias: 90,
      religiosityBias: 95,
      explorationBias: -10,
    },
    defaultLaws: ['NO_ATTACK', 'RESOURCE_SHARING', 'COOPERATION_REQUIRED'],
    startingBeliefs: [
      'The Path of Enlightenment',
      'Sacred Harmony',
      'Unity of Spirit',
    ],
    resourcePreferences: ['food', 'water', 'material'],
    dialectVariantBias: {
      peace: ['serenity', 'harmony', 'tranquility'],
      ally: ['brother', 'sister', 'kin'],
      faction: ['order', 'brotherhood', 'sect'],
      trust: ['faith', 'devotion', 'belief'],
    },
  },

  {
    id: 'nomadic_tribes',
    name: 'Nomadic Tribes',
    description:
      'Mobile, adaptable clans constantly seeking new resources. High exploration drive and loose social structures.',
    defaultTraits: {
      aggressionBias: 10,
      cooperationBias: 20,
      lawfulnessBias: 30,
      religiosityBias: 70,
      explorationBias: 40,
    },
    defaultLaws: ['RESOURCE_SHARING', 'PROTECTION_OF_TERRITORY'],
    startingBeliefs: ['The Wanderer\'s Creed', 'Spirits of the Land'],
    resourcePreferences: ['water', 'food', 'material'],
    dialectVariantBias: {
      territory: ['lands', 'grounds', 'range', 'domain'],
      faction: ['tribe', 'clan', 'family'],
      water: ['lifeblood', 'wellspring', 'essence'],
      exploration: ['wandering', 'journey', 'pilgrimage'],
    },
  },

  {
    id: 'imperial_dynasty',
    name: 'Imperial Dynasty',
    description:
      'Highly structured, hierarchical empire with strong central authority. Expansionist and law-driven.',
    defaultTraits: {
      aggressionBias: 20,
      cooperationBias: 10,
      lawfulnessBias: 95,
      religiosityBias: 50,
      explorationBias: 15,
    },
    defaultLaws: [
      'TRIBUTE_TO_LEADER',
      'STRICT_HIERARCHY',
      'TERRITORIAL_EXPANSION',
      'COOPERATION_REQUIRED',
    ],
    startingBeliefs: ['Divine Mandate', 'Imperial Order'],
    resourcePreferences: ['material', 'food', 'water'],
    dialectVariantBias: {
      leader: ['emperor', 'sovereign', 'majesty'],
      faction: ['empire', 'dynasty', 'realm'],
      territory: ['province', 'domain', 'dominion'],
      law: ['decree', 'edict', 'mandate'],
    },
  },

  {
    id: 'anarchist_collective',
    name: 'Anarchist Collective',
    description:
      'Decentralized, egalitarian society rejecting formal hierarchy. High cooperation but minimal laws.',
    defaultTraits: {
      aggressionBias: -10,
      cooperationBias: 40,
      lawfulnessBias: 20,
      religiosityBias: 30,
      explorationBias: 25,
    },
    defaultLaws: ['RESOURCE_SHARING', 'MUTUAL_AID'],
    startingBeliefs: ['Freedom and Solidarity', 'The Common Good'],
    resourcePreferences: ['food', 'water', 'material'],
    dialectVariantBias: {
      faction: ['collective', 'commune', 'cooperative'],
      leader: ['coordinator', 'facilitator', 'delegate'],
      ally: ['comrade', 'companion', 'fellow'],
      cooperation: ['solidarity', 'mutual aid', 'fellowship'],
    },
  },

  {
    id: 'technocratic_society',
    name: 'Technocratic Society',
    description:
      'Science and efficiency-driven culture valuing innovation, exploration, and resource optimization.',
    defaultTraits: {
      aggressionBias: -5,
      cooperationBias: 25,
      lawfulnessBias: 75,
      religiosityBias: 20,
      explorationBias: 35,
    },
    defaultLaws: ['RESOURCE_OPTIMIZATION', 'KNOWLEDGE_SHARING', 'INNOVATION_REWARD'],
    startingBeliefs: ['Progress Through Knowledge', 'The Rational Path'],
    resourcePreferences: ['material', 'water', 'food'],
    dialectVariantBias: {
      material: ['resources', 'assets', 'inventory', 'stock'],
      faction: ['institute', 'council', 'consortium'],
      leader: ['director', 'coordinator', 'administrator'],
      exploration: ['research', 'investigation', 'analysis'],
    },
  },

  {
    id: 'pirate_confederacy',
    name: 'Pirate Confederacy',
    description:
      'Lawless raiders united by shared code. High aggression, moderate cooperation within the crew, low external trust.',
    defaultTraits: {
      aggressionBias: 35,
      cooperationBias: 15,
      lawfulnessBias: 35,
      religiosityBias: 40,
      explorationBias: 30,
    },
    defaultLaws: ['EQUAL_SHARES', 'CAPTAIN_AUTHORITY', 'NO_INTERNAL_BETRAYAL'],
    startingBeliefs: ['The Pirate Code', 'Freedom or Death'],
    resourcePreferences: ['food', 'water', 'material'],
    dialectVariantBias: {
      faction: ['crew', 'fleet', 'company'],
      leader: ['captain', 'admiral', 'boss'],
      attack: ['raid', 'plunder', 'storm'],
      material: ['loot', 'booty', 'plunder', 'treasure'],
    },
  },

  {
    id: 'druidic_circle',
    name: 'Druidic Circle',
    description:
      'Nature-worshipping mystics focused on balance, harmony with the land, and cyclical renewal.',
    defaultTraits: {
      aggressionBias: -15,
      cooperationBias: 35,
      lawfulnessBias: 60,
      religiosityBias: 90,
      explorationBias: 5,
    },
    defaultLaws: ['PROTECT_NATURE', 'RESOURCE_CONSERVATION', 'SEASONAL_RITUALS'],
    startingBeliefs: [
      'Cycle of Seasons',
      'Spirits of the Forest',
      'Balance of All Things',
    ],
    resourcePreferences: ['water', 'food', 'material'],
    dialectVariantBias: {
      faction: ['circle', 'grove', 'assembly'],
      leader: ['elder', 'archdruid', 'sage'],
      water: ['essence', 'flow', 'spring'],
      food: ['bounty', 'harvest', 'gift'],
    },
  },
];

/**
 * Get a culture pack by ID
 */
export function getCulturePack(id: string): CulturePack | null {
  return CULTURE_PACKS.find((pack) => pack.id === id) || null;
}

/**
 * Get all culture packs
 */
export function getAllCulturePacks(): CulturePack[] {
  return CULTURE_PACKS;
}

/**
 * Apply culture pack trait biases to base agent stats
 */
export function applyCultureTraits(
  baseStats: {
    aggression: number;
    cooperation: number;
    curiosity: number;
    [key: string]: number;
  },
  culturePack: CulturePack
): typeof baseStats {
  const adjusted = { ...baseStats };

  // Apply biases with bounds checking (0-100)
  adjusted.aggression = Math.max(
    0,
    Math.min(100, baseStats.aggression + culturePack.defaultTraits.aggressionBias)
  );
  adjusted.cooperation = Math.max(
    0,
    Math.min(100, baseStats.cooperation + culturePack.defaultTraits.cooperationBias)
  );

  if ('curiosity' in adjusted) {
    adjusted.curiosity = Math.max(
      0,
      Math.min(100, baseStats.curiosity + culturePack.defaultTraits.explorationBias)
    );
  }

  return adjusted;
}

/**
 * Check if a culture pack should create a law of a given type
 * Based on lawfulnessBias and default laws
 */
export function shouldCreateLaw(
  culturePack: CulturePack,
  lawType: string
): boolean {
  // Always create laws in the default list
  if (culturePack.defaultLaws.includes(lawType)) {
    return true;
  }

  // Otherwise, use lawfulness bias as probability
  const threshold = culturePack.defaultTraits.lawfulnessBias;
  return Math.random() * 100 < threshold;
}

/**
 * Check if a culture pack should create a belief
 * Based on religiosityBias
 */
export function shouldCreateBelief(culturePack: CulturePack): boolean {
  const threshold = culturePack.defaultTraits.religiosityBias;
  return Math.random() * 100 < threshold;
}

/**
 * Get starting belief templates from culture pack
 */
export function getStartingBeliefs(culturePack: CulturePack): string[] {
  return culturePack.startingBeliefs || [];
}
