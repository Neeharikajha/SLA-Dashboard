import { useState } from "react";

export default function Upload({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState(null);
  const [fileProgress, setFileProgress] = useState({});

  async function handleClear() {
    if (!confirm("Are you sure you want to clear all data? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/clear", { method: "POST" });
      if (!res.ok) throw new Error("Failed to clear database");
      setResult(null);
      setFileProgress({});
      onUploaded?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setClearing(false);
    }
  }

  async function handleFile(e) {
    const files = Array.from(e.target.files);
    e.target.value = ""; // allow re-selecting the same files
    if (files.length === 0) return;

    setBusy(true);
    setResult(null);

    try {
      let totalValid = 0;
      let totalOriginal = 0;
      let totalDropped = 0;
      let qualityScores = [];
      let warnings = [];

      await Promise.all(
        files.map(async (file) => {
          try {
            const startTime = Date.now();
            setFileProgress(p => ({ ...p, [file.name]: { status: "uploading" } }));
            
            console.log(`[Upload] processing file: ${file.name}, size: ${file.size}`);
            const text = await file.text();
            const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: text,
            });
            
            const json = await res.json();
            if (!res.ok) throw new Error(file.name + ": " + (json.error || "HTTP " + res.status));
            
            const elapsed = Date.now() - startTime;
            setFileProgress(p => ({ ...p, [file.name]: { status: "done", time: elapsed } }));

            totalValid += json.valid_rows;
            totalOriginal += json.original_rows;
            totalDropped += json.dropped_rows;
            qualityScores.push(json.data_quality_score);
            if (json.warning) warnings.push(json.warning);
          } catch (e) {
            setFileProgress(p => ({ ...p, [file.name]: { status: "error", error: e.message } }));
            throw e;
          }
        })
      );

      const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
      const uniqueWarnings = [...new Set(warnings)];

      setResult({
        valid_rows: totalValid,
        original_rows: totalOriginal,
        dropped_rows: totalDropped,
        data_quality_score: avgQuality,
        msg: `Successfully uploaded ${files.length} file(s).`,
        warning: uniqueWarnings.join(" "),
      });
      onUploaded?.();
    } catch (err) {
      console.log(`[Upload] error:`, err.message);
      setResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card upload">
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: Object.keys(fileProgress).length ? '16px' : '0' }}>
        <label className="btn">
          {busy ? "Processing…" : "Upload CSV"}
          <input
            type="file"
            accept=".csv"
            multiple
            onChange={handleFile}
            disabled={busy || clearing}
            hidden
          />
        </label>
        <button className="btn" onClick={handleClear} disabled={busy || clearing} style={{ background: '#b3261e' }}>
          {clearing ? "Clearing..." : "Reset Database"}
        </button>
      </div>

      {Object.entries(fileProgress).length > 0 && (
        <div style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>Upload Progress:</strong>
          {Object.entries(fileProgress).map(([fname, info]) => (
            <div key={fname} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
              <span>{fname}</span>
              <span>
                {info.status === "uploading" && <span style={{ color: '#a67c00' }}>⏳ Uploading...</span>}
                {info.status === "done" && <span style={{ color: '#1a7a3c' }}>✅ Done ({info.time}ms)</span>}
                {info.status === "error" && <span style={{ color: '#b3261e' }}>❌ Failed</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {result?.error && <p className="msg error">{result.error}</p>}
      {result && !result.error && (
        <div className="msg ok">
          <p>{result.msg}</p>
          <p>
            {result.valid_rows}/{result.original_rows} rows inserted ·{" "}
            {result.dropped_rows} dropped · quality{" "}
            {Math.round(result.data_quality_score * 100)}%
          </p>
          {result.warning && <p className="msg error" style={{marginTop: "8px", fontWeight: "bold"}}>{result.warning}</p>}
        </div>
      )}
    </section>
  );
}
