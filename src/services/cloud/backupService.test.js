import { doc, setDoc } from "firebase/firestore";
import { uploadLeagueBackup } from "./backupService";

jest.mock("../../firebase", () => ({ db: { name: "mock-db" } }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((database, ...segments) => ({
    database,
    path: segments.join("/"),
  })),
  setDoc: jest.fn(async () => {}),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

describe("V2 cloud backup service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uploads the current Finals MVP selection in the backup payload", async () => {
    const payload = await uploadLeagueBackup({
      players: [{ id: "p1" }],
      selectedFinalsMvpId: "p1",
    });

    expect(payload.data.selectedFinalsMvpId).toBe("p1");
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].data.selectedFinalsMvpId).toBe("p1");
    expect(doc).toHaveBeenCalled();
  });
});
