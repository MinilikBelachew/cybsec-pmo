"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plug,
  Save,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { getApiErrorMessage } from "@/core/errors/api-error";
import { useAppSelector } from "@/store/hooks";
import { hasModulePermission } from "@/domains/auth/utils/module-permissions";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";
import {
  useGetKekaConnectionQuery,
  useLazyGetKekaConnectionSecretsQuery,
  useTestKekaConnectionMutation,
  useUpdateKekaConnectionMutation,
} from "../../api/integrations.api";

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function SecretInput({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
  hasStored,
  onReveal,
}: {
  id: string;
  label: string;
  hint?: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  hasStored?: boolean;
  onReveal?: () => Promise<string | null>;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const ensureValue = async (): Promise<string | null> => {
    if (value.trim()) return value.trim();
    if (!hasStored || !onReveal) return null;
    setRevealing(true);
    try {
      return await onReveal();
    } finally {
      setRevealing(false);
    }
  };

  const handleToggleVisible = async () => {
    if (visible) {
      setVisible(false);
      return;
    }
    if (!value.trim() && hasStored && onReveal) {
      const revealed = await ensureValue();
      if (!revealed) {
        toast.error(`No saved ${label.toLowerCase()} to show.`);
        return;
      }
    }
    setVisible(true);
  };

  const handleCopy = async () => {
    try {
      const text = await ensureValue();
      if (!text) {
        toast.error("Nothing to copy — enter a value first.");
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, "Could not copy to clipboard."),
      );
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {hint ? (
          <span className="ml-1 font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="new-password"
          className="pr-20"
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            disabled={disabled || revealing}
            onClick={() => void handleToggleVisible()}
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          >
            {revealing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : visible ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            disabled={disabled || revealing || (!value.trim() && !hasStored)}
            onClick={() => void handleCopy()}
            aria-label={`Copy ${label}`}
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function KekaConnectionForm() {
  const permissions = useAppSelector((state) => state.auth.permissions);
  const canConfigure = hasModulePermission(
    permissions,
    "integrations",
    "configure",
  );

  const { data, isLoading, isError } = useGetKekaConnectionQuery();
  const [fetchSecrets] = useLazyGetKekaConnectionSecretsQuery();
  const [updateConnection, { isLoading: isSaving }] =
    useUpdateKekaConnectionMutation();
  const [testConnection, { isLoading: isTesting }] =
    useTestKekaConnectionMutation();

  const [companySubdomain, setCompanySubdomain] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [authUrl, setAuthUrl] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [apiKey, setApiKey] = useState("");

  const secretsCache = useRef<{
    clientId: string | null;
    clientSecret: string | null;
    apiKey: string | null;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setCompanySubdomain(data.companySubdomain ?? "");
    setSandbox(data.sandbox);
    setAuthUrl(data.authUrl ?? "");
    setApiBaseUrl(data.apiBaseUrl ?? "");
    setClientId("");
    setClientSecret("");
    setApiKey("");
    secretsCache.current = null;
  }, [data]);

  const loadSecrets = async () => {
    if (secretsCache.current) return secretsCache.current;
    const result = await fetchSecrets().unwrap();
    secretsCache.current = result;
    return result;
  };

  const revealField = async (
    field: "clientId" | "clientSecret" | "apiKey",
    setValue: (value: string) => void,
  ): Promise<string | null> => {
    try {
      const secrets = await loadSecrets();
      const next = secrets[field]?.trim() || null;
      if (next) setValue(next);
      return next;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not reveal saved secret."));
      return null;
    }
  };

  const buildBody = () => ({
    companySubdomain: companySubdomain.trim() || undefined,
    sandbox,
    authUrl: authUrl.trim() || null,
    apiBaseUrl: apiBaseUrl.trim() || null,
    ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
    ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
  });

  const handleSave = async () => {
    try {
      await updateConnection(buildBody()).unwrap();
      toast.success("Keka connection settings saved.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save Keka connection."));
    }
  };

  const handleTest = async () => {
    try {
      const result = await testConnection(buildBody()).unwrap();
      toast.success(result.message || "Keka authentication succeeded.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Keka connection test failed."));
    }
  };

  const statusChip = (() => {
    if (!data) return null;
    if (data.lastTestStatus === "ok") {
      return (
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
          <CheckCircle2 className="mr-1 size-3" />
          Connected
        </Badge>
      );
    }
    if (data.lastTestStatus === "failed") {
      return (
        <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
          <AlertCircle className="mr-1 size-3" />
          Last test failed
        </Badge>
      );
    }
    if (data.configured) {
      return (
        <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
          Configured · not tested
        </Badge>
      );
    }
    return <Badge variant="secondary">Not configured</Badge>;
  })();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading Keka connection settings…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
        Could not load Keka connection settings.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Plug className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Keka authentication</h2>
            {statusChip}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Save credentials in-app (encrypted). Source: {data.source}.
          </p>
          {data.lastTestedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Last tested {formatDateTime(data.lastTestedAt)}
              {data.lastTestError ? ` · ${data.lastTestError}` : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="keka-subdomain">Company subdomain</Label>
          <Input
            id="keka-subdomain"
            value={companySubdomain}
            onChange={(e) => setCompanySubdomain(e.target.value)}
            placeholder="cybersecdemo"
            disabled={!canConfigure}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={sandbox}
              onCheckedChange={(checked) => setSandbox(checked === true)}
              disabled={!canConfigure}
            />
            Use Keka sandbox (kekademo)
          </label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="keka-auth-url">Auth URL override (optional)</Label>
          <Input
            id="keka-auth-url"
            value={authUrl}
            onChange={(e) => setAuthUrl(e.target.value)}
            placeholder={data.effectiveAuthUrl}
            disabled={!canConfigure}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="keka-api-url">API base URL override (optional)</Label>
          <Input
            id="keka-api-url"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder={data.effectiveApiBaseUrl}
            disabled={!canConfigure}
          />
        </div>
        <SecretInput
          id="keka-client-id"
          label="Client ID"
          hint={
            data.clientIdMasked ? `(current ${data.clientIdMasked})` : null
          }
          value={clientId}
          onChange={setClientId}
          placeholder={
            data.hasClientId ? "Saved — click eye to show" : "Client ID"
          }
          disabled={!canConfigure}
          hasStored={data.hasClientId}
          onReveal={() => revealField("clientId", setClientId)}
        />
        <SecretInput
          id="keka-client-secret"
          label="Client secret"
          value={clientSecret}
          onChange={setClientSecret}
          placeholder={
            data.hasClientSecret
              ? "Saved — click eye to show"
              : "Client secret"
          }
          disabled={!canConfigure}
          hasStored={data.hasClientSecret}
          onReveal={() => revealField("clientSecret", setClientSecret)}
        />
        <div className="sm:col-span-2">
          <SecretInput
            id="keka-api-key"
            label="API key"
            value={apiKey}
            onChange={setApiKey}
            placeholder={
              data.hasApiKey ? "Saved — click eye to show" : "API key"
            }
            disabled={!canConfigure}
            hasStored={data.hasApiKey}
            onReveal={() => revealField("apiKey", setApiKey)}
          />
        </div>
      </div>

      {canConfigure ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={isSaving || isTesting}
            onClick={() => void handleSave()}
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5")}
            disabled={isSaving || isTesting}
            onClick={() => void handleTest()}
          >
            {isTesting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            Test connection
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          You need integrations configure permission to change connection
          settings.
        </p>
      )}
    </div>
  );
}
