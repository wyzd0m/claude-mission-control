import { describe, expect, it } from "vitest";
import { ApprovalService, hashApprovalPayload } from "./approval-service.js";

describe("ApprovalService", () => {
  it("issues and consumes a token once", () => {
    const service = new ApprovalService();
    const hash = hashApprovalPayload({ a: 1 });
    const { token } = service.issue("bulk", hash);
    service.consume("bulk", token, hash);
    expect(() => service.consume("bulk", token, hash)).toThrow(/already used/);
  });

  it("rejects unknown tokens", () => {
    const service = new ApprovalService();
    expect(() => service.consume("bulk", "nope", "x")).toThrow(/unknown token/);
  });

  it("rejects tokens issued for a different operation kind", () => {
    const service = new ApprovalService();
    const hash = hashApprovalPayload({ a: 1 });
    const { token } = service.issue("import", hash);
    expect(() => service.consume("bulk", token, hash)).toThrow(/different operation/);
  });

  it("rejects tokens when the payload changed after the preview", () => {
    const service = new ApprovalService();
    const { token } = service.issue("bulk", hashApprovalPayload({ a: 1 }));
    expect(() => service.consume("bulk", token, hashApprovalPayload({ a: 2 }))).toThrow(
      /no longer matches/,
    );
  });

  it("rejects expired tokens", () => {
    let time = new Date("2026-07-05T12:00:00.000Z").getTime();
    const service = new ApprovalService(() => new Date(time), 1000);
    const hash = hashApprovalPayload({ a: 1 });
    const { token } = service.issue("bulk", hash);
    time += 2000;
    expect(() => service.consume("bulk", token, hash)).toThrow(/expired/);
  });
});
