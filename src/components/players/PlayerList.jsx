import React from "react";

function PlayerList({
  activeAdminMenu,
  players,
  getPlayerDisplayId,
  renderPlayerAvatar,
  setSelectedProfilePlayerId,
  toggleAvailable,
  startEditPlayer,
  deletePlayer,
  uploadExistingPlayerPhoto,
  removeExistingPlayerPhoto,
}) {
  return (
    <div
      style={{
        display: activeAdminMenu === "players" ? "block" : "none",
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "16px",
        marginTop: "16px",
        marginBottom: "20px",
        background: "#ffffff",
        overflowX: "auto",
      }}
    >
      <h3 style={{ marginTop: 0 }}>👥 Player List</h3>
      <table
        border="1"
        cellPadding="8"
        cellSpacing="0"
        style={{ width: "100%" }}
      >
        <thead>
          <tr>
            <th>BAM ID</th>
            <th>Photo</th>
            <th>Name</th>
            <th>Tier</th>
            <th>Rating</th>
            <th>Pos1</th>
            <th>Pos2</th>
            <th>Available</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {players.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: "center" }}>
                ยังไม่มีผู้เล่น
              </td>
            </tr>
          ) : (
            players.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: "bold", color: "#475569" }}>
                  {getPlayerDisplayId(p)}
                </td>
                <td>{renderPlayerAvatar(p.photoUrl, 42)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => setSelectedProfilePlayerId(String(p.id))}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#0f172a",
                      fontWeight: "bold",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                    title="Open Player Profile Manga Card"
                  >
                    {p.name}
                  </button>
                </td>
                <td>{p.tier}</td>
                <td>{p.rating}</td>
                <td>{p.pos1}</td>
                <td>{p.pos2 || "-"}</td>

                <td>
                  <button onClick={() => toggleAvailable(p.id)}>
                    {p.available ? "Yes" : "No"}
                  </button>
                </td>
                <td>
                  <button
                    onClick={() => startEditPlayer(p)}
                    style={{ marginRight: "6px" }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deletePlayer(p.id)}
                    style={{ marginRight: "6px" }}
                  >
                    Delete
                  </button>

                  <label
                    style={{
                      cursor: "pointer",
                      color: "#1976d2",
                      marginRight: "6px",
                    }}
                  >
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => uploadExistingPlayerPhoto(p.id, e)}
                    />
                  </label>

                  {p.photoUrl && (
                    <button onClick={() => removeExistingPlayerPhoto(p.id)}>
                      Remove Photo
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default PlayerList;
