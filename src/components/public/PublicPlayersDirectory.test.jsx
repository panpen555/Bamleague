import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import PublicPlayersDirectory from "./PublicPlayersDirectory";

const players = ["Alpha", "Bravo", "Charlie"].map((name, index) => ({
  id: `p${index + 1}`,
  name,
  teamName: "Team A",
  directoryKey: `id:p${index + 1}`,
  stats: { appearances: 0, pts: 0, ppg: "0.0", reb: 0, ast: 0, stl: 0, blk: 0 },
  hasSeasonStats: false,
  regularSeasonAvailable: true,
  regularSeasonMvpScore: 0,
  mvpRank: null,
  awards: [],
  profileSource: { playerId: `p${index + 1}`, playerName: name },
}));

describe("PublicPlayersDirectory", () => {
  let container;
  let root;
  let onOpenProfile;

  beforeAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onOpenProfile = jest.fn();
    window.requestAnimationFrame = (callback) => callback();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
  });

  const renderDirectory = (seasonKey = "season-1") => {
    act(() => {
      root.render(
        <PublicPlayersDirectory
          seasonKey={seasonKey}
          seasonTitle="BAM Season"
          directoryState={{ available: true, players }}
          teamNames={["Team A"]}
          renderPlayerAvatar={() => <span>avatar</span>}
          onOpenProfile={onOpenProfile}
        />,
      );
    });
  };

  const click = (element) => act(() => element.click());
  const compareButton = (name, action = "Add") =>
    container.querySelector(
      `button[aria-label="${action} ${name} ${action === "Add" ? "to" : "from"} comparison"]`,
    );

  test("selects two players, blocks a third and opens the comparison dialog", () => {
    const storageSpy = jest.spyOn(Storage.prototype, "setItem");
    renderDirectory();

    click(compareButton("Alpha"));
    click(compareButton("Bravo"));
    click(compareButton("Charlie"));

    expect(compareButton("Charlie").getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("เลือกได้สูงสุด 2 คน");
    expect(storageSpy).not.toHaveBeenCalled();

    const openComparison = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Compare Players",
    );
    expect(openComparison.disabled).toBe(false);
    click(openComparison);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  test("clears temporary selection when the selected season changes", () => {
    renderDirectory();
    click(compareButton("Alpha"));
    expect(compareButton("Alpha", "Remove")).not.toBeNull();

    renderDirectory("season-2");
    expect(compareButton("Alpha")).not.toBeNull();
    expect(container.querySelector(".bam-public-comparison-tray")).toBeNull();
  });

  test("opens the shared profile handler from a player card", () => {
    renderDirectory();
    click(container.querySelector('button[aria-label="Open player profile: Alpha"]'));

    expect(onOpenProfile).toHaveBeenCalledWith(players[0].profileSource);
  });
});
