/**
 * API Client
 * Functions for communicating with the backend
 */

const API_BASE = 'http://localhost:3001/api';

export const api = {
  /**
   * Create a new simulation
   */
  async createSimulation(preset?: string, config?: any) {
    const response = await fetch(`${API_BASE}/simulation/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, config }),
    });
    return response.json();
  },

  /**
   * Start the simulation
   */
  async startSimulation() {
    const response = await fetch(`${API_BASE}/simulation/start`, {
      method: 'POST',
    });
    return response.json();
  },

  /**
   * Pause the simulation
   */
  async pauseSimulation() {
    const response = await fetch(`${API_BASE}/simulation/pause`, {
      method: 'POST',
    });
    return response.json();
  },

  /**
   * Resume the simulation
   */
  async resumeSimulation() {
    const response = await fetch(`${API_BASE}/simulation/resume`, {
      method: 'POST',
    });
    return response.json();
  },

  /**
   * Execute a single turn
   */
  async stepSimulation() {
    const response = await fetch(`${API_BASE}/simulation/step`, {
      method: 'POST',
    });
    return response.json();
  },

  /**
   * Reset the simulation
   */
  async resetSimulation() {
    const response = await fetch(`${API_BASE}/simulation/reset`, {
      method: 'POST',
    });
    return response.json();
  },

  /**
   * Get current simulation state
   */
  async getState() {
    const response = await fetch(`${API_BASE}/simulation/state`);
    return response.json();
  },

  /**
   * Get available presets
   */
  async getPresets() {
    const response = await fetch(`${API_BASE}/presets`);
    return response.json();
  },

  /**
   * Get available personalities
   */
  async getPersonalities() {
    const response = await fetch(`${API_BASE}/personalities`);
    return response.json();
  },

  /**
   * Get logs
   */
  async getLogs(params?: { turn?: number; agentId?: string; type?: string; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.turn !== undefined) queryParams.set('turn', params.turn.toString());
    if (params?.agentId) queryParams.set('agentId', params.agentId);
    if (params?.type) queryParams.set('type', params.type);
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const response = await fetch(`${API_BASE}/logs?${queryParams}`);
    return response.json();
  },

  /**
   * Export logs
   */
  async exportLogs(format: 'json' | 'transcript') {
    const response = await fetch(`${API_BASE}/logs/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    });
    return response.json();
  },

  /**
   * Add agent to simulation
   */
  async addAgent(name: string, personalityName: string, agentType: 'llm' | 'scripted', strategy?: string) {
    const response = await fetch(`${API_BASE}/agents/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, personalityName, agentType, strategy }),
    });
    return response.json();
  },
};

/**
 * Create WebSocket connection
 */
export function createWebSocket(onMessage: (data: any) => void): WebSocket {
  const ws = new WebSocket('ws://localhost:3001/ws');

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };

  return ws;
}
