/**
 * Communication Protocol
 * Handles messaging between agents and the system
 */

import { Message } from '../schemas/types';
import { v4 as uuidv4 } from 'uuid';

export type MessageHandler = (message: Message) => void;

export class CommunicationProtocol {
  private messageQueue: Message[];
  private handlers: Map<string, MessageHandler[]>; // agentId -> handlers
  private globalHandlers: MessageHandler[];
  private messageHistory: Message[];

  constructor() {
    this.messageQueue = [];
    this.handlers = new Map();
    this.globalHandlers = [];
    this.messageHistory = [];
  }

  /**
   * Send a message from one agent to another
   */
  sendMessage(
    from: string,
    to: string,
    content: string,
    type: Message['type'] = 'other'
  ): Message {
    const message: Message = {
      id: uuidv4(),
      from,
      to,
      content,
      type,
      timestamp: Date.now(),
    };

    this.messageQueue.push(message);
    this.messageHistory.push(message);

    // Trim history if too long
    if (this.messageHistory.length > 1000) {
      this.messageHistory.shift();
    }

    return message;
  }

  /**
   * Broadcast a message to all agents
   */
  broadcast(from: string, content: string, type: Message['type'] = 'info'): Message[] {
    const messages: Message[] = [];
    const allAgents = Array.from(this.handlers.keys());

    for (const agentId of allAgents) {
      if (agentId !== from) {
        const msg = this.sendMessage(from, agentId, content, type);
        messages.push(msg);
      }
    }

    return messages;
  }

  /**
   * Register a message handler for an agent
   */
  registerHandler(agentId: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(agentId)) {
      this.handlers.set(agentId, []);
    }

    this.handlers.get(agentId)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(agentId);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Register a global message handler (receives all messages)
   */
  registerGlobalHandler(handler: MessageHandler): () => void {
    this.globalHandlers.push(handler);

    return () => {
      const index = this.globalHandlers.indexOf(handler);
      if (index > -1) {
        this.globalHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Process message queue and deliver to handlers
   */
  processQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;

      // Deliver to recipient's handlers
      const recipientHandlers = this.handlers.get(message.to);
      if (recipientHandlers) {
        recipientHandlers.forEach(handler => handler(message));
      }

      // Deliver to global handlers
      this.globalHandlers.forEach(handler => handler(message));
    }
  }

  /**
   * Get messages for an agent
   */
  getMessagesFor(agentId: string, limit: number = 50): Message[] {
    return this.messageHistory
      .filter(msg => msg.to === agentId || msg.from === agentId)
      .slice(-limit);
  }

  /**
   * Get messages between two agents
   */
  getMessagesBetween(agentId1: string, agentId2: string, limit: number = 50): Message[] {
    return this.messageHistory
      .filter(
        msg =>
          (msg.from === agentId1 && msg.to === agentId2) ||
          (msg.from === agentId2 && msg.to === agentId1)
      )
      .slice(-limit);
  }

  /**
   * Get all messages
   */
  getAllMessages(limit: number = 100): Message[] {
    return this.messageHistory.slice(-limit);
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Remove handlers for an agent
   */
  removeAgent(agentId: string): void {
    this.handlers.delete(agentId);
  }

  /**
   * Get message statistics
   */
  getStatistics(): {
    totalMessages: number;
    messagesByType: Record<string, number>;
    mostActiveAgents: { agentId: string; messageCount: number }[];
  } {
    const messagesByType: Record<string, number> = {};
    const agentMessageCounts: Map<string, number> = new Map();

    for (const msg of this.messageHistory) {
      // Count by type
      messagesByType[msg.type] = (messagesByType[msg.type] || 0) + 1;

      // Count by agent
      agentMessageCounts.set(msg.from, (agentMessageCounts.get(msg.from) || 0) + 1);
    }

    const mostActiveAgents = Array.from(agentMessageCounts.entries())
      .map(([agentId, messageCount]) => ({ agentId, messageCount }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);

    return {
      totalMessages: this.messageHistory.length,
      messagesByType,
      mostActiveAgents,
    };
  }
}
