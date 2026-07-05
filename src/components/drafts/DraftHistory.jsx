import React from "react";

function DraftHistory({
  activeAdminMenu,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  drafts,
  clearAllDrafts,
  loadDraft,
  renameDraft,
  deleteDraft,
}) {
  return (
    <details
      open
      style={{
        ...adminAccordionStyle,
        display: activeAdminMenu === "teams" ? "block" : "none",
      }}
    >
      <summary style={adminAccordionSummaryStyle}>
        <span>🗂️ Saved Drafts</span>
        <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
      </summary>
      <div style={{ marginTop: "32px" }}>
        <h2>Draft History</h2>

        {drafts.length > 0 && (
          <button onClick={clearAllDrafts} style={{ marginBottom: "12px" }}>
            Clear All Drafts
          </button>
        )}

        {drafts.length === 0 ? (
          <p>ยังไม่มี Draft ที่บันทึกไว้</p>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              style={{
                border: "1px solid #ccc",
                padding: "12px",
                marginBottom: "10px",
              }}
            >
              <strong>{draft.name}</strong>
              <p>
                Balance: {draft.balanceScore}% | {draft.createdAt}
              </p>

              <button
                onClick={() => loadDraft(draft)}
                style={{ marginRight: "8px" }}
              >
                Load
              </button>

              <button
                onClick={() => renameDraft(draft.id)}
                style={{ marginRight: "8px" }}
              >
                Rename
              </button>

              <button onClick={() => deleteDraft(draft.id)}>Delete</button>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

export default DraftHistory;
