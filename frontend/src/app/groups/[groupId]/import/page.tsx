"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { uploadImportCsv, ApiError } from "@/lib/api";
import { UploadCloud, FileText, AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";

const ACCEPTED_MIME = ["text/csv", "application/vnd.ms-excel", "text/plain"];
const MAX_SIZE_MB = 5;

export default function ImportCsvPage() {
  const router = useRouter();
  const { groupId } = useParams<{ groupId: string }>();

  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = (f: File) => {
    setError(null);
    if (!ACCEPTED_MIME.includes(f.type) && !f.name.endsWith(".csv")) {
      setError("Only CSV files are accepted.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File exceeds the ${MAX_SIZE_MB} MB limit.`);
      return;
    }
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) validateAndSet(picked);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const text = await file.text();
      const res = await uploadImportCsv(groupId, file.name, text);
      // If any participant names couldn't be auto-mapped, go to the mapping screen first
      if (res.requiresMapping) {
        router.push(`/groups/${groupId}/import/${res.job.id}/mapping`);
      } else {
        router.push(`/groups/${groupId}/import/${res.job.id}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Upload failed. Please try again.");
      }
      setUploading(false);
    }
  };

  const sizeKb = file ? (file.size / 1024).toFixed(1) : "0";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/groups/${groupId}`}
          className="handdrawn-btn-secondary flex items-center gap-2 text-sm w-fit py-1.5 px-4"
        >
          <ArrowLeft size={14} /> ← back to group
        </Link>
      </div>

      {/* Header */}
      <div className="handdrawn-card bg-white p-6 mb-6 notebook-margin-line pl-8 rotate-[-0.3deg]">
        <p className="text-xs text-paper-blue font-bold uppercase tracking-wider mb-0.5">
          📂 import / upload
        </p>
        <h1 className="marker-heading text-4xl text-paper-text uppercase tracking-wide">
          [ Upload CSV ]
        </h1>
        <p className="text-sm text-paper-text/60 mt-1 font-bold">
          Drop your expenses export — we&apos;ll scan every row for anomalies before committing anything.
        </p>
      </div>

      {/* Rules notice */}
      <div
        className="postit-card p-4 mb-6 text-sm text-paper-text"
        style={{ background: "#fff9c4" }}
      >
        <p className="marker-heading text-base mb-2">📋 Important Rules</p>
        <ul className="space-y-1 text-paper-text/80 font-bold list-none">
          <li>✅ You must upload the <strong>raw, unedited</strong> CSV export.</li>
          <li>✅ The system will detect anomalies automatically.</li>
          <li>✅ You will review and resolve each anomaly before the data is committed.</li>
          <li>🚫 Do <strong>not</strong> manually edit the CSV before uploading.</li>
        </ul>
      </div>

      {/* Expected CSV format */}
      <div className="handdrawn-card bg-white p-4 mb-6 text-xs font-mono text-paper-text/70">
        <p className="marker-heading text-sm text-paper-text mb-2 font-sans">📐 Expected CSV Columns</p>
        <p className="leading-6">
          <span className="bg-paper-muted px-1 rounded">date</span>&nbsp;
          <span className="bg-paper-muted px-1 rounded">description</span>&nbsp;
          <span className="bg-paper-muted px-1 rounded">amount</span>&nbsp;
          <span className="bg-paper-muted px-1 rounded">currency</span>&nbsp;
          <span className="bg-paper-muted px-1 rounded">paid_by</span>&nbsp;
          <span className="bg-paper-muted px-1 rounded">split_type</span>&nbsp;
          <span className="bg-paper-muted px-1 rounded">split_with</span>&nbsp;
          <span className="text-paper-text/40">split_details&nbsp;category&nbsp;notes (optional)</span>
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={`
          handdrawn-card transition-all duration-150 cursor-pointer flex flex-col items-center justify-center gap-4
          py-14 px-8 text-center select-none
          ${dragging ? "bg-paper-blue/10 border-paper-blue scale-[1.01]" : "bg-white hover:bg-paper-muted/30"}
          ${file ? "cursor-default" : ""}
        `}
        style={{ minHeight: 220 }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
          id="csv-file-input"
        />

        {file ? (
          <>
            <CheckCircle2 size={48} className="text-green-600" strokeWidth={1.5} />
            <div>
              <p className="marker-heading text-xl text-paper-text">{file.name}</p>
              <p className="text-sm text-paper-text/60 font-bold mt-0.5">{sizeKb} KB · ready to analyse</p>
            </div>
            <button
              className="text-xs text-paper-accent font-bold underline mt-2 hover:no-underline"
              onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
            >
              ✕ remove &amp; choose another
            </button>
          </>
        ) : (
          <>
            <UploadCloud
              size={52}
              className={`${dragging ? "text-paper-blue" : "text-paper-text/30"} transition-colors`}
              strokeWidth={1.5}
            />
            <div>
              <p className="marker-heading text-xl text-paper-text">
                {dragging ? "Release to drop!" : "Drag & drop your CSV here"}
              </p>
              <p className="text-sm text-paper-text/50 font-bold mt-0.5">
                or click to browse (max {MAX_SIZE_MB} MB)
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-paper-text/40 font-bold">
              <FileText size={14} /> .csv files only
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 border-2 border-paper-accent bg-paper-accent/5 p-3 rounded flex items-start gap-2">
          <AlertTriangle size={16} className="text-paper-accent shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-paper-accent">{error}</p>
        </div>
      )}

      {/* Upload button */}
      <button
        id="upload-csv-btn"
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`
          mt-6 w-full handdrawn-btn text-base py-3
          ${file && !uploading ? "bg-paper-accent text-white" : "opacity-40 cursor-not-allowed"}
        `}
        style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
      >
        {uploading ? "🔍 Analysing rows..." : file ? "📊 Analyse & Stage Import →" : "Select a CSV file first"}
      </button>

      {uploading && (
        <p className="text-center text-xs text-paper-text/50 mt-3 font-bold animate-pulse">
          Parsing CSV and running 17 anomaly checks... this takes a moment.
        </p>
      )}
    </main>
  );
}
