/**
 * Simulation Presets
 * Pre-configured scenarios for different simulation types
 */

import { Personality, Goal, AgentStats, AgentGenome } from '../schemas/types';
import { v4 as uuidv4 } from 'uuid';

export interface PresetConfig {
  name: string;
  description: string;
  worldWidth: number;
  worldHeight: number;
  resourceDensity: number;
  obstacleDensity: number;
  maxTurns: number;
  turnDuration: number;
  agentPersonalities: Personality[];
  globalGoals?: Goal[];
  initialGenomes?: AgentGenome[]; // Optional: Use evolved genomes instead of personality templates
}

/**
 * Cooperative Challenge Preset
 * Agents must work together to gather resources before time runs out
 */
export const COOPERATIVE_CHALLENGE: PresetConfig = {
  name: 'Cooperative Challenge',
  description: 'Agents must cooperate to gather 100 shared resources before turn 50',
  worldWidth: 20,
  worldHeight: 20,
  resourceDensity: 0.15,
  obstacleDensity: 0.1,
  maxTurns: 50,
  turnDuration: 2000,
  agentPersonalities: [
    {
      name: 'Team Leader',
      traits: {
        energy: 80,
        aggression: 20,
        cooperation: 90,
        riskTolerance: 50,
        curiosity: 60,
        empathy: 85,
      },
      description:
        'A natural leader who coordinates group efforts and motivates others. ' +
        'Highly cooperative and empathetic, focuses on team success.',
    },
    {
      name: 'Supportive Gatherer',
      traits: {
        energy: 70,
        aggression: 10,
        cooperation: 95,
        riskTolerance: 30,
        curiosity: 40,
        empathy: 90,
      },
      description:
        'Extremely cooperative and supportive. Focuses on resource gathering ' +
        'and sharing with those in need. Low aggression and high empathy.',
    },
    {
      name: 'Cautious Planner',
      traits: {
        energy: 75,
        aggression: 15,
        cooperation: 80,
        riskTolerance: 25,
        curiosity: 70,
        empathy: 75,
      },
      description:
        'Strategic thinker who plans ahead and avoids unnecessary risks. ' +
        'Cooperative but cautious, values efficiency and safety.',
    },
    {
      name: 'Energetic Explorer',
      traits: {
        energy: 90,
        aggression: 25,
        cooperation: 75,
        riskTolerance: 60,
        curiosity: 95,
        empathy: 70,
      },
      description:
        'High-energy explorer who discovers new resources and shares findings. ' +
        'Curious and willing to take risks for the team.',
    },
  ],
  globalGoals: [
    {
      id: uuidv4(),
      description: 'Collect 100 total resources as a team',
      priority: 'primary',
      completed: false,
    },
    {
      id: uuidv4(),
      description: 'Keep all team members alive',
      priority: 'secondary',
      completed: false,
    },
  ],
};

/**
 * Competitive Survival Preset
 * Every agent for themselves in a resource-scarce environment
 */
export const COMPETITIVE_SURVIVAL: PresetConfig = {
  name: 'Competitive Survival',
  description: 'Compete for scarce resources. Last agent standing wins.',
  worldWidth: 15,
  worldHeight: 15,
  resourceDensity: 0.08, // Very scarce
  obstacleDensity: 0.15,
  maxTurns: 100,
  turnDuration: 1500,
  agentPersonalities: [
    {
      name: 'Aggressive Survivor',
      traits: {
        energy: 85,
        aggression: 90,
        cooperation: 20,
        riskTolerance: 75,
        curiosity: 50,
        empathy: 15,
      },
      description:
        'Ruthless and aggressive. Will attack others for resources. ' +
        'Low empathy and cooperation, high aggression and risk tolerance.',
    },
    {
      name: 'Strategic Hoarder',
      traits: {
        energy: 70,
        aggression: 60,
        cooperation: 25,
        riskTolerance: 40,
        curiosity: 55,
        empathy: 20,
      },
      description:
        'Focuses on hoarding resources and avoiding fights until advantageous. ' +
        'Moderately aggressive, low cooperation.',
    },
    {
      name: 'Opportunistic Scavenger',
      traits: {
        energy: 80,
        aggression: 70,
        cooperation: 30,
        riskTolerance: 65,
        curiosity: 75,
        empathy: 25,
      },
      description:
        'Waits for opportunities to strike weakened opponents. ' +
        'High curiosity to find resources, moderate aggression.',
    },
    {
      name: 'Defensive Isolationist',
      traits: {
        energy: 75,
        aggression: 40,
        cooperation: 15,
        riskTolerance: 30,
        curiosity: 45,
        empathy: 30,
      },
      description:
        'Avoids conflict but will defend resources fiercely. ' +
        'Low cooperation, focuses on self-preservation.',
    },
  ],
  globalGoals: [
    {
      id: uuidv4(),
      description: 'Be the last agent alive',
      priority: 'primary',
      completed: false,
    },
    {
      id: uuidv4(),
      description: 'Accumulate the most resources',
      priority: 'secondary',
      completed: false,
    },
  ],
};

/**
 * Emergent Diplomacy Preset
 * Agents can negotiate, form alliances, and betray each other
 */
export const EMERGENT_DIPLOMACY: PresetConfig = {
  name: 'Emergent Diplomacy',
  description: 'Form alliances, negotiate, and navigate complex social dynamics',
  worldWidth: 25,
  worldHeight: 25,
  resourceDensity: 0.2,
  obstacleDensity: 0.08,
  maxTurns: 80,
  turnDuration: 2500,
  agentPersonalities: [
    {
      name: 'Master Diplomat',
      traits: {
        energy: 75,
        aggression: 30,
        cooperation: 85,
        riskTolerance: 45,
        curiosity: 70,
        empathy: 80,
      },
      description:
        'Skilled negotiator who forms beneficial alliances. ' +
        'High cooperation and empathy, seeks win-win solutions.',
    },
    {
      name: 'Cunning Manipulator',
      traits: {
        energy: 80,
        aggression: 50,
        cooperation: 60,
        riskTolerance: 70,
        curiosity: 75,
        empathy: 35,
      },
      description:
        'Forms alliances but may betray for personal gain. ' +
        'Moderate cooperation masks selfish intent.',
    },
    {
      name: 'Loyal Ally',
      traits: {
        energy: 70,
        aggression: 25,
        cooperation: 90,
        riskTolerance: 35,
        curiosity: 50,
        empathy: 95,
      },
      description:
        'Once allied, extremely loyal and supportive. ' +
        'High empathy and cooperation, values relationships.',
    },
    {
      name: 'Neutral Merchant',
      traits: {
        energy: 75,
        aggression: 40,
        cooperation: 70,
        riskTolerance: 50,
        curiosity: 65,
        empathy: 60,
      },
      description:
        'Willing to trade with anyone. Pragmatic and balanced. ' +
        'Seeks mutual benefit through commerce and negotiation.',
    },
    {
      name: 'Suspicious Loner',
      traits: {
        energy: 85,
        aggression: 55,
        cooperation: 40,
        riskTolerance: 45,
        curiosity: 60,
        empathy: 35,
      },
      description:
        'Distrusts others but can be convinced to cooperate. ' +
        'Requires proof of good intentions before allying.',
    },
    {
      name: 'Charismatic Leader',
      traits: {
        energy: 85,
        aggression: 45,
        cooperation: 80,
        riskTolerance: 55,
        curiosity: 70,
        empathy: 75,
      },
      description:
        'Attracts followers and builds coalitions. ' +
        'Strong leadership combined with genuine care for allies.',
    },
  ],
  globalGoals: [
    {
      id: uuidv4(),
      description: 'Form the largest alliance',
      priority: 'primary',
      completed: false,
    },
    {
      id: uuidv4(),
      description: 'Maintain peace for 20 consecutive turns',
      priority: 'secondary',
      completed: false,
    },
  ],
};

/**
 * Get preset by name
 */
export function getPreset(name: string): PresetConfig | null {
  const presets: Record<string, PresetConfig> = {
    cooperative: COOPERATIVE_CHALLENGE,
    competitive: COMPETITIVE_SURVIVAL,
    diplomatic: EMERGENT_DIPLOMACY,
  };

  return presets[name.toLowerCase()] || null;
}

/**
 * Get all preset names
 */
export function getAllPresetNames(): string[] {
  return ['cooperative', 'competitive', 'diplomatic'];
}

/**
 * Create agents from personality definitions
 */
export function createGoalsFromPersonality(personality: Personality): Goal[] {
  const goals: Goal[] = [];

  // Generate goals based on traits
  if (personality.traits.cooperation > 70) {
    goals.push({
      id: uuidv4(),
      description: 'Help allies succeed',
      priority: 'primary',
      completed: false,
    });
  }

  if (personality.traits.aggression > 70) {
    goals.push({
      id: uuidv4(),
      description: 'Eliminate threats',
      priority: 'primary',
      completed: false,
    });
  }

  if (personality.traits.curiosity > 70) {
    goals.push({
      id: uuidv4(),
      description: 'Explore the entire map',
      priority: 'secondary',
      completed: false,
    });
  }

  // Default goal
  goals.push({
    id: uuidv4(),
    description: 'Survive and thrive',
    priority: goals.length === 0 ? 'primary' : 'secondary',
    completed: false,
  });

  return goals;
}
