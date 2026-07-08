import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { DashboardState, Department } from "@mission-control/domain";
import { M } from "./materials.js";
import { ROOM_ACCENTS, STATIONS } from "./layout.js";
import {
  createAnimator,
  ingest,
  tick,
  robotPlacement,
  activeRoute,
  type LiveActivity,
} from "./animation.js";
import type { Point } from "./layout.js";

// The office's small service robot (visual redesign, Stage 3): a rounded
// low-poly body with a readable face, two arms, and a wheel base. The
// animated variant walks the waypoint routes from the pure animator, leans
// into motion, bobs its arms while working, and carries a department-colored
// output home after a success.

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

export function RobotBody({
  statusColor = STATUS_LIGHT.idle,
  armsRef,
  carrying = null,
}: {
  statusColor?: string;
  armsRef?: React.Ref<THREE.Group>;
  carrying?: Department | null;
}) {
  return (
    <>
      {/* Wheel base */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial color={M.robotDark} {...FLAT} />
      </mesh>
      {/* Rounded body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.5, 10]} />
        <meshStandardMaterial color={M.robotShell} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.76, 0]} castShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color={M.robotShell} {...FLAT} />
      </mesh>
      {/* Chest accent */}
      <mesh position={[0, 0.52, 0.31]}>
        <planeGeometry args={[0.2, 0.12]} />
        <meshStandardMaterial
          color={M.robotAccent}
          emissive={M.robotAccent}
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.06, 0]} castShadow>
        <boxGeometry args={[0.42, 0.32, 0.36]} />
        <meshStandardMaterial color={M.robotShell} {...FLAT} />
      </mesh>
      {/* Face with eyes */}
      <mesh position={[0, 1.06, 0.19]}>
        <planeGeometry args={[0.32, 0.2]} />
        <meshStandardMaterial color={M.robotDark} />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 1.07, 0.195]}>
          <circleGeometry args={[0.035, 8]} />
          <meshStandardMaterial
            color={M.robotAccent}
            emissive={M.robotAccent}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
      {/* Arms (group animates while working) */}
      <group ref={armsRef ?? null}>
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} position={[x, 0.55, 0]} rotation={[0, 0, x < 0 ? 0.25 : -0.25]} castShadow>
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
      {/* Antenna status light */}
      <mesh position={[0, 1.28, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 5]} />
        <meshStandardMaterial color={M.metal} {...FLAT} />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1} />
      </mesh>
    </>
  );
}

/** Static robot used in reduced-motion mode: parked at its rest station. */
export function StaticRobot({ at }: { at: Department }) {
  const [x, z] = STATIONS[at];
  return (
    <group position={[x, 0, z]} scale={1.15}>
      <RobotBody />
    </group>
  );
}

/**
 * Event-driven robot: the animator state lives in a ref and advances each
 * frame; React state updates happen only on discrete phase changes.
 */
export function AnimatedRobot({
  dashboard,
  onLiveActivity,
  onActiveRoute,
}: {
  dashboard: DashboardState;
  onLiveActivity: (live: LiveActivity | null) => void;
  onActiveRoute: (route: Point[] | null) => void;
}) {
  const animRef = useRef(createAnimator());
  const groupRef = useRef<THREE.Group>(null);
  const armsRef = useRef<THREE.Group>(null);
  const headingRef = useRef(0);
  const lastKeyRef = useRef("");
  const lastRouteKeyRef = useRef("");
  const [visual, setVisual] = useState<{ statusColor: string; carrying: Department | null }>({
    statusColor: STATUS_LIGHT.idle,
    carrying: null,
  });

  useEffect(() => {
    animRef.current = ingest(animRef.current, dashboard);
  }, [dashboard]);

  useFrame((frame, dt) => {
    animRef.current = tick(animRef.current, Math.min(dt, 0.25));
    const placement = robotPlacement(animRef.current);
    const group = groupRef.current;
    if (group) {
      const [x, z] = placement.position;
      const bob =
        placement.speed > 0.05 ? Math.abs(Math.sin(frame.clock.elapsedTime * 10)) * 0.05 : 0;
      group.position.set(x, bob, z);
      // Turn smoothly toward the current heading.
      let delta = placement.heading - headingRef.current;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      headingRef.current += delta * Math.min(1, dt * 8);
      group.rotation.y = headingRef.current;
      // Lean slightly into movement.
      group.rotation.x = placement.speed * 0.07;
    }
    const arms = armsRef.current;
    if (arms) {
      arms.position.y =
        placement.phase === "working" ? Math.sin(frame.clock.elapsedTime * 7) * 0.035 : 0;
    }

    const key = `${placement.phase}:${placement.activeDepartment ?? ""}:${placement.outcome ?? ""}:${placement.carrying ?? ""}`;
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      setVisual({
        statusColor:
          placement.phase === "outcome" && placement.outcome === "failed"
            ? "#ff7a76"
            : STATUS_LIGHT[placement.phase],
        carrying: placement.carrying,
      });
      onLiveActivity(
        placement.phase === "working" || placement.phase === "outcome" || placement.phase === "gate"
          ? {
              department: placement.activeDepartment!,
              phase: placement.phase,
              outcome: placement.outcome,
            }
          : null,
      );
    }
    const route = activeRoute(animRef.current);
    const routeKey = route === null ? "" : route.map((p) => p.join(",")).join(";");
    if (routeKey !== lastRouteKeyRef.current) {
      lastRouteKeyRef.current = routeKey;
      onActiveRoute(route);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[STATIONS.command_core[0], 0, STATIONS.command_core[1]]}
      scale={1.15}
    >
      <RobotBody statusColor={visual.statusColor} carrying={visual.carrying} armsRef={armsRef} />
    </group>
  );
}
