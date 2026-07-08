import { describe, expect, it } from "vitest";
import { drawPlaqueFace } from "./signage.js";
import { DEPARTMENT_LABELS } from "./scene-state.js";

// jsdom has no real 2D canvas, so the drawing routine is exercised against a
// recording stub whose measureText scales with the requested font size.

interface Fill {
  kind: "rect" | "text";
  style: string;
  text?: string;
  maxWidth?: number;
}

function makeStubContext(pixelsPerCharAt30px: number) {
  const fills: Fill[] = [];
  let font = "";
  const context = {
    fillStyle: "",
    textAlign: "",
    textBaseline: "",
    get font() {
      return font;
    },
    set font(value: string) {
      font = value;
    },
    fillRect() {
      fills.push({ kind: "rect", style: this.fillStyle });
    },
    fillText(text: string, _x: number, _y: number, maxWidth?: number) {
      fills.push({ kind: "text", style: this.fillStyle, text, ...(maxWidth ? { maxWidth } : {}) });
    },
    measureText(text: string) {
      const size = Number(/(\d+)px/.exec(font)?.[1] ?? 30);
      return { width: text.length * pixelsPerCharAt30px * (size / 30) };
    },
  };
  return { context: context as unknown as CanvasRenderingContext2D, fills, fontUsed: () => font };
}

describe("drawPlaqueFace", () => {
  it("draws the label uppercased with the accent keyline", () => {
    const { context, fills } = makeStubContext(10);
    drawPlaqueFace(context, "Planning Bay", "#7fd0ff");
    const text = fills.find((f) => f.kind === "text");
    expect(text?.text).toBe("PLANNING BAY");
    expect(fills.some((f) => f.kind === "rect" && f.style === "#7fd0ff")).toBe(true);
  });

  it("shrinks the font until long labels fit the plaque face", () => {
    const wide = makeStubContext(24); // 16 chars * 24px would overflow at 44px
    drawPlaqueFace(wide.context, "Research Archive", "#9a8cff");
    const size = Number(/(\d+)px/.exec(wide.fontUsed())?.[1]);
    expect(size).toBeLessThan(44);
    expect(size).toBeGreaterThanOrEqual(14);

    const narrow = makeStubContext(2);
    drawPlaqueFace(narrow.context, "Testing Lab", "#5fd39a");
    expect(narrow.fontUsed()).toContain("44px");
  });

  it("passes a maxWidth clamp so text can never spill off the face", () => {
    const { context, fills } = makeStubContext(10);
    drawPlaqueFace(context, DEPARTMENT_LABELS.command_core, "#57c4ff");
    const text = fills.find((f) => f.kind === "text");
    expect(text?.maxWidth).toBeGreaterThan(0);
  });
});
