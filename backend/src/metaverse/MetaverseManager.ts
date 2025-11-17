/**
 * Metaverse Manager
 * Manages multiple persistent worlds and cross-world effects
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * A persistent world instance in the metaverse
 */
export interface WorldInstance {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
  seed: number;
  meta: {
    totalAgents?: number;
    activeSessions?: number;
    resourceAbundance?: Record<string, number>; // food, water, material
    dominantBeliefs?: string[];
    culturalInfluence?: number;
    [key: string]: any;
  };
}

/**
 * Link between two worlds enabling cross-world effects
 */
export interface WorldLink {
  id: string;
  fromWorldId: string;
  toWorldId: string;
  type: 'PORTAL' | 'TRADE_ROUTE' | 'WAR_FRONT' | 'SIGNAL_LINK';
  intensity: number; // 0-1, strength of the link
  createdAt: string;
  meta?: {
    direction?: 'bidirectional' | 'unidirectional';
    [key: string]: any;
  };
}

/**
 * Metaverse Manager
 * Orchestrates multiple persistent worlds and their interactions
 */
export class MetaverseManager {
  private worlds: Map<string, WorldInstance> = new Map();
  private links: Map<string, WorldLink> = new Map();
  private worldLinksIndex: Map<string, Set<string>> = new Map(); // worldId -> linkIds

  /**
   * Create a new world instance
   */
  createWorldInstance(name: string, seed?: number): WorldInstance {
    const worldSeed = seed ?? Math.floor(Math.random() * 1000000);

    const world: WorldInstance = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      seed: worldSeed,
      meta: {
        totalAgents: 0,
        activeSessions: 0,
        resourceAbundance: {
          food: 100,
          water: 100,
          material: 100,
        },
        dominantBeliefs: [],
        culturalInfluence: 50,
      },
    };

    this.worlds.set(world.id, world);
    console.log(`[MetaverseManager] Created world "${name}" (${world.id}) with seed ${worldSeed}`);

    return world;
  }

  /**
   * Get a world instance by ID
   */
  getWorld(worldId: string): WorldInstance | null {
    return this.worlds.get(worldId) || null;
  }

  /**
   * List all worlds
   */
  listWorlds(): WorldInstance[] {
    return Array.from(this.worlds.values());
  }

  /**
   * Update world metadata
   */
  updateWorld(worldId: string, updates: Partial<WorldInstance>): void {
    const world = this.worlds.get(worldId);
    if (!world) {
      console.warn(`[MetaverseManager] World ${worldId} not found`);
      return;
    }

    Object.assign(world, updates);
    world.lastActiveAt = new Date().toISOString();

    console.log(`[MetaverseManager] Updated world ${worldId}`);
  }

  /**
   * Update world resource abundance
   */
  updateWorldResources(worldId: string, resources: Record<string, number>): void {
    const world = this.worlds.get(worldId);
    if (!world) {
      console.warn(`[MetaverseManager] World ${worldId} not found`);
      return;
    }

    if (!world.meta.resourceAbundance) {
      world.meta.resourceAbundance = { food: 100, water: 100, material: 100 };
    }

    Object.assign(world.meta.resourceAbundance, resources);
    world.lastActiveAt = new Date().toISOString();
  }

  /**
   * Register a link between two worlds
   */
  registerLink(link: Omit<WorldLink, 'id' | 'createdAt'>): WorldLink {
    // Validate worlds exist
    if (!this.worlds.has(link.fromWorldId)) {
      throw new Error(`Source world ${link.fromWorldId} does not exist`);
    }
    if (!this.worlds.has(link.toWorldId)) {
      throw new Error(`Target world ${link.toWorldId} does not exist`);
    }

    // Validate intensity
    if (link.intensity < 0 || link.intensity > 1) {
      throw new Error('Link intensity must be between 0 and 1');
    }

    const newLink: WorldLink = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...link,
    };

    this.links.set(newLink.id, newLink);

    // Index by world
    if (!this.worldLinksIndex.has(link.fromWorldId)) {
      this.worldLinksIndex.set(link.fromWorldId, new Set());
    }
    this.worldLinksIndex.get(link.fromWorldId)!.add(newLink.id);

    if (!this.worldLinksIndex.has(link.toWorldId)) {
      this.worldLinksIndex.set(link.toWorldId, new Set());
    }
    this.worldLinksIndex.get(link.toWorldId)!.add(newLink.id);

    console.log(
      `[MetaverseManager] Created ${link.type} link from ${link.fromWorldId} to ${link.toWorldId} (intensity: ${link.intensity})`
    );

    return newLink;
  }

  /**
   * Get all links for a specific world
   */
  getLinks(worldId: string): WorldLink[] {
    const linkIds = this.worldLinksIndex.get(worldId);
    if (!linkIds) {
      return [];
    }

    return Array.from(linkIds)
      .map(id => this.links.get(id))
      .filter((link): link is WorldLink => link !== undefined);
  }

  /**
   * Get all links
   */
  getAllLinks(): WorldLink[] {
    return Array.from(this.links.values());
  }

  /**
   * Remove a link
   */
  removeLink(linkId: string): void {
    const link = this.links.get(linkId);
    if (!link) {
      console.warn(`[MetaverseManager] Link ${linkId} not found`);
      return;
    }

    // Remove from indices
    this.worldLinksIndex.get(link.fromWorldId)?.delete(linkId);
    this.worldLinksIndex.get(link.toWorldId)?.delete(linkId);

    // Remove link
    this.links.delete(linkId);

    console.log(`[MetaverseManager] Removed link ${linkId}`);
  }

  /**
   * Apply cross-world effects based on active links
   * This is called periodically to propagate effects between linked worlds
   */
  applyCrossWorldEffects(): void {
    console.log('[MetaverseManager] Applying cross-world effects...');

    let effectsApplied = 0;

    for (const link of this.links.values()) {
      const sourceWorld = this.worlds.get(link.fromWorldId);
      const targetWorld = this.worlds.get(link.toWorldId);

      if (!sourceWorld || !targetWorld) {
        continue;
      }

      switch (link.type) {
        case 'TRADE_ROUTE':
          effectsApplied += this.applyTradeRouteEffects(sourceWorld, targetWorld, link);
          break;

        case 'SIGNAL_LINK':
          effectsApplied += this.applySignalLinkEffects(sourceWorld, targetWorld, link);
          break;

        case 'WAR_FRONT':
          effectsApplied += this.applyWarFrontEffects(sourceWorld, targetWorld, link);
          break;

        case 'PORTAL':
          effectsApplied += this.applyPortalEffects(sourceWorld, targetWorld, link);
          break;
      }

      // Update last active timestamps
      sourceWorld.lastActiveAt = new Date().toISOString();
      targetWorld.lastActiveAt = new Date().toISOString();
    }

    console.log(`[MetaverseManager] Applied ${effectsApplied} cross-world effects`);
  }

  /**
   * Apply TRADE_ROUTE effects: resource abundance influences scarcity
   * High abundance in source -> increases abundance in target
   * Low abundance in source -> may decrease abundance in target
   */
  private applyTradeRouteEffects(
    sourceWorld: WorldInstance,
    targetWorld: WorldInstance,
    link: WorldLink
  ): number {
    let effectsApplied = 0;

    const sourceResources = sourceWorld.meta.resourceAbundance || {};
    const targetResources = targetWorld.meta.resourceAbundance || {
      food: 100,
      water: 100,
      material: 100,
    };

    for (const resource of ['food', 'water', 'material']) {
      const sourceAmount = sourceResources[resource] || 100;
      const targetAmount = targetResources[resource] || 100;

      // Calculate transfer based on difference and link intensity
      const difference = sourceAmount - targetAmount;
      const transferAmount = difference * link.intensity * 0.1; // 10% max per cycle

      // Apply transfer
      if (Math.abs(transferAmount) > 0.5) {
        targetResources[resource] = Math.max(
          0,
          Math.min(200, targetAmount + transferAmount)
        );
        effectsApplied++;
      }
    }

    targetWorld.meta.resourceAbundance = targetResources;

    return effectsApplied;
  }

  /**
   * Apply SIGNAL_LINK effects: ideas (beliefs/culture) leak between worlds
   * Dominant beliefs from source influence target
   */
  private applySignalLinkEffects(
    sourceWorld: WorldInstance,
    targetWorld: WorldInstance,
    link: WorldLink
  ): number {
    let effectsApplied = 0;

    const sourceBeliefs = sourceWorld.meta.dominantBeliefs || [];
    const targetBeliefs = targetWorld.meta.dominantBeliefs || [];
    const sourceCulture = sourceWorld.meta.culturalInfluence || 50;

    // Transfer beliefs based on intensity and cultural influence
    if (sourceBeliefs.length > 0 && link.intensity > 0.3) {
      // Pick random belief from source
      const beliefToTransfer = sourceBeliefs[
        Math.floor(Math.random() * sourceBeliefs.length)
      ];

      // Add to target if not already present
      if (!targetBeliefs.includes(beliefToTransfer)) {
        // Chance based on intensity and cultural influence
        const transferChance = link.intensity * (sourceCulture / 100);
        if (Math.random() < transferChance) {
          targetBeliefs.push(beliefToTransfer);
          targetWorld.meta.dominantBeliefs = targetBeliefs;
          effectsApplied++;

          console.log(
            `[MetaverseManager] Belief "${beliefToTransfer}" spread from ${sourceWorld.name} to ${targetWorld.name}`
          );
        }
      }
    }

    // Cultural influence gradually equalizes
    if (targetWorld.meta.culturalInfluence !== undefined) {
      const cultureDifference = sourceCulture - targetWorld.meta.culturalInfluence;
      const cultureTransfer = cultureDifference * link.intensity * 0.05;

      if (Math.abs(cultureTransfer) > 0.1) {
        targetWorld.meta.culturalInfluence += cultureTransfer;
        effectsApplied++;
      }
    }

    return effectsApplied;
  }

  /**
   * Apply WAR_FRONT effects: conflict drains resources and cultural stability
   * Both worlds lose resources based on intensity
   */
  private applyWarFrontEffects(
    sourceWorld: WorldInstance,
    targetWorld: WorldInstance,
    link: WorldLink
  ): number {
    let effectsApplied = 0;

    // War drains resources from both worlds
    const drainFactor = link.intensity * 0.15; // 15% max drain per cycle

    for (const world of [sourceWorld, targetWorld]) {
      const resources = world.meta.resourceAbundance || {
        food: 100,
        water: 100,
        material: 100,
      };

      for (const resource of ['food', 'water', 'material']) {
        const currentAmount = resources[resource] || 100;
        const drain = currentAmount * drainFactor;

        if (drain > 0.5) {
          resources[resource] = Math.max(0, currentAmount - drain);
          effectsApplied++;
        }
      }

      world.meta.resourceAbundance = resources;

      // War reduces cultural influence
      if (world.meta.culturalInfluence !== undefined) {
        const cultureDrain = link.intensity * 2;
        world.meta.culturalInfluence = Math.max(
          0,
          world.meta.culturalInfluence - cultureDrain
        );
        effectsApplied++;
      }
    }

    return effectsApplied;
  }

  /**
   * Apply PORTAL effects: direct connection allows resource and idea exchange
   * Bidirectional flow with high efficiency
   */
  private applyPortalEffects(
    sourceWorld: WorldInstance,
    targetWorld: WorldInstance,
    link: WorldLink
  ): number {
    let effectsApplied = 0;

    // Portals allow both resource and belief transfer
    // Resources equalize faster than trade routes
    const sourceResources = sourceWorld.meta.resourceAbundance || {};
    const targetResources = targetWorld.meta.resourceAbundance || {
      food: 100,
      water: 100,
      material: 100,
    };

    for (const resource of ['food', 'water', 'material']) {
      const sourceAmount = sourceResources[resource] || 100;
      const targetAmount = targetResources[resource] || 100;

      // Fast equalization
      const difference = sourceAmount - targetAmount;
      const transferAmount = difference * link.intensity * 0.2; // 20% max per cycle

      if (Math.abs(transferAmount) > 0.5) {
        targetResources[resource] = Math.max(
          0,
          Math.min(200, targetAmount + transferAmount)
        );
        sourceResources[resource] = Math.max(
          0,
          Math.min(200, sourceAmount - transferAmount)
        );
        effectsApplied += 2; // Both directions
      }
    }

    sourceWorld.meta.resourceAbundance = sourceResources;
    targetWorld.meta.resourceAbundance = targetResources;

    // Beliefs also transfer bidirectionally
    const sourceBeliefs = sourceWorld.meta.dominantBeliefs || [];
    const targetBeliefs = targetWorld.meta.dominantBeliefs || [];

    // Source -> Target
    if (sourceBeliefs.length > 0) {
      for (const belief of sourceBeliefs) {
        if (!targetBeliefs.includes(belief) && Math.random() < link.intensity * 0.3) {
          targetBeliefs.push(belief);
          effectsApplied++;
        }
      }
    }

    // Target -> Source
    if (targetBeliefs.length > 0) {
      for (const belief of targetBeliefs) {
        if (!sourceBeliefs.includes(belief) && Math.random() < link.intensity * 0.3) {
          sourceBeliefs.push(belief);
          effectsApplied++;
        }
      }
    }

    sourceWorld.meta.dominantBeliefs = sourceBeliefs;
    targetWorld.meta.dominantBeliefs = targetBeliefs;

    return effectsApplied;
  }

  /**
   * Get statistics about the metaverse
   */
  getStats(): {
    totalWorlds: number;
    activeWorlds: number;
    totalLinks: number;
    linksByType: Record<string, number>;
    oldestWorld: { name: string; age: string } | null;
  } {
    const now = new Date();
    const activeThreshold = 1000 * 60 * 60; // 1 hour

    const activeWorlds = Array.from(this.worlds.values()).filter(world => {
      const lastActive = new Date(world.lastActiveAt);
      return now.getTime() - lastActive.getTime() < activeThreshold;
    });

    const linksByType: Record<string, number> = {
      PORTAL: 0,
      TRADE_ROUTE: 0,
      WAR_FRONT: 0,
      SIGNAL_LINK: 0,
    };

    for (const link of this.links.values()) {
      linksByType[link.type]++;
    }

    // Find oldest world
    const sortedWorlds = Array.from(this.worlds.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const oldestWorld = sortedWorlds.length > 0
      ? {
          name: sortedWorlds[0].name,
          age: this.formatAge(new Date(sortedWorlds[0].createdAt)),
        }
      : null;

    return {
      totalWorlds: this.worlds.size,
      activeWorlds: activeWorlds.length,
      totalLinks: this.links.size,
      linksByType,
      oldestWorld,
    };
  }

  /**
   * Format age in human-readable format
   */
  private formatAge(createdAt: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    return 'just now';
  }

  /**
   * Clear all metaverse data
   */
  clear(): void {
    this.worlds.clear();
    this.links.clear();
    this.worldLinksIndex.clear();
    console.log('[MetaverseManager] Cleared all metaverse data');
  }

  /**
   * Export metaverse data for persistence
   */
  export(): {
    worlds: WorldInstance[];
    links: WorldLink[];
    version: string;
    exportTime: string;
  } {
    return {
      worlds: Array.from(this.worlds.values()),
      links: Array.from(this.links.values()),
      version: '1.0',
      exportTime: new Date().toISOString(),
    };
  }

  /**
   * Import metaverse data from export
   */
  import(data: { worlds: WorldInstance[]; links: WorldLink[] }): void {
    this.clear();

    // Import worlds
    data.worlds.forEach(world => {
      this.worlds.set(world.id, world);
    });

    // Import links
    data.links.forEach(link => {
      this.links.set(link.id, link);

      // Rebuild indices
      if (!this.worldLinksIndex.has(link.fromWorldId)) {
        this.worldLinksIndex.set(link.fromWorldId, new Set());
      }
      this.worldLinksIndex.get(link.fromWorldId)!.add(link.id);

      if (!this.worldLinksIndex.has(link.toWorldId)) {
        this.worldLinksIndex.set(link.toWorldId, new Set());
      }
      this.worldLinksIndex.get(link.toWorldId)!.add(link.id);
    });

    console.log(
      `[MetaverseManager] Imported ${data.worlds.length} worlds and ${data.links.length} links`
    );
  }
}

/**
 * Global metaverse manager instance
 */
let globalMetaverseManager: MetaverseManager | null = null;

/**
 * Get the global metaverse manager
 */
export function getMetaverseManager(): MetaverseManager {
  if (!globalMetaverseManager) {
    globalMetaverseManager = new MetaverseManager();
  }
  return globalMetaverseManager;
}

/**
 * Set the global metaverse manager (for testing)
 */
export function setMetaverseManager(manager: MetaverseManager): void {
  globalMetaverseManager = manager;
}
