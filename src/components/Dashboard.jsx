import { useState } from "react";
import Upload from "./Upload";
import HealthBanner from "./HealthBanner";
import StatsSection from "./StatsSection";
import LogsTable from "./LogsTable";

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="dashboard">
      <HealthBanner key={refreshKey} />

      <Upload onUploaded={handleUploadComplete} />

      <StatsSection key={refreshKey} />

      <LogsTable key={refreshKey + 1000} />
    </div>
  );
}
