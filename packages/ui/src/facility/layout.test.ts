// Navigation tests (visual redesign, Stages 2-3): every department pair has
// a valid walking route made of straight corridor segments — start at the
// origin station, end at the destination station, no diagonal shortcuts
// through rooms.
import { describe, expect, it } from "vitest";
import { DEPARTMENTS } from "@mission-control/domain";
import { routeBetween, routeLength, pointAlongRoute, STATIONS } from "./layout.js";

describe("office navigation", () => {
  it("routes between every pair of departments", () => {
    for (const from of DEPARTMENTS) {
      for (const to of DEPARTMENTS) {
        if (from === to) continue;
        const route = routeBetween(from, to);
        expect(route.length, `${from} -> ${to}`).toBeGreaterThanOrEqual(2);
        expect(route[0], `${from} -> ${to} start`).toEqual(STATIONS[from]);
        expect(route[route.length - 1], `${from} -> ${to} end`).toEqual(STATIONS[to]);
        expect(routeLength(route), `${from} -> ${to} length`).toBeGreaterThan(0);
      }
    }
  });

  it("uses only axis-aligned corridor segments (no diagonal shortcuts)", () => {
    for (const from of DEPARTMENTS) {
      for (const to of DEPARTMENTS) {
        if (from === to) continue;
        const route = routeBetween(from, to);
        for (let i = 1; i < route.length; i++) {
          const [ax, az] = route[i - 1]!;
          const [bx, bz] = route[i]!;
          const axisAligned = Math.abs(ax - bx) < 1e-6 || Math.abs(az - bz) < 1e-6;
          expect(axisAligned, `${from} -> ${to} segment ${i}`).toBe(true);
        }
      }
    }
  });

  it("interpolates positions and headings along a route", () => {
    const route = routeBetween("command_core", "build_workshop");
    const total = routeLength(route);
    const start = pointAlongRoute(route, 0);
    expect(start.position).toEqual(STATIONS.command_core);
    const end = pointAlongRoute(route, total);
    expect(end.position[0]).toBeCloseTo(STATIONS.build_workshop[0]);
    expect(end.position[1]).toBeCloseTo(STATIONS.build_workshop[1]);
    // Midway points stay within the office footprint.
    for (let d = 0; d <= total; d += total / 20) {
      const { position } = pointAlongRoute(route, d);
      expect(Math.abs(position[0])).toBeLessThanOrEqual(10);
      expect(Math.abs(position[1])).toBeLessThanOrEqual(10);
    }
  });
});
