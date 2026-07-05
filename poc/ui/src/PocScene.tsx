import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null;
  } catch {
    return false;
  }
}

interface SceneProps {
  eventCount: number;
  lastEventAt: string | null;
  reducedMotion: boolean;
}

const MAX_EVENT_MARKERS = 12;

/**
 * Phase 0 test scene: one low-poly beacon on a platform, plus one small cube
 * per persisted test event (capped). The beacon pulses once when a new event
 * arrives. Idle rotation is ambience only and is labelled as such in the UI;
 * it stops entirely in reduced-motion mode.
 */
function Beacon({ eventCount, lastEventAt, reducedMotion }: SceneProps) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const pulseStartRef = useRef<number | null>(null);
  const prevEventKeyRef = useRef<string | null>(null);

  const eventKey = lastEventAt === null ? null : `${eventCount}:${lastEventAt}`;
  useEffect(() => {
    if (eventKey !== null && prevEventKeyRef.current !== null && eventKey !== prevEventKeyRef.current) {
      pulseStartRef.current = performance.now();
    }
    prevEventKeyRef.current = eventKey;
  }, [eventKey]);

  useFrame((_, delta) => {
    const beacon = beaconRef.current;
    if (!beacon) return;
    if (!reducedMotion) {
      beacon.rotation.y += delta * 0.4;
    }
    let scale = 1;
    if (pulseStartRef.current !== null) {
      const elapsed = (performance.now() - pulseStartRef.current) / 1000;
      if (elapsed < 0.8) {
        scale = 1 + 0.25 * Math.sin((elapsed / 0.8) * Math.PI);
      } else {
        pulseStartRef.current = null;
      }
    }
    beacon.scale.setScalar(scale);
  });

  const markerPositions = useMemo(() => {
    const count = Math.min(eventCount, MAX_EVENT_MARKERS);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / MAX_EVENT_MARKERS) * Math.PI * 2;
      return [Math.cos(angle) * 2.1, 0.25, Math.sin(angle) * 2.1] as const;
    });
  }, [eventCount]);

  return (
    <group>
      {/* Platform */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[3, 3.2, 0.3, 8]} />
        <meshStandardMaterial color="#1c2836" flatShading />
      </mesh>
      {/* Central beacon */}
      <mesh ref={beaconRef} position={[0, 1.1, 0]}>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color="#57c4ff"
          emissive="#1a4a66"
          flatShading
          metalness={0.1}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 0.6, 6]} />
        <meshStandardMaterial color="#2c3d52" flatShading />
      </mesh>
      {/* One marker cube per persisted test event (capped) */}
      {markerPositions.map((position, i) => (
        <mesh key={i} position={position as unknown as [number, number, number]}>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial color="#5fd39a" flatShading />
        </mesh>
      ))}
    </group>
  );
}

export function PocScene(props: SceneProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [8, 8, 8], zoom: 55, near: 0.1, far: 100 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.5, 0)}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0d1218"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} />
      <Beacon {...props} />
    </Canvas>
  );
}
