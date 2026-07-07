import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { Department } from "@mission-control/domain";
import { ROOM_POSITIONS, ROOM_ACCENTS, STATE_COLORS } from "./layout.js";
import type { RoomSceneState, SceneState } from "./scene-state.js";

// Procedural low-poly facility (Phase 6, VISUAL_DESIGN §5-§7). Everything is
// generated from primitives in code — no imported models. The scene renders
// the deterministic SceneState and nothing else: ambient motion is limited
// to the Command Core beacon and stops entirely in reduced-motion mode.

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null;
  } catch {
    return false;
  }
}

const FLAT = { flatShading: true } as const;

function roomStateColor(room: RoomSceneState): string {
  if (room.failed) return STATE_COLORS.failed;
  if (room.waiting) return STATE_COLORS.waiting;
  if (room.workingCount > 0) return STATE_COLORS.working;
  if (room.stageHighlight) return STATE_COLORS.stage;
  return STATE_COLORS.neutral;
}

/** Shared room shell: floor slab, two back walls, and a status light strip. */
function RoomShell({ room, children }: { room: RoomSceneState; children?: React.ReactNode }) {
  const [x, z] = ROOM_POSITIONS[room.department];
  const accent = ROOM_ACCENTS[room.department];
  const stateColor = roomStateColor(room);
  const emissiveIntensity =
    room.failed || room.waiting || room.workingCount > 0 ? 0.9 : room.stageHighlight ? 0.5 : 0.15;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[5.6, 0.3, 5.6]} />
        <meshStandardMaterial color="#1a2432" {...FLAT} />
      </mesh>
      {/* Back walls (open toward the core so interiors stay readable). */}
      <mesh position={[0, 0.9, -2.65]}>
        <boxGeometry args={[5.6, 1.8, 0.3]} />
        <meshStandardMaterial color="#22303f" {...FLAT} />
      </mesh>
      <mesh position={[x < 0 ? -2.65 : 2.65, 0.9, 0]}>
        <boxGeometry args={[0.3, 1.8, 5.6]} />
        <meshStandardMaterial color="#22303f" {...FLAT} />
      </mesh>
      {/* Status light strip along the floor edge. */}
      <mesh position={[0, 0.06, 2.65]}>
        <boxGeometry args={[5.2, 0.12, 0.18]} />
        <meshStandardMaterial
          color={stateColor}
          emissive={stateColor}
          emissiveIntensity={emissiveIntensity}
          {...FLAT}
        />
      </mesh>
      {/* Department accent marker. */}
      <mesh position={[-2.2, 1.95, -2.2]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} {...FLAT} />
      </mesh>
      {children}
    </group>
  );
}

/** Department-specific props, all primitives (VISUAL_DESIGN §6). */
function RoomProps({ department }: { department: Department }) {
  switch (department) {
    case "planning_bay":
      return (
        <>
          <mesh position={[0, 0.45, -1.6]}>
            <boxGeometry args={[3.6, 0.9, 0.15]} />
            <meshStandardMaterial
              color="#2b4a63"
              emissive="#2b6a93"
              emissiveIntensity={0.35}
              {...FLAT}
            />
          </mesh>
          <mesh position={[0, 0.35, 0.4]}>
            <boxGeometry args={[2.4, 0.7, 1.2]} />
            <meshStandardMaterial color="#2c3d52" {...FLAT} />
          </mesh>
          {[-0.7, 0, 0.7].map((dx) => (
            <mesh key={dx} position={[dx, 0.85, 0.4]}>
              <boxGeometry args={[0.45, 0.3, 0.45]} />
              <meshStandardMaterial color="#7fd0ff" {...FLAT} />
            </mesh>
          ))}
        </>
      );
    case "research_archive":
      return (
        <>
          {[-1.4, 0.2].map((dx) => (
            <mesh key={dx} position={[dx, 0.9, -1.4]}>
              <boxGeometry args={[1.2, 1.8, 0.6]} />
              <meshStandardMaterial color="#33415a" {...FLAT} />
            </mesh>
          ))}
          <mesh position={[1.6, 0.55, 0.6]}>
            <cylinderGeometry args={[0.35, 0.45, 1.1, 6]} />
            <meshStandardMaterial
              color="#9a8cff"
              emissive="#4a3f99"
              emissiveIntensity={0.4}
              {...FLAT}
            />
          </mesh>
        </>
      );
    case "build_workshop":
      return (
        <>
          <mesh position={[0, 0.5, -1.2]}>
            <boxGeometry args={[3.2, 1, 1.2]} />
            <meshStandardMaterial color="#3a4a5e" {...FLAT} />
          </mesh>
          <mesh position={[-1, 1.4, -1.2]} rotation={[0, 0, Math.PI / 5]}>
            <boxGeometry args={[0.25, 1.4, 0.25]} />
            <meshStandardMaterial color="#ffb46b" {...FLAT} />
          </mesh>
          <mesh position={[1.3, 0.35, 0.8]}>
            <boxGeometry args={[1.4, 0.7, 0.8]} />
            <meshStandardMaterial color="#2c3d52" {...FLAT} />
          </mesh>
        </>
      );
    case "testing_lab":
      return (
        <>
          <mesh position={[-1, 0.9, -1.2]}>
            <cylinderGeometry args={[0.8, 0.9, 1.8, 8]} />
            <meshStandardMaterial
              color="#2a4a45"
              emissive="#1f6a5a"
              emissiveIntensity={0.3}
              transparent
              opacity={0.85}
              {...FLAT}
            />
          </mesh>
          {[0.6, 1.4].map((dx, i) => (
            <mesh key={dx} position={[dx, 0.65 + i * 0.25, 0.4]}>
              <boxGeometry args={[0.35, 1.3 + i * 0.5, 0.35]} />
              <meshStandardMaterial
                color="#5fd39a"
                emissive="#2a6a4d"
                emissiveIntensity={0.35}
                {...FLAT}
              />
            </mesh>
          ))}
        </>
      );
    case "memory_vault":
      return (
        <>
          {[-1.4, 0, 1.4].map((dx) => (
            <mesh key={dx} position={[dx, 1, -1.4]}>
              <cylinderGeometry args={[0.45, 0.55, 2, 6]} />
              <meshStandardMaterial color="#2f4a55" {...FLAT} />
            </mesh>
          ))}
          <mesh position={[0.4, 0.75, 0.7]} rotation={[0, Math.PI / 6, 0]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial
              color="#66e0d0"
              emissive="#2a8a80"
              emissiveIntensity={0.6}
              {...FLAT}
            />
          </mesh>
        </>
      );
    case "security_gate":
      return (
        <>
          {[-1, 1].map((dx) => (
            <mesh key={dx} position={[dx, 1, 0]}>
              <boxGeometry args={[0.5, 2, 0.5]} />
              <meshStandardMaterial color="#3a4a5e" {...FLAT} />
            </mesh>
          ))}
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[2.5, 0.4, 0.5]} />
            <meshStandardMaterial color="#2c3d52" {...FLAT} />
          </mesh>
          <mesh position={[0, 2.3, 0]}>
            <sphereGeometry args={[0.28, 8, 6]} />
            <meshStandardMaterial
              color="#ffc66b"
              emissive="#aa7a2a"
              emissiveIntensity={0.7}
              {...FLAT}
            />
          </mesh>
        </>
      );
    case "delivery_dock":
      return (
        <>
          <mesh position={[0, 0.25, -1]}>
            <boxGeometry args={[3.4, 0.5, 2]} />
            <meshStandardMaterial color="#3a4a5e" {...FLAT} />
          </mesh>
          {[
            [-0.8, 0.75],
            [0.4, 0.75],
            [-0.2, 1.25],
          ].map(([dx, dy], i) => (
            <mesh key={i} position={[dx!, dy!, -1]}>
              <boxGeometry args={[0.7, 0.5, 0.7]} />
              <meshStandardMaterial color="#c48a5a" {...FLAT} />
            </mesh>
          ))}
        </>
      );
    default:
      return null;
  }
}

/** Command Core: dispatch platform, holographic project model, stage beacon. */
function CommandCore({ idle, reducedMotion }: { idle: boolean; reducedMotion: boolean }) {
  const holoRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!reducedMotion && holoRef.current) {
      // Ambient identity motion only — never presented as work.
      holoRef.current.rotation.y += delta * 0.3;
    }
  });
  return (
    <group>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[3.4, 3.7, 0.4, 8]} />
        <meshStandardMaterial color="#1e2a3a" {...FLAT} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.6, 1.8, 0.3, 8]} />
        <meshStandardMaterial color="#2c3d52" {...FLAT} />
      </mesh>
      <mesh ref={holoRef} position={[0, 1.5, 0]}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial
          color="#57c4ff"
          emissive="#1a4a66"
          emissiveIntensity={idle ? 0.4 : 0.8}
          transparent
          opacity={0.9}
          {...FLAT}
        />
      </mesh>
    </group>
  );
}

/** One reusable robot (VISUAL_DESIGN §7): static placement in Phase 6. */
function Robot({ at }: { at: Department }) {
  const [x, z] = ROOM_POSITIONS[at];
  const offset = at === "command_core" ? 2.4 : 1.9;
  return (
    <group position={[x, 0, z + offset]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.6, 0.7, 0.5]} />
        <meshStandardMaterial color="#c8d6e5" {...FLAT} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.5, 0.4, 0.45]} />
        <meshStandardMaterial color="#dfe9f2" {...FLAT} />
      </mesh>
      <mesh position={[0, 1.05, 0.24]}>
        <planeGeometry args={[0.34, 0.2]} />
        <meshStandardMaterial color="#0d1218" emissive="#57c4ff" emissiveIntensity={0.8} />
      </mesh>
      {[-0.4, 0.4].map((dx) => (
        <mesh key={dx} position={[dx, 0.5, 0]}>
          <boxGeometry args={[0.15, 0.5, 0.15]} />
          <meshStandardMaterial color="#9fb2c4" {...FLAT} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.2, 8]} />
        <meshStandardMaterial color="#5a6b7d" {...FLAT} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial
          color="#5fd39a"
          emissive="#2a6a4d"
          emissiveIntensity={0.9}
          {...FLAT}
        />
      </mesh>
    </group>
  );
}

function Paths() {
  const departments = useMemo(
    () => Object.entries(ROOM_POSITIONS).filter(([d]) => d !== "command_core"),
    [],
  );
  return (
    <>
      {departments.map(([department, [x, z]]) => {
        const length = Math.hypot(x, z) - 5;
        const angle = Math.atan2(x, z);
        return (
          <mesh
            key={department}
            position={[x / 2, 0.02, z / 2]}
            rotation={[-Math.PI / 2, 0, -angle]}
          >
            <planeGeometry args={[0.8, length]} />
            <meshStandardMaterial color="#202c3b" />
          </mesh>
        );
      })}
    </>
  );
}

export function Facility({ scene, reducedMotion }: { scene: SceneState; reducedMotion: boolean }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [16, 16, 16], zoom: 12, near: 0.1, far: 200 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      frameloop={reducedMotion ? "demand" : "always"}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0d1218"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[10, 18, 8]} intensity={1.0} />
      {/* Facility ground */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[26, 0.3, 26]} />
        <meshStandardMaterial color="#131b26" {...FLAT} />
      </mesh>
      <Paths />
      <CommandCore idle={scene.idle} reducedMotion={reducedMotion} />
      {scene.rooms
        .filter((room) => room.department !== "command_core")
        .map((room) => (
          <RoomShell key={room.department} room={room}>
            <RoomProps department={room.department} />
          </RoomShell>
        ))}
      <Robot at={scene.robotAt} />
    </Canvas>
  );
}
