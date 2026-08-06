"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { ListPagination, paginateItems } from "@/shared/components/list-pagination";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { cn } from "@/shared/utils/cn";
import { hasModulePermission } from "@/domains/auth/utils/module-permissions";
import { useAppSelector } from "@/store/hooks";
import { useGetRolesQuery } from "@/domains/roles/api/roles.api";
import {
  useAcknowledgeAlertEventMutation,
  useDeleteAlertRuleMutation,
  useGetAlertCatalogueQuery,
  useGetAlertInstancesQuery,
  useUpdateAlertRuleMutation,
} from "../api/alerts.api";
import { ALERT_INSTANCE_ROLE_CODES } from "../schemas/alert.schema";
import { AlertRuleForm } from "./alert-rule-form";

function formatDeliveryStatus(status: string, ackedAt: string | null): string {
  if (ackedAt || status === "acknowledged") return "Acknowledged";
  if (status === "sent") return "Sent";
  if (status === "queued") return "Queued";
  if (status === "failed") return "Failed";
  if (status === "retrying") return "Retrying";
  if (status === "dead") return "Dead";
  return status;
}

export function AlertCataloguePage() {
  const permissions = useAppSelector((s) => s.auth.permissions);
  const user = useAppSelector((s) => s.auth.user);
  const roleCode = user?.backendRoleCode ?? "";
  const canManage = hasModulePermission(permissions, "notifications", "manage");
  const canViewInstances = (
    ALERT_INSTANCE_ROLE_CODES as readonly string[]
  ).includes(roleCode);
  const { data: rules = [], isLoading } = useGetAlertCatalogueQuery(undefined, {
    skip: !canManage,
  });
  const { data: instances = [] } = useGetAlertInstancesQuery(undefined, {
    skip: !canViewInstances,
  });
  const { data: rolesData } = useGetRolesQuery(
    { page: 1, limit: 100 },
    { skip: !canManage },
  );
  const roles = rolesData?.data ?? [];
  const [updateRule, { isLoading: updatingRule }] = useUpdateAlertRuleMutation();
  const [deleteRule, { isLoading: deletingRule }] = useDeleteAlertRuleMutation();
  const [acknowledge] = useAcknowledgeAlertEventMutation();
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [instancePage, setInstancePage] = useState(1);
  const [instancePageSize, setInstancePageSize] = useState(10);

  useEffect(() => {
    setInstancePage(1);
  }, [instancePageSize, instances.length]);

  const instancePageCount = Math.max(
    1,
    Math.ceil(instances.length / instancePageSize),
  );
  useEffect(() => {
    if (instancePage > instancePageCount) setInstancePage(instancePageCount);
  }, [instancePage, instancePageCount]);

  const pagedInstances = useMemo(
    () => paginateItems(instances, instancePage, instancePageSize),
    [instances, instancePage, instancePageSize],
  );

  const onToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateRule({ id, body: { isActive } }).unwrap();
      toast.success(isActive ? "Rule enabled" : "Rule disabled");
    } catch {
      toast.error(isActive ? "Failed to enable rule" : "Failed to disable rule");
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteRule(deleteConfirm.id).unwrap();
      toast.success("Rule deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  if (!canManage && !canViewInstances) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        You do not have permission to view alert configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Alert Catalogue"
        description="Configure thresholds, channels, recipients, reminder cadence, acknowledgement, and escalation hierarchy."
        actions={
          canManage ? (
            <Button onClick={() => setShowForm((v) => !v)} className="gap-2">
              <Plus className="size-4" />
              Add rule
            </Button>
          ) : null
        }
      />

      {canManage && (
        <AlertRuleForm
          open={showForm}
          roles={roles}
          onCancel={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {canManage && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 text-sm font-semibold">
            Catalogue rules
          </div>
          {isLoading ? (
            <div className="py-12 flex justify-center text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Bell className="size-8 opacity-40" />
              No alert rules yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-start px-4 py-3">Event</th>
                  <th className="text-start px-4 py-3">Threshold</th>
                  <th className="text-start px-4 py-3">Channels</th>
                  <th className="text-start px-4 py-3">Recipients</th>
                  <th className="text-start px-4 py-3">Cadence</th>
                  <th className="text-start px-4 py-3">Escalation</th>
                  <th className="text-end px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-t border-border/40">
                    <td className="px-4 py-3 font-medium">{rule.eventType}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {Object.keys(rule.thresholdConfig ?? {}).length === 0
                        ? "—"
                        : JSON.stringify(rule.thresholdConfig)}
                    </td>
                    <td className="px-4 py-3">{rule.channels.join(", ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {rule.recipients.length === 0
                        ? "—"
                        : rule.recipients
                            .map((r) => r.roleName ?? r.roleCode ?? r.roleId)
                            .join(", ")}
                    </td>
                    <td className="px-4 py-3">{rule.reminderCadenceHrs}h</td>
                    <td className="px-4 py-3">
                      {rule.escalationRole} / {rule.escalationDelayHrs}h
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="inline-flex items-center justify-end gap-2">
                        <div
                          role="radiogroup"
                          aria-label="Rule status"
                          className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5"
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={rule.isActive}
                            disabled={updatingRule}
                            onClick={() => {
                              if (!rule.isActive) {
                                void onToggleActive(rule.id, true);
                              }
                            }}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                              rule.isActive
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={!rule.isActive}
                            disabled={updatingRule}
                            onClick={() => {
                              if (rule.isActive) {
                                void onToggleActive(rule.id, false);
                              }
                            }}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                              !rule.isActive
                                ? "bg-rose-600 text-white shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Inactive
                          </button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() =>
                            setDeleteConfirm({
                              id: rule.id,
                              label: rule.eventType,
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {canViewInstances && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 text-sm font-semibold">
            Recent alert instances
          </div>
          {instances.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No alert events yet.
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-start px-4 py-3">Event</th>
                    <th className="text-start px-4 py-3">Object</th>
                    <th className="text-start px-4 py-3">Channel</th>
                    <th className="text-start px-4 py-3">Status</th>
                    <th className="text-start px-4 py-3">Fired</th>
                    <th className="text-end px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInstances.map((event) => (
                    <tr key={event.id} className="border-t border-border/40">
                      <td className="px-4 py-3">{event.eventType ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {event.objectType}
                        {event.objectTitle
                          ? ` · ${event.objectTitle}`
                          : event.objectId
                            ? ` · ${event.objectId.slice(0, 8)}`
                            : ""}
                      </td>
                      <td className="px-4 py-3">{event.channel}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {formatDeliveryStatus(
                            event.deliveryStatus,
                            event.ackedAt,
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(event.firedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {!event.ackedAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await acknowledge(event.id).unwrap();
                                toast.success("Acknowledged");
                              } catch {
                                toast.error("Failed to acknowledge");
                              }
                            }}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ListPagination
                page={instancePage}
                pageSize={instancePageSize}
                total={instances.length}
                onPageChange={setInstancePage}
                onPageSizeChange={(size) => {
                  setInstancePageSize(size);
                  setInstancePage(1);
                }}
              />
            </>
          )}
        </div>
      )}

      <DeleteDialog
        isOpen={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => void onConfirmDelete()}
        title="Delete catalogue rule"
        description={
          deleteConfirm
            ? `Are you sure you want to delete the “${deleteConfirm.label}” rule? Its alert instances will also be removed. This cannot be undone.`
            : "Are you sure you want to delete this catalogue rule?"
        }
        isDeleting={deletingRule}
      />
    </div>
  );
}
