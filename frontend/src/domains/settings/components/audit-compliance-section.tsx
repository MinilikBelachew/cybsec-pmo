"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, FileSpreadsheet, Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { getApiErrorMessage } from "@/core/errors/api-error";
import {
  useGetAuditSettingsQuery,
  useRunAuditArchiveMutation,
  useUpdateAuditSettingsMutation,
} from "../api/settings.api";

type AuditComplianceSectionProps = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function AuditComplianceSection({
  onSuccess,
  onError,
}: AuditComplianceSectionProps) {
  const { data, isLoading, isError, error } = useGetAuditSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateAuditSettingsMutation();
  const [runArchive, { isLoading: isArchiving }] = useRunAuditArchiveMutation();
  const loadErrorNotified = useRef(false);

  const [retentionMonths, setRetentionMonths] = useState("12");
  const [exportMaxRows, setExportMaxRows] = useState("10000");
  const [excelJsonLimit, setExcelJsonLimit] = useState("30000");
  const [pdfJsonLimit, setPdfJsonLimit] = useState("800");
  const [archiveEnabled, setArchiveEnabled] = useState(true);

  useEffect(() => {
    if (!data) return;
    setRetentionMonths(String(data.auditRetentionMonths));
    setExportMaxRows(String(data.auditExportMaxRows));
    setExcelJsonLimit(String(data.auditExportExcelJsonCellLimit));
    setPdfJsonLimit(String(data.auditExportPdfJsonLimit));
    setArchiveEnabled(data.auditArchiveEnabled);
    loadErrorNotified.current = false;
  }, [data]);

  useEffect(() => {
    if (!isError || loadErrorNotified.current) return;
    loadErrorNotified.current = true;
    onError(
      getApiErrorMessage(error, "Could not load audit settings. Check your permissions and try again."),
    );
  }, [isError, error, onError]);

  const handleSave = async () => {
    try {
      await updateSettings({
        auditRetentionMonths: Number(retentionMonths),
        auditExportMaxRows: Number(exportMaxRows),
        auditExportExcelJsonCellLimit: Number(excelJsonLimit),
        auditExportPdfJsonLimit: Number(pdfJsonLimit),
        auditArchiveEnabled: archiveEnabled,
      }).unwrap();
      onSuccess("Audit and compliance settings saved.");
    } catch (err) {
      onError(
        getApiErrorMessage(err, "Could not save audit settings. Check values and try again."),
      );
    }
  };

  const handleRunArchive = async () => {
    try {
      const result = await runArchive().unwrap();
      onSuccess(
        result.archivedCount > 0
          ? `Archived ${result.archivedCount} audit event(s) to long-term storage.`
          : "No audit events were old enough to archive.",
      );
    } catch (err) {
      onError(getApiErrorMessage(err, "Audit archival job failed."));
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading audit settings…</p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Audit settings could not be loaded. Refresh the page or contact an administrator.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Audit retention &amp; archive</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Events older than the retention period are moved from the live audit table to{" "}
            <code className="text-xs">audit_logs_archive</code> (not deleted). A scheduled job
            runs daily at 02:00 UTC.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="retention-months">Retention period (months)</Label>
            <Input
              id="retention-months"
              type="number"
              min={1}
              max={120}
              value={retentionMonths}
              onChange={(e) => setRetentionMonths(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 pb-1">
            <Checkbox
              id="archive-enabled"
              checked={archiveEnabled}
              onCheckedChange={(checked) => setArchiveEnabled(checked === true)}
            />
            <Label htmlFor="archive-enabled">Automatic archival enabled</Label>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <p>
            Last archival run:{" "}
            {data.lastAuditArchiveAt
              ? new Date(data.lastAuditArchiveAt).toLocaleString()
              : "Never"}
          </p>
          <p>Rows archived in last run: {data.lastAuditArchiveCount}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isArchiving}
          onClick={() => void handleRunArchive()}
        >
          <Archive className="size-4" />
          {isArchiving ? "Running…" : "Run archive now"}
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Audit export limits</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Controls how many rows are included in filtered exports (JSON, Excel, PDF) and how
              large JSON payloads appear in each format.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="export-max-rows">Max rows per export</Label>
            <Input
              id="export-max-rows"
              type="number"
              min={100}
              max={50000}
              value={exportMaxRows}
              onChange={(e) => setExportMaxRows(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="excel-json-limit">Excel JSON cell limit (chars)</Label>
            <Input
              id="excel-json-limit"
              type="number"
              min={1000}
              max={32767}
              value={excelJsonLimit}
              onChange={(e) => setExcelJsonLimit(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdf-json-limit">PDF JSON snippet limit (chars)</Label>
            <Input
              id="pdf-json-limit"
              type="number"
              min={100}
              max={10000}
              value={pdfJsonLimit}
              onChange={(e) => setPdfJsonLimit(e.target.value)}
            />
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          <Save className="size-4" />
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
      </section>
    </div>
  );
}
