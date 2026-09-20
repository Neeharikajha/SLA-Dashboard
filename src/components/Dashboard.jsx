import { useState, useEffect } from "react";
import Upload from "./Upload.jsx";
import StatsSection from "./StatsSection.jsx";
import LogsTable from "./LogsTable.jsx";

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0); // bump after upload to refetch stats + logs
  const [filename, setFilename] = useState("");
  const [availableFiles, setAvailableFiles] = useState([]);

  useEffect(() => {
    fetch("/api/files")
      .then((res) => res.json())
      .then((data) => setAvailableFiles(data.files || []));
  }, [refreshKey]);

  return (
    <main>
      <h1>SLA Dashboard</h1>
      <Upload onUploaded={() => setRefreshKey((k) => k + 1)} />
      <div className="card filters">
        <label htmlFor="file-select">Filter by Upload:</label>
        <select
          id="file-select"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
        >
          <option value="">All Uploads</option>
          {availableFiles.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <StatsSection refreshKey={refreshKey} filename={filename} />
      <LogsTable refreshKey={refreshKey} filename={filename} />
    </main>
  );
}
