import type { Department } from "@mission-control/domain";
import type * as THREE from "three";
import { M } from "./materials.js";
import { ROOM_POSITIONS, ROOM_ACCENTS, STATE_COLORS } from "./layout.js";
import type { RoomSceneState } from "./scene-state.js";
import type { LiveActivity } from "./animation.js";
import {
  Bench,
  Bookshelf,
  ChargingPad,
  Chair,
  Desk,
  FilingCabinet,
  GlassPartition,
  Kiosk,
  Monitor,
  PackageStack,
  Plant,
  RoundTable,
  Rug,
  WallBoard,
} from "./furniture.js";

// The connected office floor (visual redesign, Stages 1-2): one continuous
// wooden floor on a diorama plinth, corridor strips between the room cells,
// two exterior window walls on the far sides, glass partitions with door
// gaps, and eight furnished department zones. Door-to-station lanes stay
// clear of furniture so robot routes never clip.

const FLAT = { flatShading: true } as const;

export function roomStateColor(room: RoomSceneState, live?: LiveActivity): string {
  if (live?.phase === "outcome" && live.outcome !== null && live.outcome !== "open") {
    return STATE_COLORS[live.outcome];
  }
  if (live?.phase === "working" || live?.phase === "gate") return STATE_COLORS.working;
  if (room.failed) return STATE_COLORS.failed;
  if (room.waiting) return STATE_COLORS.waiting;
  if (room.workingCount > 0) return STATE_COLORS.working;
  if (room.stageHighlight) return STATE_COLORS.stage;
  return M.corridorTrim;
}

export function roomIsEmphasized(room: RoomSceneState, live?: LiveActivity): boolean {
  return (
    live !== undefined ||
    room.failed ||
    room.waiting ||
    room.workingCount > 0 ||
    room.stageHighlight
  );
}

// ------------------------------------------------------------------- shell

function ExteriorWalls() {
  // Far-side walls only (north z=-9.9 and west x=-9.9) so the interior stays
  // visible from the isometric camera. Window strips break up the mass.
  const segments = [-7, 0, 7];
  return (
    <group>
      {segments.map((x) => (
        <group key={`n${x}`} position={[x, 0, -9.9]}>
          <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[6.6, 2.2, 0.25]} />
            <meshStandardMaterial color={M.wall} {...FLAT} />
          </mesh>
          <mesh position={[0, 1.45, 0.14]}>
            <planeGeometry args={[4.6, 0.9]} />
            <meshStandardMaterial color={M.glass} transparent opacity={0.35} />
          </mesh>
        </group>
      ))}
      {segments.map((z) => (
        <group key={`w${z}`} position={[-9.9, 0, z]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[6.6, 2.2, 0.25]} />
            <meshStandardMaterial color={M.wall} {...FLAT} />
          </mesh>
          <mesh position={[0, 1.45, 0.14]}>
            <planeGeometry args={[4.6, 0.9]} />
            <meshStandardMaterial color={M.glass} transparent opacity={0.35} />
          </mesh>
        </group>
      ))}
      {/* Corner post where the two exterior walls meet */}
      <mesh position={[-9.9, 1.2, -9.9]} castShadow>
        <boxGeometry args={[0.4, 2.4, 0.4]} />
        <meshStandardMaterial color={M.wallLow} {...FLAT} />
      </mesh>
    </group>
  );
}

function Corridors() {
  // Slate walkway strips along x = ±3.5 and z = ±3.5 with warm trim lines.
  return (
    <group>
      {[-3.5, 3.5].map((x) => (
        <mesh key={`vx${x}`} position={[x, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1.4, 19.6]} />
          <meshStandardMaterial color={M.corridor} />
        </mesh>
      ))}
      {[-3.5, 3.5].map((z) => (
        <mesh key={`hz${z}`} position={[0, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[19.6, 1.4]} />
          <meshStandardMaterial color={M.corridor} />
        </mesh>
      ))}
    </group>
  );
}

export function OfficeShell() {
  return (
    <group>
      {/* Diorama plinth */}
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[21.4, 0.8, 21.4]} />
        <meshStandardMaterial color={M.plinth} {...FLAT} />
      </mesh>
      {/* Continuous wooden floor */}
      <mesh position={[0, -0.075, 0]} receiveShadow>
        <boxGeometry args={[20.4, 0.15, 20.4]} />
        <meshStandardMaterial color={M.floorWood} {...FLAT} />
      </mesh>
      {/* Subtle plank variation */}
      {[-8.4, -4.2, 4.2, 8.4].map((x) => (
        <mesh key={x} position={[x, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1.8, 20.4]} />
          <meshStandardMaterial color={M.floorWoodAlt} />
        </mesh>
      ))}
      <Corridors />
      <ExteriorWalls />
    </group>
  );
}

// -------------------------------------------------------------- room zones

interface ZoneProps {
  room: RoomSceneState;
  live?: LiveActivity | undefined;
}

/** Door lintel with the department accent + live status light and signage. */
function DoorSign({
  department,
  room,
  live,
  edge,
}: ZoneProps & { department: Department; edge: "n" | "s" | "e" | "w" }) {
  const accent = ROOM_ACCENTS[department];
  const state = roomStateColor(room, live);
  const emphasized = roomIsEmphasized(room, live);
  const rotationY =
    edge === "s" ? 0 : edge === "n" ? Math.PI : edge === "e" ? -Math.PI / 2 : Math.PI / 2;
  const offset: [number, number, number] =
    edge === "s"
      ? [0, 0, 2.8]
      : edge === "n"
        ? [0, 0, -2.8]
        : edge === "e"
          ? [2.8, 0, 0]
          : [-2.8, 0, 0];
  return (
    <group position={offset} rotation={[0, rotationY, 0]}>
      {/* Partition segments either side of the 1.4-wide door gap */}
      <GlassPartition position={[-1.75, 0, 0]} length={2.1} />
      <GlassPartition position={[1.75, 0, 0]} length={2.1} />
      {/* Lintel with status light */}
      <mesh position={[0, 1.72, 0]}>
        <boxGeometry args={[1.6, 0.14, 0.12]} />
        <meshStandardMaterial
          color={state}
          emissive={state}
          emissiveIntensity={emphasized ? 1.1 : 0.25}
          {...FLAT}
        />
      </mesh>
      {/* Department sign chip */}
      <mesh position={[0, 1.95, 0]}>
        <boxGeometry args={[0.55, 0.26, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} {...FLAT} />
      </mesh>
      {emphasized && (
        <pointLight position={[0, 1.6, 0.6]} color={state} intensity={4} distance={5} />
      )}
    </group>
  );
}

function Zone({ department, children }: { department: Department; children: React.ReactNode }) {
  const [x, z] = ROOM_POSITIONS[department];
  return <group position={[x, 0, z]}>{children}</group>;
}

export function PlanningOffice(props: ZoneProps) {
  return (
    <Zone department="planning_bay">
      <DoorSign {...props} department="planning_bay" edge="s" />
      <Rug position={[0, 0.02, -0.7]} size={[3.6, 2.6]} color={M.fabricTeal} />
      <RoundTable position={[0, 0, -0.9]}>
        {[M.bookA, M.bookB, M.bookD].map((c, i) => (
          <mesh key={i} position={[-0.35 + i * 0.35, 0.79, 0.1]}>
            <boxGeometry args={[0.24, 0.03, 0.3]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
      </RoundTable>
      <Chair position={[-0.95, 0, -0.9]} rotationY={Math.PI / 2} />
      <Chair position={[0.95, 0, -0.9]} rotationY={-Math.PI / 2} />
      <WallBoard position={[0, 0, -2.55]} kind="notes" />
      <Desk position={[-2.05, 0, 0.7]} rotationY={Math.PI / 2}>
        <Monitor glow={ROOM_ACCENTS.planning_bay} />
      </Desk>
      <Chair position={[-1.25, 0, 0.7]} rotationY={-Math.PI / 2} />
      <Plant position={[2.25, 0, 2.2]} />
      <Plant position={[2.3, 0, -2.3]} tall />
    </Zone>
  );
}

export function ResearchOffice(props: ZoneProps) {
  return (
    <Zone department="research_archive">
      <DoorSign {...props} department="research_archive" edge="e" />
      <Rug position={[-0.6, 0.02, 0]} size={[2.8, 3.4]} color={M.fabricBlue} />
      <Bookshelf position={[-2.35, 0, -1.1]} rotationY={Math.PI / 2} />
      <Bookshelf position={[-2.35, 0, 1.1]} rotationY={Math.PI / 2} />
      <Desk position={[0.6, 0, -1.95]}>
        <Monitor glow={ROOM_ACCENTS.research_archive} />
      </Desk>
      <Chair position={[0.6, 0, -1.15]} rotationY={Math.PI} />
      <Kiosk position={[-0.4, 0, 2.15]} rotationY={Math.PI} glow={ROOM_ACCENTS.research_archive} />
      <FilingCabinet position={[1.9, 0, 2.15]} />
      <Plant position={[2.2, 0, -2.3]} />
    </Zone>
  );
}

export function BuildWorkspace(props: ZoneProps) {
  return (
    <Zone department="build_workshop">
      <DoorSign {...props} department="build_workshop" edge="w" />
      <Rug position={[0.8, 0.02, 0]} size={[3.2, 4.2]} color={M.slate} />
      <Desk position={[2.05, 0, -1.2]} rotationY={-Math.PI / 2} wide>
        <Monitor x={-0.5} glow={ROOM_ACCENTS.build_workshop} />
        <Monitor x={0.2} glow={M.screenGlow} />
      </Desk>
      <Chair position={[1.2, 0, -1.2]} rotationY={Math.PI / 2} />
      <Desk position={[2.05, 0, 1.3]} rotationY={-Math.PI / 2}>
        <Monitor glow={M.screenGlow} />
      </Desk>
      <Chair position={[1.2, 0, 1.3]} rotationY={Math.PI / 2} />
      <Desk position={[-0.6, 0, -2.15]} wide>
        {[0, 1].map((i) => (
          <mesh key={i} position={[-0.4 + i * 0.5, 0.83, 0.05]} castShadow>
            <boxGeometry args={[0.3, 0.22, 0.3]} />
            <meshStandardMaterial color={i === 0 ? M.bookD : M.metal} {...FLAT} />
          </mesh>
        ))}
      </Desk>
      <WallBoard position={[-0.6, 0, -2.62]} kind="screen" glow={ROOM_ACCENTS.build_workshop} />
      <Plant position={[-1.0, 0, 2.25]} />
    </Zone>
  );
}

export function TestingWorkspace(props: ZoneProps) {
  return (
    <Zone department="testing_lab">
      <DoorSign {...props} department="testing_lab" edge="w" />
      <Rug position={[0.8, 0.02, 0.3]} size={[3.2, 3.4]} color={M.fabricTeal} />
      <Desk position={[1.0, 0, -1.6]}>
        <Monitor glow={ROOM_ACCENTS.testing_lab} />
      </Desk>
      <Chair position={[1.0, 0, -0.8]} rotationY={Math.PI} />
      {/* Device-testing bench with indicator lights */}
      <Desk position={[2.05, 0, 0.9]} rotationY={-Math.PI / 2} wide>
        <mesh position={[-0.5, 0.86, 0]} castShadow>
          <boxGeometry args={[0.45, 0.28, 0.4]} />
          <meshStandardMaterial color={M.slate} {...FLAT} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0.15 + i * 0.25, 0.8, 0.08]}>
            <cylinderGeometry args={[0.05, 0.05, 0.12, 6]} />
            <meshStandardMaterial
              color={i === 2 ? STATE_COLORS.failed : STATE_COLORS.succeeded}
              emissive={i === 2 ? STATE_COLORS.failed : STATE_COLORS.succeeded}
              emissiveIntensity={0.5}
            />
          </mesh>
        ))}
      </Desk>
      <WallBoard position={[0.4, 0, -2.62]} kind="bugs" />
      <FilingCabinet position={[-0.9, 0, 2.2]} />
      <Plant position={[2.25, 0, 2.25]} tall />
    </Zone>
  );
}

export function MemoryRecordsRoom(props: ZoneProps) {
  return (
    <Zone department="memory_vault">
      <DoorSign {...props} department="memory_vault" edge="e" />
      <Rug position={[-0.7, 0.02, 0]} size={[2.6, 3.6]} color={M.fabricBlue} />
      {[-1.7, -0.4, 0.9].map((z) => (
        <FilingCabinet key={z} position={[-2.35, 0, z]} rotationY={Math.PI / 2} />
      ))}
      <Bookshelf
        position={[-0.8, 0, -2.35]}
        colors={[M.bookC, M.bookB, M.bookC, M.bookB, M.bookC]}
      />
      <Kiosk position={[0.6, 0, -2.2]} glow={ROOM_ACCENTS.memory_vault} />
      {/* Checkpoint crystal on a pedestal — the room's small identity piece */}
      <group position={[-0.6, 0, 2.1]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 0.7, 6]} />
          <meshStandardMaterial color={M.slate} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.95, 0]} rotation={[0, Math.PI / 5, 0]}>
          <octahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial
            color={ROOM_ACCENTS.memory_vault}
            emissive={ROOM_ACCENTS.memory_vault}
            emissiveIntensity={0.55}
            {...FLAT}
          />
        </mesh>
      </group>
      <Plant position={[1.9, 0, 2.2]} />
    </Zone>
  );
}

export function ApprovalDesk(props: ZoneProps) {
  const waiting = props.room.waiting || props.live?.phase === "gate";
  return (
    <Zone department="security_gate">
      <DoorSign {...props} department="security_gate" edge="w" />
      <Rug position={[0.6, 0.02, 0]} size={[3.4, 3]} color={M.fabricTeal} />
      {/* Reception / approval desk facing the entrance */}
      <Desk position={[0.7, 0, 0]} rotationY={-Math.PI / 2} wide>
        <Monitor glow={ROOM_ACCENTS.security_gate} wide />
      </Desk>
      {/* Gate posts with the amber waiting beacon */}
      {[-1.1, 1.1].map((z) => (
        <mesh key={z} position={[-1.85, 0.55, z]} castShadow>
          <boxGeometry args={[0.22, 1.1, 0.22]} />
          <meshStandardMaterial color={M.slate} {...FLAT} />
        </mesh>
      ))}
      <mesh position={[-1.85, 1.25, 0]}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial
          color={STATE_COLORS.waiting}
          emissive={STATE_COLORS.waiting}
          emissiveIntensity={waiting ? 1.3 : 0.25}
        />
      </mesh>
      <Bench position={[0.6, 0, 2.2]} rotationY={Math.PI} />
      <Kiosk position={[2.2, 0, -1.7]} rotationY={-Math.PI / 2} glow={ROOM_ACCENTS.security_gate} />
      <Plant position={[2.3, 0, 2.25]} />
    </Zone>
  );
}

export function DeliveryArea(props: ZoneProps) {
  return (
    <Zone department="delivery_dock">
      <DoorSign {...props} department="delivery_dock" edge="e" />
      <Rug position={[-0.7, 0.02, 0]} size={[2.8, 3.4]} color={M.slate} />
      {/* Packaging desk facing the station */}
      <Desk position={[-0.9, 0, 0]} rotationY={Math.PI / 2} wide>
        <mesh position={[0.3, 0.86, 0]} castShadow>
          <boxGeometry args={[0.4, 0.28, 0.4]} />
          <meshStandardMaterial color={M.wood} {...FLAT} />
        </mesh>
      </Desk>
      <PackageStack position={[-2.1, 0, -1.6]} />
      <PackageStack position={[-1.9, 0, 1.8]} rotationY={0.6} />
      {/* Delivery platform */}
      <mesh position={[0.6, 0.06, -2.0]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.85, 0.12, 10]} />
        <meshStandardMaterial color={M.slate} {...FLAT} />
      </mesh>
      <Kiosk position={[1.9, 0, -2.2]} glow={ROOM_ACCENTS.delivery_dock} />
      <Plant position={[2.2, 0, 2.2]} />
    </Zone>
  );
}

export function CommandHub({
  idle,
  emphasized,
  holoRef,
}: {
  idle: boolean;
  emphasized: boolean;
  holoRef?: React.Ref<THREE.Mesh>;
}) {
  return (
    <Zone department="command_core">
      <Rug position={[0, 0.02, 0]} size={[4.8, 4.8]} color={M.corridor} />
      {/* Holographic project display, offset so both crossing lanes stay clear */}
      <group position={[-1.4, 0, -1.4]}>
        <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.75, 0.85, 0.24, 10]} />
          <meshStandardMaterial color={M.slate} {...FLAT} />
        </mesh>
        <mesh ref={holoRef ?? null} position={[0, 1.15, 0]}>
          <icosahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color={ROOM_ACCENTS.command_core}
            emissive={ROOM_ACCENTS.command_core}
            emissiveIntensity={idle ? 0.45 : 0.85}
            transparent
            opacity={0.9}
            {...FLAT}
          />
        </mesh>
      </group>
      {/* Dispatch desk with shared status screens */}
      <Desk position={[1.8, 0, -0.9]} rotationY={-Math.PI / 2} wide>
        <Monitor x={-0.4} glow={M.screenGlow} />
        <Monitor x={0.35} glow={emphasized ? STATE_COLORS.working : M.screenWarm} />
      </Desk>
      <Chair position={[1.0, 0, -0.9]} rotationY={Math.PI / 2} />
      {/* Robot charging points */}
      <ChargingPad position={[-1.9, 0, 0.9]} />
      <ChargingPad position={[-1.1, 0, 1.7]} />
      <Plant position={[2.1, 0, 1.9]} tall />
    </Zone>
  );
}

/** Open entrance lounge in the front-center cell — warmth, not a department. */
export function EntranceLounge() {
  return (
    <group position={[0, 0, 7]}>
      <Rug position={[0, 0.02, 0.6]} size={[4.4, 3.4]} color={M.fabricTeal} />
      <Bench position={[-1.3, 0, 0.4]} rotationY={Math.PI / 2} />
      <Bench position={[1.3, 0, 0.4]} rotationY={-Math.PI / 2} />
      <RoundTable position={[0, 0, 0.6]} />
      <Plant position={[-2.2, 0, 2.2]} tall />
      <Plant position={[2.2, 0, 2.2]} tall />
      <Kiosk position={[0, 0, 2.4]} rotationY={Math.PI} glow={M.screenWarm} />
    </group>
  );
}
