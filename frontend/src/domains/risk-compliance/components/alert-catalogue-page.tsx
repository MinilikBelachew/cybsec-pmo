"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Bell, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { hasModulePermission } from "@/domains/auth/utils/module-permissions";
import { useAppSelector } from "@/store/hooks";
import { useGetRolesQuery } from "@/domains/roles/api/roles.api";
import {
  useAcknowledgeAlertEventMutation,
  useDisableAlertRuleMutation,
  useGetAlertCatalogueQuery,
  useGetAlertInstancesQuery,
} from "../api/alerts.api";
import { AlertRuleForm } from "./alert-rule-form";

export function AlertCataloguePage() {
  const permissions = useAppSelector((s) => s.auth.permissions);
  const canManage = hasModulePermission(permissions, "notifications", "manage");
  const canView = hasModulePermission(permissions, "notifications", "view");
  const { data: rules = [], isLoading } = useGetAlertCatalogueQuery(undefined, {
    skip: !canManage,
  });
  const { data: instances = [] } = useGetAlertInstancesQuery(undefined, {
    skip: !canView,
  });
  const { data: rolesData } = useGetRolesQuery(
    { page: 1, limit: 100 },
    { skip: !canManage },
  );
  const roles = rolesData?.data ?? [];
  const [disableRule] = useDisableAlertRuleMutation();
  const [acknowledge] = useAcknowledgeAlertEventMutation();
  const [showForm, setShowForm] = useState(false);

  if (!canManage && !canView) {
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

      {showForm && canManage && (
        <AlertRuleForm
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
                  <th className="text-start px-4 py-3">Status</th>
                  <th className="text-end px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-t border-border/40">
                    <td className="px-4 py-3 font-medium">{rule.eventType}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {JSON.stringify(rule.thresholdConfig)}
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
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {rule.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-end">
                      {rule.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await disableRule(rule.id).unwrap();
                              toast.success("Rule disabled");
                            } catch {
                              toast.error("Failed to disable rule");
                            }
                          }}
                        >
                          Disable
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {canView && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 text-sm font-semibold">
            Recent alert instances
          </div>
          {instances.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No alert events yet.
            </div>
          ) : (
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
                {instances.slice(0, 50).map((event) => (
                  <tr key={event.id} className="border-t border-border/40">
                    <td className="px-4 py-3">{event.eventType ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.objectType}
                      {event.objectId ? ` · ${event.objectId.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-4 py-3">{event.channel}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{event.deliveryStatus}</Badge>
                      {event.ackedAt && (
                        <Badge variant="outline" className="ms-1">
                          Acked
                        </Badge>
                      )}
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
          )}
        </div>
      )}
    </div>
  );
}
