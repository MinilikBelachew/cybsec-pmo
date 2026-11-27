"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Save,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { getApiErrorMessage } from "@/core/errors/api-error";
import { useAuth } from "@/domains/auth";
import {
  useGetMailConnectionQuery,
  useTestMailConnectionMutation,
  useUpdateMailConnectionMutation,
} from "../api/settings.api";

type Props = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function MailConnectionSection({ onSuccess, onError }: Props) {
  const { user } = useAuth();
  const { data, isLoading, isError } = useGetMailConnectionQuery();
  const [updateMail, { isLoading: isSaving }] =
    useUpdateMailConnectionMutation();
  const [testMail, { isLoading: isTesting }] = useTestMailConnectionMutation();

  const [sendgridEnabled, setSendgridEnabled] = useState(false);
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [showSendgridKey, setShowSendgridKey] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpRequireTls, setSmtpRequireTls] = useState(false);
  const [smtpIgnoreTls, setSmtpIgnoreTls] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState("");
  const [defaultName, setDefaultName] = useState("");
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (!data) return;
    setSendgridEnabled(data.sendgridEnabled);
    setSmtpHost(data.smtpHost ?? "");
    setSmtpPort(String(data.smtpPort || 587));
    setSmtpUser(data.smtpUser ?? "");
    setSmtpSecure(data.smtpSecure);
    setSmtpRequireTls(data.smtpRequireTls);
    setSmtpIgnoreTls(data.smtpIgnoreTls);
    setDefaultEmail(data.defaultEmail ?? "");
    setDefaultName(data.defaultName ?? "");
  }, [data]);

  useEffect(() => {
    if (!testEmail && user?.email) {
      setTestEmail(user.email);
    }
  }, [user?.email, testEmail]);

  const buildPayload = () => ({
    sendgridEnabled,
    ...(sendgridApiKey.trim()
      ? { sendgridApiKey: sendgridApiKey.trim() }
      : {}),
    ...(smtpHost.trim() ? { smtpHost: smtpHost.trim() } : {}),
    smtpPort: Number(smtpPort) || 587,
    ...(smtpUser.trim() ? { smtpUser: smtpUser.trim() } : {}),
    ...(smtpPassword.trim() ? { smtpPassword: smtpPassword.trim() } : {}),
    smtpSecure,
    smtpRequireTls,
    smtpIgnoreTls,
    ...(defaultEmail.trim() ? { defaultEmail: defaultEmail.trim() } : {}),
    ...(defaultName.trim() ? { defaultName: defaultName.trim() } : {}),
  });

  const handleSave = async () => {
    try {
      await updateMail(buildPayload()).unwrap();
      setSendgridApiKey("");
      setSmtpPassword("");
      onSuccess("Email delivery settings saved.");
    } catch (err) {
      onError(getApiErrorMessage(err, "Could not save email settings."));
    }
  };

  const handleTest = async () => {
    if (!testEmail.trim()) {
      onError("Enter a recipient email address to send a test email.");
      return;
    }
    try {
      const res = await testMail({
        ...buildPayload(),
        testEmail: testEmail.trim(),
      }).unwrap();
      onSuccess(res.message);
    } catch (err) {
      onError(getApiErrorMessage(err, "Failed to send test email."));
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading email settings…</p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Could not load email delivery settings.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Mail className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Email Delivery (SMTP &amp; SendGrid)
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Configure outbound email for status report distribution,
              notifications, and alerts. Updates apply immediately without
              restarting the server.
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

      {/* Sender Identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-mail-from-email">Default Sender Email</Label>
          <Input
            id="settings-mail-from-email"
            type="email"
            value={defaultEmail}
            onChange={(e) => setDefaultEmail(e.target.value)}
            placeholder="pmo-noreply@yourcompany.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-mail-from-name">Default Sender Name</Label>
          <Input
            id="settings-mail-from-name"
            value={defaultName}
            onChange={(e) => setDefaultName(e.target.value)}
            placeholder="CyberSec PMO"
          />
        </div>
      </div>

      {/* SendGrid */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sendgridEnabled}
            onChange={(e) => setSendgridEnabled(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span className="text-sm font-semibold">
            Use SendGrid as primary email provider
          </span>
        </label>
        {sendgridEnabled && (
          <div className="space-y-1.5">
            <Label htmlFor="settings-sendgrid-key">
              SendGrid API Key{" "}
              {data.hasSendgridApiKey && (
                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                  (Saved: {data.sendgridApiKeyMasked})
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="settings-sendgrid-key"
                name="mail_sendgrid_api_key"
                autoComplete="new-password"
                type={showSendgridKey ? "text" : "password"}
                value={sendgridApiKey}
                onChange={(e) => setSendgridApiKey(e.target.value)}
                placeholder={
                  data.hasSendgridApiKey
                    ? "Leave blank to keep saved key"
                    : "SG.xxxxxxxx..."
                }
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSendgridKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSendgridKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SMTP */}
      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold">
          SMTP Server {sendgridEnabled ? "(Fallback)" : "(Primary)"}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="settings-smtp-host">SMTP Host</Label>
            <Input
              id="settings-smtp-host"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.office365.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-smtp-port">Port</Label>
            <Input
              id="settings-smtp-port"
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="settings-smtp-user">SMTP Username</Label>
            <Input
              id="settings-smtp-user"
              name="mail_smtp_username"
              autoComplete="off"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="pmo@yourcompany.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-smtp-pass">
              SMTP Password{" "}
              {data.hasSmtpPassword && (
                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                  (Saved — encrypted)
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="settings-smtp-pass"
                name="mail_smtp_password"
                autoComplete="new-password"
                type={showSmtpPass ? "text" : "password"}
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={
                  data.hasSmtpPassword
                    ? "Leave blank to keep saved password"
                    : "Password or App Password"
                }
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSmtpPass((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSmtpPass ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={smtpRequireTls}
              onChange={(e) => setSmtpRequireTls(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Require STARTTLS (port 587)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={smtpSecure}
              onChange={(e) => setSmtpSecure(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Implicit SSL/TLS (port 465)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={smtpIgnoreTls}
              onChange={(e) => setSmtpIgnoreTls(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Ignore TLS
          </label>
        </div>
      </div>

      {/* Test Email */}
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="settings-mail-test-to">Send Test Email To</Label>
          <Input
            id="settings-mail-test-to"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@yourcompany.com"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          disabled={isTesting || isSaving}
          onClick={() => void handleTest()}
        >
          {isTesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {isTesting ? "Sending…" : "Send Test Email"}
        </Button>
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
              ? "Delivered"
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
          {isSaving ? "Saving…" : "Save Email Settings"}
        </Button>
      </div>
    </section>
  );
}
