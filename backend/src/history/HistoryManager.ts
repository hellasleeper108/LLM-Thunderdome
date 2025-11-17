/**
 * History Manager
 * Transforms logged events into structured world history
 */

import { v4 as uuidv4 } from 'uuid';
import { EventLog } from '../schemas/types';

/**
 * Structured historical event
 */
export interface HistoricalEvent {
  id: string;
  turn: number;
  type: string; // 'war', 'alliance', 'belief', 'disaster', 'evolution', 'death', etc.
  title: string;
  description: string;
  agentsInvolved: string[];
  factionsInvolved: string[];
  worldLocation?: { x: number; y: number };
  tags: string[];
  timestamp: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Era summary grouping events by time period
 */
export interface EraSummary {
  title: string;
  startTurn: number;
  endTurn: number;
  keyEvents: HistoricalEvent[];
  totalEvents: number;
  dominantType: string;
  tags: string[];
}

/**
 * Filter for querying historical events
 */
export interface HistoryFilter {
  type?: string;
  minTurn?: number;
  maxTurn?: number;
  tags?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  factionId?: string;
}

/**
 * History Manager
 * Records and organizes simulation history
 */
export class HistoryManager {
  private events: Map<string, HistoricalEvent> = new Map();
  private eventsByTurn: Map<number, Set<string>> = new Map();
  private eventsByType: Map<string, Set<string>> = new Map();
  private eventsByTag: Map<string, Set<string>> = new Map();

  /**
   * Record a historical event from a logged event
   */
  recordFromLoggedEvent(logEvent: EventLog): HistoricalEvent {
    // Determine event type and generate appropriate title
    const { type, title, tags, severity } = this.categorizeEvent(logEvent);

    const historicalEvent: HistoricalEvent = {
      id: uuidv4(),
      turn: logEvent.turn,
      type,
      title,
      description: logEvent.description,
      agentsInvolved: logEvent.agentIds || [],
      factionsInvolved: this.extractFactionIds(logEvent),
      worldLocation: this.extractLocation(logEvent),
      tags,
      timestamp: logEvent.timestamp || Date.now(),
      severity,
    };

    // Store event
    this.events.set(historicalEvent.id, historicalEvent);

    // Index by turn
    if (!this.eventsByTurn.has(logEvent.turn)) {
      this.eventsByTurn.set(logEvent.turn, new Set());
    }
    this.eventsByTurn.get(logEvent.turn)!.add(historicalEvent.id);

    // Index by type
    if (!this.eventsByType.has(type)) {
      this.eventsByType.set(type, new Set());
    }
    this.eventsByType.get(type)!.add(historicalEvent.id);

    // Index by tags
    tags.forEach(tag => {
      if (!this.eventsByTag.has(tag)) {
        this.eventsByTag.set(tag, new Set());
      }
      this.eventsByTag.get(tag)!.add(historicalEvent.id);
    });

    console.log(`[HistoryManager] Recorded: Turn ${logEvent.turn} - ${title}`);

    return historicalEvent;
  }

  /**
   * Categorize event and generate title/tags
   */
  private categorizeEvent(logEvent: EventLog): {
    type: string;
    title: string;
    tags: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  } {
    const desc = logEvent.description.toLowerCase();
    const eventType = logEvent.type;
    let type = 'other';
    let title = logEvent.description;
    const tags: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Religion events
    if (eventType === 'religion_born') {
      type = 'belief';
      title = `New Belief Emerges: ${this.extractQuoted(logEvent.description)}`;
      tags.push('religion', 'belief', 'cultural');
      severity = 'high';
    } else if (eventType === 'ritual_performed') {
      type = 'ritual';
      title = `Ritual Performed: ${this.extractQuoted(logEvent.description)}`;
      tags.push('religion', 'ritual', 'cultural');
      severity = 'low';
    }
    // Alliance and diplomacy
    else if (desc.includes('alliance') && desc.includes('formed')) {
      type = 'alliance';
      title = `Alliance Formed: ${this.extractAgentNames(logEvent.description)}`;
      tags.push('alliance', 'diplomacy', 'cooperation');
      severity = 'medium';
    } else if (desc.includes('alliance') && (desc.includes('broken') || desc.includes('dissolved'))) {
      type = 'alliance_broken';
      title = `Alliance Broken: ${this.extractAgentNames(logEvent.description)}`;
      tags.push('alliance', 'diplomacy', 'betrayal');
      severity = 'medium';
    }
    // Combat and conflict
    else if (desc.includes('attack') || desc.includes('combat') || desc.includes('killed')) {
      type = 'war';
      if (desc.includes('killed')) {
        title = `Agent Killed: ${this.extractAgentNames(logEvent.description)}`;
        tags.push('war', 'combat', 'death');
        severity = 'high';
      } else {
        title = `Combat: ${this.extractAgentNames(logEvent.description)}`;
        tags.push('war', 'combat', 'conflict');
        severity = 'medium';
      }
    }
    // Faction events
    else if (desc.includes('faction') && desc.includes('created')) {
      type = 'faction_formed';
      title = `Faction Founded: ${this.extractQuoted(logEvent.description)}`;
      tags.push('faction', 'political', 'formation');
      severity = 'high';
    } else if (desc.includes('faction') && desc.includes('merged')) {
      type = 'faction_merged';
      title = `Factions Merged: ${this.extractQuoted(logEvent.description)}`;
      tags.push('faction', 'political', 'merger');
      severity = 'high';
    }
    // Law events
    else if (desc.includes('law') && desc.includes('created')) {
      type = 'law_created';
      title = `New Law Enacted: ${this.extractQuoted(logEvent.description)}`;
      tags.push('law', 'political', 'governance');
      severity = 'medium';
    } else if (desc.includes('law') && desc.includes('violated')) {
      type = 'law_violation';
      title = `Law Violated: ${this.extractQuoted(logEvent.description)}`;
      tags.push('law', 'violation', 'conflict');
      severity = 'low';
    }
    // World events
    else if (eventType === 'event' || desc.includes('disaster') || desc.includes('storm') || desc.includes('anomaly')) {
      type = 'disaster';
      title = `World Event: ${logEvent.description}`;
      tags.push('disaster', 'world_event', 'environmental');
      severity = 'critical';
    }
    // Evolution and genetics
    else if (desc.includes('evolved') || desc.includes('mutation') || desc.includes('generation')) {
      type = 'evolution';
      title = `Evolution: ${logEvent.description}`;
      tags.push('evolution', 'genetics', 'progress');
      severity = 'medium';
    }
    // Resource events
    else if (desc.includes('resource') || desc.includes('gather') || desc.includes('trade')) {
      type = 'resource';
      title = logEvent.description;
      tags.push('resource', 'economy');
      severity = 'low';
    }
    // Communication
    else if (eventType === 'dialogue' || desc.includes('message') || desc.includes('negotiate')) {
      type = 'communication';
      title = logEvent.description;
      tags.push('communication', 'social');
      severity = 'low';
    }

    // Extract metadata tags
    if (logEvent.metadata) {
      if (logEvent.metadata.severity) {
        severity = logEvent.metadata.severity;
      }
      if (logEvent.metadata.tags) {
        tags.push(...logEvent.metadata.tags);
      }
    }

    // Add agent count tag
    if (logEvent.agentIds && logEvent.agentIds.length > 0) {
      if (logEvent.agentIds.length === 1) {
        tags.push('individual');
      } else if (logEvent.agentIds.length <= 3) {
        tags.push('small_group');
      } else {
        tags.push('large_group');
      }
    }

    return { type, title, tags, severity };
  }

  /**
   * Extract quoted text from description
   */
  private extractQuoted(text: string): string {
    const match = text.match(/"([^"]+)"/);
    return match ? match[1] : text;
  }

  /**
   * Extract agent names from description
   */
  private extractAgentNames(text: string): string {
    // Simple extraction - could be enhanced
    const match = text.match(/Agent[^,.\s]*/g);
    return match ? match.join(' and ') : 'Unknown';
  }

  /**
   * Extract faction IDs from event metadata
   */
  private extractFactionIds(logEvent: EventLog): string[] {
    const factionIds: string[] = [];

    if (logEvent.metadata) {
      if (logEvent.metadata.factionId) {
        factionIds.push(logEvent.metadata.factionId);
      }
      if (logEvent.metadata.factionIds) {
        factionIds.push(...logEvent.metadata.factionIds);
      }
      if (logEvent.metadata.factions) {
        factionIds.push(...logEvent.metadata.factions);
      }
    }

    return [...new Set(factionIds)]; // Remove duplicates
  }

  /**
   * Extract world location from event metadata
   */
  private extractLocation(logEvent: EventLog): { x: number; y: number } | undefined {
    if (logEvent.metadata) {
      if (logEvent.metadata.position) {
        return logEvent.metadata.position;
      }
      if (logEvent.metadata.location) {
        return logEvent.metadata.location;
      }
      if (logEvent.metadata.x !== undefined && logEvent.metadata.y !== undefined) {
        return { x: logEvent.metadata.x, y: logEvent.metadata.y };
      }
    }
    return undefined;
  }

  /**
   * Get events with optional filters
   */
  getEvents(filter?: HistoryFilter): HistoricalEvent[] {
    let eventIds = new Set<string>(this.events.keys());

    // Filter by type
    if (filter?.type) {
      const typeSet = this.eventsByType.get(filter.type);
      if (typeSet) {
        eventIds = new Set([...eventIds].filter(id => typeSet.has(id)));
      } else {
        return []; // No events of this type
      }
    }

    // Filter by turn range
    if (filter?.minTurn !== undefined || filter?.maxTurn !== undefined) {
      const minTurn = filter.minTurn ?? 0;
      const maxTurn = filter.maxTurn ?? Infinity;
      eventIds = new Set([...eventIds].filter(id => {
        const event = this.events.get(id)!;
        return event.turn >= minTurn && event.turn <= maxTurn;
      }));
    }

    // Filter by tags (must have ALL specified tags)
    if (filter?.tags && filter.tags.length > 0) {
      eventIds = new Set([...eventIds].filter(id => {
        const event = this.events.get(id)!;
        return filter.tags!.every(tag => event.tags.includes(tag));
      }));
    }

    // Filter by severity
    if (filter?.severity) {
      eventIds = new Set([...eventIds].filter(id => {
        const event = this.events.get(id)!;
        return event.severity === filter.severity;
      }));
    }

    // Filter by faction
    if (filter?.factionId) {
      eventIds = new Set([...eventIds].filter(id => {
        const event = this.events.get(id)!;
        return event.factionsInvolved.includes(filter.factionId!);
      }));
    }

    // Convert to array and sort by turn
    return [...eventIds]
      .map(id => this.events.get(id)!)
      .sort((a, b) => a.turn - b.turn);
  }

  /**
   * Summarize an era (time period)
   */
  summarizeEra(startTurn: number, endTurn: number): EraSummary {
    const events = this.getEvents({ minTurn: startTurn, maxTurn: endTurn });

    // Find dominant event type
    const typeCounts = new Map<string, number>();
    const allTags = new Set<string>();

    events.forEach(event => {
      typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
      event.tags.forEach(tag => allTags.add(tag));
    });

    let dominantType = 'mixed';
    let maxCount = 0;
    typeCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    });

    // Get key events (high severity or high agent involvement)
    const keyEvents = events
      .filter(e => {
        const severityWeight = { low: 1, medium: 2, high: 3, critical: 4 };
        return (
          (e.severity && severityWeight[e.severity] >= 3) ||
          e.agentsInvolved.length >= 3
        );
      })
      .slice(0, 10); // Top 10 key events

    // Generate era title
    const title = this.generateEraTitle(startTurn, endTurn, dominantType, events);

    return {
      title,
      startTurn,
      endTurn,
      keyEvents,
      totalEvents: events.length,
      dominantType,
      tags: Array.from(allTags),
    };
  }

  /**
   * Generate descriptive era title
   */
  private generateEraTitle(
    startTurn: number,
    endTurn: number,
    dominantType: string,
    events: HistoricalEvent[]
  ): string {
    const typeNames: Record<string, string> = {
      war: 'Age of Conflict',
      alliance: 'Age of Diplomacy',
      belief: 'Age of Faith',
      disaster: 'Age of Calamity',
      evolution: 'Age of Progress',
      faction_formed: 'Age of Foundations',
      law_created: 'Age of Order',
      mixed: 'Age of Change',
    };

    const baseName = typeNames[dominantType] || 'Era';

    // Add descriptor based on severity
    const criticalEvents = events.filter(e => e.severity === 'critical').length;
    if (criticalEvents > 3) {
      return `The Dark ${baseName}`;
    }

    // Add descriptor based on cooperation vs conflict
    const cooperativeEvents = events.filter(e => e.tags.includes('cooperation')).length;
    const conflictEvents = events.filter(e => e.tags.includes('conflict') || e.tags.includes('war')).length;

    if (cooperativeEvents > conflictEvents * 2) {
      return `The Golden ${baseName}`;
    } else if (conflictEvents > cooperativeEvents * 2) {
      return `The Turbulent ${baseName}`;
    }

    return baseName;
  }

  /**
   * Get all eras with fixed window size
   */
  getEras(windowSize: number = 20): EraSummary[] {
    if (this.events.size === 0) {
      return [];
    }

    // Find min and max turns
    const turns = Array.from(this.eventsByTurn.keys()).sort((a, b) => a - b);
    const minTurn = turns[0];
    const maxTurn = turns[turns.length - 1];

    const eras: EraSummary[] = [];

    for (let start = minTurn; start <= maxTurn; start += windowSize) {
      const end = Math.min(start + windowSize - 1, maxTurn);
      const era = this.summarizeEra(start, end);

      // Only include eras with events
      if (era.totalEvents > 0) {
        eras.push(era);
      }
    }

    return eras;
  }

  /**
   * Get statistics about recorded history
   */
  getStats() {
    const totalEvents = this.events.size;
    const eventTypes = Array.from(this.eventsByType.keys());
    const totalTags = this.eventsByTag.size;

    // Most common type
    let mostCommonType = '';
    let maxTypeCount = 0;
    this.eventsByType.forEach((eventIds, type) => {
      if (eventIds.size > maxTypeCount) {
        maxTypeCount = eventIds.size;
        mostCommonType = type;
      }
    });

    // Turn range
    const turns = Array.from(this.eventsByTurn.keys()).sort((a, b) => a - b);
    const turnRange = turns.length > 0
      ? { min: turns[0], max: turns[turns.length - 1] }
      : null;

    return {
      totalEvents,
      eventTypes,
      totalTags,
      mostCommonType,
      mostCommonTypeCount: maxTypeCount,
      turnRange,
    };
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.events.clear();
    this.eventsByTurn.clear();
    this.eventsByType.clear();
    this.eventsByTag.clear();
    console.log('[HistoryManager] History cleared');
  }
}

/**
 * Global history manager instance
 */
let globalHistoryManager: HistoryManager | null = null;

/**
 * Get the global history manager
 */
export function getHistoryManager(): HistoryManager {
  if (!globalHistoryManager) {
    globalHistoryManager = new HistoryManager();
  }
  return globalHistoryManager;
}

/**
 * Set the global history manager (for testing)
 */
export function setHistoryManager(manager: HistoryManager): void {
  globalHistoryManager = manager;
}
