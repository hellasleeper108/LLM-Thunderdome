/**
 * WebGL 3D Arena Component
 * Renders the simulation world in 3D using Three.js
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { AgentState, WorldState, TileType } from '../types';

// Three.js will be imported dynamically to avoid SSR issues
let THREE: any;
let OrbitControls: any;

interface Agent3D {
  id: string;
  mesh: any; // THREE.Mesh
  light: any; // THREE.PointLight
  particles: any; // THREE.Points
}

interface WorldEvent3D {
  id: string;
  particles: any; // THREE.Points
  mesh: any; // THREE.Mesh
}

export function WebGLArena() {
  const world = useStore((state) => state.world);
  const simulation = useStore((state) => state.simulation);
  const selectedAgent = useStore((state) => state.selectedAgent);
  const selectAgent = useStore((state) => state.selectAgent);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const agentsRef = useRef<Map<string, Agent3D>>(new Map());
  const eventsRef = useRef<Map<string, WorldEvent3D>>(new Map());
  const gridRef = useRef<any>(null);
  const animationFrameRef = useRef<number>();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Three.js
  useEffect(() => {
    const initThree = async () => {
      try {
        // Dynamically import Three.js
        const threeModule = await import('three');
        THREE = threeModule;

        // Import OrbitControls
        const { OrbitControls: Controls } = await import(
          'three/examples/jsm/controls/OrbitControls.js'
        );
        OrbitControls = Controls;

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load Three.js:', err);
        setError('Failed to load 3D renderer. Please install three.js package.');
        setIsLoading(false);
      }
    };

    initThree();
  }, []);

  // Initialize scene
  useEffect(() => {
    if (isLoading || error || !THREE || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 20, 100);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(20, 25, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minDistance = 10;
    controls.maxDistance = 80;
    controlsRef.current = controls;

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Update controls
      controls.update();

      // Animate agents
      agentsRef.current.forEach((agent3d) => {
        // Gentle bobbing animation
        agent3d.mesh.position.y =
          0.5 + Math.sin(Date.now() * 0.002 + agent3d.mesh.position.x) * 0.1;

        // Rotate
        agent3d.mesh.rotation.y += 0.01;

        // Update particles
        if (agent3d.particles) {
          agent3d.particles.rotation.y += 0.02;
        }
      });

      // Animate event particles
      eventsRef.current.forEach((event3d) => {
        if (event3d.particles) {
          event3d.particles.rotation.y += 0.01;

          // Pulsate
          const scale = 1 + Math.sin(Date.now() * 0.003) * 0.2;
          event3d.particles.scale.set(scale, scale, scale);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [isLoading, error]);

  // Create 3D grid
  useEffect(() => {
    if (!world || !sceneRef.current || !THREE) return;

    const scene = sceneRef.current;

    // Remove old grid
    if (gridRef.current) {
      scene.remove(gridRef.current);
    }

    const gridGroup = new THREE.Group();

    // Create floor grid
    const gridHelper = new THREE.GridHelper(world.width, world.width, 0x444444, 0x222222);
    gridGroup.add(gridHelper);

    // Create floor plane for shadows
    const planeGeometry = new THREE.PlaneGeometry(world.width, world.height);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    gridGroup.add(plane);

    // Add tile visualization
    world.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        const tileGeometry = new THREE.BoxGeometry(0.9, 0.05, 0.9);
        let tileMaterial: any;

        // Color based on tile type
        switch (tile.type) {
          case TileType.RESOURCE_FOOD:
            tileMaterial = new THREE.MeshStandardMaterial({
              color: 0x44ff44,
              emissive: 0x002200,
            });
            break;
          case TileType.RESOURCE_WATER:
            tileMaterial = new THREE.MeshStandardMaterial({
              color: 0x4444ff,
              emissive: 0x000022,
            });
            break;
          case TileType.RESOURCE_MATERIAL:
            tileMaterial = new THREE.MeshStandardMaterial({
              color: 0xaa7744,
              emissive: 0x221100,
            });
            break;
          case TileType.OBSTACLE:
            tileMaterial = new THREE.MeshStandardMaterial({
              color: 0x666666,
              emissive: 0x111111,
            });
            break;
          case TileType.EVENT_STORM:
          case TileType.EVENT_ANOMALY:
          case TileType.EVENT_BOON:
            tileMaterial = new THREE.MeshStandardMaterial({
              color: 0xff00ff,
              emissive: 0x220022,
            });
            break;
          default:
            tileMaterial = new THREE.MeshStandardMaterial({
              color: 0x1a1a2e,
              emissive: 0x000000,
              transparent: true,
              opacity: 0.3,
            });
        }

        const tileMesh = new THREE.Mesh(tileGeometry, tileMaterial);
        tileMesh.position.set(
          x - world.width / 2 + 0.5,
          0,
          y - world.height / 2 + 0.5
        );
        tileMesh.castShadow = false;
        tileMesh.receiveShadow = true;

        gridGroup.add(tileMesh);
      });
    });

    scene.add(gridGroup);
    gridRef.current = gridGroup;
  }, [world]);

  // Update agents
  useEffect(() => {
    if (!simulation?.agents || !sceneRef.current || !THREE) return;

    const scene = sceneRef.current;
    const currentAgents = new Set(simulation.agents.map((a) => a.id));

    // Remove agents that no longer exist
    agentsRef.current.forEach((agent3d, agentId) => {
      if (!currentAgents.has(agentId)) {
        scene.remove(agent3d.mesh);
        scene.remove(agent3d.light);
        if (agent3d.particles) scene.remove(agent3d.particles);
        agentsRef.current.delete(agentId);
      }
    });

    // Add or update agents
    simulation.agents.forEach((agent) => {
      let agent3d = agentsRef.current.get(agent.id);

      if (!agent3d) {
        // Create new agent
        agent3d = createAgent3D(agent, world);
        scene.add(agent3d.mesh);
        scene.add(agent3d.light);
        if (agent3d.particles) scene.add(agent3d.particles);
        agentsRef.current.set(agent.id, agent3d);

        // Add click handler
        agent3d.mesh.userData = { agentId: agent.id };
      } else {
        // Update existing agent position and state
        updateAgent3D(agent3d, agent, world);
      }
    });
  }, [simulation?.agents, world]);

  // Create agent 3D object
  const createAgent3D = (agent: AgentState, world: WorldState | null): Agent3D => {
    if (!world) {
      throw new Error('World is required to create agent 3D');
    }

    // Agent body (cone shape)
    const geometry = new THREE.ConeGeometry(0.4, 1.2, 8);

    // Color based on personality or stats
    const hue = (agent.stats.cooperation / 100) * 120; // Green for cooperative, red for aggressive
    const color = new THREE.Color().setHSL(hue / 360, 0.7, 0.5);

    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.2,
      metalness: 0.3,
      roughness: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position
    const x = agent.position.x - world.width / 2 + 0.5;
    const z = agent.position.y - world.height / 2 + 0.5;
    mesh.position.set(x, 0.5, z);

    // Point light for agent (based on aggression)
    const lightColor = agent.stats.aggression > 50 ? 0xff4444 : 0x4444ff;
    const lightIntensity = agent.stats.aggression / 100;
    const light = new THREE.PointLight(lightColor, lightIntensity * 2, 5);
    light.position.copy(mesh.position);
    light.position.y += 1;

    // Particle trail
    const particleCount = 20;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = Math.random() * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: color,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.position.copy(mesh.position);

    return {
      id: agent.id,
      mesh,
      light,
      particles,
    };
  };

  // Update agent 3D object
  const updateAgent3D = (
    agent3d: Agent3D,
    agent: AgentState,
    world: WorldState | null
  ) => {
    if (!world) return;

    // Update position
    const x = agent.position.x - world.width / 2 + 0.5;
    const z = agent.position.y - world.height / 2 + 0.5;
    agent3d.mesh.position.x = x;
    agent3d.mesh.position.z = z;
    agent3d.light.position.x = x;
    agent3d.light.position.z = z;
    if (agent3d.particles) {
      agent3d.particles.position.x = x;
      agent3d.particles.position.z = z;
    }

    // Update color based on health
    const health = agent.health / 100;
    const material = agent3d.mesh.material as any;
    if (health < 0.5) {
      material.emissiveIntensity = 0.5 - health;
    }

    // Update light based on aggression
    const lightColor = agent.stats.aggression > 50 ? 0xff4444 : 0x4444ff;
    agent3d.light.color.setHex(lightColor);
    agent3d.light.intensity = (agent.stats.aggression / 100) * 2;

    // Make dead agents transparent
    if (!agent.isAlive) {
      material.transparent = true;
      material.opacity = 0.3;
      agent3d.light.intensity = 0;
    }
  };

  // Handle agent click
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      const meshes = Array.from(agentsRef.current.values()).map((a) => a.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const agentId = intersects[0].object.userData.agentId;
        const agent = simulation?.agents.find((a) => a.id === agentId);
        if (agent) {
          selectAgent(agent);
        }
      }
    };

    const container = containerRef.current;
    container?.addEventListener('click', handleClick);

    return () => {
      container?.removeEventListener('click', handleClick);
    };
  }, [simulation?.agents, selectAgent]);

  // Update world events (storms, anomalies, etc.)
  useEffect(() => {
    if (!world || !sceneRef.current || !THREE) return;

    const scene = sceneRef.current;

    // Clear existing event particles
    eventsRef.current.forEach((event3d) => {
      if (event3d.particles) scene.remove(event3d.particles);
      if (event3d.mesh) scene.remove(event3d.mesh);
    });
    eventsRef.current.clear();

    // Find event tiles
    world.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        const isEventTile =
          tile.type === TileType.EVENT_STORM ||
          tile.type === TileType.EVENT_ANOMALY ||
          tile.type === TileType.EVENT_BOON;

        if (isEventTile) {
          // Create particle effect for event
          const particleCount = 100;
          const particleGeometry = new THREE.BufferGeometry();
          const positions = new Float32Array(particleCount * 3);
          const colors = new Float32Array(particleCount * 3);

          // Determine color based on event type
          let baseColor: any; // THREE.Color
          switch (tile.type) {
            case TileType.EVENT_STORM:
              baseColor = new THREE.Color(0x8800ff); // Purple
              break;
            case TileType.EVENT_ANOMALY:
              baseColor = new THREE.Color(0xff0088); // Pink
              break;
            case TileType.EVENT_BOON:
              baseColor = new THREE.Color(0x00ffff); // Cyan
              break;
            default:
              baseColor = new THREE.Color(0xff00ff);
          }

          // Create particle positions in a sphere
          for (let i = 0; i < particleCount; i++) {
            const radius = Math.random() * 0.8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + 1;
            positions[i * 3 + 2] = radius * Math.cos(phi);

            colors[i * 3] = baseColor.r;
            colors[i * 3 + 1] = baseColor.g;
            colors[i * 3 + 2] = baseColor.b;
          }

          particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

          const particleMaterial = new THREE.PointsMaterial({
            size: 0.08,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });

          const particles = new THREE.Points(particleGeometry, particleMaterial);
          particles.position.set(
            x - world.width / 2 + 0.5,
            0,
            y - world.height / 2 + 0.5
          );

          scene.add(particles);

          // Create glowing mesh under particles
          const glowGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: 0.3,
            emissive: baseColor,
            emissiveIntensity: 0.8,
          });
          const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
          glowMesh.position.set(
            x - world.width / 2 + 0.5,
            0.05,
            y - world.height / 2 + 0.5
          );
          scene.add(glowMesh);

          const eventId = `${x}-${y}-${tile.type}`;
          eventsRef.current.set(eventId, {
            id: eventId,
            particles,
            mesh: glowMesh,
          });
        }
      });
    });
  }, [world]);

  // Highlight selected agent
  useEffect(() => {
    if (!selectedAgent) {
      // Remove all highlights
      agentsRef.current.forEach((agent3d) => {
        const material = agent3d.mesh.material as any;
        material.emissiveIntensity = 0.2;
      });
      return;
    }

    const agent3d = agentsRef.current.get(selectedAgent.id);
    if (agent3d) {
      // Remove previous highlights
      agentsRef.current.forEach((a) => {
        const mat = a.mesh.material as any;
        mat.emissiveIntensity = 0.2;
      });

      // Highlight selected
      const material = agent3d.mesh.material as any;
      material.emissiveIntensity = 0.8;
    }
  }, [selectedAgent]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded">
        <div className="text-center">
          <div className="text-white text-lg mb-2">Loading 3D Renderer...</div>
          <div className="text-gray-400 text-sm">Initializing Three.js</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">⚠️ 3D Renderer Error</div>
          <div className="text-gray-400 text-sm">{error}</div>
          <div className="text-gray-500 text-xs mt-2">
            Run: npm install three @types/three
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Controls overlay */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded p-3 text-white text-sm">
        <div className="font-bold mb-2">🎮 3D Controls</div>
        <div className="space-y-1 text-xs">
          <div>• Left Click + Drag: Rotate</div>
          <div>• Right Click + Drag: Pan</div>
          <div>• Scroll: Zoom</div>
          <div>• Click Agent: Select</div>
        </div>
      </div>

      {/* Stats overlay */}
      {simulation && (
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded p-3 text-white text-sm">
          <div className="font-bold mb-2">📊 Scene Stats</div>
          <div className="space-y-1 text-xs">
            <div>Agents: {agentsRef.current.size}</div>
            <div>Turn: {simulation.turn}</div>
            <div>
              Status:
              <span className={`ml-1 ${
                simulation.status === 'running' ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {simulation.status}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
