"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Database,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { BaseBuddyWordmark } from "@/components/basebuddy-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { baseBuddyBranding } from "@/lib/branding";
import type { InstallSetupStatus } from "@/lib/self-host/install-runtime";
import { cn } from "@/lib/utils";

type SetupMode = "same" | "split";
type SetupStepId = "mode" | "env" | "sql" | "auth" | "check";
type AuthProviderChoice = "email" | "github" | "google" | "magic-link";

const AUTH_PROVIDER_STORAGE_KEY = "basebuddy.setup.authProviders";
const AUTH_READY_STORAGE_KEY = "basebuddy.setup.authReady";
const ENV_SAVED_STORAGE_KEY = "basebuddy.setup.envSaved";
const SQL_READY_STORAGE_KEY = "basebuddy.setup.sqlReady";
const WIZARD_MODE_STORAGE_KEY = "basebuddy.setup.installMode";

const authProviderOptions: Array<{
  description: string;
  id: AuthProviderChoice;
  label: string;
}> = [
  {
    description: "Email and password accounts from Supabase Auth.",
    id: "email",
    label: "Email and password",
  },
  {
    description: "One-time email links from Supabase Auth.",
    id: "magic-link",
    label: "Magic link",
  },
  {
    description: "Google OAuth from Supabase Auth providers.",
    id: "google",
    label: "Google",
  },
  {
    description: "GitHub OAuth from Supabase Auth providers.",
    id: "github",
    label: "GitHub",
  },
];

const setupSteps: Array<{
  description: string;
  id: SetupStepId;
  label: string;
}> = [
  {
    description: "Choose one Supabase project or two.",
    id: "mode",
    label: "Install",
  },
  {
    description: "Add the values BaseBuddy needs.",
    id: "env",
    label: ".env",
  },
  {
    description: "Install the BaseBuddy tables.",
    id: "sql",
    label: "SQL",
  },
  {
    description: "Match the login options you enabled.",
    id: "auth",
    label: "Auth",
  },
  {
    description: "Confirm setup before signing in.",
    id: "check",
    label: "Check",
  },
];

const sameProjectEnvBlock = `BASEBUDDY_SUPABASE_URL=https://your-project-ref.supabase.co
BASEBUDDY_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
BASEBUDDY_SUPABASE_SECRET_KEY=your-secret-key
BASEBUDDY_DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres`;

const splitProjectEnvBlock = `BASEBUDDY_CONTROL_SUPABASE_URL=https://your-basebuddy-project-ref.supabase.co
BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY=your-basebuddy-publishable-key
BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY=your-basebuddy-secret-key
BASEBUDDY_CONTROL_DATABASE_URL=postgresql://postgres.your-basebuddy-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres

BASEBUDDY_CONTENT_SUPABASE_URL=https://your-content-project-ref.supabase.co
BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY=your-content-publishable-key
BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY=your-content-secret-key
BASEBUDDY_CONTENT_DATABASE_URL=postgresql://postgres.your-content-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres`;

const cliMigrationCommand =
  "supabase db push --db-url \"$BASEBUDDY_DATABASE_URL\"";

const fallbackMigrationSql = `-- Open supabase/migrations/20260420130000_basebuddy_self_host_baseline.sql
-- Copy the full file into the Supabase SQL editor for the project that will store BaseBuddy setup tables.`;

const fallbackSetupSections = [
  {
    detail: "Required app settings for BaseBuddy, sign-in, content access, and uploads.",
    title: "App configuration",
  },
  {
    detail: "Connects BaseBuddy to the workspace it uses for users, projects, and setup.",
    title: "Workspace connection",
  },
  {
    detail: "Required BaseBuddy tables and database setup are installed.",
    title: "BaseBuddy tables",
  },
  {
    detail: "Redirect URLs and sign-in readiness for this self-host install.",
    title: "Sign-in",
  },
  {
    detail: "Connects BaseBuddy to the content you want to edit.",
    title: "Content connection",
  },
  {
    detail: "Upload access for media and files.",
    title: "Upload storage",
  },
  {
    detail: "Shows whether app data and editable content are kept together or separate.",
    title: "Install layout",
  },
  {
    detail: "Open projects, create your first project, then connect your content.",
    title: "Next steps",
  },
] as const;

type SetupSectionCopy = {
  detail: string;
  title: string;
};

const legacyPlaneTerm = (kind: "content" | "control") => `${kind}-plane`;
const legacyPlaneWords = (kind: "content" | "control") => `${kind} plane`;

const setupSectionCopyByRuntimeTitle = new Map<string, SetupSectionCopy>(
  [
    ["app configuration", fallbackSetupSections[0]],
    ["environment", fallbackSetupSections[0]],
    ["workspace connection", fallbackSetupSections[1]],
    [`${legacyPlaneTerm("control")} connectivity`, fallbackSetupSections[1]],
    [`${legacyPlaneWords("control")} connectivity`, fallbackSetupSections[1]],
    ["basebuddy tables", fallbackSetupSections[2]],
    [`${legacyPlaneTerm("control")} schema`, fallbackSetupSections[2]],
    [`${legacyPlaneWords("control")} schema`, fallbackSetupSections[2]],
    ["auth", fallbackSetupSections[3]],
    ["sign-in", fallbackSetupSections[3]],
    ["content connection", fallbackSetupSections[4]],
    [`${legacyPlaneTerm("content")} connectivity`, fallbackSetupSections[4]],
    [`${legacyPlaneWords("content")} connectivity`, fallbackSetupSections[4]],
    ["storage", fallbackSetupSections[5]],
    ["upload storage", fallbackSetupSections[5]],
    ["auth endpoint", {
      detail: "Supabase Auth is reachable for the sign-in methods you enabled.",
      title: "Sign-in check",
    }],
    ["database", {
      detail: "BaseBuddy can connect to the Supabase database.",
      title: "Database connection",
    }],
    ["workspace database", {
      detail: "BaseBuddy can connect to the workspace database.",
      title: "Workspace database",
    }],
    ["content database", {
      detail: "BaseBuddy can connect to the content database.",
      title: "Content database",
    }],
    ["supabase api", {
      detail: "Supabase REST access for this project.",
      title: "Supabase REST API",
    }],
    ["install layout", fallbackSetupSections[6]],
    ["topology", fallbackSetupSections[6]],
    ["next actions", fallbackSetupSections[7]],
  ],
);

const getSetupSectionCopy = (title: string, detail: string) => {
  const copy = setupSectionCopyByRuntimeTitle.get(title.trim().toLowerCase());

  if (copy) {
    return copy;
  }

  return {
    detail,
    title,
  };
};

const getSetupCheckLabel = (label: string, key: string) => {
  const normalizedLabel = label.trim().toLowerCase();
  const normalizedKey = key.trim().toLowerCase();

  if (
    normalizedLabel.includes(`${legacyPlaneTerm("content")} database url`) ||
    normalizedKey.includes("content_database_url")
  ) {
    return "Content connection";
  }

  if (
    normalizedLabel.includes(`${legacyPlaneTerm("control")} secret key`) ||
    normalizedKey.includes("control_supabase_secret_key")
  ) {
    return "Workspace secret key";
  }

  if (normalizedLabel.includes(legacyPlaneTerm("control"))) {
    return label.replace(new RegExp(legacyPlaneTerm("control"), "gi"), "Workspace");
  }

  if (normalizedLabel.includes(legacyPlaneTerm("content"))) {
    return label.replace(new RegExp(legacyPlaneTerm("content"), "gi"), "Content");
  }

  return label;
};

const getStatusCopy = (status: "invalid" | "missing" | "ready") => {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "invalid") {
    return "Needs attention";
  }

  return "Missing";
};

const getEnvBlockForMode = (mode: SetupMode) =>
  mode === "same" ? sameProjectEnvBlock : splitProjectEnvBlock;

const getAuthProviderEnvValue = (providers: AuthProviderChoice[]) => {
  const envProviders = providers.map((provider) =>
    provider === "email" ? "password" : provider === "magic-link" ? "magic_link" : provider,
  );

  return Array.from(new Set(envProviders)).join(",");
};

const getAuthProviderLabels = (providers: AuthProviderChoice[]) =>
  authProviderOptions
    .filter((option) => providers.includes(option.id))
    .map((option) => option.label)
    .join(", ");

const getModeCopy = (mode: SetupMode) => {
  if (mode === "same") {
    return {
      badge: "Recommended for most installs",
      databaseTarget: "Run the migration in the same Supabase project.",
      title: "Install BaseBuddy in the same Supabase project",
    };
  }

  return {
    badge: "For stricter separation",
    databaseTarget: "Run the migration in the Supabase project that stores BaseBuddy setup.",
    title: "Install BaseBuddy in a different Supabase project",
  };
};

const copyText = async (value: string) => {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }

  await navigator.clipboard.writeText(value);
  return true;
};

function CopyableBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(value);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5" onClick={handleCopy}>
          <Clipboard className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 text-xs leading-5 text-foreground">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function SetupCheckboxRow({
  checked,
  children,
  id,
  onChange,
}: {
  checked: boolean;
  children: React.ReactNode;
  id: string;
  onChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:border-primary/50 hover:bg-secondary/30"
    >
      <Checkbox
        id={id}
        checked={checked}
        className="mt-0.5"
        onCheckedChange={onChange}
      />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

export function OnboardingSetupView({
  migrationSql,
  readOnly = false,
  status,
}: {
  migrationSql?: string;
  readOnly?: boolean;
  status?: InstallSetupStatus;
}) {
  const { appName } = baseBuddyBranding;
  const [mode, setMode] = useState<SetupMode>("same");
  const [authProviders, setAuthProviders] = useState<AuthProviderChoice[]>(["email"]);
  const [authReady, setAuthReady] = useState(false);
  const [envSaved, setEnvSaved] = useState(false);
  const [sqlReady, setSqlReady] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [setupCheckError, setSetupCheckError] = useState<string | null>(null);
  const [setupCheckPending, setSetupCheckPending] = useState(false);
  const [activeStep, setActiveStep] = useState<SetupStepId>(readOnly ? "check" : "mode");
  const modeCopy = getModeCopy(mode);
  const envBlock = `${getEnvBlockForMode(mode)}
BASEBUDDY_AUTH_PROVIDERS=${getAuthProviderEnvValue(authProviders) || "password"}`;
  const setupSections = useMemo(
    () =>
      currentStatus?.sections.map((section) => {
        const copy = getSetupSectionCopy(section.title, section.description);

        return {
          checks: section.checks,
          detail: copy.detail,
          status: section.status,
          title: copy.title,
        };
      }) ??
      fallbackSetupSections.map((section) => ({
        ...section,
        checks: [],
        status: "ready" as const,
      })),
    [currentStatus],
  );
  const allReady = setupSections.every((section) => section.status === "ready");
  const issueSections = setupSections.filter((section) => section.status !== "ready");
  const readySections = setupSections.filter((section) => section.status === "ready");
  const activeStepIndex = Math.max(
    setupSteps.findIndex((step) => step.id === activeStep),
    0,
  );
  const activeStepMeta = setupSteps[activeStepIndex] ?? setupSteps[0];
  const setupReport = useMemo(
    () =>
      [
        `${appName} setup report`,
        `Install option: ${modeCopy.title}`,
        `Sign-in methods: ${getAuthProviderLabels(authProviders) || "None selected"}`,
        `Added .env values: ${envSaved ? "Yes" : "Not confirmed"}`,
        `Ran BaseBuddy SQL: ${sqlReady ? "Yes" : "Not confirmed"}`,
        `Configured sign-in: ${authReady ? "Yes" : "Not confirmed"}`,
        "",
        ...setupSections.flatMap((section) => [
          `${section.title}: ${getStatusCopy(section.status)}`,
          ...section.checks.map(
            (check) =>
              `- ${getSetupCheckLabel(check.label, check.key)}: ${
                check.value ?? getStatusCopy(check.status)
              }`,
          ),
        ]),
      ].join("\n"),
    [appName, authProviders, authReady, envSaved, modeCopy.title, setupSections, sqlReady],
  );

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useEffect(() => {
    const storedMode = window.localStorage.getItem(WIZARD_MODE_STORAGE_KEY);

    if (storedMode === "same" || storedMode === "split") {
      setMode(storedMode);
    }

    setEnvSaved(window.localStorage.getItem(ENV_SAVED_STORAGE_KEY) === "true");
    setSqlReady(window.localStorage.getItem(SQL_READY_STORAGE_KEY) === "true");
    setAuthReady(window.localStorage.getItem(AUTH_READY_STORAGE_KEY) === "true");

    const storedProviders = window.localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY);

    if (storedProviders) {
      try {
        const parsed = JSON.parse(storedProviders);

        if (Array.isArray(parsed)) {
          const nextProviders = parsed.filter((value): value is AuthProviderChoice =>
            authProviderOptions.some((option) => option.id === value),
          );

          setAuthProviders(nextProviders);
        }
      } catch {
        window.localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
      }
    }
  }, []);

  const chooseMode = (nextMode: SetupMode) => {
    setMode(nextMode);
    window.localStorage.setItem(WIZARD_MODE_STORAGE_KEY, nextMode);
  };

  const resetLocalChoices = () => {
    setMode("same");
    setAuthProviders(["email"]);
    setAuthReady(false);
    setEnvSaved(false);
    setSqlReady(false);
    window.localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_READY_STORAGE_KEY);
    window.localStorage.removeItem(ENV_SAVED_STORAGE_KEY);
    window.localStorage.removeItem(SQL_READY_STORAGE_KEY);
    window.localStorage.removeItem(WIZARD_MODE_STORAGE_KEY);
  };

  const toggleEnvSaved = () => {
    setEnvSaved((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(ENV_SAVED_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  };

  const toggleSqlReady = () => {
    setSqlReady((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(SQL_READY_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  };

  const toggleAuthReady = () => {
    setAuthReady((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(AUTH_READY_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  };

  const toggleAuthProvider = (provider: AuthProviderChoice) => {
    setAuthProviders((currentProviders) => {
      const nextProviders = currentProviders.includes(provider)
        ? currentProviders.filter((currentProvider) => currentProvider !== provider)
        : [...currentProviders, provider];

      window.localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, JSON.stringify(nextProviders));
      return nextProviders;
    });
  };

  const checkSetup = async () => {
    setSetupCheckError(null);
    setSetupCheckPending(true);

    try {
      const response = await fetch("/api/setup/check", {
        body: "{}",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: unknown;
        ready?: boolean;
        status?: InstallSetupStatus;
      };

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Setup check failed.");
      }

      if (payload.ready) {
        window.location.assign("/projects");
        return;
      }

      if (!payload.status) {
        throw new Error("Setup check failed.");
      }

      setCurrentStatus(payload.status);
    } catch {
      setSetupCheckError("Could not check setup right now. Refresh the page and try again.");
    } finally {
      setSetupCheckPending(false);
    }
  };

  const goToPreviousStep = () => {
    const previousStep = setupSteps[Math.max(activeStepIndex - 1, 0)];
    setActiveStep(previousStep.id);
  };

  const isStepReady = (stepId: SetupStepId) => {
    if (stepId === "env") {
      return envSaved;
    }

    if (stepId === "sql") {
      return sqlReady;
    }

    if (stepId === "auth") {
      return authProviders.length > 0 && authReady;
    }

    return true;
  };

  const canOpenStep = (stepIndex: number) =>
    stepIndex <= activeStepIndex ||
    setupSteps.slice(0, stepIndex).every((step) => isStepReady(step.id));

  const currentStepReady = isStepReady(activeStep);

  const goToNextStep = () => {
    if (!currentStepReady) {
      return;
    }

    const nextStep = setupSteps[Math.min(activeStepIndex + 1, setupSteps.length - 1)];
    setActiveStep(nextStep.id);
  };

  const renderActiveStep = () => {
    if (activeStep === "mode") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Choose where BaseBuddy lives</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Pick the setup that matches how you want to keep BaseBuddy data.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(["same", "split"] as const).map((option) => {
              const copy = getModeCopy(option);
              const selected = mode === option;

              return (
                <button
                  key={option}
                  type="button"
                  aria-label={`${copy.badge} ${copy.title}`}
                  aria-pressed={selected}
                  className={`rounded-lg border p-4 text-left transition ${
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                  onClick={() => chooseMode(option)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {option === "same" ? "Same project" : "Different project"}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-foreground">{copy.title}</h3>
                    </div>
                    {selected ? <CheckCircle2 className="h-5 w-5 text-primary" /> : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{copy.databaseTarget}</p>
                  <Badge variant={selected ? "default" : "secondary"} className="mt-4">
                    {copy.badge}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeStep === "env") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Add values to `.env`</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Create `.env` in the repo root, paste this block, and replace the placeholders.
            </p>
          </div>

          <CopyableBlock label={`${modeCopy.title} .env`} value={envBlock} />

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            For local Supabase, add `?sslmode=disable` to the database URL. For hosted Supabase, use the pooler
            connection string from the Supabase dashboard.
          </div>

          <SetupCheckboxRow checked={envSaved} id="basebuddy-env-confirmation" onChange={toggleEnvSaved}>
            <span className="block text-sm font-medium text-foreground">
              I added these values to `.env`
            </span>
            <span className="block text-xs text-muted-foreground">
              Your browser only stores this confirmation, not secret values.
            </span>
          </SetupCheckboxRow>
        </div>
      );
    }

    if (activeStep === "sql") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Run the BaseBuddy SQL</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {modeCopy.databaseTarget} Choose one method below. You do not need to run both.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Option 1: Supabase CLI</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Use this if you already have the Supabase CLI installed and can run commands from this repo.
              </p>
            </div>
            <CopyableBlock
              label="Supabase CLI command"
              value={
                mode === "same"
                  ? cliMigrationCommand
                  : cliMigrationCommand.replace("BASEBUDDY_DATABASE_URL", "BASEBUDDY_CONTROL_DATABASE_URL")
              }
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Option 2: Supabase SQL Editor</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Use this if you prefer the Supabase dashboard. Open SQL Editor, paste the SQL, and run it once.
              </p>
            </div>
            <details className="rounded-lg border border-border bg-muted/20">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                Migration SQL
              </summary>
              <div className="border-t border-border p-3">
                <CopyableBlock label="Migration SQL" value={migrationSql?.trim() || fallbackMigrationSql} />
              </div>
            </details>
          </div>

          <details className="rounded-lg border border-border bg-muted/20">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
              What this installs
            </summary>
            <div className="space-y-2 border-t border-border p-4 text-sm leading-6 text-muted-foreground">
              <p>
                This installs the BaseBuddy tables, policies, and helper functions needed for projects, permissions,
                mapping, and setup checks.
              </p>
              <p>It does not rename, move, or reshape your content tables.</p>
            </div>
          </details>

          <SetupCheckboxRow checked={sqlReady} id="basebuddy-sql-confirmation" onChange={toggleSqlReady}>
            <span className="block text-sm font-medium text-foreground">I ran the BaseBuddy SQL</span>
            <span className="block text-xs text-muted-foreground">
              Run it in the Supabase project that stores BaseBuddy setup tables.
            </span>
          </SetupCheckboxRow>
        </div>
      );
    }

    if (activeStep === "auth") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Set up Supabase Auth</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Select the sign-in methods you enabled in Supabase. BaseBuddy will match this login screen to your
              choices.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {authProviderOptions.map((provider) => (
              <SetupCheckboxRow
                key={provider.id}
                checked={authProviders.includes(provider.id)}
                id={`basebuddy-auth-provider-${provider.id}`}
                onChange={() => toggleAuthProvider(provider.id)}
              >
                <span className="block text-sm font-medium text-foreground">{provider.label}</span>
                <span className="block text-xs text-muted-foreground">{provider.description}</span>
              </SetupCheckboxRow>
            ))}
          </div>

          {authProviders.length === 0 ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              Choose at least one sign-in method before inviting users.
            </p>
          ) : null}

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Add `http://localhost:8080/auth/callback` while setting up locally. For Vercel, add your deployed
            `/auth/callback` URL, such as `https://your-app.vercel.app/auth/callback`.
          </div>

          <SetupCheckboxRow checked={authReady} id="basebuddy-auth-confirmation" onChange={toggleAuthReady}>
            <span className="block text-sm font-medium text-foreground">
              I enabled these sign-in methods and added the redirect URL
            </span>
            <span className="block text-xs text-muted-foreground">
              This keeps the setup flow honest before the final check.
            </span>
          </SetupCheckboxRow>
        </div>
      );
    }

    const renderSetupSection = (section: (typeof setupSections)[number]) => (
      <section key={section.title} className="rounded-md border border-border bg-background p-3">
        <div className="flex items-start gap-3">
          {section.status === "ready" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              <Badge variant={section.status === "ready" ? "secondary" : "outline"}>
                {getStatusCopy(section.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{section.detail}</p>
            {section.checks.length > 0 ? (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Details
                </summary>
                <dl className="mt-2 space-y-2">
                  {section.checks.map((check) => (
                    <div key={`${section.title}-${check.key}`} className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">{getSetupCheckLabel(check.label, check.key)}</dt>
                      <dd className="max-w-[13rem] truncate text-right font-mono text-foreground">
                        {check.value ?? getStatusCopy(check.status)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}
          </div>
        </div>
      </section>
    );

    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          {allReady ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
          )}
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {readOnly ? "Setup summary" : "Check setup"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {readOnly
                ? "This is the current setup status for this install."
                : "After BaseBuddy is running with your latest `.env`, check setup before signing in."}
            </p>
          </div>
        </div>

        <div
          className={`rounded-md border p-3 text-sm ${
            allReady
              ? "border-success/40 bg-success/10 text-success"
              : "border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          {allReady
            ? "BaseBuddy is ready. You can open projects and start mapping content."
            : `${issueSections.length} setup ${issueSections.length === 1 ? "item needs" : "items need"} attention.`}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" disabled={setupCheckPending} onClick={checkSetup}>
            {setupCheckPending ? "Checking..." : "Check setup"}
          </Button>
          {allReady ? (
            <Button type="button" variant="hero" size="sm" asChild>
              <Link href="/projects">Open projects</Link>
            </Button>
          ) : null}
        </div>

        {setupCheckError ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            {setupCheckError}
          </p>
        ) : null}

        {issueSections.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">{issueSections.map(renderSetupSection)}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{setupSections.map(renderSetupSection)}</div>
        )}

        {issueSections.length > 0 && readySections.length > 0 ? (
          <details className="rounded-lg border border-border bg-background">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
              Ready checks ({readySections.length})
            </summary>
            <div className="grid gap-3 border-t border-border p-3 md:grid-cols-2">
              {readySections.map(renderSetupSection)}
            </div>
          </details>
        ) : null}

        <details className="rounded-lg border border-border bg-background">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
            Copy setup details
          </summary>
          <div className="border-t border-border p-3">
            <CopyableBlock label="Setup details" value={setupReport} />
          </div>
        </details>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex h-14 items-center">
              <BaseBuddyWordmark className="h-10 w-auto" />
            </div>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-foreground">{readOnly ? "Summary" : "Install"}</span>
          </div>
          {readOnly ? null : (
            <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={resetLocalChoices}>
              <RotateCcw className="h-3.5 w-3.5" />
              Start over
            </Button>
          )}
        </div>
      </div>

      <main className="container mx-auto px-6 py-16">
        {readOnly ? null : (
        <div className="mb-12 overflow-x-auto">
          <div className="mx-auto flex min-w-max items-center justify-center gap-2 px-2 sm:px-6">
              {setupSteps.map((step, index) => {
                const reached = index <= activeStepIndex;
                const completed = index < activeStepIndex;

                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Step ${index + 1} ${step.label}`}
                      className="flex items-center gap-2"
                      disabled={!canOpenStep(index)}
                      onClick={() => {
                        if (canOpenStep(index)) {
                          setActiveStep(step.id);
                        }
                      }}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                          reached
                            ? "bg-primary text-primary-foreground"
                            : canOpenStep(index)
                              ? "bg-secondary text-muted-foreground"
                              : "bg-secondary/60 text-muted-foreground/60",
                        )}
                      >
                        {completed ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span
                        className={cn(
                          "whitespace-nowrap text-xs font-medium",
                          reached
                            ? "text-foreground"
                            : canOpenStep(index)
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60",
                        )}
                      >
                        {step.label}
                      </span>
                    </button>
                    {index < setupSteps.length - 1 ? (
                      <div className={cn("h-px w-8", completed ? "bg-primary" : "bg-border")} />
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>
        )}

        <div className={cn("mx-auto", readOnly ? "max-w-3xl" : "max-w-2xl")}>
          <div className="animate-fade-in">
            <div className="mb-8 text-center">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {readOnly ? "Setup summary" : `${appName} setup`}
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {readOnly ? "See whether this install is ready to use." : activeStepMeta.description}
              </p>
            </div>

            <div className="space-y-6">{renderActiveStep()}</div>
          </div>

          {readOnly ? null : (
          <div className="mt-10 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={activeStepIndex === 0}
              onClick={goToPreviousStep}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            {activeStep === "check" ? (
              allReady ? (
                <Button type="button" variant="hero" size="sm" asChild>
                  <Link href="/projects">Open projects</Link>
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled>
                  Finish setup
                </Button>
              )
            ) : (
              <Button
                type="button"
                variant="hero"
                size="sm"
                className="gap-2"
                disabled={!currentStepReady}
                onClick={goToNextStep}
              >
                Continue
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          )}
        </div>
      </main>
    </div>
  );
}
