"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function ImportReportPage() {
  const { groupId, jobId } = useParams() as { groupId: string; jobId: string };
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        const data = await apiFetch<any>(`/api/groups/${groupId}/imports/${jobId}`);
        setJob(data.job);
      } catch (err: any) {
        setError(err.message || "Failed to load import report.");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [groupId, jobId]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading import report...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!job) return null;

  const anomalies: any[] = [];
  job.rows?.forEach((row: any) => {
    row.anomalies?.forEach((anomaly: any) => {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: anomaly.anomalyType,
        severity: anomaly.severity,
        description: anomaly.description,
        actionTaken: anomaly.suggestedAction,
        rawData: row.rawData,
      });
    });
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Import Report</h1>
          <p className="text-gray-400 mt-2">
            File: {job.fileName} • Total Rows: {job.totalRows} • Status: {job.status}
          </p>
        </div>
        <div className="space-x-4">
          <Link href={`/groups/${groupId}`} className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition">
            Back to Group
          </Link>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Anomalies Detected ({anomalies.length})</h2>
        </div>
        
        {anomalies.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No anomalies detected. Import was perfectly clean!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Row</th>
                  <th className="px-6 py-3 font-medium">Severity</th>
                  <th className="px-6 py-3 font-medium">Anomaly Type</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Action Taken / Suggested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {anomalies.map((anom, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-mono">{anom.rowNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        anom.severity === "ERROR" ? "bg-red-500/20 text-red-400" :
                        anom.severity === "WARNING" ? "bg-amber-500/20 text-amber-400" :
                        "bg-blue-500/20 text-blue-400"
                      }`}>
                        {anom.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-200">
                      {anom.type}
                    </td>
                    <td className="px-6 py-4">{anom.description}</td>
                    <td className="px-6 py-4 text-emerald-400">{anom.actionTaken}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
