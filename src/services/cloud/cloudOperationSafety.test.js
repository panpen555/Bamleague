import {
  createRecoveryEnvelope,
  runWithRequiredRecovery,
} from "./cloudOperationSafety";

describe("Cloud operation recovery safety", () => {
  test("creates recovery before a protected Cloud write", async () => {
    const events = [];
    await runWithRequiredRecovery({
      createRecovery: async () => events.push("backup"),
      operation: async () => events.push("main-write"),
    });
    expect(events).toEqual(["backup", "main-write"]);
  });

  test("stops the Cloud write when recovery fails", async () => {
    const write = jest.fn();
    await expect(
      runWithRequiredRecovery({
        createRecovery: async () => {
          throw new Error("backup failed");
        },
        operation: write,
      }),
    ).rejects.toThrow("backup failed");
    expect(write).not.toHaveBeenCalled();
  });

  test("creates local recovery before local overwrite", async () => {
    const events = [];
    await runWithRequiredRecovery({
      createRecovery: async () => events.push("local-recovery"),
      operation: async () => events.push("restore-cloud-data"),
    });
    expect(events).toEqual(["local-recovery", "restore-cloud-data"]);
  });

  test("recovery envelope is detached from mutable source data", () => {
    const source = { players: [{ id: 1, name: "A" }] };
    const recovery = createRecoveryEnvelope({
      kind: "local-before-download",
      sourceSchema: 3,
      data: source,
      createdAt: "2026-08-02T00:00:00.000Z",
    });
    source.players[0].name = "Changed";
    expect(recovery.data.players[0].name).toBe("A");
  });
});
