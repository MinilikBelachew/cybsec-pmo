"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
  Moon,
  Send,
  ShieldCheck,
  Sun,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { setupClient } from "../api/setup.api";
import type { SetupConfig, SetupStatus } from "../types/setup.types";

const SETUP_TOKEN_STORAGE_KEY = "cybsec_pmo_setup_token";

type WizardStep = 1 | 2 | 3;

type BannerState = {
  type: "success" | "error";
  message: string;
} | null;

export function SetupWizardPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = typeof params?.locale === "string" ? params.locale : "en";
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [setupKey, setSetupKey] = useState("");
  const [showSetupKey, setShowSetupKey] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [finished, setFinished] = useState(false);

  // Step 1: Entra ID + Super Admin
  const [tenantId, setTenantId] = useState("");
  const [entraClientId, setEntraClientId] = useState("");
  const [entraClientSecret, setEntraClientSecret] = useState("");
  const [showEntraSecret, setShowEntraSecret] = useState(false);
  const [entraRedirectUri, setEntraRedirectUri] = useState("");
  const [superAdminEmail, setSuperAdminEmail] = useState("");
  const [superAdminName, setSuperAdminName] = useState("");
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [entraBanner, setEntraBanner] = useState<BannerState>(null);
  const [testingEntra, setTestingEntra] = useState(false);
  const [savingEntra, setSavingEntra] = useState(false);

  // Step 2: Email (SMTP & SendGrid)
  const [sendgridEnabled, setSendgridEnabled] = useState(false);
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [showSendgridKey, setShowSendgridKey] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpRequireTls, setSmtpRequireTls] = useState(true);
  const [smtpIgnoreTls, setSmtpIgnoreTls] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState("");
  const [defaultName, setDefaultName] = useState("CyberSec PMO");
  const [testRecipient, setTestRecipient] = useState("");
  const [mailBanner, setMailBanner] = useState<BannerState>(null);
  const [testingMail, setTestingMail] = useState(false);
  const [savingMail, setSavingMail] = useState(false);

  // Step 3: Keka
  const [kekaSubdomain, setKekaSubdomain] = useState("");
  const [kekaSandbox, setKekaSandbox] = useState(true);
  const [kekaClientId, setKekaClientId] = useState("");
  const [kekaClientSecret, setKekaClientSecret] = useState("");
  const [kekaApiKey, setKekaApiKey] = useState("");
  const [showKekaSecrets, setShowKekaSecrets] = useState(false);
  const [kekaBanner, setKekaBanner] = useState<BannerState>(null);
  const [testingKeka, setTestingKeka] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const hydrateFromConfig = useCallback((data: SetupConfig) => {
    setConfig(data);

    setTenantId(data.entra.tenantId ?? "");
    setEntraRedirectUri(data.entra.redirectUri ?? "");
    setSuperAdminEmail(data.superAdmin?.email ?? "");
    setSuperAdminName(data.superAdmin?.displayName ?? "");

    setSendgridEnabled(data.mail.sendgridEnabled);
    setSmtpHost(data.mail.smtpHost ?? "");
    setSmtpPort(String(data.mail.smtpPort || 587));
    setSmtpUser(data.mail.smtpUser ?? "");
    setSmtpSecure(data.mail.smtpSecure);
    setSmtpRequireTls(data.mail.smtpRequireTls);
    setSmtpIgnoreTls(data.mail.smtpIgnoreTls);
    setDefaultEmail(data.mail.defaultEmail ?? "");
    setDefaultName(data.mail.defaultName ?? "CyberSec PMO");
    setTestRecipient(data.superAdmin?.email ?? "");

    setKekaSubdomain(data.keka.companySubdomain ?? "");
    setKekaSandbox(data.keka.sandbox);
  }, []);

  const loadConfig = useCallback(
    async (token: string) => {
      setLoadingConfig(true);
      try {
        const data = await setupClient.getConfig(token);
        hydrateFromConfig(data);
        setSetupToken(token);
      } catch {
        sessionStorage.removeItem(SETUP_TOKEN_STORAGE_KEY);
        setSetupToken(null);
      } finally {
        setLoadingConfig(false);
      }
    },
    [hydrateFromConfig],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await setupClient.getStatus();
        if (!active) return;
        setStatus(s);
        if (!s.setupCompleted) {
          const savedToken = sessionStorage.getItem(SETUP_TOKEN_STORAGE_KEY);
          if (savedToken) {
            await loadConfig(savedToken);
          }
        }
      } catch (err) {
        if (!active) return;
        setStatusError(
          err instanceof Error
            ? err.message
            : "Could not reach backend API to check setup status.",
        );
      } finally {
        if (active) setLoadingStatus(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadConfig]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupKey.trim()) {
      setUnlockError("Enter the Setup Key from your server environment.");
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await setupClient.unlock(setupKey.trim());
      sessionStorage.setItem(SETUP_TOKEN_STORAGE_KEY, res.setupToken);
      await loadConfig(res.setupToken);
      setSetupKey("");
    } catch (err) {
      setUnlockError(
        err instanceof Error ? err.message : "Invalid setup key.",
      );
    } finally {
      setUnlocking(false);
    }
  };

  const handleCopyRedirectUri = async () => {
    const uri =
      entraRedirectUri.trim() || config?.entra.effectiveRedirectUri || "";
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedRedirect(true);
      setTimeout(() => setCopiedRedirect(false), 2000);
    } catch {
      // Clipboard may be restricted in non-HTTPS contexts
    }
  };

  const handleTestEntra = async () => {
    if (!setupToken) return;
    setTestingEntra(true);
    setEntraBanner(null);
    try {
      const res = await setupClient.testEntra(setupToken, {
        tenantId: tenantId.trim() || undefined,
        clientId: entraClientId.trim() || undefined,
        clientSecret: entraClientSecret.trim() || undefined,
        redirectUri: entraRedirectUri.trim() || null,
      });
      setEntraBanner({ type: "success", message: res.message });
    } catch (err) {
      setEntraBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Microsoft Entra ID test failed.",
      });
    } finally {
      setTestingEntra(false);
    }
  };

  const handleSaveEntraAndContinue = async () => {
    if (!setupToken) return;
    setEntraBanner(null);

    const hasTenant = Boolean(tenantId.trim());
    const hasClientId = Boolean(
      entraClientId.trim() || config?.entra.hasClientId,
    );
    const hasClientSecret = Boolean(
      entraClientSecret.trim() || config?.entra.hasClientSecret,
    );
    const hasAdminEmail = Boolean(superAdminEmail.trim());

    if (!hasTenant || !hasClientId || !hasClientSecret) {
      setEntraBanner({
        type: "error",
        message:
          "Tenant ID, Client ID, and Client Secret are required to enable Microsoft Sign-In.",
      });
      return;
    }

    if (!hasAdminEmail) {
      setEntraBanner({
        type: "error",
        message:
          "Enter the corporate Microsoft email of your first Super Admin so you can sign in after setup.",
      });
      return;
    }

    setSavingEntra(true);
    try {
      const result = await setupClient.saveEntra(setupToken, {
        tenantId: tenantId.trim(),
        ...(entraClientId.trim() ? { clientId: entraClientId.trim() } : {}),
        ...(entraClientSecret.trim()
          ? { clientSecret: entraClientSecret.trim() }
          : {}),
        redirectUri: entraRedirectUri.trim() || null,
        superAdminEmail: superAdminEmail.trim(),
        ...(superAdminName.trim()
          ? { superAdminName: superAdminName.trim() }
          : {}),
      });
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              entra: result.entra,
              superAdmin: result.superAdmin,
            }
          : prev,
      );
      setEntraClientId("");
      setEntraClientSecret("");
      if (!testRecipient.trim() && result.superAdmin?.email) {
        setTestRecipient(result.superAdmin.email);
      }
      setStep(2);
    } catch (err) {
      setEntraBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not save Entra ID settings.",
      });
    } finally {
      setSavingEntra(false);
    }
  };

  const buildMailPayload = () => ({
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

  const handleTestMail = async () => {
    if (!setupToken) return;
    if (!testRecipient.trim()) {
      setMailBanner({
        type: "error",
        message: "Enter a recipient email address to send a test email.",
      });
      return;
    }
    setTestingMail(true);
    setMailBanner(null);
    try {
      const res = await setupClient.testMail(setupToken, {
        ...buildMailPayload(),
        testEmail: testRecipient.trim(),
      });
      setMailBanner({ type: "success", message: res.message });
    } catch (err) {
      setMailBanner({
        type: "error",
        message:
          err instanceof Error ? err.message : "Test email failed to send.",
      });
    } finally {
      setTestingMail(false);
    }
  };

  const handleSaveMailAndContinue = async () => {
    if (!setupToken) return;
    setSavingMail(true);
    setMailBanner(null);
    try {
      const updated = await setupClient.saveMail(setupToken, buildMailPayload());
      setConfig((prev) => (prev ? { ...prev, mail: updated } : prev));
      setSendgridApiKey("");
      setSmtpPassword("");
      setStep(3);
    } catch (err) {
      setMailBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not save email configuration.",
      });
    } finally {
      setSavingMail(false);
    }
  };

  const buildKekaPayload = () => ({
    ...(kekaSubdomain.trim() ? { companySubdomain: kekaSubdomain.trim() } : {}),
    sandbox: kekaSandbox,
    ...(kekaClientId.trim() ? { clientId: kekaClientId.trim() } : {}),
    ...(kekaClientSecret.trim()
      ? { clientSecret: kekaClientSecret.trim() }
      : {}),
    ...(kekaApiKey.trim() ? { apiKey: kekaApiKey.trim() } : {}),
  });

  const handleTestKeka = async () => {
    if (!setupToken) return;
    setTestingKeka(true);
    setKekaBanner(null);
    try {
      const res = await setupClient.testKeka(setupToken, buildKekaPayload());
      setKekaBanner({ type: "success", message: res.message });
    } catch (err) {
      setKekaBanner({
        type: "error",
        message:
          err instanceof Error ? err.message : "Keka connection test failed.",
      });
    } finally {
      setTestingKeka(false);
    }
  };

  const handleFinishSetup = async (saveKekaFirst: boolean) => {
    if (!setupToken) return;
    setFinishing(true);
    setKekaBanner(null);
    try {
      if (
        saveKekaFirst &&
        (kekaSubdomain.trim() ||
          kekaClientId.trim() ||
          kekaClientSecret.trim() ||
          kekaApiKey.trim())
      ) {
        const updatedKeka = await setupClient.saveKeka(
          setupToken,
          buildKekaPayload(),
        );
        setConfig((prev) => (prev ? { ...prev, keka: updatedKeka } : prev));
      }

      const finalStatus = await setupClient.complete(setupToken);
      setStatus(finalStatus);
      sessionStorage.removeItem(SETUP_TOKEN_STORAGE_KEY);
      setSetupToken(null);
      setFinished(true);
    } catch (err) {
      setKekaBanner({
        type: "error",
        message:
          err instanceof Error ? err.message : "Could not complete setup.",
      });
    } finally {
      setFinishing(false);
    }
  };

  const goToLogin = () => {
    router.push(`/${locale}/login`);
  };

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="relative h-screen w-full overflow-y-auto overflow-x-hidden bg-background text-foreground">
      {/* Light / Dark mode toggle */}
      <div className="fixed right-4 top-4 z-30">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="gap-2 rounded-full bg-card/90 backdrop-blur-md shadow-xs"
          aria-label="Toggle light or dark theme"
        >
          {isDark ? (
            <>
              <Sun className="size-4 text-amber-400" />
              <span className="text-xs font-medium">Light mode</span>
            </>
          ) : (
            <>
              <Moon className="size-4 text-slate-700" />
              <span className="text-xs font-medium">Dark mode</span>
            </>
          )}
        </Button>
      </div>

      {/* Subtle background styling matching AuthLayoutShell */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-44 opacity-20 dark:opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(to right, #f25022, #ffb900, #7fba00, #00a4ef)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col justify-start px-4 pt-12 pb-16 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            CyberSec PMO — First-Time Production Setup
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Platform Setup Wizard
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Configure Microsoft Entra ID SSO, email delivery, and optional Keka
            integration. Credentials are encrypted with AES-256-GCM at rest.
          </p>
        </div>

        {/* Loading */}
        {loadingStatus && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
            <Loader2 className="size-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              Checking platform setup status…
            </p>
          </div>
        )}

        {/* Backend unreachable */}
        {!loadingStatus && statusError && (
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 text-center space-y-4">
            <XCircle className="size-8 text-destructive mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Unable to connect</h2>
              <p className="text-sm text-muted-foreground">{statusError}</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        )}

        {/* Finished screen (just completed in this session) */}
        {!loadingStatus && !statusError && finished && (
          <div className="rounded-2xl border border-emerald-500/30 bg-card p-8 sm:p-10 space-y-6 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Platform Setup Complete</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                The setup wizard is now permanently locked. You can update
                Microsoft Entra ID, Email, or Keka credentials anytime under{" "}
                <span className="font-medium text-foreground">
                  Settings → Connections
                </span>
                .
              </p>
            </div>

            <div className="mx-auto max-w-md rounded-xl border border-border bg-muted/30 p-4 text-left text-sm space-y-2">
              <SummaryRow
                label="Microsoft Entra ID (SSO)"
                ok={Boolean(status?.entraConfigured)}
                detail={
                  config?.superAdmin?.email
                    ? `Super Admin: ${config.superAdmin.email}`
                    : "Configured"
                }
              />
              <SummaryRow
                label="Email (SMTP / SendGrid)"
                ok={Boolean(status?.mailConfigured)}
                optional
              />
              <SummaryRow
                label="Keka Integration"
                ok={Boolean(status?.kekaConfigured)}
                optional
              />
            </div>

            <Button size="lg" className="gap-2" onClick={goToLogin}>
              Go to Sign in with Microsoft
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Already locked before visiting */}
        {!loadingStatus &&
          !statusError &&
          !finished &&
          status?.setupCompleted && (
            <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 text-center space-y-5 shadow-sm">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock className="size-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold">
                  Initial Setup Already Completed
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  This platform has already been initialized and the setup
                  wizard is locked. Sign in with Microsoft as a Super Admin to
                  manage connections in Settings.
                </p>
              </div>
              <Button onClick={goToLogin} className="gap-2">
                Continue to Sign In
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

        {/* Unlock screen */}
        {!loadingStatus &&
          !statusError &&
          !finished &&
          status &&
          !status.setupCompleted &&
          !setupToken && (
            <form
              onSubmit={(e) => void handleUnlock(e)}
              className="rounded-2xl border border-border bg-card p-8 sm:p-10 space-y-6 shadow-sm max-w-lg mx-auto w-full"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="size-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Unlock Setup Wizard</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter the one-time Setup Key configured on the server (
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      SETUP_WIZARD_SECRET
                    </code>{" "}
                    or{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      BREAK_GLASS_EMERGENCY_SECRET
                    </code>
                    ).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setup-key-input">Setup Key</Label>
                <div className="relative">
                  <Input
                    id="setup-key-input"
                    type={showSetupKey ? "text" : "password"}
                    value={setupKey}
                    onChange={(e) => {
                      setSetupKey(e.target.value);
                      setUnlockError(null);
                    }}
                    placeholder="Paste your server Setup Key"
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showSetupKey ? "Hide setup key" : "Show setup key"}
                  >
                    {showSetupKey ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {unlockError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                  {unlockError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={unlocking || loadingConfig}
              >
                {unlocking || loadingConfig ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    Unlock Setup Wizard
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          )}

        {/* Unlocked 3-Step Wizard */}
        {!loadingStatus &&
          !statusError &&
          !finished &&
          status &&
          !status.setupCompleted &&
          setupToken &&
          config && (
            <div className="space-y-6">
              {/* Stepper */}
              <div className="grid grid-cols-3 gap-3">
                <StepPill
                  number={1}
                  title="Entra ID & Admin"
                  badge="Required"
                  active={step === 1}
                  done={step > 1 || (config.entra.configured && Boolean(config.superAdmin))}
                  onClick={() => setStep(1)}
                />
                <StepPill
                  number={2}
                  title="Email Delivery"
                  badge="Optional"
                  active={step === 2}
                  done={step > 2 && config.mail.configured}
                  onClick={() => {
                    if (config.entra.configured && config.superAdmin) setStep(2);
                  }}
                />
                <StepPill
                  number={3}
                  title="Keka HR / PSA"
                  badge="Optional"
                  active={step === 3}
                  done={config.keka.configured}
                  onClick={() => {
                    if (config.entra.configured && config.superAdmin) setStep(3);
                  }}
                />
              </div>

              {/* Step 1: Microsoft Entra ID & First Super Admin */}
              {step === 1 && (
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-5 text-primary" />
                        <h2 className="text-lg font-semibold">
                          Step 1 — Microsoft Entra ID (SSO) &amp; Super Admin
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connect your Azure App Registration and designate the
                        first Super Admin who will sign in with Microsoft.
                      </p>
                    </div>
                    <Badge variant="default">Required</Badge>
                  </div>

                  {/* Callback URI helper box */}
                  <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Azure App Registration Redirect URI
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => void handleCopyRedirectUri()}
                      >
                        {copiedRedirect ? (
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
                    <code className="block break-all text-xs text-foreground">
                      {entraRedirectUri.trim() || config.entra.effectiveRedirectUri}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      Add this exact URL under Azure Portal → App Registrations →
                      Authentication → Web Redirect URIs.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="entra-tenant-id">
                        Directory (Tenant) ID *
                      </Label>
                      <Input
                        id="entra-tenant-id"
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="entra-client-id">
                        Application (Client) ID *{" "}
                        {config.entra.hasClientId && (
                          <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                            (Saved: {config.entra.clientIdMasked})
                          </span>
                        )}
                      </Label>
                      <Input
                        id="entra-client-id"
                        name="setup_entra_client_id"
                        autoComplete="off"
                        value={entraClientId}
                        onChange={(e) => setEntraClientId(e.target.value)}
                        placeholder={
                          config.entra.hasClientId
                            ? "Leave blank to keep saved Client ID"
                            : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="entra-client-secret">
                        Client Secret Value *{" "}
                        {config.entra.hasClientSecret && (
                          <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                            (Saved)
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="entra-client-secret"
                          name="setup_entra_client_secret"
                          autoComplete="new-password"
                          type={showEntraSecret ? "text" : "password"}
                          value={entraClientSecret}
                          onChange={(e) => setEntraClientSecret(e.target.value)}
                          placeholder={
                            config.entra.hasClientSecret
                              ? "Leave blank to keep saved secret"
                              : "Paste Secret Value (not Secret ID)"
                          }
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEntraSecret((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showEntraSecret ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="entra-redirect-uri">
                        Custom Redirect URI{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="entra-redirect-uri"
                        value={entraRedirectUri}
                        onChange={(e) => setEntraRedirectUri(e.target.value)}
                        placeholder={config.entra.effectiveRedirectUri}
                      />
                    </div>
                  </div>

                  {/* First Super Admin */}
                  <div className="border-t border-border pt-5 space-y-4">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold">
                        First Super Admin Account
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        This user will automatically receive full{" "}
                        <strong>Super Admin</strong> access the first time they
                        sign in with Microsoft.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="super-admin-email">
                          Super Admin Microsoft Email *
                        </Label>
                        <Input
                          id="super-admin-email"
                          type="email"
                          value={superAdminEmail}
                          onChange={(e) => setSuperAdminEmail(e.target.value)}
                          placeholder="admin@yourcompany.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="super-admin-name">
                          Display Name{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            (optional)
                          </span>
                        </Label>
                        <Input
                          id="super-admin-name"
                          value={superAdminName}
                          onChange={(e) => setSuperAdminName(e.target.value)}
                          placeholder="Platform Administrator"
                        />
                      </div>
                    </div>
                  </div>

                  {entraBanner && <StatusBanner banner={entraBanner} />}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleTestEntra()}
                      disabled={testingEntra || savingEntra}
                      className="gap-2"
                    >
                      {testingEntra ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                      {testingEntra ? "Testing…" : "Test Entra ID"}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void handleSaveEntraAndContinue()}
                      disabled={savingEntra || testingEntra}
                      className="gap-2"
                    >
                      {savingEntra ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {savingEntra ? "Saving…" : "Save & Continue"}
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Email (SMTP & SendGrid) */}
              {step === 2 && (
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="size-5 text-primary" />
                        <h2 className="text-lg font-semibold">
                          Step 2 — Email Delivery (SMTP &amp; SendGrid)
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Used for status report distribution, notifications, and
                        security alerts. You can configure this now or skip and
                        set it up later in Settings.
                      </p>
                    </div>
                    <Badge variant="secondary">Optional</Badge>
                  </div>

                  {/* Sender identity */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="mail-default-email">
                        Default Sender Email
                      </Label>
                      <Input
                        id="mail-default-email"
                        type="email"
                        value={defaultEmail}
                        onChange={(e) => setDefaultEmail(e.target.value)}
                        placeholder="pmo-noreply@yourcompany.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mail-default-name">
                        Default Sender Name
                      </Label>
                      <Input
                        id="mail-default-name"
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
                        className="size-4 rounded border-border accent-primary"
                      />
                      <span className="text-sm font-semibold">
                        Use SendGrid as primary email provider
                      </span>
                    </label>
                    {sendgridEnabled && (
                      <div className="space-y-1.5 pt-1">
                        <Label htmlFor="sendgrid-api-key">
                          SendGrid API Key{" "}
                          {config.mail.hasSendgridApiKey && (
                            <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                              (Saved: {config.mail.sendgridApiKeyMasked})
                            </span>
                          )}
                        </Label>
                        <div className="relative">
                          <Input
                            id="sendgrid-api-key"
                            type={showSendgridKey ? "text" : "password"}
                            value={sendgridApiKey}
                            onChange={(e) => setSendgridApiKey(e.target.value)}
                            placeholder={
                              config.mail.hasSendgridApiKey
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
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold">
                        SMTP Server {sendgridEnabled ? "(Fallback)" : "(Primary)"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Works with Microsoft 365 (`smtp.office365.com:587`),
                        Gmail App Passwords (`smtp.gmail.com:587`), or any
                        corporate SMTP relay.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="smtp-host">SMTP Host</Label>
                        <Input
                          id="smtp-host"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="smtp.office365.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtp-port">Port</Label>
                        <Input
                          id="smtp-port"
                          type="number"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(e.target.value)}
                          placeholder="587"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="smtp-user">SMTP Username</Label>
                        <Input
                          id="smtp-user"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                          placeholder="pmo@yourcompany.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtp-pass">
                          SMTP Password{" "}
                          {config.mail.hasSmtpPassword && (
                            <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                              (Saved)
                            </span>
                          )}
                        </Label>
                        <div className="relative">
                          <Input
                            id="smtp-pass"
                            type={showSmtpPass ? "text" : "password"}
                            value={smtpPassword}
                            onChange={(e) => setSmtpPassword(e.target.value)}
                            placeholder={
                              config.mail.hasSmtpPassword
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
                    <div className="flex flex-wrap gap-5 pt-1 text-xs">
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

                  {/* Send Test Email */}
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="mail-test-to">
                        Send a live test email
                      </Label>
                      <Input
                        id="mail-test-to"
                        type="email"
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        placeholder="you@yourcompany.com"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleTestMail()}
                      disabled={testingMail || savingMail}
                      className="gap-2 shrink-0"
                    >
                      {testingMail ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      {testingMail ? "Sending…" : "Send Test Email"}
                    </Button>
                  </div>

                  {mailBanner && <StatusBanner banner={mailBanner} />}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="gap-1.5"
                    >
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(3)}
                        disabled={savingMail}
                      >
                        Skip for now
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleSaveMailAndContinue()}
                        disabled={savingMail || testingMail}
                        className="gap-2"
                      >
                        {savingMail ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        {savingMail ? "Saving…" : "Save & Continue"}
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Keka HR / PSA */}
              {step === 3 && (
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link2 className="size-5 text-primary" />
                        <h2 className="text-lg font-semibold">
                          Step 3 — Keka HR / PSA Integration
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connect Keka for employee, leave, project, and timesheet
                        sync. You can configure this now or skip and set it up
                        anytime later in Integrations → Keka.
                      </p>
                    </div>
                    <Badge variant="secondary">Optional</Badge>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="keka-subdomain">Company Subdomain</Label>
                      <Input
                        id="keka-subdomain"
                        value={kekaSubdomain}
                        onChange={(e) => setKekaSubdomain(e.target.value)}
                        placeholder="e.g. yourcompany"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm">
                        <input
                          type="checkbox"
                          checked={kekaSandbox}
                          onChange={(e) => setKekaSandbox(e.target.checked)}
                          className="size-4 accent-primary"
                        />
                        <span>Use Keka Sandbox (kekademo.com)</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="keka-client-id">
                        Client ID{" "}
                        {config.keka.hasClientId && (
                          <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                            (Saved)
                          </span>
                        )}
                      </Label>
                      <Input
                        id="keka-client-id"
                        type={showKekaSecrets ? "text" : "password"}
                        value={kekaClientId}
                        onChange={(e) => setKekaClientId(e.target.value)}
                        placeholder={
                          config.keka.hasClientId
                            ? "Keep saved"
                            : "Keka Client ID"
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="keka-client-secret">
                        Client Secret{" "}
                        {config.keka.hasClientSecret && (
                          <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                            (Saved)
                          </span>
                        )}
                      </Label>
                      <Input
                        id="keka-client-secret"
                        type={showKekaSecrets ? "text" : "password"}
                        value={kekaClientSecret}
                        onChange={(e) => setKekaClientSecret(e.target.value)}
                        placeholder={
                          config.keka.hasClientSecret
                            ? "Keep saved"
                            : "Keka Client Secret"
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="keka-api-key">
                        API Key{" "}
                        {config.keka.hasApiKey && (
                          <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                            (Saved)
                          </span>
                        )}
                      </Label>
                      <Input
                        id="keka-api-key"
                        type={showKekaSecrets ? "text" : "password"}
                        value={kekaApiKey}
                        onChange={(e) => setKekaApiKey(e.target.value)}
                        placeholder={
                          config.keka.hasApiKey ? "Keep saved" : "Keka API Key"
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowKekaSecrets((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showKekaSecrets ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      {showKekaSecrets ? "Hide secrets" : "Show secrets"}
                    </button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleTestKeka()}
                      disabled={testingKeka || finishing}
                      className="gap-2"
                    >
                      {testingKeka ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Link2 className="size-4" />
                      )}
                      {testingKeka ? "Testing…" : "Test Keka Connection"}
                    </Button>
                  </div>

                  {kekaBanner && <StatusBanner banner={kekaBanner} />}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(2)}
                      disabled={finishing}
                      className="gap-1.5"
                    >
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleFinishSetup(false)}
                        disabled={finishing || testingKeka}
                      >
                        Skip &amp; Finish Setup
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleFinishSetup(true)}
                        disabled={finishing || testingKeka}
                        className="gap-2"
                      >
                        {finishing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {finishing ? "Finishing…" : "Save & Finish Setup"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

function StepPill({
  number,
  title,
  badge,
  active,
  done,
  onClick,
}: {
  number: number;
  title: string;
  badge: string;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
        active
          ? "border-primary bg-primary/5 shadow-xs"
          : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          done
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="size-4" /> : number}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{badge}</div>
      </div>
    </button>
  );
}

function StatusBanner({ banner }: { banner: NonNullable<BannerState> }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        banner.type === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {banner.type === "success" ? (
        <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="size-4 shrink-0 mt-0.5" />
      )}
      <span>{banner.message}</span>
    </div>
  );
}

function SummaryRow({
  label,
  ok,
  optional,
  detail,
}: {
  label: string;
  ok: boolean;
  optional?: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {detail && (
          <div className="text-xs text-muted-foreground truncate">{detail}</div>
        )}
      </div>
      <Badge variant={ok ? "default" : "secondary"}>
        {ok ? "Configured" : optional ? "Skipped" : "Pending"}
      </Badge>
    </div>
  );
}
