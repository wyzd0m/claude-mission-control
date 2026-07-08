import type { ReactNode } from "react";
import { M } from "./materials.js";

// Procedural office furniture (visual redesign, Stage 1). Every piece is
// code-defined primitives sharing the warm palette. Components take a
// position and optional Y rotation so rooms can arrange them naturally.

const FLAT = { flatShading: true } as const;

export interface PlacedProps {
  position: [number, number, number];
  rotationY?: number;
  children?: ReactNode;
}

function Placed({ position, rotationY = 0, children }: PlacedProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {children}
    </group>
  );
}

export function Desk(props: PlacedProps & { wide?: boolean }) {
  const width = props.wide ? 2.4 : 1.7;
  return (
    <Placed {...props}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.08, 0.9]} />
        <meshStandardMaterial color={M.deskTop} {...FLAT} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 - 0.12), 0.34, 0]} castShadow>
          <boxGeometry args={[0.1, 0.68, 0.8]} />
          <meshStandardMaterial color={M.deskLeg} {...FLAT} />
        </mesh>
      ))}
      {props.children}
    </Placed>
  );
}

export function Chair(props: PlacedProps) {
  return (
    <Placed {...props}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.5, 0.09, 0.5]} />
        <meshStandardMaterial color={M.charcoal} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.72, -0.22]} castShadow>
        <boxGeometry args={[0.5, 0.55, 0.09]} />
        <meshStandardMaterial color={M.charcoal} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 6]} />
        <meshStandardMaterial color={M.metal} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.26, 0.28, 0.05, 8]} />
        <meshStandardMaterial color={M.slate} {...FLAT} />
      </mesh>
    </Placed>
  );
}

/** Desk-top monitor; place as a child of Desk. */
export function Monitor({
  x = 0,
  glow = M.screenGlow,
  wide = false,
}: {
  x?: number;
  glow?: string;
  wide?: boolean;
}) {
  const width = wide ? 0.9 : 0.55;
  return (
    <group position={[x, 0.76, -0.18]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[width, 0.38, 0.05]} />
        <meshStandardMaterial color={M.robotDark} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.3, 0.028]}>
        <planeGeometry args={[width - 0.08, 0.3]} />
        <meshStandardMaterial color={M.screenOff} emissive={glow} emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.1, 0.14, 0.08]} />
        <meshStandardMaterial color={M.metal} {...FLAT} />
      </mesh>
    </group>
  );
}

export function Bookshelf(props: PlacedProps & { colors?: string[] }) {
  const books = props.colors ?? [M.bookA, M.bookB, M.bookC, M.bookD, M.bookB, M.bookA];
  return (
    <Placed {...props}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.8, 0.42]} />
        <meshStandardMaterial color={M.wood} {...FLAT} />
      </mesh>
      {[0.45, 1.0, 1.55].map((y, row) => (
        <group key={y}>
          <mesh position={[0, y - 0.14, 0]}>
            <boxGeometry args={[1.34, 0.05, 0.36]} />
            <meshStandardMaterial color={M.woodDark} {...FLAT} />
          </mesh>
          {books.slice(0, 4 + (row % 2)).map((color, i) => (
            <mesh key={i} position={[-0.5 + i * 0.26, y + 0.08, 0.02]} castShadow>
              <boxGeometry args={[0.16, 0.38, 0.26]} />
              <meshStandardMaterial color={color} {...FLAT} />
            </mesh>
          ))}
        </group>
      ))}
    </Placed>
  );
}

export function FilingCabinet(props: PlacedProps) {
  return (
    <Placed {...props}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.65, 1.1, 0.55]} />
        <meshStandardMaterial color={M.slate} {...FLAT} />
      </mesh>
      {[0.28, 0.62, 0.96].map((y) => (
        <mesh key={y} position={[0, y, 0.29]}>
          <boxGeometry args={[0.5, 0.06, 0.03]} />
          <meshStandardMaterial color={M.metal} {...FLAT} />
        </mesh>
      ))}
    </Placed>
  );
}

export function RoundTable(props: PlacedProps) {
  return (
    <Placed {...props}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.07, 12]} />
        <meshStandardMaterial color={M.deskTop} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 0.7, 6]} />
        <meshStandardMaterial color={M.deskLeg} {...FLAT} />
      </mesh>
      {props.children}
    </Placed>
  );
}

/** Wall-mounted display with sticky notes or a glowing panel. */
export function WallBoard(
  props: PlacedProps & { kind?: "notes" | "screen" | "bugs"; glow?: string },
) {
  const kind = props.kind ?? "notes";
  return (
    <Placed {...props}>
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[1.9, 1.1, 0.07]} />
        <meshStandardMaterial color={kind === "screen" ? M.robotDark : M.paper} {...FLAT} />
      </mesh>
      {kind === "screen" ? (
        <mesh position={[0, 1.3, 0.045]}>
          <planeGeometry args={[1.7, 0.9]} />
          <meshStandardMaterial
            color={M.screenOff}
            emissive={props.glow ?? M.screenGlow}
            emissiveIntensity={0.5}
          />
        </mesh>
      ) : (
        [
          [-0.6, 1.5, M.bookD],
          [-0.15, 1.55, M.bookC],
          [0.35, 1.45, M.bookB],
          [-0.45, 1.1, M.bookA],
          [0.1, 1.12, M.bookC],
          [0.6, 1.15, kind === "bugs" ? "#ff7a76" : M.bookD],
        ].map(([x, y, color], i) => (
          <mesh key={i} position={[x as number, y as number, 0.045]}>
            <planeGeometry args={[0.28, 0.28]} />
            <meshStandardMaterial color={color as string} />
          </mesh>
        ))
      )}
    </Placed>
  );
}

export function Plant(props: PlacedProps & { tall?: boolean }) {
  const height = props.tall ? 1.0 : 0.6;
  return (
    <Placed {...props}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.36, 8]} />
        <meshStandardMaterial color={M.pot} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.36 + height * 0.4, 0]} castShadow>
        <coneGeometry args={[0.3, height, 7]} />
        <meshStandardMaterial color={M.plant} {...FLAT} />
      </mesh>
      <mesh position={[0.12, 0.3 + height * 0.25, 0.08]}>
        <coneGeometry args={[0.2, height * 0.7, 6]} />
        <meshStandardMaterial color={M.plantDark} {...FLAT} />
      </mesh>
    </Placed>
  );
}

export function Rug({
  position,
  size,
  color = M.fabricTeal,
}: {
  position: [number, number, number];
  size: [number, number];
  color?: string;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** Half-height divider wall with a glass top panel. */
export function GlassPartition({
  position,
  length,
  rotationY = 0,
}: {
  position: [number, number, number];
  length: number;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.9, 0.12]} />
        <meshStandardMaterial color={M.wallLow} {...FLAT} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[length, 0.7, 0.05]} />
        <meshStandardMaterial color={M.glass} transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <boxGeometry args={[length, 0.06, 0.08]} />
        <meshStandardMaterial color={M.glassFrame} {...FLAT} />
      </mesh>
    </group>
  );
}

export function Bench(props: PlacedProps) {
  return (
    <Placed {...props}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.5, 0.12, 0.55]} />
        <meshStandardMaterial color={M.fabricBlue} {...FLAT} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.5]} />
          <meshStandardMaterial color={M.woodDark} {...FLAT} />
        </mesh>
      ))}
    </Placed>
  );
}

/** Free-standing terminal / kiosk. */
export function Kiosk(props: PlacedProps & { glow?: string }) {
  return (
    <Placed {...props}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.5, 1.1, 0.35]} />
        <meshStandardMaterial color={M.slate} {...FLAT} />
      </mesh>
      <mesh position={[0, 1.15, 0.05]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.44, 0.32, 0.05]} />
        <meshStandardMaterial color={M.robotDark} {...FLAT} />
      </mesh>
      <mesh position={[0, 1.16, 0.085]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.36, 0.24]} />
        <meshStandardMaterial
          color={M.screenOff}
          emissive={props.glow ?? M.screenGlow}
          emissiveIntensity={0.6}
        />
      </mesh>
    </Placed>
  );
}

export function PackageStack(props: PlacedProps) {
  return (
    <Placed {...props}>
      {[
        [0, 0.25, 0, 0.5],
        [0.45, 0.2, 0.15, 0.4],
        [0.1, 0.62, 0.05, 0.35],
      ].map(([x, y, z, s], i) => (
        <mesh key={i} position={[x!, y!, z!]} castShadow>
          <boxGeometry args={[s!, s!, s!]} />
          <meshStandardMaterial color={i === 1 ? M.woodDark : M.wood} {...FLAT} />
        </mesh>
      ))}
    </Placed>
  );
}

export function ChargingPad({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.55, 0.6, 0.06, 10]} />
        <meshStandardMaterial color={M.slate} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.02, 10]} />
        <meshStandardMaterial
          color={M.robotAccent}
          emissive={M.robotAccent}
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  );
}
