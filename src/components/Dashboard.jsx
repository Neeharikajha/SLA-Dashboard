import { useState } from "react";
import Upload from "./Upload.jsx";
import StatsSection from "./StatsSection.jsx";
import LogsTable from "./LogsTable.jsx";

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0); // bump after upload to refetch stats + logs

  return (
    <main>
      <h1>SLA Dashboard</h1>
      <Upload onUploaded={() => setRefreshKey((k) => k + 1)} />
      <StatsSection refreshKey={refreshKey} />
      <LogsTable refreshKey={refreshKey} />
    </main>
  );
}
