# 🎮 LLM Thunderdome

**A Multi-Agent Simulation Environment Where AI Agents Battle, Cooperate, and Evolve**

LLM Thunderdome is a sophisticated simulation platform where multiple AI agents (powered by LLMs or scripted logic) interact within a dynamic 2D world. Agents can gather resources, form alliances, engage in combat, negotiate, and pursue complex goals in real-time.

---

## 🌟 Features

### Core Capabilities

- **Multi-Agent System**: Support for both LLM-powered and rule-based scripted agents
- **Dynamic World**: 2D grid-based environment with resources, obstacles, and random events
- **Turn-Based Engine**: Sophisticated simulation engine with pause, step, and replay capabilities
- **Real-Time Dashboard**: React-based frontend with live updates via WebSocket
- **Event Logging**: Comprehensive logging system with JSON and transcript export
- **Preset Scenarios**: Three pre-configured simulation types out of the box

### Agent Capabilities

Agents can:
- 🔍 Observe their surroundings
- 🚶 Move and explore the world
- 📦 Gather resources (food, water, materials)
- ⚔️ Attack other agents
- 🤝 Form and break alliances
- 💬 Communicate and negotiate
- 🎁 Share resources with allies
- 😴 Rest and recover

### Agent Personalities

8 pre-defined personalities with unique trait combinations:

1. **Cooperative Helper** - High empathy and cooperation, low aggression
2. **Resource Hoarder** - Greedy and risk-averse, low empathy
3. **Curious Explorer** - High curiosity and risk tolerance
4. **Diplomat** - Master negotiator with high communication skills
5. **Aggressive Warrior** - High aggression, dominance-focused
6. **Cautious Survivor** - Risk-averse, defensive playstyle
7. **Charismatic Leader** - Natural leader who inspires others
8. **Lone Wolf** - Independent and distrustful

### Simulation Presets

#### 1. Cooperative Challenge
- **Goal**: Gather shared resources before time runs out
- **Agents**: 4 cooperative personalities
- **World**: 20x20 grid
- **Turns**: 50
- **Focus**: Teamwork and resource sharing

#### 2. Competitive Survival
- **Goal**: Last agent standing wins
- **Agents**: 4 aggressive/defensive personalities
- **World**: 15x15 grid with scarce resources
- **Turns**: 100
- **Focus**: Combat and survival

#### 3. Emergent Diplomacy
- **Goal**: Form the largest alliance
- **Agents**: 6 diverse personalities
- **World**: 25x25 grid
- **Turns**: 80
- **Focus**: Negotiation and social dynamics

---

## 🏗️ Architecture

### Backend (Node.js + TypeScript + Express)

```
backend/
├── src/
│   ├── agents/           # Agent system (Base, LLM, Scripted)
│   ├── world/            # 2D grid world management
│   ├── engine/           # Turn-based simulation engine
│   ├── state/            # Centralized state management
│   ├── logging/          # Event logging system
│   ├── events/           # Communication protocol
│   ├── schemas/          # TypeScript type definitions
│   ├── simulations/      # Preset configurations
│   └── index.ts          # Main server (REST + WebSocket)
```

### Frontend (React + Vite + TypeScript + Tailwind)

```
frontend/
├── src/
│   ├── components/
│   │   ├── ArenaView.tsx          # Grid visualization
│   │   ├── AgentInspector.tsx     # Agent details panel
│   │   ├── EventLog.tsx           # Scrollable event list
│   │   └── SimulationControls.tsx # UI controls
│   ├── store.ts          # Zustand state management
│   ├── api.ts            # Backend API client
│   ├── types.ts          # TypeScript types
│   ├── App.tsx           # Main application
│   └── main.tsx          # Entry point
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd LLM-Thunderdome
```

2. **Install dependencies**

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### Running the Application

#### Option 1: Run Everything Together (Recommended)

From the root directory:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend dev server on `http://localhost:3000`

#### Option 2: Run Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### First Simulation

1. Open your browser to `http://localhost:3000`
2. Select a preset from the dropdown (e.g., "Cooperative Challenge")
3. Click "Create Simulation"
4. Click "Start" to begin the simulation
5. Watch agents interact in real-time!

Use the controls to:
- ⏸️ **Pause** - Stop the simulation
- ▶️ **Resume** - Continue from pause
- ⏭️ **Step** - Execute one turn at a time
- 🔄 **Reset** - Start fresh

---

## 📚 API Documentation

### REST Endpoints

#### Simulation Management

**Create Simulation**
```http
POST /api/simulation/create
Content-Type: application/json

{
  "preset": "cooperative",  // or "competitive", "diplomatic"
  "config": {               // optional overrides
    "worldWidth": 20,
    "worldHeight": 20,
    "maxTurns": 50
  }
}
```

**Start Simulation**
```http
POST /api/simulation/start
```

**Pause Simulation**
```http
POST /api/simulation/pause
```

**Resume Simulation**
```http
POST /api/simulation/resume
```

**Execute Single Turn**
```http
POST /api/simulation/step
```

**Reset Simulation**
```http
POST /api/simulation/reset
```

**Get Simulation State**
```http
GET /api/simulation/state
```

#### Configuration

**Get Available Presets**
```http
GET /api/presets
```

**Get Available Personalities**
```http
GET /api/personalities
```

#### Logging

**Get Logs**
```http
GET /api/logs?turn=5&agentId=abc123&type=dialogue&limit=100
```

**Export Logs**
```http
POST /api/logs/export
Content-Type: application/json

{
  "format": "json"  // or "transcript"
}
```

#### Agents

**Add Agent to Simulation**
```http
POST /api/agents/add
Content-Type: application/json

{
  "name": "My Agent",
  "personalityName": "cooperative_helper",
  "agentType": "llm",      // or "scripted"
  "strategy": "gatherer"   // for scripted agents
}
```

### WebSocket Events

Connect to `ws://localhost:3001/ws`

**Events Received:**

- `initial_state` - Full state when connecting
- `simulation_created` - New simulation created
- `simulation_started` - Simulation started
- `simulation_paused` - Simulation paused
- `simulation_resumed` - Simulation resumed
- `simulation_reset` - Simulation reset
- `turn_complete` - Turn execution finished
- `state_update` - World state changed
- `agent_added` - New agent joined

---

## 🎨 Creating Custom Agents

### Method 1: Using Existing Personalities

```typescript
import { LLMAgent, COOPERATIVE_HELPER, createGoalsFromPersonality } from './agents';

const agent = new LLMAgent(
  "My Helper Bot",
  COOPERATIVE_HELPER,
  { x: 5, y: 5 },
  createGoalsFromPersonality(COOPERATIVE_HELPER),
  { mock: true }  // Use mock LLM (rule-based)
);
```

### Method 2: Custom Personality

```typescript
const customPersonality = {
  name: "Chaotic Neutral",
  traits: {
    energy: 80,
    aggression: 50,
    cooperation: 50,
    riskTolerance: 90,
    curiosity: 85,
    empathy: 40,
  },
  description: "Unpredictable agent that keeps everyone guessing."
};

const agent = new LLMAgent(
  "Chaos Bot",
  customPersonality,
  { x: 10, y: 10 },
  [
    {
      id: uuidv4(),
      description: "Cause maximum chaos",
      priority: 'primary',
      completed: false
    }
  ],
  { mock: true }
);
```

### Method 3: Scripted Agent with Strategy

```typescript
import { ScriptedAgent, AGGRESSIVE_WARRIOR } from './agents';

const agent = new ScriptedAgent(
  "War Machine",
  AGGRESSIVE_WARRIOR,
  { x: 0, y: 0 },
  createGoalsFromPersonality(AGGRESSIVE_WARRIOR),
  { strategy: 'aggressive' }  // 'aggressive', 'defensive', 'gatherer', 'explorer', 'social'
);
```

### Method 4: Real LLM Integration

```typescript
const agent = new LLMAgent(
  "GPT Agent",
  DIPLOMAT,
  { x: 15, y: 15 },
  createGoalsFromPersonality(DIPLOMAT),
  {
    mock: false,
    endpoint: 'https://api.openai.com/v1',
    apiKey: 'your-api-key',
    model: 'gpt-4'
  }
);
```

---

## 🗺️ Creating Custom Worlds

```typescript
import { World } from './world';

const customWorld = new World({
  width: 30,
  height: 30,
  resourceDensity: 0.25,    // 0-1, percentage of tiles with resources
  obstacleDensity: 0.15,    // 0-1, percentage of tiles with obstacles
  eventFrequency: 0.1       // 0-1, chance of events spawning
});
```

---

## 🎯 Creating Custom Simulation Presets

```typescript
import { PresetConfig } from './simulations';

const myPreset: PresetConfig = {
  name: 'Battle Royale',
  description: '10 agents fight until only one remains',
  worldWidth: 30,
  worldHeight: 30,
  resourceDensity: 0.1,
  obstacleDensity: 0.2,
  maxTurns: 200,
  turnDuration: 1000,
  agentPersonalities: [
    AGGRESSIVE_WARRIOR,
    AGGRESSIVE_WARRIOR,
    AGGRESSIVE_WARRIOR,
    CAUTIOUS_SURVIVOR,
    CAUTIOUS_SURVIVOR,
    LONE_WOLF,
    LONE_WOLF,
    DIPLOMAT,
    CURIOUS_EXPLORER,
    COOPERATIVE_HELPER,
  ],
  globalGoals: [
    {
      id: uuidv4(),
      description: 'Be the last one standing',
      priority: 'primary',
      completed: false,
    }
  ],
};
```

---

## 📊 Understanding Agent Stats

Each agent has 6 core stats (0-100):

- **Energy**: Depletes with actions, restored by resting
- **Aggression**: Likelihood to attack, damage dealt
- **Cooperation**: Willingness to form alliances and share
- **Risk Tolerance**: Probability of taking dangerous actions
- **Curiosity**: Drive to explore unknown areas
- **Empathy**: Consideration for other agents' well-being

These traits influence decision-making in both LLM and scripted agents.

---

## 🔧 Configuration

### Backend Port

Edit `backend/src/index.ts`:
```typescript
const PORT = process.env.PORT || 3001;
```

Or set environment variable:
```bash
PORT=4000 npm run dev
```

### Frontend API URL

Edit `frontend/src/api.ts`:
```typescript
const API_BASE = 'http://localhost:3001/api';
```

### Turn Duration

When creating a simulation:
```json
{
  "preset": "cooperative",
  "config": {
    "turnDuration": 1000  // milliseconds per turn
  }
}
```

---

## 📝 Logging and Exports

### Log Types

- `action` - Agent actions (move, gather, attack, etc.)
- `interaction` - Agent-to-agent interactions
- `resource_change` - Resource gathering/sharing
- `dialogue` - Communication between agents
- `state_update` - World/simulation state changes
- `event` - Random world events

### Export Formats

**JSON Export:**
```json
{
  "exportTime": "2024-01-15T10:30:00.000Z",
  "totalLogs": 1250,
  "logs": [...]
}
```

**Transcript Export:**
```
================================================================================
LLM THUNDERDOME - SIMULATION TRANSCRIPT
================================================================================
Export Time: 2024-01-15T10:30:00.000Z
Total Events: 1250
================================================================================

────────────────────────────────────────────────────────────────────────────────
TURN 1
────────────────────────────────────────────────────────────────────────────────

[10:15:23] ⚡ ACTION
  Cooperative Helper 1 performed GATHER successfully
  ...
```

---

## 🏆 Example Use Cases

### Research
- Study emergent behaviors in multi-agent systems
- Test negotiation algorithms
- Analyze resource allocation strategies

### Gaming
- AI tournament competitions
- Twitch streaming AI battles
- Educational demonstrations

### Development
- Test LLM reasoning capabilities
- Benchmark agent decision-making
- Prototype game AI systems

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Clear node_modules and reinstall
cd backend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Frontend won't connect
1. Verify backend is running on port 3001
2. Check browser console for errors
3. Ensure WebSocket URL is correct in `api.ts`

### Agents not moving
- Check that simulation status is "running"
- Click "Step" to manually advance one turn
- Review Event Log for error messages

### Port already in use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in backend/src/index.ts
```

---

## 🛠️ Building for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

---

## 📖 Additional Resources

- **TypeScript Docs**: https://www.typescriptlang.org/docs/
- **React Docs**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Zustand**: https://github.com/pmndrs/zustand
- **Express.js**: https://expressjs.com/

---

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- Additional agent personalities
- New simulation presets
- Advanced world generation algorithms
- Replay system UI
- Heatmap visualizations
- Agent learning/evolution
- Multiplayer mode

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🎮 Have Fun!

LLM Thunderdome is designed to be both educational and entertaining. Watch agents cooperate, compete, and surprise you with emergent behaviors. The possibilities are endless!

**Pro Tip**: Try creating agents with opposing goals in the same simulation and watch the drama unfold! 🍿

---

Built with ❤️ for the AI community
