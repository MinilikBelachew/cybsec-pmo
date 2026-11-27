"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { getApiErrorMessage } from "@/core/errors/api-error";
import {
  useGetEntraConnectionQuery,
  useTestEntraConnectionMutation,
  useUpdateEntraConnectionMutation,
} from "../api/settings.api";

type Props = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function EntraConnectionSection({ onSuccess, onError }: Props) {
  const { data, isLoading, isError } = useGetEntraConnectionQuery();
  const [updateEntra, { isLoading: isSaving }] =
    useUpdateEntraConnectionMutation();
  const [testEntra, { isLoading: isTesting }] =
    useTestEntraConnectionMutation();

  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTenantId(data.tenantId ?? "");
    setRedirectUri(data.redirectUri ?? "");
  }, [data]);

  const buildPayload = () => ({
    tenantId: tenantId.trim() || undefined,
    ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
    ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
    redirectUri: redirectUri.trim() || null,
  });

  const handleSave = async () => {
    try {
      await updateEntra(buildPayload()).unwrap();
      setClientId("");
      setClientSecret("");
      onSuccess("Microsoft Entra ID settings saved.");
    } catch (err) {
      onError(getApiErrorMessage(err, "Could not save Entra ID settings."));
    }
  };

  const handleTest = async () => {
    try {
      const res = await testEntra(buildPayload()).unwrap();
      onSuccess(res.message);
    } catch (err) {
      onError(getApiErrorMessage(err, "Microsoft Entra ID test failed."));
    }
  };

  const handleCopyRedirect = async () => {
    const uri = redirectUri.trim() || data?.effectiveRedirectUri || "";
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading Microsoft Entra ID settings…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Could not load Microsoft Entra ID connection settings.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Microsoft Entra ID (SSO)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Manage Azure App Registration credentials used for Microsoft
              Single Sign-On. Changes take effect immediately with zero restart.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.configured ? "default" : "secondary"}>
            {data.configured ? "Configured" : "Not configured"}
          </Badge>
          <Badge variant="outline" className="capitalize">
            Source: {data.source}
          </Badge>
        </div>
      </div>

      {/* Effective Redirect URI */}
      <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active Redirect URI
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => void handleCopyRedirect()}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>
        <code className="block break-all text-xs">
          {redirectUri.trim() || data.effectiveRedirectUri}
        </code>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-entra-tenant">Directory (Tenant) ID</Label>
          <Input
            id="settings-entra-tenant"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-entra-client">
            Application (Client) ID{" "}
            {data.hasClientId && (
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                (Saved: {data.clientIdMasked})
              </span>
            )}
          </Label>
          <Input
            id="settings-entra-client"
            name="entra_app_client_id"
            autoComplete="off"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={
              data.hasClientId
                ? "Leave blank to keep saved Client ID"
                : "Application (Client) ID"
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-entra-secret">
            Client Secret Value{" "}
            {data.hasClientSecret && (
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                (Saved — encrypted)
              </span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="settings-entra-secret"
              name="entra_app_client_secret"
              autoComplete="new-password"
              type={showSecret ? "text" : "password"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={
                data.hasClientSecret
                  ? "Leave blank to keep saved secret"
                  : "Paste new Secret Value"
              }
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-entra-redirect">
            Custom Redirect URI (optional)
          </Label>
          <Input
            id="settings-entra-redirect"
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            placeholder={data.effectiveRedirectUri}
          />
        </div>
      </div>

      {data.lastTestStatus && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {data.lastTestStatus === "ok" ? (
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="size-4 text-destructive shrink-0" />
          )}
          <span>
            Last test:{" "}
            {data.lastTestStatus === "ok"
              ? "Verified"
              : `Failed (${data.lastTestError ?? "Unknown error"})`}
            {data.lastTestedAt
              ? ` · ${new Date(data.lastTestedAt).toLocaleString()}`
              : ""}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={isSaving || isTesting}
          onClick={() => void handleSave()}
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isSaving ? "Saving…" : "Save Entra ID"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={isSaving || isTesting}
          onClick={() => void handleTest()}
        >
          {isTesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          {isTesting ? "Testing…" : "Test Connection"}
        </Button>
      </div>
    </section>
  );
}
