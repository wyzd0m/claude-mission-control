import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { M } from "./materials.js";

// Real text signage for department doors. Each plaque face is drawn once to
// a small offscreen canvas (system font — no font assets, no network, no SDF
// library) and mounted as a texture on a low-poly plaque box. The text is
// rendered on both faces because the fixed isometric camera sees the
// corridor side of some doors and the room side of others.

const FLAT = { flatShading: true } as const;

// Face texture proportions; kept small per VISUAL_DESIGN ("avoid large
// textures") while staying crisp at monitor-window zoom levels.
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 64;
const PADDING_X = 18;

/** Draw a department label onto a plaque-face canvas. Exported for tests. */
export function drawPlaqueFace(
  context: CanvasRenderingContext2D,
  label: string,
  accent: string,
): void {
  const text = label.toUpperCase();
  context.fillStyle = M.charcoal;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Thin accent keyline along the bottom edge — the department's color key.
  context.fillStyle = accent;
  context.fillRect(PADDING_X, CANVAS_HEIGHT - 10, CANVAS_WIDTH - PADDING_X * 2, 4);

  // Fit the label between the side paddings, shrinking for long names.
  const family = '"Segoe UI", "Helvetica Neue", system-ui, sans-serif';
  let size = 34;
  context.font = `700 ${size}px ${family}`;
  const maxWidth = CANVAS_WIDTH - PADDING_X * 2;
  while (size > 14 && context.measureText(text).width > maxWidth) {
    size -= 1;
    context.font = `700 ${size}px ${family}`;
  }
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, CANVAS_WIDTH / 2, (CANVAS_HEIGHT - 8) / 2, maxWidth);
}

function makeLabelTexture(label: string, accent: string): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  drawPlaqueFace(context, label, accent);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Nameplate mounted above a door lintel. Local +z faces the corridor (the
 * parent DoorSign group is already rotated per edge); a mirrored back face
 * keeps the label legible for doors that face away from the camera.
 */
export function DoorPlaque({ label, accent }: { label: string; accent: string }) {
  const texture = useMemo(() => makeLabelTexture(label, accent), [label, accent]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <group position={[0, 2.08, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.5, 0.5, 0.1]} />
        <meshStandardMaterial color={M.charcoal} {...FLAT} />
      </mesh>
      {texture !== null &&
        ([0.056, -0.056] as const).map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[0, z > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[2.42, 0.484]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
          </mesh>
        ))}
    </group>
  );
}

/**
 * Freestanding nameplate on a short pole for rooms without a door lintel
 * (the open Command Hub). Rotate the group so the face reads from the camera.
 */
export function StandingSign({
  label,
  accent,
  position,
  rotationY = 0,
}: {
  label: string;
  accent: string;
  position: [number, number, number];
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 1.4, 6]} />
        <meshStandardMaterial color={M.slate} {...FLAT} />
      </mesh>
      <group position={[0, -0.62, 0]}>
        <DoorPlaque label={label} accent={accent} />
      </group>
    </group>
  );
}
