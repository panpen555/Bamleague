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

  test("uploads manual playoff mode and stable source references in V2 payload", async () => {
    const schedule = [
      {
        id: "SF1",
        week: 6,
        phase: "postseason",
        manualPlayoff: true,
        teamASource: { type: "winner", matchId: "P1" },
        teamBSource: {
          type: "bestLoser",
          matchIds: ["P1", "P2", "P3"],
          selectedTeam: "Team E",
        },
      },
    ];
    const payload = await uploadLeagueBackup({ playoffMode: "manual", schedule });

    expect(payload.data.playoffMode).toBe("manual");
    expect(payload.data.schedule).toEqual(schedule);
    expect(setDoc.mock.calls[0][1].data.schedule).toEqual(schedule);
  });});
