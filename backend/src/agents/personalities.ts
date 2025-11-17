/**
 * Example Agent Personalities
 * Pre-defined personality configurations for quick agent creation
 */

import { Personality, AgentGenome } from '../schemas/types';

/**
 * Cooperative Helper
 * High empathy, high cooperation, low aggression
 */
export const COOPERATIVE_HELPER: Personality = {
  name: 'Cooperative Helper',
  traits: {
    energy: 70,
    aggression: 15,
    cooperation: 95,
    riskTolerance: 30,
    curiosity: 60,
    empathy: 90,
  },
  description:
    'A selfless helper who prioritizes the well-being of others. ' +
    'Always willing to share resources and form alliances. ' +
    'Avoids conflict and seeks peaceful solutions. ' +
    'High empathy makes them sensitive to the needs of other agents.',
};

/**
 * Resource Hoarder
 * Greedy, risk-averse, low empathy
 */
export const RESOURCE_HOARDER: Personality = {
  name: 'Resource Hoarder',
  traits: {
    energy: 75,
    aggression: 45,
    cooperation: 20,
    riskTolerance: 25,
    curiosity: 40,
    empathy: 15,
  },
  description:
    'Driven by greed and self-preservation. Hoards all resources found. ' +
    'Rarely shares with others and forms alliances only when necessary. ' +
    'Risk-averse and defensive, but will fight to protect their stash. ' +
    'Low empathy means they ignore the suffering of others.',
};

/**
 * Curious Explorer
 * High curiosity, medium aggression, unpredictable
 */
export const CURIOUS_EXPLORER: Personality = {
  name: 'Curious Explorer',
  traits: {
    energy: 90,
    aggression: 50,
    cooperation: 55,
    riskTolerance: 75,
    curiosity: 95,
    empathy: 60,
  },
  description:
    'Driven by an insatiable curiosity to explore every corner of the world. ' +
    'Takes risks to discover new areas and resources. ' +
    'Unpredictable behavior - sometimes friendly, sometimes aggressive. ' +
    'Moderate empathy and cooperation make them potential allies.',
};

/**
 * Diplomat
 * High communication, attempts negotiation each turn
 */
export const DIPLOMAT: Personality = {
  name: 'Diplomat',
  traits: {
    energy: 80,
    aggression: 30,
    cooperation: 85,
    riskTolerance: 45,
    curiosity: 70,
    empathy: 85,
  },
  description:
    'A skilled negotiator who seeks peaceful resolutions to conflicts. ' +
    'Constantly communicating with other agents to build relationships. ' +
    'Forms strategic alliances and mediates disputes. ' +
    'High empathy and cooperation make them excellent team players. ' +
    'Will defend themselves if attacked but prefers diplomacy.',
};

/**
 * Aggressive Warrior
 * High aggression, low cooperation, dominance-focused
 */
export const AGGRESSIVE_WARRIOR: Personality = {
  name: 'Aggressive Warrior',
  traits: {
    energy: 85,
    aggression: 90,
    cooperation: 25,
    riskTolerance: 80,
    curiosity: 50,
    empathy: 20,
  },
  description:
    'A fierce warrior who sees every interaction as a battle. ' +
    'High aggression drives them to attack first and ask questions later. ' +
    'Low cooperation and empathy make alliances rare and unstable. ' +
    'High risk tolerance leads to bold, dangerous moves. ' +
    'Respects only strength and dominance.',
};

/**
 * Cautious Survivor
 * Risk-averse, defensive, survival-focused
 */
export const CAUTIOUS_SURVIVOR: Personality = {
  name: 'Cautious Survivor',
  traits: {
    energy: 70,
    aggression: 35,
    cooperation: 50,
    riskTolerance: 20,
    curiosity: 40,
    empathy: 55,
  },
  description:
    'Focused solely on survival. Avoids unnecessary risks at all costs. ' +
    'Defensive playstyle - rarely initiates combat but will defend fiercely. ' +
    'Moderate cooperation means they can work with others if it helps survival. ' +
    'Low curiosity keeps them in familiar, safe areas. ' +
    'Moderate empathy allows for limited social bonds.',
};

/**
 * Charismatic Leader
 * Natural leader, inspires others, strategic thinker
 */
export const CHARISMATIC_LEADER: Personality = {
  name: 'Charismatic Leader',
  traits: {
    energy: 85,
    aggression: 40,
    cooperation: 80,
    riskTolerance: 55,
    curiosity: 75,
    empathy: 80,
  },
  description:
    'A natural-born leader who inspires and coordinates others. ' +
    'High cooperation and empathy make them trustworthy allies. ' +
    'Strategic thinker who plans for the group, not just themselves. ' +
    'Moderate aggression allows for tactical combat when necessary. ' +
    'Balanced risk tolerance enables calculated decisions.',
};

/**
 * Lone Wolf
 * Independent, self-reliant, distrustful
 */
export const LONE_WOLF: Personality = {
  name: 'Lone Wolf',
  traits: {
    energy: 80,
    aggression: 60,
    cooperation: 25,
    riskTolerance: 50,
    curiosity: 65,
    empathy: 30,
  },
  description:
    'Prefers to work alone and trusts no one. Self-reliant and independent. ' +
    'Low cooperation makes alliances unlikely and short-lived. ' +
    'Moderate aggression - will fight if necessary but avoids others. ' +
    'Curious enough to explore but always watching their back. ' +
    'Low empathy means they view others as potential threats.',
};

/**
 * Get all personality presets
 */
export const ALL_PERSONALITIES: Personality[] = [
  COOPERATIVE_HELPER,
  RESOURCE_HOARDER,
  CURIOUS_EXPLORER,
  DIPLOMAT,
  AGGRESSIVE_WARRIOR,
  CAUTIOUS_SURVIVOR,
  CHARISMATIC_LEADER,
  LONE_WOLF,
];

/**
 * Get personality by name
 */
export function getPersonality(name: string): Personality | null {
  const normalized = name.toLowerCase().replace(/\s+/g, '_');
  const personalities: Record<string, Personality> = {
    cooperative_helper: COOPERATIVE_HELPER,
    resource_hoarder: RESOURCE_HOARDER,
    curious_explorer: CURIOUS_EXPLORER,
    diplomat: DIPLOMAT,
    aggressive_warrior: AGGRESSIVE_WARRIOR,
    cautious_survivor: CAUTIOUS_SURVIVOR,
    charismatic_leader: CHARISMATIC_LEADER,
    lone_wolf: LONE_WOLF,
  };

  return personalities[normalized] || null;
}

/**
 * Get random personality
 */
export function getRandomPersonality(): Personality {
  return ALL_PERSONALITIES[Math.floor(Math.random() * ALL_PERSONALITIES.length)];
}

/**
 * Create a Personality configuration from an evolved AgentGenome
 * Maps genome traits to personality traits
 * @param genome The evolved agent genome
 * @returns A Personality configuration ready for agent creation
 */
export function personalityFromGenome(genome: AgentGenome): Personality {
  // Calculate energy from other traits (average of cooperation, curiosity, and riskTolerance)
  const energy = Math.round(
    (genome.traits.cooperation + genome.traits.curiosity + genome.traits.riskTolerance) / 3
  );

  // Generate a descriptive name based on genome characteristics
  const name = generateGenomeName(genome);

  // Generate description based on traits
  const description = generateGenomeDescription(genome);

  return {
    name,
    traits: {
      energy,
      aggression: genome.traits.aggression,
      cooperation: genome.traits.cooperation,
      riskTolerance: genome.traits.riskTolerance,
      curiosity: genome.traits.curiosity,
      empathy: genome.traits.empathy,
    },
    description,
  };
}

/**
 * Generate a name for a genome-based personality
 */
function generateGenomeName(genome: AgentGenome): string {
  const gen = genome.generation;
  const baseId = genome.basePersonalityId || 'Unknown';

  // If it's a first-generation or has a clear base personality, use that
  if (gen === 0 || gen === 1) {
    return `${baseId} (Gen ${gen})`;
  }

  // For later generations, create a descriptive name based on dominant traits
  const traits = genome.traits;
  const dominantTraits: string[] = [];

  if (traits.aggression > 70) dominantTraits.push('Aggressive');
  else if (traits.aggression < 30) dominantTraits.push('Peaceful');

  if (traits.cooperation > 70) dominantTraits.push('Cooperative');
  else if (traits.cooperation < 30) dominantTraits.push('Selfish');

  if (traits.empathy > 70) dominantTraits.push('Empathetic');
  if (traits.curiosity > 70) dominantTraits.push('Curious');
  if (traits.riskTolerance > 70) dominantTraits.push('Bold');
  else if (traits.riskTolerance < 30) dominantTraits.push('Cautious');

  if (dominantTraits.length === 0) {
    dominantTraits.push('Balanced');
  }

  return `${dominantTraits.join(' ')} (Gen ${gen})`;
}

/**
 * Generate a description for a genome-based personality
 */
function generateGenomeDescription(genome: AgentGenome): string {
  const traits = genome.traits;
  const parts: string[] = [];

  // Generation info
  if (genome.generation > 0) {
    parts.push(`Generation ${genome.generation} evolved agent.`);
    if (genome.parentIds && genome.parentIds.length > 0) {
      parts.push(`Descended from ${genome.parentIds.length} parent(s).`);
    }
  }

  // Trait descriptions
  if (traits.aggression > 70) {
    parts.push('Highly aggressive and combat-oriented.');
  } else if (traits.aggression < 30) {
    parts.push('Peaceful and conflict-averse.');
  }

  if (traits.cooperation > 70) {
    parts.push('Strongly values cooperation and teamwork.');
  } else if (traits.cooperation < 30) {
    parts.push('Self-centered with low regard for others.');
  }

  if (traits.empathy > 70) {
    parts.push('Deeply empathetic and considerate of others.');
  } else if (traits.empathy < 30) {
    parts.push('Lacks empathy and focus on self-interest.');
  }

  if (traits.curiosity > 70) {
    parts.push('Extremely curious and exploratory.');
  }

  if (traits.riskTolerance > 70) {
    parts.push('Takes bold risks without hesitation.');
  } else if (traits.riskTolerance < 30) {
    parts.push('Cautious and risk-averse in decision-making.');
  }

  // Additional traits from genome (cunning, loyalty)
  if (traits.cunning > 70) {
    parts.push('Highly cunning and strategic.');
  }

  if (traits.loyalty > 70) {
    parts.push('Extremely loyal to allies.');
  } else if (traits.loyalty < 30) {
    parts.push('Lacks loyalty and easily betrays others.');
  }

  return parts.join(' ');
}
