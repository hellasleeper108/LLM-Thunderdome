/**
 * Faction Manager
 * Manages higher-level social structures (factions) that agents can belong to
 */

import { BaseAgent } from '../agents/BaseAgent';
import { v4 as uuidv4 } from 'uuid';

export interface Faction {
  id: string;
  name: string;
  description?: string;
  members: Set<string>; // agentIds
  resources: {
    food: number;
    water: number;
    materials: number;
  };
  cohesion: number; // 0-1 (how unified the faction is)
  aggression: number; // 0-100 (faction's overall aggression stance)
  diplomacy: number; // 0-100 (faction's diplomatic tendency)
  laws: string[]; // IDs of laws this faction enforces
  founded: number; // Turn when faction was created
  metadata?: Record<string, any>;
}

export class FactionManager {
  private factions: Map<string, Faction>;
  private agentToFaction: Map<string, string>; // agentId -> factionId

  constructor() {
    this.factions = new Map();
    this.agentToFaction = new Map();
  }

  /**
   * Create a new faction
   */
  createFaction(
    name: string,
    initialMembers: BaseAgent[],
    options?: {
      description?: string;
      initialResources?: { food?: number; water?: number; materials?: number };
      aggression?: number;
      diplomacy?: number;
      founded?: number;
    }
  ): Faction {
    const factionId = uuidv4();

    // Calculate initial cohesion based on member similarity
    const cohesion = this.calculateInitialCohesion(initialMembers);

    // Calculate faction-level stats from member averages
    const avgAggression = initialMembers.length > 0
      ? initialMembers.reduce((sum, agent) => sum + agent.getState().stats.aggression, 0) / initialMembers.length
      : 50;

    const avgDiplomacy = initialMembers.length > 0
      ? initialMembers.reduce((sum, agent) => sum + agent.getState().stats.cooperation, 0) / initialMembers.length
      : 50;

    const faction: Faction = {
      id: factionId,
      name,
      description: options?.description || `A faction of ${initialMembers.length} members`,
      members: new Set(initialMembers.map(agent => agent.getState().id)),
      resources: {
        food: options?.initialResources?.food || 0,
        water: options?.initialResources?.water || 0,
        materials: options?.initialResources?.materials || 0,
      },
      cohesion,
      aggression: options?.aggression ?? avgAggression,
      diplomacy: options?.diplomacy ?? avgDiplomacy,
      laws: [],
      founded: options?.founded || 0,
      metadata: {},
    };

    this.factions.set(factionId, faction);

    // Map agents to faction
    initialMembers.forEach(agent => {
      this.agentToFaction.set(agent.getState().id, factionId);
    });

    console.log(`[FactionManager] Created faction "${name}" with ${initialMembers.length} members (cohesion: ${cohesion.toFixed(2)})`);

    return faction;
  }

  /**
   * Create a faction from agent IDs (useful when you don't have BaseAgent objects)
   */
  createFactionFromIds(
    name: string,
    memberIds: string[],
    options?: {
      description?: string;
      initialResources?: { food?: number; water?: number; materials?: number };
      aggression?: number;
      diplomacy?: number;
      cohesion?: number;
      founded?: number;
    }
  ): Faction {
    const factionId = uuidv4();

    const faction: Faction = {
      id: factionId,
      name,
      description: options?.description || `A faction of ${memberIds.length} members`,
      members: new Set(memberIds),
      resources: {
        food: options?.initialResources?.food || 0,
        water: options?.initialResources?.water || 0,
        materials: options?.initialResources?.materials || 0,
      },
      cohesion: options?.cohesion || 0.7, // Default moderate cohesion
      aggression: options?.aggression || 50,
      diplomacy: options?.diplomacy || 50,
      laws: [],
      founded: options?.founded || 0,
      metadata: {},
    };

    this.factions.set(factionId, faction);

    // Map agents to faction
    memberIds.forEach(agentId => {
      this.agentToFaction.set(agentId, factionId);
    });

    console.log(`[FactionManager] Created faction "${name}" with ${memberIds.length} members (cohesion: ${faction.cohesion.toFixed(2)})`);

    return faction;
  }

  /**
   * Add a member to a faction
   */
  addMember(factionId: string, agent: BaseAgent): boolean {
    const faction = this.factions.get(factionId);
    if (!faction) {
      console.warn(`[FactionManager] Faction ${factionId} not found`);
      return false;
    }

    const agentId = agent.getState().id;

    // Check if agent is already in another faction
    const currentFaction = this.agentToFaction.get(agentId);
    if (currentFaction) {
      console.warn(`[FactionManager] Agent ${agent.getState().name} is already in faction ${currentFaction}`);
      return false;
    }

    // Add to faction
    faction.members.add(agentId);
    this.agentToFaction.set(agentId, factionId);

    // Recalculate cohesion (new member may affect unity)
    this.recalculateCohesion(factionId);

    console.log(`[FactionManager] Added ${agent.getState().name} to faction "${faction.name}"`);

    return true;
  }

  /**
   * Remove a member from a faction
   */
  removeMember(factionId: string, agent: BaseAgent): boolean {
    const faction = this.factions.get(factionId);
    if (!faction) {
      console.warn(`[FactionManager] Faction ${factionId} not found`);
      return false;
    }

    const agentId = agent.getState().id;

    if (!faction.members.has(agentId)) {
      console.warn(`[FactionManager] Agent ${agent.getState().name} is not in faction "${faction.name}"`);
      return false;
    }

    // Remove from faction
    faction.members.delete(agentId);
    this.agentToFaction.delete(agentId);

    // If faction is empty, consider disbanding
    if (faction.members.size === 0) {
      console.log(`[FactionManager] Faction "${faction.name}" is now empty`);
      // Optional: auto-disband or mark as inactive
    } else {
      // Recalculate cohesion
      this.recalculateCohesion(factionId);
    }

    console.log(`[FactionManager] Removed ${agent.getState().name} from faction "${faction.name}"`);

    return true;
  }

  /**
   * Transfer resources to/from faction
   */
  transferResource(
    factionId: string,
    type: 'food' | 'water' | 'materials',
    delta: number
  ): boolean {
    const faction = this.factions.get(factionId);
    if (!faction) {
      console.warn(`[FactionManager] Faction ${factionId} not found`);
      return false;
    }

    // Update resource
    faction.resources[type] += delta;

    // Prevent negative resources
    if (faction.resources[type] < 0) {
      faction.resources[type] = 0;
    }

    console.log(`[FactionManager] Faction "${faction.name}" ${type}: ${delta > 0 ? '+' : ''}${delta} (total: ${faction.resources[type]})`);

    return true;
  }

  /**
   * Update faction cohesion
   */
  updateCohesion(factionId: string, delta: number): boolean {
    const faction = this.factions.get(factionId);
    if (!faction) {
      console.warn(`[FactionManager] Faction ${factionId} not found`);
      return false;
    }

    faction.cohesion = Math.max(0, Math.min(1, faction.cohesion + delta));

    console.log(`[FactionManager] Faction "${faction.name}" cohesion: ${delta > 0 ? '+' : ''}${delta.toFixed(3)} (now: ${faction.cohesion.toFixed(3)})`);

    return true;
  }

  /**
   * Get faction by agent ID
   */
  getFactionByAgent(agentId: string): Faction | null {
    const factionId = this.agentToFaction.get(agentId);
    if (!factionId) {
      return null;
    }

    return this.factions.get(factionId) || null;
  }

  /**
   * Get faction by ID
   */
  getFaction(factionId: string): Faction | null {
    return this.factions.get(factionId) || null;
  }

  /**
   * List all factions
   */
  listFactions(): Faction[] {
    return Array.from(this.factions.values());
  }

  /**
   * Check if two agents are in the same faction
   */
  areSameFaction(agentId1: string, agentId2: string): boolean {
    const faction1 = this.agentToFaction.get(agentId1);
    const faction2 = this.agentToFaction.get(agentId2);

    return faction1 !== undefined && faction1 === faction2;
  }

  /**
   * Add a law to a faction
   */
  addLaw(factionId: string, lawId: string): boolean {
    const faction = this.factions.get(factionId);
    if (!faction) {
      console.warn(`[FactionManager] Faction ${factionId} not found`);
      return false;
    }

    if (!faction.laws.includes(lawId)) {
      faction.laws.push(lawId);
      console.log(`[FactionManager] Added law ${lawId} to faction "${faction.name}"`);
      return true;
    }

    return false;
  }

  /**
   * Remove a law from a faction
   */
  removeLaw(factionId: string, lawId: string): boolean {
    const faction = this.factions.get(factionId);
    if (!faction) {
      console.warn(`[FactionManager] Faction ${factionId} not found`);
      return false;
    }

    const index = faction.laws.indexOf(lawId);
    if (index !== -1) {
      faction.laws.splice(index, 1);
      console.log(`[FactionManager] Removed law ${lawId} from faction "${faction.name}"`);
      return true;
    }

    return false;
  }

  /**
   * Disband a faction
   */
  disbandFaction(factionId: string): boolean {
    const faction = this.factions.get(factionId);
    if (!faction) {
      console.warn(`[FactionManager] Faction ${factionId} not found`);
      return false;
    }

    // Remove all agent mappings
    faction.members.forEach(agentId => {
      this.agentToFaction.delete(agentId);
    });

    // Remove faction
    this.factions.delete(factionId);

    console.log(`[FactionManager] Disbanded faction "${faction.name}"`);

    return true;
  }

  /**
   * Calculate initial cohesion based on member personality similarity
   */
  private calculateInitialCohesion(members: BaseAgent[]): number {
    if (members.length === 0) {
      return 1.0;
    }

    if (members.length === 1) {
      return 1.0;
    }

    // Calculate variance in key stats (lower variance = higher cohesion)
    const aggressions = members.map(a => a.getState().stats.aggression);
    const cooperations = members.map(a => a.getState().stats.cooperation);
    const empathies = members.map(a => a.getState().stats.empathy);

    const avgAggression = aggressions.reduce((sum, v) => sum + v, 0) / aggressions.length;
    const avgCooperation = cooperations.reduce((sum, v) => sum + v, 0) / cooperations.length;
    const avgEmpathy = empathies.reduce((sum, v) => sum + v, 0) / empathies.length;

    const varianceAggression = aggressions.reduce((sum, v) => sum + Math.pow(v - avgAggression, 2), 0) / aggressions.length;
    const varianceCooperation = cooperations.reduce((sum, v) => sum + Math.pow(v - avgCooperation, 2), 0) / cooperations.length;
    const varianceEmpathy = empathies.reduce((sum, v) => sum + Math.pow(v - avgEmpathy, 2), 0) / empathies.length;

    // Average variance (0-10000, since stats are 0-100)
    const avgVariance = (varianceAggression + varianceCooperation + varianceEmpathy) / 3;

    // Convert to cohesion (0-1), where low variance = high cohesion
    // Max variance would be ~2500 (half agents at 0, half at 100)
    const cohesion = Math.max(0, Math.min(1, 1 - (avgVariance / 2500)));

    return cohesion;
  }

  /**
   * Recalculate faction cohesion (called when membership changes)
   */
  private recalculateCohesion(factionId: string): void {
    const faction = this.factions.get(factionId);
    if (!faction || faction.members.size === 0) {
      return;
    }

    // Note: This method needs agent references to recalculate
    // For now, just apply a small decay
    faction.cohesion = Math.max(0, faction.cohesion - 0.05);
  }

  /**
   * Get faction state for serialization
   */
  getState(): any {
    const factions = Array.from(this.factions.values()).map(f => ({
      ...f,
      members: Array.from(f.members), // Convert Set to Array
    }));

    return {
      factions,
      agentToFaction: Object.fromEntries(this.agentToFaction),
    };
  }

  /**
   * Restore faction state from serialization
   */
  setState(state: any): void {
    this.factions.clear();
    this.agentToFaction.clear();

    if (state.factions) {
      state.factions.forEach((factionData: any) => {
        const faction: Faction = {
          ...factionData,
          members: new Set(factionData.members), // Convert Array back to Set
        };
        this.factions.set(faction.id, faction);
      });
    }

    if (state.agentToFaction) {
      Object.entries(state.agentToFaction).forEach(([agentId, factionId]) => {
        this.agentToFaction.set(agentId, factionId as string);
      });
    }
  }
}
