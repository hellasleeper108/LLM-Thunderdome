/**
 * Genealogy Tracker
 * Tracks lineage and family trees across evolutionary generations
 */

import { AgentGenome } from '../schemas/types';

/**
 * Node in the genealogy tree representing a single genome
 */
export interface GenealogyNode {
  genomeId: string;
  parentIds: string[];
  generationIndex: number;
  derivedTraitsSummary: Record<string, number>; // Key traits from this genome
  timestamp: number;
  metadata?: {
    mutated?: boolean;
    crossover?: boolean;
    fitnessScore?: number;
  };
}

/**
 * Complete genealogy tree structure
 */
export interface GenealogyTree {
  rootIds: string[]; // Generation 0 genomes (no parents)
  nodes: Record<string, GenealogyNode>;
  totalGenerations: number;
  totalGenomes: number;
}

/**
 * Genealogy Tracker
 * Manages lineage tracking for evolved agent genomes
 */
export class GenealogyTracker {
  private nodes: Map<string, GenealogyNode> = new Map();
  private generationIndex: Map<number, Set<string>> = new Map(); // generation -> genomeIds
  private childrenIndex: Map<string, Set<string>> = new Map(); // parentId -> childIds

  /**
   * Register a new genome in the genealogy tree
   */
  registerGenome(
    genome: AgentGenome,
    parents: AgentGenome[] | null,
    generationIndex: number,
    metadata?: {
      mutated?: boolean;
      crossover?: boolean;
      fitnessScore?: number;
    }
  ): void {
    const genomeId = genome.id;

    // Check if already registered
    if (this.nodes.has(genomeId)) {
      console.warn(`[GenealogyTracker] Genome ${genomeId} already registered`);
      return;
    }

    // Extract parent IDs
    const parentIds: string[] = parents ? parents.map(p => p.id) : [];

    // Create node
    const node: GenealogyNode = {
      genomeId,
      parentIds,
      generationIndex,
      derivedTraitsSummary: this.extractTraitsSummary(genome),
      timestamp: Date.now(),
      metadata,
    };

    // Store node
    this.nodes.set(genomeId, node);

    // Index by generation
    if (!this.generationIndex.has(generationIndex)) {
      this.generationIndex.set(generationIndex, new Set());
    }
    this.generationIndex.get(generationIndex)!.add(genomeId);

    // Index children for each parent
    parentIds.forEach(parentId => {
      if (!this.childrenIndex.has(parentId)) {
        this.childrenIndex.set(parentId, new Set());
      }
      this.childrenIndex.get(parentId)!.add(genomeId);
    });

    console.log(
      `[GenealogyTracker] Registered genome ${genomeId} (gen ${generationIndex}, parents: ${parentIds.join(', ') || 'none'})`
    );
  }

  /**
   * Extract summary of key traits from a genome
   */
  private extractTraitsSummary(genome: AgentGenome): Record<string, number> {
    return {
      aggression: genome.traits.aggression,
      cooperation: genome.traits.cooperation,
      empathy: genome.traits.empathy,
      curiosity: genome.traits.curiosity,
      riskTolerance: genome.traits.riskTolerance,
      cunning: genome.traits.cunning,
      loyalty: genome.traits.loyalty,
    };
  }

  /**
   * Get complete lineage (ancestry) for a genome
   * Returns nodes from root ancestors to the specified genome
   */
  getLineage(genomeId: string): GenealogyNode[] {
    const lineage: GenealogyNode[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) return;

      // Recurse on parents first (depth-first)
      node.parentIds.forEach(parentId => traverse(parentId));

      // Add current node
      lineage.push(node);
    };

    traverse(genomeId);

    // Sort by generation (oldest first)
    return lineage.sort((a, b) => a.generationIndex - b.generationIndex);
  }

  /**
   * Get all descendants of a genome
   */
  getDescendants(genomeId: string): GenealogyNode[] {
    const descendants: GenealogyNode[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      const children = this.childrenIndex.get(currentId) || new Set();

      children.forEach(childId => {
        if (visited.has(childId)) return;
        visited.add(childId);

        const childNode = this.nodes.get(childId);
        if (childNode) {
          descendants.push(childNode);
          traverse(childId); // Recurse on children
        }
      });
    };

    traverse(genomeId);

    // Sort by generation (oldest first)
    return descendants.sort((a, b) => a.generationIndex - b.generationIndex);
  }

  /**
   * Get all siblings of a genome (share at least one parent)
   */
  getSiblings(genomeId: string): GenealogyNode[] {
    const node = this.nodes.get(genomeId);
    if (!node || node.parentIds.length === 0) {
      return [];
    }

    const siblings = new Set<string>();

    // Find all children of parents
    node.parentIds.forEach(parentId => {
      const children = this.childrenIndex.get(parentId) || new Set();
      children.forEach(childId => {
        if (childId !== genomeId) {
          siblings.add(childId);
        }
      });
    });

    return Array.from(siblings)
      .map(id => this.nodes.get(id))
      .filter((n): n is GenealogyNode => n !== undefined);
  }

  /**
   * Get complete genealogy tree
   */
  getTree(): GenealogyTree {
    // Find root nodes (generation 0 or no parents)
    const rootIds: string[] = [];
    for (const [genomeId, node] of this.nodes.entries()) {
      if (node.parentIds.length === 0) {
        rootIds.push(genomeId);
      }
    }

    // Build nodes object
    const nodesObj: Record<string, GenealogyNode> = {};
    this.nodes.forEach((node, id) => {
      nodesObj[id] = node;
    });

    // Calculate total generations
    const allGenerations = Array.from(this.generationIndex.keys());
    const totalGenerations = allGenerations.length > 0 ? Math.max(...allGenerations) + 1 : 0;

    return {
      rootIds,
      nodes: nodesObj,
      totalGenerations,
      totalGenomes: this.nodes.size,
    };
  }

  /**
   * Get all genomes in a specific generation
   */
  getGeneration(generationIndex: number): GenealogyNode[] {
    const genomeIds = this.generationIndex.get(generationIndex) || new Set();
    return Array.from(genomeIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is GenealogyNode => n !== undefined);
  }

  /**
   * Get node for a specific genome
   */
  getNode(genomeId: string): GenealogyNode | null {
    return this.nodes.get(genomeId) || null;
  }

  /**
   * Get statistics about the genealogy
   */
  getStats(): {
    totalGenomes: number;
    totalGenerations: number;
    rootCount: number;
    averageChildrenPerGenome: number;
    largestGeneration: { index: number; count: number };
  } {
    const tree = this.getTree();

    // Calculate average children per genome
    let totalChildren = 0;
    this.childrenIndex.forEach(children => {
      totalChildren += children.size;
    });
    const averageChildrenPerGenome = this.nodes.size > 0 ? totalChildren / this.nodes.size : 0;

    // Find largest generation
    let largestGeneration = { index: 0, count: 0 };
    this.generationIndex.forEach((genomeIds, genIndex) => {
      if (genomeIds.size > largestGeneration.count) {
        largestGeneration = { index: genIndex, count: genomeIds.size };
      }
    });

    return {
      totalGenomes: tree.totalGenomes,
      totalGenerations: tree.totalGenerations,
      rootCount: tree.rootIds.length,
      averageChildrenPerGenome,
      largestGeneration,
    };
  }

  /**
   * Clear all genealogy data
   */
  clear(): void {
    this.nodes.clear();
    this.generationIndex.clear();
    this.childrenIndex.clear();
    console.log('[GenealogyTracker] Cleared all genealogy data');
  }

  /**
   * Export genealogy data for persistence
   */
  export(): {
    nodes: GenealogyNode[];
    version: string;
    exportTime: string;
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      version: '1.0',
      exportTime: new Date().toISOString(),
    };
  }

  /**
   * Import genealogy data from export
   */
  import(data: { nodes: GenealogyNode[] }): void {
    this.clear();

    data.nodes.forEach(node => {
      this.nodes.set(node.genomeId, node);

      // Rebuild indices
      if (!this.generationIndex.has(node.generationIndex)) {
        this.generationIndex.set(node.generationIndex, new Set());
      }
      this.generationIndex.get(node.generationIndex)!.add(node.genomeId);

      node.parentIds.forEach(parentId => {
        if (!this.childrenIndex.has(parentId)) {
          this.childrenIndex.set(parentId, new Set());
        }
        this.childrenIndex.get(parentId)!.add(node.genomeId);
      });
    });

    console.log(`[GenealogyTracker] Imported ${data.nodes.length} genealogy nodes`);
  }
}

/**
 * Global genealogy tracker instance
 */
let globalGenealogyTracker: GenealogyTracker | null = null;

/**
 * Get the global genealogy tracker
 */
export function getGenealogyTracker(): GenealogyTracker {
  if (!globalGenealogyTracker) {
    globalGenealogyTracker = new GenealogyTracker();
  }
  return globalGenealogyTracker;
}

/**
 * Set the global genealogy tracker (for testing)
 */
export function setGenealogyTracker(tracker: GenealogyTracker): void {
  globalGenealogyTracker = tracker;
}
