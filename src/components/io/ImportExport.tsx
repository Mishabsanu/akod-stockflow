"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Download, Eye, FileSpreadsheet, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImportPreviewTable, type ImportResult } from "./ImportPreviewTable";

interface ImportExportProps {
  /** URL segment of /api/io/<entity>, e.g. "products", "stock-upload" */
  entity: string;
  /** Shown in the import dialog */
  title: string;
  canImport?: boolean;
  /** One line telling the user how matching works, e.g. "Rows are matched by SKU." */
  importHint?: string;
  /** Hide the Export menu (import-only screens such as the stock upload) */
  showExport?: boolean;
  /** Label of the import button */
  importLabel?: string;
  /** Extra query params sent with export, templates and upload, e.g. { channel: id } */
  params?: Record<string, string>;
}

const linkBtn =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition";

type Step = "choose" | "preview" | "done";

/** Export (CSV / Excel, same filters as the screen) and Import (Excel / CSV with a preview first). */
export function ImportExport({ entity, title, canImport = false, importHint, showExport = true, importLabel = "Import", params }: ImportExportProps) {
  const router = useRouter();
  const search = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [result, setResult] = useState<ImportResult | null>(null);

  const base = `/api/io/${entity}`;
  const qs = new URLSearchParams(search.toString());
  qs.delete("page");
  qs.delete("limit");
  for (const [k, v] of Object.entries(params ?? {})) qs.set(k, v);
  const extra = new URLSearchParams(params ?? {});
  const withExtra = (q: Record<string, string>) => `${base}?${new URLSearchParams({ ...Object.fromEntries(extra), ...q })}`;
  const exportHref = (format: "csv" | "xlsx") => {
    const q = new URLSearchParams(qs);
    q.set("format", format);
    return `${base}?${q}`;
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const close = () => {
    setOpen(false);
    setFile(null);
    setResult(null);
    setStep("choose");
  };

  const send = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(withExtra(dryRun ? { dryRun: "1" } : {}), { method: "POST", body, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      setStep(dryRun ? "preview" : "done");
      if (!dryRun && data.created + data.updated > 0) {
        toast.success(`${data.created} added, ${data.updated} updated`);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const okRows = result ? result.created + result.updated : 0;

  const footer =
    step === "choose" ? (
      <>
        <Button variant="outline" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => send(true)} loading={busy} disabled={!file} icon={<Eye className="w-4 h-4" />}>
          Preview
        </Button>
      </>
    ) : step === "preview" ? (
      <>
        <Button variant="outline" onClick={() => setStep("choose")} disabled={busy} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button onClick={() => send(false)} loading={busy} disabled={okRows === 0} icon={<Upload className="w-4 h-4" />}>
          Confirm import ({okRows} row{okRows === 1 ? "" : "s"})
        </Button>
      </>
    ) : (
      <Button onClick={close}>Done</Button>
    );

  return (
    <>
      {showExport && (
        <div className="relative" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className={linkBtn} title="Download (uses the current filters)">
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1 text-xs">
              <a href={exportHref("csv")} onClick={() => setMenuOpen(false)} className="block px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                CSV (.csv)
              </a>
              <a href={exportHref("xlsx")} onClick={() => setMenuOpen(false)} className="block px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                Excel (.xlsx)
              </a>
            </div>
          )}
        </div>
      )}
      {canImport && (
        <button type="button" onClick={() => setOpen(true)} className={linkBtn}>
          <Upload className="w-4 h-4" />
          {importLabel}
        </button>
      )}

      <Modal
        open={open}
        onClose={close}
        title={`Import ${title}`}
        subtitle={
          step === "preview"
            ? "Preview — nothing has been saved yet"
            : "CSV or Excel (.xlsx) — first row must be the column headings"
        }
        icon={<FileSpreadsheet className="w-4 h-4" />}
        size={step === "choose" ? "md" : "lg"}
        footer={footer}
      >
        {step === "choose" ? (
          <div className="space-y-4 text-xs text-slate-600">
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>
                Download a{" "}
                <a href={withExtra({ template: "1", format: "csv" })} className="font-bold text-brand hover:underline">
                  CSV template
                </a>{" "}
                or{" "}
                <a href={withExtra({ template: "1" })} className="font-bold text-brand hover:underline">
                  Excel template
                </a>
                {showExport && (
                  <>
                    {" "}
                    (or{" "}
                    <a href={exportHref("csv")} className="font-bold text-brand hover:underline">
                      current data
                    </a>{" "}
                    to edit)
                  </>
                )}
                .
              </li>
              <li>Fill it in. Empty cells keep the existing value.</li>
              <li>Upload it and check the preview before confirming. {importHint}</li>
            </ol>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 hover:border-brand rounded-xl p-6 text-center"
            >
              <FileSpreadsheet className="w-8 h-8 mx-auto text-brand mb-1.5" />
              <span className="block text-sm font-bold text-slate-800 break-all">{file ? file.name : "Choose file"}</span>
              <span className="block text-[11px] text-slate-500">{file ? `${(file.size / 1024).toFixed(0)} KB` : ".csv or .xlsx, up to 5 MB"}</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>
        ) : result ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                ["Rows", result.total],
                [step === "preview" ? "Will add" : "Added", result.created],
                [step === "preview" ? "Will update" : "Updated", result.updated],
                ["Failed", result.errors.length],
              ].map(([label, n]) => (
                <div key={label} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{label}</p>
                  <p className="text-lg font-black text-slate-900">{n}</p>
                </div>
              ))}
            </div>
            {result.errors.length === 0 ? (
              <p className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                {step === "preview" ? "Every row is valid." : "Every row was imported."}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-rose-700 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {result.errors.length} row(s) {step === "preview" ? "will be skipped" : "were not imported"} — fix them in the file and upload again.
              </p>
            )}
            <ImportPreviewTable rows={result.rows} />
            {result.ignored.length > 0 && <p className="text-[11px] text-slate-500">Columns not used: {result.ignored.join(", ")}</p>}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
