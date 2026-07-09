import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { DashboardState, Department } from "@mission-control/domain";
import { M } from "./materials.js";
import { ROBOT_HOME_POINTS, ROOM_ACCENTS, STATIONS } from "./layout.js";
import {
  createAnimator,
  ingest,
  tick,
  robotPlacements,
  activeRoutes,
  ROBOT_COUNT,
  type LiveActivity,
} from "./animation.js";
import type { Point } from "./layout.js";

// The office's small service robot (visual redesign, Stage 3): a rounded
// low-poly body with a readable face, two arms, and a wheel base. The
// animated variant walks the waypoint routes from the pure animator, leans
// into motion, performs a department-specific work gesture with a held prop
// (D-027), and carries a department-colored output home after a success.

import { DEPARTMENT_GESTURES, GESTURE_REST, gestureFrame } from "./gestures.js";
import { ROBOT_IDENTITIES, type RobotIdentity } from "./robot-identities.js";
import { makeLabelTexture } from "./signage.js";

const FLAT = { flatShading: true } as const;

import type { RobotPlacement } from "./animation.js";

const STATUS_LIGHT: Record<RobotPlacement["phase"], string> = {
  idle: "#5fd39a",
  ambient: "#5fd39a",
  travel: "#57c4ff",
  working: "#57c4ff",
  outcome: "#5fd39a",
  return: "#5fd39a",
  gate: "#ffc66b",
};

/** Hand prop for a department's work gesture: small procedural primitives. */
function GestureProp({ department }: { department: Department }) {
  const accent = ROOM_ACCENTS[department];
  switch (DEPARTMENT_GESTURES[department]) {
    case "type":
      return null;
    case "place": // task card
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.22, 0.02, 0.16]} />
            <meshStandardMaterial color={M.paper} {...FLAT} />
          </mesh>
          <mesh position={[-0.06, 0.015, 0]}>
            <boxGeometry args={[0.07, 0.012, 0.16]} />
            <meshStandardMaterial color={accent} {...FLAT} />
          </mesh>
        </group>
      );
    case "read": // reference book
      return (
        <group rotation={[0.4, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.24, 0.05, 0.18]} />
            <meshStandardMaterial color={accent} {...FLAT} />
          </mesh>
          <mesh position={[0, 0.032, 0]}>
            <boxGeometry args={[0.21, 0.02, 0.15]} />
            <meshStandardMaterial color={M.paper} {...FLAT} />
          </mesh>
        </group>
      );
    case "tinker": // wrench
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.26, 6]} />
            <meshStandardMaterial color={M.metal} {...FLAT} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.09, 0.08, 0.045]} />
            <meshStandardMaterial color={M.metal} {...FLAT} />
          </mesh>
        </group>
      );
    case "scan": // diagnostic probe with a glowing tip
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.24, 6]} />
            <meshStandardMaterial color={M.metal} {...FLAT} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
          </mesh>
        </group>
      );
    case "file": // memory cartridge
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.2, 0.12, 0.07]} />
            <meshStandardMaterial color={accent} {...FLAT} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.12, 0.07, 0.01]} />
            <meshStandardMaterial color={M.robotDark} {...FLAT} />
          </mesh>
        </group>
      );
    case "stamp": // approval stamp
      return (
        <group>
          <mesh position={[0, -0.03, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.075, 0.05, 8]} />
            <meshStandardMaterial color={M.robotDark} {...FLAT} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.035, 0.045, 0.11, 8]} />
            <meshStandardMaterial color={M.wood} {...FLAT} />
          </mesh>
        </group>
      );
    case "pack": // outgoing package
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.22, 0.28]} />
            <meshStandardMaterial color={M.wood} {...FLAT} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.06, 0.225, 0.285]} />
            <meshStandardMaterial color={M.paper} {...FLAT} />
          </mesh>
        </group>
      );
  }
}

export const PROP_REST_POSITION: [number, number, number] = [0, 0.62, 0.38];

/** Chest name badge: the robot's name in the shared plaque style (D-029). */
function NameBadge({ name, accent, y, z }: { name: string; accent: string; y: number; z: number }) {
  const texture = useMemo(() => makeLabelTexture(name, accent), [name, accent]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (texture === null) return null;
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[0.42, 0.0875]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** Head + torso silhouette per identity variant (D-029). */
function VariantShell({ identity }: { identity: RobotIdentity }) {
  const { variant, shell, accent } = identity;
  if (variant === "scout") {
    return (
      <>
        {/* Slim body with a dome head and a single visor eye */}
        <mesh position={[0, 0.46, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.29, 0.44, 10]} />
          <meshStandardMaterial color={shell} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.68, 0]} castShadow>
          <sphereGeometry args={[0.24, 10, 8]} />
          <meshStandardMaterial color={shell} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.98, 0]} castShadow>
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshStandardMaterial color={shell} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.99, 0.2]}>
          <planeGeometry args={[0.28, 0.11]} />
          <meshStandardMaterial color={M.robotDark} />
        </mesh>
        <mesh position={[0, 0.99, 0.205]}>
          <circleGeometry args={[0.045, 8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1} />
        </mesh>
      </>
    );
  }
  if (variant === "hauler") {
    return (
      <>
        {/* Boxy torso with a wide flat head and square eyes */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.62, 0.56, 0.46]} />
          <meshStandardMaterial color={shell} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.98, 0]} castShadow>
          <boxGeometry args={[0.52, 0.26, 0.36]} />
          <meshStandardMaterial color={shell} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.98, 0.19]}>
          <planeGeometry args={[0.42, 0.16]} />
          <meshStandardMaterial color={M.robotDark} />
        </mesh>
        {[-0.11, 0.11].map((x) => (
          <mesh key={x} position={[x, 0.98, 0.195]}>
            <planeGeometry args={[0.075, 0.075]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1} />
          </mesh>
        ))}
      </>
    );
  }
  // courier — the original silhouette
  return (
    <>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.5, 10]} />
        <meshStandardMaterial color={shell} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.76, 0]} castShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color={shell} {...FLAT} />
      </mesh>
      <mesh position={[0, 1.06, 0]} castShadow>
        <boxGeometry args={[0.42, 0.32, 0.36]} />
        <meshStandardMaterial color={shell} {...FLAT} />
      </mesh>
      <mesh position={[0, 1.06, 0.19]}>
        <planeGeometry args={[0.32, 0.2]} />
        <meshStandardMaterial color={M.robotDark} />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 1.07, 0.195]}>
          <circleGeometry args={[0.035, 8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1} />
        </mesh>
      ))}
    </>
  );
}

/** Variant-specific mount points for shared parts. */
const VARIANT_DIMS: Record<
  RobotIdentity["variant"],
  {
    antennaY: number;
    lightY: number;
    chestY: number;
    chestZ: number;
    badgeY: number;
    badgeZ: number;
    armX: number;
  }
> = {
  courier: {
    antennaY: 1.28,
    lightY: 1.38,
    chestY: 0.52,
    chestZ: 0.31,
    badgeY: 0.34,
    badgeZ: 0.345,
    armX: 0.38,
  },
  scout: {
    antennaY: 1.22,
    lightY: 1.33,
    chestY: 0.5,
    chestZ: 0.27,
    badgeY: 0.32,
    badgeZ: 0.3,
    armX: 0.32,
  },
  hauler: {
    antennaY: 1.18,
    lightY: 1.29,
    chestY: 0.58,
    chestZ: 0.24,
    badgeY: 0.34,
    badgeZ: 0.245,
    armX: 0.4,
  },
};

export function RobotBody({
  identity = ROBOT_IDENTITIES[0]!,
  statusColor = STATUS_LIGHT.idle,
  armsRef,
  leftArmRef,
  rightArmRef,
  wheelRef,
  propRef,
  gestureAt = null,
  carrying = null,
}: {
  identity?: RobotIdentity;
  statusColor?: string;
  armsRef?: React.Ref<THREE.Group>;
  leftArmRef?: React.Ref<THREE.Mesh>;
  rightArmRef?: React.Ref<THREE.Mesh>;
  wheelRef?: React.Ref<THREE.Mesh>;
  propRef?: React.Ref<THREE.Group>;
  gestureAt?: Department | null;
  carrying?: Department | null;
}) {
  const dims = VARIANT_DIMS[identity.variant];
  return (
    <>
      {/* Ball wheel (rolls with travel speed) */}
      <mesh ref={wheelRef ?? null} position={[0, 0.14, 0]} castShadow>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial color={M.robotDark} {...FLAT} />
      </mesh>
      <VariantShell identity={identity} />
      {/* Chest accent light */}
      <mesh position={[0, dims.chestY, dims.chestZ]}>
        <planeGeometry args={[0.2, 0.12]} />
        <meshStandardMaterial
          color={identity.accent}
          emissive={identity.accent}
          emissiveIntensity={0.4}
        />
      </mesh>
      <NameBadge name={identity.name} accent={identity.accent} y={dims.badgeY} z={dims.badgeZ} />
      {/* Arms (group animates while working; individual arms swing in gait) */}
      <group ref={armsRef ?? null}>
        {([-dims.armX, dims.armX] as const).map((x) => (
          <mesh
            key={x}
            ref={(x < 0 ? leftArmRef : rightArmRef) ?? null}
            position={[x, 0.55, 0]}
            rotation={[0, 0, x < 0 ? 0.25 : -0.25]}
            castShadow
          >
            <capsuleGeometry args={[0.06, 0.3, 3, 6]} />
            <meshStandardMaterial color={M.metal} {...FLAT} />
          </mesh>
        ))}
        {carrying !== null && (
          <mesh position={[0, 0.62, 0.34]} castShadow>
            <boxGeometry args={[0.26, 0.26, 0.26]} />
            <meshStandardMaterial
              color={ROOM_ACCENTS[carrying]}
              emissive={ROOM_ACCENTS[carrying]}
              emissiveIntensity={0.45}
              {...FLAT}
            />
          </mesh>
        )}
      </group>
      {/* Held work prop (D-027): animated by the gesture channels. */}
      {gestureAt !== null && (
        <group ref={propRef ?? null} position={PROP_REST_POSITION}>
          <GestureProp department={gestureAt} />
        </group>
      )}
      {/* Antenna status light */}
      <mesh position={[0, dims.antennaY, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 5]} />
        <meshStandardMaterial color={M.metal} {...FLAT} />
      </mesh>
      <mesh position={[0, dims.lightY, 0]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1} />
      </mesh>
    </>
  );
}

/** Static fleet used in reduced-motion mode: robot 0 at its rest station,
 *  the rest parked on their charging pads. */
export function StaticRobots({ at }: { at: Department }) {
  const [x, z] = STATIONS[at];
  return (
    <>
      <group position={[x, 0, z]} scale={ROBOT_IDENTITIES[0]!.scale}>
        <RobotBody identity={ROBOT_IDENTITIES[0]!} />
      </group>
      {ROBOT_HOME_POINTS.slice(1).map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]} scale={ROBOT_IDENTITIES[i + 1]!.scale}>
          <RobotBody identity={ROBOT_IDENTITIES[i + 1]!} />
        </group>
      ))}
    </>
  );
}

interface RobotVisual {
  statusColor: string;
  carrying: Department | null;
  gestureAt: Department | null;
}

const IDLE_VISUAL: RobotVisual = {
  statusColor: STATUS_LIGHT.idle,
  carrying: null,
  gestureAt: null,
};

/**
 * Event-driven robot fleet (D-028): one animator state lives in a ref and
 * advances each frame, dispatching jobs across the capped fleet; React
 * state updates happen only on discrete phase changes.
 */
export function AnimatedRobots({
  dashboard,
  onLiveActivities,
  onActiveRoutes,
}: {
  dashboard: DashboardState;
  onLiveActivities: (lives: LiveActivity[]) => void;
  onActiveRoutes: (routes: Point[][]) => void;
}) {
  const animRef = useRef(createAnimator());
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const armsRefs = useRef<(THREE.Group | null)[]>([]);
  const leftArmRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rightArmRefs = useRef<(THREE.Mesh | null)[]>([]);
  const wheelRefs = useRef<(THREE.Mesh | null)[]>([]);
  const propRefs = useRef<(THREE.Group | null)[]>([]);
  const headingRefs = useRef<number[]>(Array.from({ length: ROBOT_COUNT }, () => 0));
  const lastKeyRef = useRef("");
  const lastRouteKeyRef = useRef("");
  const [visuals, setVisuals] = useState<RobotVisual[]>(
    Array.from({ length: ROBOT_COUNT }, () => IDLE_VISUAL),
  );

  useEffect(() => {
    animRef.current = ingest(animRef.current, dashboard);
  }, [dashboard]);

  useFrame((frame, dt) => {
    animRef.current = tick(animRef.current, Math.min(dt, 0.25));
    const placements = robotPlacements(animRef.current);

    placements.forEach((placement, i) => {
      // Grounded locomotion (D-029): the gait clock drives the bob, the
      // body sway, and the alternating arm swing together, so the pieces
      // read as one rolling machine instead of a sliding figurine.
      // Per-robot phase offsets keep simultaneous walks out of lockstep.
      const stride = Math.min(placement.speed, 1);
      const gaitT = frame.clock.elapsedTime * 9 + i * 2.1;
      const group = groupRefs.current[i];
      if (group) {
        const [x, z] = placement.position;
        const bob = stride > 0.03 ? Math.abs(Math.sin(gaitT)) * 0.04 * stride : 0;
        group.position.set(x, bob, z);
        // Turn smoothly toward the current heading.
        let delta = placement.heading - headingRefs.current[i]!;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        headingRefs.current[i] = headingRefs.current[i]! + delta * Math.min(1, dt * 8);
        group.rotation.y = headingRefs.current[i]!;
        // Lean into movement, sway side to side with the gait.
        group.rotation.x = placement.speed * 0.07;
        group.rotation.z = Math.sin(gaitT) * 0.045 * stride;
      }
      // The ball wheel rolls with travel speed.
      const wheel = wheelRefs.current[i];
      if (wheel) {
        wheel.rotation.x += placement.speed * dt * 9;
      }
      // Department gesture: animated channels while working, held still while
      // the outcome plays, absent everywhere else (the prop unmounts).
      const working = placement.phase === "working" && placement.activeDepartment !== null;
      const gesture = working
        ? gestureFrame(
            DEPARTMENT_GESTURES[placement.activeDepartment!],
            frame.clock.elapsedTime + i * 0.9,
          )
        : GESTURE_REST;
      const arms = armsRefs.current[i];
      if (arms) {
        arms.position.y = gesture.armBob;
        arms.rotation.x = gesture.armSwing;
      }
      // Alternating arm swing while travelling; still while working.
      const swing = working ? 0 : Math.sin(gaitT) * 0.55 * stride;
      const left = leftArmRefs.current[i];
      const right = rightArmRefs.current[i];
      if (left) left.rotation.x = swing;
      if (right) right.rotation.x = -swing;
      const prop = propRefs.current[i];
      if (prop) {
        prop.position.set(
          PROP_REST_POSITION[0] + gesture.propOffset[0],
          PROP_REST_POSITION[1] + gesture.propOffset[1],
          PROP_REST_POSITION[2] + gesture.propOffset[2],
        );
        prop.rotation.x = gesture.propTilt;
      }
    });

    const key = placements
      .map((p) => `${p.phase}:${p.activeDepartment ?? ""}:${p.outcome ?? ""}:${p.carrying ?? ""}`)
      .join("|");
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      setVisuals(
        placements.map((placement) => ({
          statusColor:
            placement.phase === "outcome" && placement.outcome === "failed"
              ? "#ff7a76"
              : STATUS_LIGHT[placement.phase],
          carrying: placement.carrying,
          gestureAt:
            placement.phase === "working" || placement.phase === "outcome"
              ? placement.activeDepartment
              : null,
        })),
      );
      onLiveActivities(
        placements
          .filter((p) => p.phase === "working" || p.phase === "outcome" || p.phase === "gate")
          .map((p) => ({
            department: p.activeDepartment!,
            phase: p.phase as LiveActivity["phase"],
            outcome: p.outcome,
          })),
      );
    }
    const routes = activeRoutes(animRef.current);
    const routeKey = routes.map((route) => route.map((p) => p.join(",")).join(";")).join("~");
    if (routeKey !== lastRouteKeyRef.current) {
      lastRouteKeyRef.current = routeKey;
      onActiveRoutes(routes);
    }
  });

  return (
    <>
      {Array.from({ length: ROBOT_COUNT }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
          position={[ROBOT_HOME_POINTS[i]![0], 0, ROBOT_HOME_POINTS[i]![1]]}
          scale={ROBOT_IDENTITIES[i]!.scale}
        >
          <RobotBody
            identity={ROBOT_IDENTITIES[i]!}
            statusColor={visuals[i]!.statusColor}
            carrying={visuals[i]!.carrying}
            gestureAt={visuals[i]!.gestureAt}
            armsRef={(el) => {
              armsRefs.current[i] = el;
            }}
            leftArmRef={(el) => {
              leftArmRefs.current[i] = el;
            }}
            rightArmRef={(el) => {
              rightArmRefs.current[i] = el;
            }}
            wheelRef={(el) => {
              wheelRefs.current[i] = el;
            }}
            propRef={(el) => {
              propRefs.current[i] = el;
            }}
          />
        </group>
      ))}
    </>
  );
}
