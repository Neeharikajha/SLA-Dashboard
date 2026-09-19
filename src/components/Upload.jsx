import { useState } from "react";

export default function Upload({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/upload", { method: "POST", body: text });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setResult(json);
      onUploaded?.();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card upload">
      <label className="btn">
        {busy ? "Processing…" : "Upload CSV"}
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          disabled={busy}
          hidden
        />
      </label>
      {result?.error && <p className="msg error">{result.error}</p>}
      {result && !result.error && (
        <p className="msg ok">
          {result.valid_rows}/{result.original_rows} rows inserted ·{" "}
          {result.dropped_rows} dropped · quality{" "}
          {Math.round(result.data_quality_score * 100)}%
        </p>
      )}
    </section>
  );
}
