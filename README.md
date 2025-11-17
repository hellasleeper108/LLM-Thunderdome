# 🎮 LLM Thunderdome

**A Multi-Agent Simulation Environment Where AI Agents Battle, Cooperate, and Evolve**

LLM Thunderdome is a sophisticated simulation platform where multiple AI agents (powered by LLMs or scripted logic) interact within a dynamic 2D/3D world. Watch agents develop relationships, evolve personalities, form alliances, engage in combat, negotiate complex deals, and create emergent narratives—all while their memories, emotions, and social bonds shape every decision.

## ✨ What Makes It Special?

- 🧠 **Advanced Memory System**: Agents have episodic and semantic memory with realistic consolidation
- 🤝 **Multi-Dimensional Relationships**: Trust, fear, respect, rivalry, and loyalty evolve dynamically
- 🎭 **Personality Evolution**: Traits drift based on experiences, creating genuine character arcs
- 🎬 **Cinematic Replays**: Auto-generated camera paths with smart highlighting of key moments
- ⚡ **Real-Time 3D Visualization**: WebGL rendering with smooth animations
- 🎯 **Sophisticated AI**: LLM integration or rule-based strategies with 5+ behavior modes

---

## 🌟 Features

### Core Capabilities

- **Multi-Agent System**: Support for both LLM-powered and rule-based scripted agents
- **Dynamic World**: 2D grid-based environment with resources, obstacles, and random events
- **Turn-Based Engine**: Sophisticated simulation engine with pause, step, and replay capabilities
- **Real-Time Dashboard**: React-based frontend with live updates via WebSocket
- **Event Logging**: Comprehensive logging system with JSON and transcript export
- **Preset Scenarios**: Three pre-configured simulation types out of the box

### Advanced Systems

- **Advanced Memory System**: Dual-tier episodic and semantic memory with automatic consolidation
- **Social Graph**: Multi-dimensional relationship tracking (trust, fear, respect, rivalry, loyalty)
- **Alliance System**: Dynamic alliance formation and breaking with strength tracking
- **Trait Drift**: Personality traits evolve based on actions and experiences
- **Negotiation Engine**: Sophisticated trade, alliance, threat, and aid protocols
- **Cinematic Replays**: Generate smooth camera paths and highlights for replay visualization
- **WebGL Rendering**: Hardware-accelerated 3D visualization of the simulation world
- **Replay System**: Record, playback, and export complete simulation histories

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

## 🧠 Advanced Systems

### Memory System

Agents use a **dual-tier memory architecture** that mimics human memory:

#### Episodic Memory
- Stores specific experiences and events (max 100 episodes)
- Each episode has importance (0-100) and emotional valence (-100 to +100)
- Memories naturally decay over time (0.5 strength per turn)
- High-importance memories are retained longer

#### Semantic Memory
- Stores general facts and patterns (max 50 facts)
- Each fact has a confidence level (0-100)
- Facts are reinforced when re-observed, gaining confidence
- Rarely-accessed facts slowly lose confidence

#### Memory Consolidation
- Every 10 turns, important episodic memories are converted to semantic facts
- Creates a rich knowledge base that influences future decisions
- Balances short-term experiences with long-term learning

```typescript
// Example: Agent remembers a dangerous combat encounter
memoryManager.recordEpisode({
  content: "Attacked by Warrior Bot - barely survived!",
  importance: 85,
  emotionalValence: -70, // negative experience
  context: { agentId: "warrior-123" }
});
```

### Social Graph System

Agents maintain a **multi-dimensional relationship graph** with other agents:

- **Trust** (0-100): Reliability, likelihood to cooperate
- **Fear** (0-100): Threat perception, avoidance behavior
- **Respect** (0-100): Admiration for capabilities
- **Rivalry** (0-100): Competitive tension
- **Loyalty** (0-100): Commitment to alliance

**Key Features:**
- Relationships are **directed** (A's trust of B ≠ B's trust of A)
- All relationships naturally decay by 1 point per turn
- Actions modify specific dimensions (e.g., betrayal reduces trust, combat increases fear)
- Enables realistic, emergent social dynamics

### Alliance System

Agents can form strategic partnerships with dynamic strength:

**Formation:**
- Based on personality compatibility (60%), trust (30%), and loyalty (10%)
- Can include conditions: mutual protection, resource sharing, exclusivity

**Tracking:**
- Alliance strength (0-100) determines bond durability
- Stronger alliances are harder to break

**Breaking:**
- Reduces trust and loyalty dramatically
- Increases rivalry between former allies
- Can trigger cascade effects in larger alliance networks

### Trait Drift System

Personality traits **dynamically evolve** based on agent experiences:

- **Actions**: Aggressive actions → increase aggression trait
- **Outcomes**: Successful cooperation → increase cooperation trait
- **Relationships**: Strong alliances → increase empathy trait
- **Experiences**: Dangerous events → adjust risk tolerance

**Constraints:**
- Maximum ±5 change per turn (prevents wild swings)
- All traits bounded [0, 100]
- Creates realistic character arcs over time

Example: A cautious agent that repeatedly succeeds in combat may gradually become more aggressive and risk-tolerant.

### Negotiation Engine

Sophisticated protocol system for agent-to-agent interactions:

**Protocols:**
1. **TRADE**: Exchange resources (food, water, materials)
2. **ALLIANCE**: Form partnerships with conditions
3. **THREAT**: Coerce behavior through intimidation
4. **REQUEST_AID**: Ask for help from allies or neighbors

**Evaluation:**
- Considers personality traits (cooperation, empathy, risk tolerance)
- Factors in relationships (trust, fear, loyalty)
- Calculates resource needs and strategic value
- May generate counter-offers if initial offer is rejected

### Cinematic Replay System

Generate **professional-quality replay visualizations** with smooth camera movements:

**Features:**
- **Camera Paths**: Smooth transitions between key moments with easing
- **Highlights**: Visual markers for important events with emoji labels
- **Focus Modes**: Different cinematic styles
  - `wars` - Follows combat and deaths
  - `alliances` - Tracks alliance formation/breaking
  - `evolution` - Shows resource gathering and trait evolution
  - `religion` - Follows religious activities (if enabled)
  - `random` - General interesting moments

**Technical:**
- Analyzes replay data to identify key moments
- Generates 3D camera keyframes with position and lookAt vectors
- Creates highlight sequences with agent IDs, locations, and labels
- Exports as JSON for frontend consumption

```http
GET /api/simulation/replay/cinematic?focusOn=wars
```

---

## 🏗️ Architecture

### Backend (Node.js + TypeScript + Express)

```
backend/
├── src/
│   ├── agents/                    # Agent system
│   │   ├── BaseAgent.ts           # Abstract base class
│   │   ├── LLMAgent.ts            # LLM-powered agents
│   │   ├── ScriptedAgent.ts       # Rule-based agents
│   │   ├── AllianceManager.ts     # Alliance system
│   │   ├── SocialGraph.ts         # Relationship tracking
│   │   ├── TraitDrift.ts          # Personality evolution
│   │   ├── personalities.ts       # Predefined personalities
│   │   └── memory/                # Memory subsystem
│   │       ├── MemoryManager.ts   # Memory orchestrator
│   │       ├── EpisodicMemory.ts  # Event memories
│   │       └── SemanticMemory.ts  # Fact memories
│   ├── world/                     # World management
│   │   └── World.ts               # 2D grid with resources
│   ├── engine/                    # Simulation engine
│   │   ├── SimulationEngine.ts    # Turn-based orchestrator
│   │   └── NegotiationEngine.ts   # Trade/alliance protocols
│   ├── state/                     # State management
│   │   └── StateManager.ts        # Centralized state + pub/sub
│   ├── logging/                   # Logging system
│   │   ├── EventLogger.ts         # Event logging
│   │   ├── ReplayManager.ts       # Replay recording
│   │   └── CinematicReplay.ts     # Camera path generation
│   ├── events/                    # Communication
│   │   └── CommunicationProtocol.ts
│   ├── schemas/                   # Type definitions
│   │   └── types.ts               # All TypeScript types
│   ├── simulations/               # Presets
│   │   └── presets.ts             # Scenario configurations
│   └── index.ts                   # Main server (REST + WebSocket)
```

### Frontend (React + Vite + TypeScript + Tailwind)

```
frontend/
├── src/
│   ├── components/
│   │   ├── ArenaView.tsx          # 2D grid visualization
│   │   ├── WebGLArena.tsx         # 3D WebGL rendering
│   │   ├── ReplayViewer.tsx       # Replay playback + cinematic mode
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

#### Logging and Replay

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

**Get Current Replay**
```http
GET /api/simulation/replay
```

**Get Cinematic Script**
```http
GET /api/simulation/replay/cinematic?focusOn=wars
```

Query Parameters:
- `focusOn`: Focus mode for camera path
  - `wars` - Follows combat and deaths
  - `alliances` - Tracks alliance formation/breaking
  - `evolution` - Shows resource gathering and trait evolution
  - `religion` - Follows religious activities
  - `random` - General interesting moments (default)

Returns:
```json
{
  "replayId": "replay-uuid",
  "cameraPath": [
    {
      "turn": 0,
      "position": { "x": 10, "y": 10, "z": 25 },
      "lookAt": { "x": 10, "y": 10, "z": 0 },
      "easing": "easeInOut",
      "duration": 3
    }
  ],
  "highlights": [
    {
      "turn": 5,
      "agentIds": ["agent-1", "agent-2"],
      "worldLocation": { "x": 8, "y": 12 },
      "label": "⚔️ Combat (3 attacks)",
      "intensity": 0.9,
      "duration": 3
    }
  ],
  "metadata": {
    "totalTurns": 100,
    "focusMode": "wars",
    "generatedAt": 1234567890
  }
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

### Trait Evolution

Thanks to the **Trait Drift System**, agent personalities are not static:

- Successful aggressive actions increase aggression over time
- Cooperative successes increase cooperation and empathy
- Repeated failures may decrease risk tolerance
- Strong alliances gradually increase loyalty and empathy

This creates dynamic character arcs where a cautious explorer might become a brave warrior, or a lone wolf might learn to value cooperation after positive experiences with allies.

### Relationships and Social Dynamics

Agents track **multi-dimensional relationships** with every other agent they encounter:

**Relationship Dimensions:**
- **Trust** (0-100): Built through cooperation, destroyed by betrayal
- **Fear** (0-100): Increases from combat losses, decreases when threats are eliminated
- **Respect** (0-100): Earned through impressive actions, lost through incompetence
- **Rivalry** (0-100): Grows from competition, reduced by alliances
- **Loyalty** (0-100): Strengthened by alliances, shattered by betrayal

**Key Properties:**
- Relationships are **asymmetric** - Agent A's trust of Agent B is independent of B's trust of A
- All relationship values naturally decay by 1 point per turn (simulates fading memories)
- Actions immediately update specific dimensions (e.g., attack increases fear, sharing increases trust)
- Relationships influence negotiation success rates and alliance formation

**Example Scenario:**
```
Turn 1: Agent A shares food with Agent B
  → A→B trust: +15
  → A→B loyalty: +10

Turn 10: Agent B attacks Agent A
  → A→B trust: -30
  → A→B fear: +40
  → A→B rivalry: +20
  → A→B loyalty: -25

Turn 20: Agents decay naturally
  → All dimensions: -1 per turn for 10 turns
```

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

## 🎬 Using Cinematic Replays

The cinematic replay system generates professional-quality camera paths for visualizing simulations:

### Frontend (ReplayViewer)

1. **Open Replay Viewer** component in the frontend
2. **Load a replay** from a completed simulation
3. **Toggle Cinematic Mode** - Click the "🎥 Cinematic" button
4. **Select Focus Mode** - Choose from dropdown before loading:
   - `wars` - Camera follows combat and deaths
   - `alliances` - Tracks alliance formations and betrayals
   - `evolution` - Shows resource gathering and trait changes
   - `religion` - Follows religious activities
   - `random` - General highlights
5. **Watch the replay** - Camera automatically follows key moments
6. **View Highlights** - See emoji-labeled highlights as they occur

### Backend API

Fetch cinematic scripts programmatically:

```typescript
// Get cinematic script for wars focus
const response = await fetch(
  'http://localhost:3001/api/simulation/replay/cinematic?focusOn=wars'
);
const script = await response.json();

// Script contains:
// - cameraPath: Array of camera keyframes with 3D positions
// - highlights: Array of important moments with labels
// - metadata: Turn count, focus mode, generation time
```

### Camera Path Structure

```typescript
interface CameraKeyframe {
  turn: number;                    // When to reach this position
  position: {x, y, z};             // Camera 3D position
  lookAt: {x, y, z};               // Point camera is looking at
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  duration?: number;               // Seconds to hold position
}
```

### Highlight Structure

```typescript
interface HighlightSequence {
  turn: number;                    // When highlight starts
  agentIds?: string[];             // Agents involved
  worldLocation?: {x, y};          // World coordinates
  label?: string;                  // Emoji + description
  intensity?: number;              // 0-1 visual emphasis
  duration?: number;               // Turns to show highlight
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

### Research & Academia
- **Emergent Behavior Studies**: Observe how simple rules create complex social dynamics
- **Memory Systems Research**: Study episodic vs semantic memory consolidation
- **Social Network Analysis**: Track relationship evolution in multi-agent systems
- **Negotiation Algorithm Testing**: Compare different trade and alliance strategies
- **Personality Psychology**: Watch trait drift create realistic character development

### Gaming & Entertainment
- **AI Tournament Competitions**: Host bracket-style AI battles with different strategies
- **Twitch/YouTube Content**: Stream cinematic replays with commentary
- **Educational Demonstrations**: Show students how AI agents make decisions
- **AI vs AI Challenges**: Pit different LLMs against each other
- **Speedrun Simulations**: Optimize agent strategies for fastest wins

### Development & Testing
- **LLM Benchmarking**: Compare reasoning capabilities across different models
- **Multi-Agent Coordination**: Test swarm intelligence and coordination algorithms
- **Procedural Story Generation**: Use agent interactions to create narratives
- **Game AI Prototyping**: Test agent behaviors before full game implementation
- **Reinforcement Learning**: Use simulation as training environment

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

Contributions are welcome! Areas for potential improvement:

**Agent Enhancements:**
- Additional agent personalities
- More sophisticated decision-making strategies
- Machine learning integration for agent learning
- Cross-agent communication protocols

**World Features:**
- Procedural terrain generation
- Weather systems and seasonal effects
- Dynamic resource nodes (mines, forests, etc.)
- Natural disasters and world events

**Visualization:**
- Heatmap overlays (resource density, danger zones)
- Relationship graph visualization
- Time-series charts for agent stats
- Advanced particle effects for combat/magic

**Simulation Features:**
- Tournament mode with bracket system
- Multiplayer spectator mode
- Custom scripting language for agent behaviors
- Save/load simulation states

**Analytics:**
- Post-simulation analysis reports
- Strategy effectiveness metrics
- Agent behavior pattern detection
- Statistical comparison tools

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🎮 Have Fun!

LLM Thunderdome is designed to be both educational and entertaining. Watch agents cooperate, compete, and surprise you with emergent behaviors. The possibilities are endless!

**Pro Tip**: Try creating agents with opposing goals in the same simulation and watch the drama unfold! 🍿

---

Built with ❤️ for the AI community
