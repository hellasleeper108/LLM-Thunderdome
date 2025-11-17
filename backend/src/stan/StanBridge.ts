/**
 * STAN (External Overseer System) Bridge
 * Allows external orchestrators to observe simulation events and state
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration for STAN bridge
 */
export interface StanConfig {
  enabled: boolean;
  webhookUrl?: string;
  apiKey?: string;
  maxEventsPerSecond?: number;
}

/**
 * Event types that can be sent to STAN
 */
export type StanEventType =
  | 'TURN_SUMMARY'
  | 'AGENT_EVENT'
  | 'NEGOTIATION'
  | 'FACTION_EVENT'
  | 'CLUSTER_SUMMARY'
  | 'SIMULATION_START'
  | 'SIMULATION_END'
  | 'PREDICTION'
  | 'ALLIANCE_FORMED'
  | 'ALLIANCE_BROKEN';

/**
 * Event sent to STAN overseer
 */
export interface StanEvent {
  id: string;
  type: StanEventType;
  payload: any;
  timestamp: number;
}

/**
 * Bridge for communicating with STAN external overseer system
 *
 * Handles:
 * - Event batching and rate limiting
 * - Webhook delivery with retry logic
 * - Configuration management
 * - Error handling and logging
 */
export class StanBridge {
  private config: StanConfig;
  private eventQueue: StanEvent[] = [];
  private lastSendTime: number = 0;
  private sendInterval: number;
  private batchTimeout: NodeJS.Timeout | null = null;
  private eventCount: number = 0;
  private startTime: number = Date.now();

  constructor(config: StanConfig) {
    this.config = {
      enabled: config.enabled ?? false,
      webhookUrl: config.webhookUrl,
      apiKey: config.apiKey,
      maxEventsPerSecond: config.maxEventsPerSecond ?? 10,
    };

    // Calculate minimum interval between sends based on rate limit
    this.sendInterval = 1000 / (this.config.maxEventsPerSecond || 10);

    console.log('[STAN] Bridge initialized:', {
      enabled: this.config.enabled,
      hasWebhook: !!this.config.webhookUrl,
      rateLimit: this.config.maxEventsPerSecond,
    });
  }

  /**
   * Send a single event to STAN
   * Events are queued and sent with rate limiting
   */
  async sendEvent(event: StanEvent): Promise<void> {
    if (!this.shouldSend()) {
      return;
    }

    // Add to queue
    this.eventQueue.push(event);

    // Schedule batch send if not already scheduled
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushQueue();
      }, 100); // Batch events over 100ms window
    }
  }

  /**
   * Send a batch of events to STAN
   * Useful for sending multiple related events together
   */
  async sendBatch(events: StanEvent[]): Promise<void> {
    if (!this.shouldSend() || events.length === 0) {
      return;
    }

    this.eventQueue.push(...events);
    await this.flushQueue();
  }

  /**
   * Create a STAN event with auto-generated ID and timestamp
   */
  createEvent(type: StanEventType, payload: any): StanEvent {
    return {
      id: uuidv4(),
      type,
      payload,
      timestamp: Date.now(),
    };
  }

  /**
   * Enable or disable STAN event sending
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`[STAN] ${enabled ? 'Enabled' : 'Disabled'}`);

    if (!enabled) {
      // Clear queue when disabled
      this.eventQueue = [];
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
    }
  }

  /**
   * Update STAN configuration
   */
  updateConfig(updates: Partial<StanConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };

    if (updates.maxEventsPerSecond) {
      this.sendInterval = 1000 / updates.maxEventsPerSecond;
    }

    console.log('[STAN] Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): StanConfig {
    return { ...this.config };
  }

  /**
   * Get statistics about STAN bridge usage
   */
  getStats() {
    const uptime = Date.now() - this.startTime;
    return {
      enabled: this.config.enabled,
      totalEventsSent: this.eventCount,
      queuedEvents: this.eventQueue.length,
      uptime,
      eventsPerSecond: uptime > 0 ? (this.eventCount / (uptime / 1000)).toFixed(2) : 0,
    };
  }

  /**
   * Check if events should be sent
   */
  private shouldSend(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.config.webhookUrl) {
      console.warn('[STAN] No webhook URL configured, events will not be sent');
      return false;
    }

    return true;
  }

  /**
   * Flush queued events to STAN webhook
   */
  private async flushQueue(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.eventQueue.length === 0) {
      return;
    }

    // Check rate limit
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSendTime;
    if (timeSinceLastSend < this.sendInterval) {
      // Reschedule for later
      this.batchTimeout = setTimeout(() => {
        this.flushQueue();
      }, this.sendInterval - timeSinceLastSend);
      return;
    }

    // Take events from queue
    const eventsToSend = this.eventQueue.splice(0, 50); // Max 50 events per batch
    this.lastSendTime = now;

    try {
      await this.deliverEvents(eventsToSend);
      this.eventCount += eventsToSend.length;
    } catch (error) {
      console.error('[STAN] Failed to deliver events:', error);
      // Optionally: implement retry logic or dead letter queue
    }

    // If more events in queue, schedule next flush
    if (this.eventQueue.length > 0) {
      this.batchTimeout = setTimeout(() => {
        this.flushQueue();
      }, this.sendInterval);
    }
  }

  /**
   * Deliver events to STAN webhook
   */
  private async deliverEvents(events: StanEvent[]): Promise<void> {
    if (!this.config.webhookUrl) {
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Thunderdome-STAN-Bridge/1.0',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const payload = {
      events,
      metadata: {
        source: 'llm-thunderdome',
        version: '1.0',
        timestamp: Date.now(),
      },
    };

    console.log(`[STAN] Sending ${events.length} events to ${this.config.webhookUrl}`);

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `STAN webhook failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    console.log(`[STAN] Successfully delivered ${events.length} events`);
  }
}

/**
 * Global STAN bridge instance
 * Initialized from environment variables
 */
let globalStanBridge: StanBridge | null = null;

/**
 * Initialize STAN bridge from environment variables
 */
export function initializeStanBridge(): StanBridge {
  const config: StanConfig = {
    enabled: process.env.STAN_ENABLED === 'true',
    webhookUrl: process.env.STAN_WEBHOOK_URL,
    apiKey: process.env.STAN_API_KEY,
    maxEventsPerSecond: process.env.STAN_MAX_EVENTS_PER_SECOND
      ? parseInt(process.env.STAN_MAX_EVENTS_PER_SECOND, 10)
      : 10,
  };

  globalStanBridge = new StanBridge(config);
  return globalStanBridge;
}

/**
 * Get the global STAN bridge instance
 */
export function getStanBridge(): StanBridge {
  if (!globalStanBridge) {
    globalStanBridge = initializeStanBridge();
  }
  return globalStanBridge;
}

/**
 * Set the global STAN bridge instance (for testing)
 */
export function setStanBridge(bridge: StanBridge): void {
  globalStanBridge = bridge;
}
