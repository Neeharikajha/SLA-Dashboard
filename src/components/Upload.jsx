import { useState } from "react";

export default function Upload({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    console.log(`[Upload] selected file: ${file.name}, size: ${file.size}`);
    setBusy(true);

    try {
      const text = await file.text();
      console.log(`[Upload] read ${text.length} bytes, sending to /api/upload`);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });
      console.log(`[Upload] response status: ${res.status}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      console.log(`[Upload] success:`, json);

      const newEntry = {
        id: Date.now(),
        filename: file.name,
        timestamp: new Date(),
        validRows: json.valid_rows,
        droppedRows: json.dropped_rows,
        quality: (json.data_quality_score * 100).toFixed(2),
      };

      setHistory((prev) => [newEntry, ...prev]);
      onUploaded?.();
    } catch (err) {
      console.log(`[Upload] error:`, err.message);
      const errorEntry = {
        id: Date.now(),
        filename: file.name,
        timestamp: new Date(),
        error: err.message,
      };
      setHistory((prev) => [errorEntry, ...prev]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="upload-section">
      <h2>Upload CSV Data</h2>

      <label className="upload-button">
        {busy ? "Processing…" : "+ Select File"}
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          disabled={busy}
          hidden
        />
      </label>

      {history.length > 0 && (
        <div className="upload-history">
          <h3 style={{ marginTop: "1.5rem", fontSize: "0.95rem" }}>
            Upload History
          </h3>
          <div>
            {history.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: "0.75rem",
                  margin: "0.5rem 0",
                  borderRadius: "4px",
                  background: entry.error ? "#fee2e2" : "#f0fdf4",
                  borderLeft: `4px solid ${entry.error ? "#ef4444" : "#10b981"}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.875rem",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{entry.filename}</span>
                  <span style={{ color: "#64748b" }}>
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                {entry.error ? (
                  <div style={{ color: "#991b1b", fontSize: "0.875rem" }}>
                    Error: {entry.error}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.875rem", color: "#166534" }}>
                    {entry.validRows}/{entry.validRows + entry.droppedRows} rows
                    · quality {entry.quality}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
