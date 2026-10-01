import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import PublicScheduleBoard from "./PublicScheduleBoard";

const regular = {
  id: "r1",
  week: 1,
  label: "League",
  teamA: "A",
  teamB: "B",
  scoreA: "",
  scoreB: "",
  status: "Pending",
};

describe("PublicScheduleBoard", () => {
  let container;
  let root;
  let onOpenMatch;

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
    onOpenMatch = jest.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderBoard = (schedule) => {
    act(() => {
      root.render(
        <PublicScheduleBoard
          schedule={schedule}
          teams={[{ name: "A" }, { name: "B" }]}
          seasonTitle="BAM Season"
          renderTeam={(name) => <span>{name}</span>}
          onOpenMatch={onOpenMatch}
        />,
      );
    });
  };

  test("opens the existing Match Detail handler from a fixture card", () => {
    renderBoard([regular]);
    act(() => container.querySelector('[data-match-id="r1"]').click());
    expect(onOpenMatch).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" }));
  });

  test("renders grouped postseason fallback without guessed SVG connectors", () => {
    renderBoard([
      { ...regular, id: "sf", phase: "postseason", label: "Semi Final" },
      { ...regular, id: "f", phase: "postseason", label: "Final" },
    ]);
    expect(container.textContent).toContain("ROAD TO THE CHAMPIONSHIP");
    expect(container.querySelector(".bam-public-bracket-connectors")).toBeNull();
    expect(container.querySelectorAll(".bam-public-bracket-match")).toHaveLength(2);
  });

  test("shows Best Loser only when an Admin-selected team exists", () => {
    renderBoard([
      { ...regular, id: "p1", phase: "postseason", label: "Play-in" },
      {
        ...regular,
        id: "sf",
        phase: "postseason",
        label: "Semi Final",
        teamB: "B",
        teamBSource: {
          type: "bestLoser",
          matchIds: ["p1"],
          selectedTeam: "B",
        },
      },
    ]);
    expect(container.textContent).toContain("BEST LOSER");
  });
});

