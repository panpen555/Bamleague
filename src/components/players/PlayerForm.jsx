import React from "react";

function PlayerForm({
  form,
  setForm,
  editingId,
  validTiers,
  validPositions,
  handlePlayerPhotoUpload,
  renderPlayerAvatar,
  addOrUpdatePlayer,
  resetForm,
}) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>
        👤 {editingId ? "Edit Player" : "Players"}
      </h2>
      <p style={{ marginTop: 0, color: "#555" }}>
        เพิ่ม / แก้ไขรายชื่อผู้เล่น กำหนดตำแหน่ง สกิล และสถานะพร้อมแข่ง
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "14px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: "10px",
            padding: "14px",
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginTop: 0 }}>📝 Player Info</h3>

          <label style={{ display: "block", marginBottom: "10px" }}>
            ชื่อผู้เล่น
            <input
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                marginTop: "4px",
                padding: "8px",
              }}
              placeholder="Player name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <label>
              Tier
              <select
                style={{
                  display: "block",
                  marginTop: "4px",
                  padding: "6px",
                }}
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
              >
                <option value="">Auto Tier</option>
                {validTiers.map((tier) => (
                  <option key={tier}>{tier}</option>
                ))}
              </select>
            </label>

            <label>
              POS 1
              <select
                style={{
                  display: "block",
                  marginTop: "4px",
                  padding: "6px",
                }}
                value={form.pos1}
                onChange={(e) => setForm({ ...form, pos1: e.target.value })}
              >
                {validPositions.map((pos) => (
                  <option key={pos}>{pos}</option>
                ))}
              </select>
            </label>

            <label>
              POS 2
              <select
                style={{
                  display: "block",
                  marginTop: "4px",
                  padding: "6px",
                }}
                value={form.pos2}
                onChange={(e) => setForm({ ...form, pos2: e.target.value })}
              >
                <option value="">-</option>
                {validPositions.map((pos) => (
                  <option key={pos}>{pos}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "block", marginTop: "12px" }}>
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) =>
                setForm({ ...form, available: e.target.checked })
              }
            />{" "}
            Available Player
          </label>
        </div>

        <div
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: "10px",
            padding: "14px",
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginTop: 0 }}>🏀 Skill Rating</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(90px, 1fr))",
              gap: "10px",
            }}
          >
            {[
              ["เลี้ยง", "dribbling"],
              ["วงใน", "insideScoring"],
              ["ยิง", "shooting"],
              ["ป้องกัน", "defense"],
              ["จ่ายบอล", "passing"],
            ].map(([label, key]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="1"
                  max="5"
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "4px",
                    padding: "6px",
                  }}
                  value={form[key]}
                  onChange={(e) =>
                    setForm({ ...form, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: "10px",
            padding: "14px",
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginTop: 0 }}>📷 Photo & Action</h3>

          <label style={{ display: "block", marginBottom: "10px" }}>
            Player Photo
            <input
              type="file"
              accept="image/*"
              onChange={handlePlayerPhotoUpload}
              style={{ display: "block", marginTop: "6px" }}
            />
          </label>

          {form.photoUrl && (
            <div style={{ marginBottom: "10px" }}>
              {renderPlayerAvatar(form.photoUrl, 48)}
              <button
                type="button"
                onClick={() => setForm({ ...form, photoUrl: "" })}
                style={{ marginLeft: "8px" }}
              >
                Remove Photo
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={addOrUpdatePlayer}
            style={{
              marginRight: "8px",
              padding: "8px 14px",
              background: "#1565c0",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
            }}
          >
            {editingId ? "Save Update" : "Add Player"}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default PlayerForm;
