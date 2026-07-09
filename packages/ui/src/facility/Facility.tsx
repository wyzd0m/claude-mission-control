import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import type { DashboardState } from "@mission-control/domain";
import { LIGHTING } from "./materials.js";
import { STATE_COLORS, type Point } from "./layout.js";
import type { SceneState } from "./scene-state.js";
import type { LiveActivity } from "./animation.js";
import {
  ApprovalDesk,
  BuildWorkspace,
  CommandHub,
  DeliveryArea,
  EntranceLounge,
  MemoryRecordsRoom,
  OfficeShell,
  PlanningOffice,
  ResearchOffice,
  TestingWorkspace,
} from "./office.js";
import { AnimatedRobots, StaticRobots } from "./robot.js";

// The office diorama (visual redesign, Stages 1-4). Everything is generated
// from primitives in code — no imported models. The scene renders the
// deterministic SceneState plus the animator's live presentation, and
// nothing else: ambient motion is atmosphere, never presented as work.

export type { LiveActivity };

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null;
  } catch {
    return false;
  }
}

/**
 * Adaptive render resolution (D-032): supersample up to 1.75x for crisp
 * low-poly edges, but step the ratio down when the measured frame rate
 * sags (integrated GPUs, big monitors) and back up when there is headroom.
 * Resolution is the biggest lever on fill-rate-bound machines.
 */
function AdaptiveResolution({ min = 1, max = 1.75 }: { min?: number; max?: number }) {
  const setDpr = useThree((state) => state.setDpr);
  const dprRef = useRef(Math.min(max, 1.5));
  const emaFps = useRef(60);
  const cooldown = useRef(2); // let startup settle before judging
  useEffect(() => {
    setDpr(dprRef.current);
  }, [setDpr]);
  useFrame((_, dt) => {
    if (dt <= 0 || dt > 0.25) return; // ignore tab-switch spikes
    emaFps.current = emaFps.current * 0.95 + (1 / dt) * 0.05;
    cooldown.current -= dt;
    if (cooldown.current > 0) return;
    if (emaFps.current < 45 && dprRef.current > min) {
      dprRef.current = Math.max(min, dprRef.current - 0.25);
      setDpr(dprRef.current);
      cooldown.current = 2;
    } else if (emaFps.current > 57 && dprRef.current < max) {
      dprRef.current = Math.min(max, dprRef.current + 0.25);
      setDpr(dprRef.current);
      cooldown.current = 4;
    }
  });
  return null;
}

/**
 * Fit the diorama to the canvas: orthographic zoom scales with the viewport
 * so the office is the highlight at every panel size, from the embedded
 * chat widget to a full monitor window.
 */
function ResponsiveZoom() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useEffect(() => {
    const zoom = Math.min(Math.min(size.width, size.height * 1.55) / 33, 44);
    if ("zoom" in camera) {
      camera.zoom = Math.max(zoom, 8);
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);
  return null;
}

/** Slow ambient rotation for the Command Hub hologram (identity, not work). */
function HoloSpin({
  idle,
  reducedMotion,
  emphasized,
}: {
  idle: boolean;
  reducedMotion: boolean;
  emphasized: boolean;
}) {
  const holoRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!reducedMotion && holoRef.current) {
      holoRef.current.rotation.y += delta * 0.3;
    }
  });
  return <CommandHub idle={idle} emphasized={emphasized} holoRef={holoRef} />;
}

/** Glowing floor strip along the robot's current walking route. */
function RouteHighlight({ route }: { route: Point[] }) {
  return (
    <group>
      {route.slice(0, -1).map(([ax, az], i) => {
        const [bx, bz] = route[i + 1]!;
        const length = Math.hypot(bx - ax, bz - az);
        if (length < 0.05) return null;
        return (
          <mesh
            key={i}
            position={[(ax + bx) / 2, 0.03, (az + bz) / 2]}
            rotation={[-Math.PI / 2, 0, -Math.atan2(bx - ax, bz - az)]}
          >
            <planeGeometry args={[0.35, length]} />
            <meshStandardMaterial
              color={STATE_COLORS.working}
              emissive={STATE_COLORS.working}
              emissiveIntensity={0.6}
              transparent
              opacity={0.55}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function Facility({
  scene,
  dashboard,
  reducedMotion,
}: {
  scene: SceneState;
  dashboard: DashboardState;
  reducedMotion: boolean;
}) {
  const [lives, setLives] = useState<LiveActivity[]>([]);
  const [routes, setRoutes] = useState<Point[][]>([]);

  const liveFor = (department: string) => lives.find((live) => live.department === department);
  const roomFor = (department: string) =>
    scene.rooms.find((room) => room.department === department)!;

  return (
    <Canvas
      shadows
      orthographic
      // Start supersampled at 1.5x (crisp on 1x-DPR monitors);
      // AdaptiveResolution then tunes the ratio to the machine. Ask for the
      // discrete GPU on dual-GPU systems — browsers default some canvases
      // to the power-saving integrated one.
      dpr={1.5}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [16, 15, 16], zoom: 11.5, near: 0.1, far: 200 }}
      onCreated={({ camera, scene }) => {
        camera.lookAt(0, 0, 0);
        // Dev-only (matches the demo/test bridges' purpose): let plain-browser
        // layout checks inspect the scene graph. Never active in a host.
        const params = new URLSearchParams(window.location.search);
        if (params.has("demo") || params.has("test")) {
          (window as unknown as Record<string, unknown>).__cmcDemoScene = scene;
        }
      }}
      frameloop={reducedMotion ? "demand" : "always"}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0d1218"]} />
      {!reducedMotion && <AdaptiveResolution />}
      <ResponsiveZoom />
      <ambientLight color={LIGHTING.ambientColor} intensity={LIGHTING.ambientIntensity} />
      <hemisphereLight
        color={LIGHTING.hemiSky}
        groundColor={LIGHTING.hemiGround}
        intensity={LIGHTING.hemiIntensity}
      />
      <directionalLight
        color={LIGHTING.keyColor}
        intensity={LIGHTING.keyIntensity}
        position={LIGHTING.keyPosition}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />
      <directionalLight
        color={LIGHTING.fillColor}
        intensity={LIGHTING.fillIntensity}
        position={LIGHTING.fillPosition}
      />

      <OfficeShell />
      <EntranceLounge />
      <HoloSpin
        idle={scene.idle}
        reducedMotion={reducedMotion}
        emphasized={lives.length > 0 || !scene.idle}
      />
      <PlanningOffice room={roomFor("planning_bay")} live={liveFor("planning_bay")} />
      <ResearchOffice room={roomFor("research_archive")} live={liveFor("research_archive")} />
      <BuildWorkspace room={roomFor("build_workshop")} live={liveFor("build_workshop")} />
      <TestingWorkspace room={roomFor("testing_lab")} live={liveFor("testing_lab")} />
      <MemoryRecordsRoom room={roomFor("memory_vault")} live={liveFor("memory_vault")} />
      <ApprovalDesk room={roomFor("security_gate")} live={liveFor("security_gate")} />
      <DeliveryArea room={roomFor("delivery_dock")} live={liveFor("delivery_dock")} />

      {routes.map((route, i) => (
        <RouteHighlight key={i} route={route} />
      ))}

      {reducedMotion ? (
        <StaticRobots at={scene.robotAt} />
      ) : (
        <AnimatedRobots
          dashboard={dashboard}
          onLiveActivities={setLives}
          onActiveRoutes={setRoutes}
        />
      )}
    </Canvas>
  );
}
