import fs from "fs";
import path from "path";

const read = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

describe("public players navigation wiring", () => {
  const playersSource = read("Players.jsx");
  const footerSource = read("../components/public/PublicDashboardFooter.jsx");

  test("replaces the public Awards tab with Players and keeps awards in Overview", () => {
    expect(playersSource).toContain('{ key: "players", label: "Players"');
    expect(playersSource).not.toContain('{ key: "awards", label: "Awards"');
    expect(playersSource).toContain('publicDashboardTab === "overview"');
    expect(playersSource).toContain("Season Awards");
    expect(footerSource).toContain('"players", "schedule"');
    expect(footerSource).not.toContain('"schedule", "awards"');
  });

  test("makes the Players summary card open the selected-season directory", () => {
    expect(playersSource).toContain('openPublicDashboardTab("players")');
    expect(playersSource).toContain("View players in ${selectedDashboardSeasonTitle}");
    expect(playersSource).toContain("seasonKey={String(publicSeasonId)}");
    expect(playersSource).toContain("directoryState={publicPlayerDirectoryState}");
  });

  test("keeps a fallback for the retired awards tab value", () => {
    expect(playersSource).toContain('publicDashboardTab === "awards"');
    expect(playersSource).toContain('setPublicDashboardTab("overview")');
  });
});
