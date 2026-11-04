"use client";

import { useState } from "react";

interface DownloadButtonProps {
  runId: string;
  backendUrl: string;
  fileCount: number;
}

export default function DownloadButton({ runId, backendUrl, fileCount }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(`${backendUrl}/api/zip/${runId}`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `project-${runId.slice(0, 8)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download error:", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      id="download-zip-btn"
      className="btn-download"
      onClick={handleDownload}
      disabled={downloading}
      title={`Download ${fileCount} generated files as ZIP`}
    >
      {downloading ? (
        <>
          <span className="spinner" style={{ borderTopColor: "var(--accent-green)", width: "14px", height: "14px" }} />
          Downloading…
        </>
      ) : (
        <>⬇ Download ZIP ({fileCount} files)</>
      )}
    </button>
  );
}
