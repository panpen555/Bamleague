import {
  getSelectedFinalsMvpIdFromBackup,
  normalizeSelectedFinalsMvpId,
  SELECTED_FINALS_MVP_STORAGE_KEY,
} from "./finalsMvpPersistence";

describe("Finals MVP current selection persistence", () => {
  test("accepts string and number player IDs without changing identity", () => {
    expect(normalizeSelectedFinalsMvpId("p-1")).toBe("p-1");
    expect(normalizeSelectedFinalsMvpId(42)).toBe("42");
  });

  test("rejects invalid current selection values", () => {
    [null, undefined, false, true, {}, [], Number.NaN].forEach((value) => {
      expect(normalizeSelectedFinalsMvpId(value)).toBe("");
    });
  });

  test("restores raw and wrapped backup selections", () => {
    expect(
      getSelectedFinalsMvpIdFromBackup({ selectedFinalsMvpId: "BAM-000123" }),
    ).toBe("BAM-000123");
    expect(
      getSelectedFinalsMvpIdFromBackup({
        data: { selectedFinalsMvpId: 123 },
      }),
    ).toBe("123");
  });

  test("legacy backups without a selection clear stale current selection", () => {
    expect(getSelectedFinalsMvpIdFromBackup({ players: [] })).toBe("");
    expect(getSelectedFinalsMvpIdFromBackup({ data: { players: [] } })).toBe(
      "",
    );
  });

  test("uses the current season field name as the local storage key", () => {
    expect(SELECTED_FINALS_MVP_STORAGE_KEY).toBe("selectedFinalsMvpId");
  });
});
