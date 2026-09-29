import fs from "fs";
import path from "path";

const readSource = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

describe("season UI copy", () => {
  const playersSource = readSource("Players.jsx");

  test("uses the real season title in public and profile UI", () => {
    expect(playersSource).toContain('label: getCurrentSeasonTitle()');
    expect(playersSource).toContain(': getCurrentSeasonTitle();');
    expect(playersSource).toContain("Back to {getCurrentSeasonTitle()}");
    expect(playersSource).not.toMatch(/Current Season|Current Awards|Season ปัจจุบัน|\(ปัจจุบัน\)/);
  });

  test("preserves the internal CURRENT season identifier", () => {
    expect(playersSource).toContain('id: "CURRENT"');
    expect(playersSource).toContain('publicSeasonId === "CURRENT"');
    expect(playersSource).toContain('publicSeasonId !== "CURRENT"');
    expect(playersSource).toContain('setPublicSeasonId("CURRENT")');
  });

  test("uses working-season wording in admin support UI", () => {
    const leagueSetupSource = readSource(
      "../components/settings/LeagueSetupCards.jsx",
    );
    const navigationSource = readSource(
      "../components/admin/AdminNavigation.jsx",
    );
    const backupSource = readSource(
      "../components/cloud/BackupRestoreTools.jsx",
    );

    expect(leagueSetupSource).toContain("Season ที่กำลังจัดการ");
    expect(leagueSetupSource).not.toContain("Stats ปัจจุบัน");
    expect(navigationSource).toContain("เมนูที่กำลังใช้งาน");
    expect(navigationSource).not.toContain("Current Module");
    expect(backupSource).toContain("ข้อมูล Season ที่กำลังจัดการ");
  });
});
