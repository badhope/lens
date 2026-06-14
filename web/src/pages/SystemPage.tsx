import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Brain,
  Check,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  Globe,
  HardDrive,
  KeyRound,
  Link2,
  Play,
  Plus,
  Power,
  RotateCcw,
  RotateCw,
  Server,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { H2 } from "@nous-research/ui/ui/components/typography/h2";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";
import { Label } from "@nous-research/ui/ui/components/label";
import { Select, SelectOption } from "@nous-research/ui/ui/components/select";
import { Toast } from "@nous-research/ui/ui/components/toast";
import { useToast } from "@nous-research/ui/hooks/use-toast";
import { useConfirmDelete } from "@nous-research/ui/hooks/use-confirm-delete";
import { ConfirmDialog } from "@nous-research/ui/ui/components/confirm-dialog";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { cn, themedBody } from "@/lib/utils";
import { api } from "@/lib/api";
import type {
  StatusResponse,
  MemoryStatus,
  CredentialPoolProvider,
  CheckpointsResponse,
  HooksResponse,
  HookEntry,
  SystemStats,
  UpdateCheckResponse,
  CuratorStatus,
  PortalStatus,
  DebugShareResponse,
} from "@/lib/api";
import { useI18n, LOCALE_META } from "@/i18n";
import type { Locale, Translations } from "@/i18n";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Live action-log viewer for the spawn-based admin actions (doctor, audit,
 * backup, import, skills update, checkpoints prune, gateway start/stop).
 * Polls /api/actions/<name>/status until the process exits.
 */
function ActionLogViewer({
  action,
  onClose,
}: {
  action: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(true);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const st = await api.getActionStatus(action, 400);
        if (cancelled) return;
        setLines(st.lines);
        setRunning(st.running);
        setExitCode(st.exit_code);
        if (st.running) timer.current = setTimeout(poll, 1200);
      } catch {
        if (!cancelled) setRunning(false);
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [action]);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm">{action}</span>
            {running ? (
              <Badge tone="warning">running</Badge>
            ) : (
              <Badge tone={exitCode === 0 ? "success" : "destructive"}>
                {exitCode === 0 ? "done" : `exit ${exitCode}`}
              </Badge>
            )}
          </div>
          <Button ghost size="icon" onClick={onClose} aria-label="Close log">
            <X />
          </Button>
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words bg-background/50 border border-border p-3 text-xs font-mono text-muted-foreground">
          {lines.length ? lines.join("\n") : "Starting…"}
        </pre>
      </CardContent>
    </Card>
  );
}

const HOOK_EVENTS_FALLBACK = [
  "pre_tool_call",
  "post_tool_call",
  "pre_llm_call",
  "post_llm_call",
  "on_session_start",
  "on_session_end",
];

export default function SystemPage() {
  const { toast, showToast } = useToast();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [memory, setMemory] = useState<MemoryStatus | null>(null);
  const [pool, setPool] = useState<CredentialPoolProvider[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointsResponse | null>(
    null,
  );
  const [hooks, setHooks] = useState<HooksResponse | null>(null);
  const [curator, setCurator] = useState<CuratorStatus | null>(null);
  const [portal, setPortal] = useState<PortalStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Add-credential form.
  const [credProvider, setCredProvider] = useState("openrouter");
  const [credKey, setCredKey] = useState("");
  const [credLabel, setCredLabel] = useState("");
  const [addingCred, setAddingCred] = useState(false);

  const [importPath, setImportPath] = useState("");
  // Restore-from-backup is destructive (overwrites the live config) and the
  // spawned `hermes import` runs non-interactively (stdin is /dev/null), so
  // its CLI "Continue? [y/N]" prompt would auto-abort. The dashboard owns the
  // consent: confirm here, then call the endpoint with force=true.
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  // Create-hook modal.
  const [hookModalOpen, setHookModalOpen] = useState(false);
  const closeHookModal = useCallback(() => setHookModalOpen(false), []);
  const hookModalRef = useModalBehavior({
    open: hookModalOpen,
    onClose: closeHookModal,
  });
  const [hookEvent, setHookEvent] = useState("pre_tool_call");
  const [hookCommand, setHookCommand] = useState("");
  const [hookMatcher, setHookMatcher] = useState("");
  const [hookTimeout, setHookTimeout] = useState("");
  const [hookApprove, setHookApprove] = useState(true);
  const [creatingHook, setCreatingHook] = useState(false);

  // ── Update check ───────────────────────────────────────────────────
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(
    null,
  );
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);

  const loadAll = useCallback(() => {
    Promise.allSettled([
      api.getStatus(),
      api.getSystemStats(),
      api.getMemory(),
      api.getCredentialPool(),
      api.getCheckpoints(),
      api.getHooks(),
      api.getCurator(),
      api.getPortal(),
      // Cached (non-forced) check so the version row shows update status on
      // load without a separate effect / a forced network round-trip.
      api.checkHermesUpdate(false),
    ])
      .then(([s, st, m, p, c, h, cur, prt, upd]) => {
        if (s.status === "fulfilled") setStatus(s.value);
        if (st.status === "fulfilled") setStats(st.value);
        if (m.status === "fulfilled") setMemory(m.value);
        if (p.status === "fulfilled") setPool(p.value.providers);
        if (c.status === "fulfilled") setCheckpoints(c.value);
        if (h.status === "fulfilled") setHooks(h.value);
        if (cur.status === "fulfilled") setCurator(cur.value);
        if (prt.status === "fulfilled") setPortal(prt.value);
        if (upd.status === "fulfilled") setUpdateInfo(upd.value);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Gateway lifecycle ──────────────────────────────────────────────
  const runGateway = async (verb: "start" | "stop" | "restart") => {
    try {
      if (verb === "start") {
        await api.startGateway();
        setActiveAction("gateway-start");
      } else if (verb === "stop") {
        await api.stopGateway();
        setActiveAction("gateway-stop");
      } else {
        await api.restartGateway();
        setActiveAction("gateway-restart");
      }
      showToast(`Gateway ${verb} started`, "success");
      setTimeout(loadAll, 3000);
    } catch (e) {
      showToast(`Gateway ${verb} failed: ${e}`, "error");
    }
  };

  // ── Curator ────────────────────────────────────────────────────────
  const toggleCuratorPaused = async () => {
    if (!curator) return;
    try {
      await api.setCuratorPaused(!curator.paused);
      showToast(curator.paused ? "Curator resumed" : "Curator paused", "success");
      loadAll();
    } catch (e) {
      showToast(`Curator toggle failed: ${e}`, "error");
    }
  };

  // ── Memory ─────────────────────────────────────────────────────────
  // Memory provider selection lives on the /plugins page now (see the
  // read-only display + link below); the dropdown was intentionally
  // dropped from this card during the admin-panel refresh.
  const memoryReset = useConfirmDelete({
    onDelete: useCallback(
      async (target: string) => {
        try {
          const res = await api.resetMemory(
            target as "all" | "memory" | "user",
          );
          showToast(`Reset: ${res.deleted.join(", ") || "nothing"}`, "success");
          loadAll();
        } catch (e) {
          showToast(`Reset failed: ${e}`, "error");
          throw e;
        }
      },
      [loadAll, showToast],
    ),
  });

  // ── Credential pool ────────────────────────────────────────────────
  const addCredential = async () => {
    if (!credProvider.trim() || !credKey.trim()) {
      showToast("Provider and API key required", "error");
      return;
    }
    setAddingCred(true);
    try {
      await api.addCredentialPoolEntry(
        credProvider.trim(),
        credKey.trim(),
        credLabel.trim() || undefined,
      );
      showToast("Credential added", "success");
      setCredKey("");
      setCredLabel("");
      loadAll();
    } catch (e) {
      showToast(`Failed to add credential: ${e}`, "error");
    } finally {
      setAddingCred(false);
    }
  };

  const credDelete = useConfirmDelete({
    onDelete: useCallback(
      async (key: string) => {
        const [provider, idxStr] = key.split("|");
        try {
          await api.removeCredentialPoolEntry(provider, Number(idxStr));
          showToast("Credential removed", "success");
          loadAll();
        } catch (e) {
          showToast(`Failed to remove: ${e}`, "error");
          throw e;
        }
      },
      [loadAll, showToast],
    ),
  });

  // ── Operations ─────────────────────────────────────────────────────
  const runOp = async (fn: () => Promise<{ name: string }>, label: string) => {
    try {
      const res = await fn();
      setActiveAction(res.name);
      showToast(`${label} started`, "success");
    } catch (e) {
      showToast(`${label} failed: ${e}`, "error");
    }
  };

  // ── Debug share ────────────────────────────────────────────────────
  // Unlike the fire-and-forget ops above, `debug share` produces shareable
  // paste URLs that are the whole point — so we surface them as real,
  // copyable links rather than a log tail.
  const [shareRedact, setShareRedact] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<DebugShareResponse | null>(
    null,
  );
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedLabel(label);
        setTimeout(
          () => setCopiedLabel((cur) => (cur === label ? null : cur)),
          1500,
        );
      } catch {
        showToast("Couldn't copy to clipboard", "error");
      }
    },
    [showToast],
  );

  const runDebugShare = useCallback(async () => {
    setSharing(true);
    setShareResult(null);
    try {
      const res = await api.runDebugShare({ redact: shareRedact });
      setShareResult(res);
      const n = Object.keys(res.urls).length;
      showToast(
        `Uploaded ${n} paste${n === 1 ? "" : "s"}${
          res.redacted ? " (redacted)" : ""
        }`,
        "success",
      );
    } catch (e) {
      showToast(`Debug share failed: ${e}`, "error");
    } finally {
      setSharing(false);
    }
  }, [shareRedact, showToast]);


  // ── Update check / apply ───────────────────────────────────────────
  const checkForUpdate = useCallback(
    async (force = false) => {
      setCheckingUpdate(true);
      try {
        const info = await api.checkHermesUpdate(force);
        setUpdateInfo(info);
        if (force) {
          if (info.update_available) {
            showToast(
              info.behind && info.behind > 0
                ? `Update available — ${info.behind} commit${info.behind === 1 ? "" : "s"} behind`
                : "Update available",
              "success",
            );
          } else if (info.behind === 0) {
            showToast("You're on the latest version", "success");
          } else if (info.message) {
            showToast(info.message, "error");
          }
        }
      } catch (e) {
        showToast(`Update check failed: ${e}`, "error");
      } finally {
        setCheckingUpdate(false);
      }
    },
    [showToast],
  );

  // Auto-check (cached) runs inside loadAll on mount; this is the
  // user-triggered forced re-check from the "Check for updates" button.
  const applyUpdate = async () => {
    setUpdateConfirmOpen(false);
    try {
      const resp = await api.updateHermes();
      if (!resp.ok && resp.error === "docker_update_unsupported") {
        showToast(
          resp.message ??
            "Updates don't apply inside Docker — re-pull the image instead.",
          "error",
        );
        return;
      }
      setActiveAction(resp.name ?? "hermes-update");
      showToast("Update started", "success");
    } catch (e) {
      showToast(`Update failed: ${e}`, "error");
    }
  };

  const checkpointsPrune = useConfirmDelete({
    onDelete: useCallback(async () => {
      try {
        const res = await api.pruneCheckpoints();
        setActiveAction(res.name);
        showToast("Checkpoint prune started", "success");
      } catch (e) {
        showToast(`Prune failed: ${e}`, "error");
        throw e;
      }
    }, [showToast]),
  });

  // ── Hooks ──────────────────────────────────────────────────────────
  const createHook = async () => {
    if (!hookCommand.trim()) {
      showToast("Command is required", "error");
      return;
    }
    setCreatingHook(true);
    try {
      await api.createHook({
        event: hookEvent,
        command: hookCommand.trim(),
        matcher: hookMatcher.trim() || undefined,
        timeout: hookTimeout.trim() ? Number(hookTimeout) : undefined,
        approve: hookApprove,
      });
      showToast("Hook created", "success");
      setHookCommand("");
      setHookMatcher("");
      setHookTimeout("");
      setHookModalOpen(false);
      loadAll();
    } catch (e) {
      showToast(`Failed to create hook: ${e}`, "error");
    } finally {
      setCreatingHook(false);
    }
  };

  const hookDelete = useConfirmDelete({
    onDelete: useCallback(
      async (key: string) => {
        const sep = key.indexOf("|");
        const event = key.slice(0, sep);
        const command = key.slice(sep + 1);
        try {
          await api.deleteHook(event, command);
          showToast("Hook removed", "success");
          loadAll();
        } catch (e) {
          showToast(`Failed to remove hook: ${e}`, "error");
          throw e;
        }
      },
      [loadAll, showToast],
    ),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="text-2xl text-primary" />
      </div>
    );
  }

  const gatewayRunning = status?.gateway_running;
  const validEvents = hooks?.valid_events?.length
    ? hooks.valid_events
    : HOOK_EVENTS_FALLBACK;

  return (
    <div className="flex flex-col gap-8">
      <Toast toast={toast} />

      <ConfirmDialog
        open={updateConfirmOpen}
        onCancel={() => setUpdateConfirmOpen(false)}
        onConfirm={() => void applyUpdate()}
        title="Update Hermes?"
        description={
          updateInfo && updateInfo.behind && updateInfo.behind > 0
            ? `This will run 'hermes update' (${updateInfo.update_command}) and pull ${updateInfo.behind} new commit${updateInfo.behind === 1 ? "" : "s"}. The gateway restarts when the update finishes; the current session keeps its prompt cache until then.`
            : `This will run 'hermes update' (${updateInfo?.update_command ?? "hermes update"}) and restart the gateway when it finishes.`
        }
        confirmLabel="Update now"
      />

      <DeleteConfirmDialog
        open={memoryReset.isOpen}
        onCancel={memoryReset.cancel}
        onConfirm={memoryReset.confirm}
        title="Reset memory"
        description="This permanently erases the selected built-in memory files. This cannot be undone."
        loading={memoryReset.isDeleting}
      />
      <DeleteConfirmDialog
        open={credDelete.isOpen}
        onCancel={credDelete.cancel}
        onConfirm={credDelete.confirm}
        title="Remove credential"
        description="Remove this pooled API key? The agent will no longer rotate through it."
        loading={credDelete.isDeleting}
      />
      <DeleteConfirmDialog
        open={checkpointsPrune.isOpen}
        onCancel={checkpointsPrune.cancel}
        onConfirm={checkpointsPrune.confirm}
        title="Prune checkpoints"
        description="Delete the rollback checkpoint shadow store? Existing /rollback points will be lost."
        loading={checkpointsPrune.isDeleting}
      />
      <DeleteConfirmDialog
        open={hookDelete.isOpen}
        onCancel={hookDelete.cancel}
        onConfirm={hookDelete.confirm}
        title="Remove shell hook"
        description="Remove this hook from config and revoke its consent? It stops firing on the next restart."
        loading={hookDelete.isDeleting}
      />

      {/* Create-hook modal */}
      {hookModalOpen && (
        <div
          ref={hookModalRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setHookModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className={cn(themedBody, "relative w-full max-w-lg border border-border bg-card shadow-2xl flex flex-col")}>
            <Button
              ghost
              size="icon"
              onClick={() => setHookModalOpen(false)}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X />
            </Button>
            <header className="p-5 pb-3 border-b border-border">
              <h2 className="font-mondwest text-display text-base tracking-wider">
                New shell hook
              </h2>
            </header>
            <div className="p-5 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hook-event">Event</Label>
                <Select
                  id="hook-event"
                  value={hookEvent}
                  onValueChange={(v) => setHookEvent(v)}
                >
                  {validEvents.map((ev) => (
                    <SelectOption key={ev} value={ev}>
                      {ev}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hook-command">Command (absolute path)</Label>
                <Input
                  id="hook-command"
                  autoFocus
                  placeholder="/usr/local/bin/my-hook.sh"
                  value={hookCommand}
                  onChange={(e) => setHookCommand(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="hook-matcher">Matcher (optional)</Label>
                  <Input
                    id="hook-matcher"
                    placeholder="e.g. terminal"
                    value={hookMatcher}
                    onChange={(e) => setHookMatcher(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hook-timeout">Timeout (s)</Label>
                  <Input
                    id="hook-timeout"
                    placeholder="10"
                    value={hookTimeout}
                    onChange={(e) => setHookTimeout(e.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={hookApprove}
                  onChange={(e) => setHookApprove(e.target.checked)}
                />
                Approve now (grant consent so it fires; otherwise it stays
                configured but inactive)
              </label>
              <p className="text-xs text-warning">
                Shell hooks run arbitrary commands on this host. Only add scripts
                you trust. Takes effect on the next gateway/session restart.
              </p>
              <div className="flex justify-end">
                <Button
                  className="uppercase"
                  size="sm"
                  onClick={createHook}
                  disabled={creatingHook}
                  prefix={creatingHook ? <Spinner /> : undefined}
                >
                  {creatingHook ? "Creating" : "Create hook"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live action log */}
      {activeAction && (
        <ActionLogViewer
          action={activeAction}
          onClose={() => setActiveAction(null)}
        />
      )}

      {/* ── General / 通用 ───────────────────────────────────────── */}
      <GeneralSettingsSection />

      {/* ── Host / system stats ───────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
          <Server className="h-4 w-4" /> Host
        </H2>
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">OS</div>
                <div>{stats?.os} {stats?.os_release}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Arch</div>
                <div>{stats?.arch}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Host</div>
                <div className="truncate">{stats?.hostname}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Python</div>
                <div>{stats?.python_impl} {stats?.python_version}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Hermes</div>
                <div className="flex items-center gap-2">
                  <span>v{stats?.hermes_version}</span>
                  {updateInfo &&
                    (updateInfo.update_available ? (
                      <Badge tone="warning">
                        {updateInfo.behind && updateInfo.behind > 0
                          ? `${updateInfo.behind} behind`
                          : "update available"}
                      </Badge>
                    ) : updateInfo.behind === 0 ? (
                      <Badge tone="success">latest</Badge>
                    ) : null)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> CPU
                </div>
                <div>
                  {stats?.cpu_count ?? "—"} cores
                  {typeof stats?.cpu_percent === "number"
                    ? ` · ${stats.cpu_percent.toFixed(0)}%`
                    : ""}
                </div>
              </div>
              {stats?.memory && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Memory</div>
                  <div>
                    {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)} ({stats.memory.percent}%)
                  </div>
                </div>
              )}
              {stats?.disk && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <HardDrive className="h-3 w-3" /> Disk
                  </div>
                  <div>
                    {formatBytes(stats.disk.used)} / {formatBytes(stats.disk.total)} ({stats.disk.percent}%)
                  </div>
                </div>
              )}
              {typeof stats?.uptime_seconds === "number" && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Uptime</div>
                  <div>{formatDuration(stats.uptime_seconds)}</div>
                </div>
              )}
              {stats?.load_avg && stats.load_avg.length >= 3 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Load avg</div>
                  <div>{stats.load_avg.map((n) => n.toFixed(2)).join(" / ")}</div>
                </div>
              )}
            </div>
            {stats && !stats.psutil && (
              <p className="mt-3 text-xs text-muted-foreground">
                Install the <span className="font-mono">psutil</span> extra for
                CPU / memory / disk metrics.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                size="sm"
                ghost
                disabled={checkingUpdate}
                prefix={
                  checkingUpdate ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )
                }
                onClick={() => void checkForUpdate(true)}
              >
                Check for updates
              </Button>
              {updateInfo?.update_available && updateInfo.can_apply && (
                <Button
                  size="sm"
                  prefix={<Download className="h-3.5 w-3.5" />}
                  onClick={() => setUpdateConfirmOpen(true)}
                >
                  Update now
                </Button>
              )}
              {updateInfo &&
                !updateInfo.can_apply &&
                updateInfo.update_available && (
                  <span className="text-xs text-muted-foreground">
                    Update with{" "}
                    <span className="font-mono">{updateInfo.update_command}</span>
                  </span>
                )}
              {updateInfo?.message && !updateInfo.update_available && (
                <span className="text-xs text-muted-foreground">
                  {updateInfo.message}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Portal ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
          <Globe className="h-4 w-4" /> Nous Portal
        </H2>
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-center gap-3">
              <Badge tone={portal?.logged_in ? "success" : "secondary"}>
                {portal?.logged_in ? "logged in" : "not logged in"}
              </Badge>
              {portal?.provider && (
                <span className="text-sm text-muted-foreground">
                  inference provider: {portal.provider}
                </span>
              )}
              <a
                href={portal?.subscription_url || "https://portal.nousresearch.com/manage-subscription"}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-primary underline"
              >
                Manage subscription
              </a>
            </div>
            {portal?.features && portal.features.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-border pt-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Tool Gateway routing
                </span>
                {portal.features.map((f) => (
                  <div key={f.label} className="flex items-center justify-between text-sm">
                    <span>{f.label}</span>
                    <span className="text-muted-foreground">{f.state}</span>
                  </div>
                ))}
              </div>
            )}
            {!portal?.logged_in && (
              <p className="text-xs text-muted-foreground">
                Log in with <span className="font-mono">hermes portal</span>.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Curator ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4" /> Skill curator
        </H2>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Badge tone={curator?.paused ? "warning" : curator?.enabled ? "success" : "secondary"}>
                {curator?.paused ? "paused" : curator?.enabled ? "active" : "disabled"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {curator?.interval_hours ? `every ${curator.interval_hours}h` : ""}
                {curator?.last_run_at ? ` · last run ${new Date(curator.last_run_at).toLocaleString()}` : " · never run"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" ghost onClick={toggleCuratorPaused}>
                {curator?.paused ? "Resume" : "Pause"}
              </Button>
              <Button
                size="sm"
                ghost
                prefix={<Play className="h-3.5 w-3.5" />}
                onClick={() => runOp(api.runCurator, "Curator review")}
              >
                Run now
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Gateway ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
          <Power className="h-4 w-4" /> Gateway
        </H2>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Badge tone={gatewayRunning ? "success" : "secondary"}>
                {gatewayRunning ? "running" : "stopped"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {status?.gateway_state ?? "—"}
                {status?.gateway_pid ? ` · pid ${status.gateway_pid}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="uppercase"
                onClick={() => runGateway("start")}
                disabled={gatewayRunning}
                prefix={<Play className="h-3.5 w-3.5" />}
              >
                Start
              </Button>
              <Button
                size="sm"
                className="uppercase"
                onClick={() => runGateway("restart")}
                prefix={<RotateCw className="h-3.5 w-3.5" />}
              >
                Restart
              </Button>
              <Button
                size="sm"
                className="uppercase text-warning"
                ghost
                onClick={() => runGateway("stop")}
                disabled={!gatewayRunning}
                prefix={<Power className="h-3.5 w-3.5" />}
              >
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Memory ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
          <Brain className="h-4 w-4" /> Memory
        </H2>
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                External provider:{" "}
                <span className="font-mono text-foreground">
                  {memory?.active || "built-in only"}
                </span>
              </span>
              <Link to="/plugins" className="underline">
                Change in Plugins →
              </Link>
              <span className="ml-auto">
                New credentials:{" "}
                <span className="font-mono">hermes memory setup</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                Built-in files — MEMORY.md:{" "}
                {formatBytes(memory?.builtin_files.memory ?? 0)} · USER.md:{" "}
                {formatBytes(memory?.builtin_files.user ?? 0)}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Button size="sm" ghost className="text-destructive" onClick={() => memoryReset.requestDelete("memory")}>
                  Reset MEMORY.md
                </Button>
                <Button size="sm" ghost className="text-destructive" onClick={() => memoryReset.requestDelete("user")}>
                  Reset USER.md
                </Button>
                <Button size="sm" ghost className="text-destructive" onClick={() => memoryReset.requestDelete("all")}>
                  Reset all
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Credential pool ───────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
          <KeyRound className="h-4 w-4" /> Credential pool
        </H2>
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="grid gap-2">
                <Label htmlFor="cred-provider">Provider</Label>
                <Input id="cred-provider" value={credProvider} onChange={(e) => setCredProvider(e.target.value)} placeholder="openrouter" />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="cred-key">API key</Label>
                <Input id="cred-key" type="password" value={credKey} onChange={(e) => setCredKey(e.target.value)} placeholder="sk-…" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cred-label">Label</Label>
                <Input id="cred-label" value={credLabel} onChange={(e) => setCredLabel(e.target.value)} placeholder="optional" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" className="uppercase" onClick={addCredential} disabled={addingCred} prefix={addingCred ? <Spinner /> : undefined}>
                Add key
              </Button>
            </div>
            {pool.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No pooled credentials. Add one above to enable key rotation.
              </p>
            )}
            {pool.map((prov) => (
              <div key={prov.provider} className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {prov.provider}
                </span>
                {prov.entries.map((entry) => (
                  <div key={`${prov.provider}-${entry.index}`} className="flex items-center gap-3 border border-border bg-background/40 px-3 py-2">
                    <span className="text-sm font-medium">{entry.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{entry.token_preview}</span>
                    <Badge tone="outline">{entry.auth_type}</Badge>
                    {entry.last_status && <Badge tone="secondary">{entry.last_status}</Badge>}
                    <Button ghost size="icon" className="ml-auto text-destructive" aria-label="Remove credential" onClick={() => credDelete.requestDelete(`${prov.provider}|${entry.index}`)}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── Operations ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-4 w-4" /> Operations
        </H2>
        <Card>
          <CardContent className="flex flex-wrap gap-2 py-4">
            <Button size="sm" ghost prefix={<Stethoscope className="h-3.5 w-3.5" />} onClick={() => runOp(api.runDoctor, "Doctor")}>
              Run doctor
            </Button>
            <Button size="sm" ghost prefix={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => runOp(api.runSecurityAudit, "Security audit")}>
              Security audit
            </Button>
            <Button size="sm" ghost prefix={<Database className="h-3.5 w-3.5" />} onClick={() => runOp(() => api.runBackup(), "Backup")}>
              Create backup
            </Button>
            <Button size="sm" ghost prefix={<RotateCw className="h-3.5 w-3.5" />} onClick={() => runOp(api.updateSkillsFromHub, "Skills update")}>
              Update skills
            </Button>
            <Button size="sm" ghost prefix={<Activity className="h-3.5 w-3.5" />} onClick={() => runOp(api.runPromptSize, "Prompt size")}>
              Prompt size
            </Button>
            <Button size="sm" ghost prefix={<Database className="h-3.5 w-3.5" />} onClick={() => runOp(api.runDump, "Support dump")}>
              Support dump
            </Button>
            <Button size="sm" ghost prefix={<RotateCw className="h-3.5 w-3.5" />} onClick={() => runOp(api.runConfigMigrate, "Config migrate")}>
              Migrate config
            </Button>
          </CardContent>
        </Card>

        {/* Debug share — uploads a redacted report + logs, returns shareable
            links. Separated from the buttons above because its output is
            persistent, copyable URLs, not a fire-and-forget log tail. */}
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Share2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Share debug report</span>
                  <span className="text-xs text-muted-foreground max-w-prose">
                    Uploads system info + logs to a public paste service and
                    returns links to send the Hermes team. Pastes auto-delete
                    after 6 hours.
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                disabled={sharing}
                prefix={
                  sharing ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )
                }
                onClick={() => void runDebugShare()}
              >
                {sharing ? "Uploading…" : "Generate share link"}
              </Button>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                className="accent-current"
                checked={shareRedact}
                disabled={sharing}
                onChange={(e) => setShareRedact(e.target.checked)}
              />
              Redact credential-shaped tokens before upload (recommended)
            </label>

            {shareResult && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone="success">uploaded</Badge>
                    {shareResult.redacted ? (
                      <Badge tone="outline">redacted</Badge>
                    ) : (
                      <Badge tone="warning">not redacted</Badge>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      auto-deletes in{" "}
                      {Math.round(shareResult.auto_delete_seconds / 3600)}h
                    </span>
                  </div>
                  {Object.keys(shareResult.urls).length > 1 && (
                    <Button
                      size="sm"
                      ghost
                      prefix={
                        copiedLabel === "__all__" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )
                      }
                      onClick={() =>
                        void copyToClipboard(
                          Object.entries(shareResult.urls)
                            .map(([label, url]) => `${label}: ${url}`)
                            .join("\n"),
                          "__all__",
                        )
                      }
                    >
                      Copy all
                    </Button>
                  )}
                </div>

                {Object.entries(shareResult.urls).map(([label, url]) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 bg-background/50 border border-border px-3 py-2"
                  >
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-xs shrink-0 w-24 truncate text-muted-foreground">
                      {label}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs truncate flex-1 text-primary hover:underline"
                    >
                      {url}
                    </a>
                    <Button
                      ghost
                      size="icon"
                      aria-label={`Copy ${label} link`}
                      onClick={() => void copyToClipboard(url, label)}
                    >
                      {copiedLabel === label ? <Check /> : <Copy />}
                    </Button>
                  </div>
                ))}

                {shareResult.failures.length > 0 && (
                  <span className="text-xs text-destructive">
                    Some logs failed to upload: {shareResult.failures.join("; ")}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end">
            <div className="grid gap-2 flex-1">
              <Label htmlFor="import-path">Restore from backup archive</Label>
              <Input id="import-path" value={importPath} onChange={(e) => setImportPath(e.target.value)} placeholder="/path/to/hermes-backup.zip" />
            </div>
            <Button
              size="sm"
              ghost
              disabled={!importPath.trim()}
              onClick={() => {
                if (!importPath.trim()) return;
                setImportConfirmOpen(true);
              }}
            >
              Import
            </Button>
            <ConfirmDialog
              open={importConfirmOpen}
              title="Restore from backup?"
              description={`This will overwrite your current Hermes configuration, skills, sessions, and data with the contents of ${importPath.trim() || "the archive"}. This cannot be undone.`}
              destructive
              confirmLabel="Restore"
              cancelLabel="Cancel"
              onCancel={() => setImportConfirmOpen(false)}
              onConfirm={() => {
                setImportConfirmOpen(false);
                runOp(() => api.runImport(importPath.trim(), true), "Import");
              }}
            />
          </CardContent>
        </Card>
      </section>

      {/* ── Checkpoints ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-4 w-4" /> Checkpoints
        </H2>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-sm text-muted-foreground">
              {checkpoints?.sessions.length ?? 0} session(s) ·{" "}
              {formatBytes(checkpoints?.total_bytes ?? 0)}
            </span>
            <Button size="sm" ghost className="text-destructive" disabled={!checkpoints?.sessions.length} prefix={<Trash2 className="h-3.5 w-3.5" />} onClick={() => checkpointsPrune.requestDelete("all")}>
              Prune
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* ── Shell hooks ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
            <Terminal className="h-4 w-4" /> Shell hooks
          </H2>
          <Button size="sm" className="uppercase" prefix={<Plus className="h-3.5 w-3.5" />} onClick={() => setHookModalOpen(true)}>
            New hook
          </Button>
        </div>
        {(!hooks || hooks.hooks.length === 0) && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No shell hooks configured.
            </CardContent>
          </Card>
        )}
        {hooks?.hooks.map((h: HookEntry, i) => (
          <Card key={`${h.event}-${i}`}>
            <CardContent className="flex items-center gap-3 py-3">
              <Badge tone="outline">{h.event}</Badge>
              {h.matcher && (
                <span className="text-xs text-muted-foreground">matcher: {h.matcher}</span>
              )}
              <span className="font-mono text-xs truncate flex-1">{h.command}</span>
              {h.executable === false && (
                <Badge tone="destructive">not executable</Badge>
              )}
              <Badge tone={h.allowed ? "success" : "warning"}>
                {h.allowed ? "allowed" : "not approved"}
              </Badge>
              <Button
                ghost
                size="icon"
                className="text-destructive"
                aria-label="Remove hook"
                onClick={() =>
                  hookDelete.requestDelete(`${h.event}|${h.command ?? ""}`)
                }
              >
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

/**
 * General settings — language, font size, display density, corner radius,
 * content width, and the auto-fit-to-window toggle.  Lives in the
 * "System" tab (the dashboard's de-facto settings page) so users who
 * can't find the sidebar's compact language / theme switchers have a
 * second, larger, labelled entry point.
 *
 * All controls write to the same `I18nProvider` and DOM `style`
 * properties the sidebar's compact switchers touch, so there's only one
 * source of truth — localStorage for the locale and each layout knob,
 * the root `<html>` element for the runtime CSS variables.
 *
 * Persistence keys (`hermes-*`) and the writer side of every variable
 * live next to each other in this file so changing the storage shape
 * only requires editing one section.
 */
function GeneralSettingsSection() {
  const { t, locale, setLocale } = useI18n();
  const allLocales = Object.entries(LOCALE_META) as Array<[
    Locale,
    (typeof LOCALE_META)[Locale],
  ]>;

  // -- helpers ----------------------------------------------------------
  // The layout section is optional in Translations (locales that
  // haven't been translated yet fall back to English).  Provide a
  // small lookup helper so we never crash on `undefined.title`.
  const lyt = (key: keyof NonNullable<Translations["layout"]>) =>
    (t.layout?.[key] as string | undefined) ?? EN_FALLBACKS[key] ?? "";

  // -- storage helpers --------------------------------------------------
  const useStoredNumber = (
    key: string,
    fallback: number,
    min: number,
    max: number,
  ) => {
    const [v, set] = useState<number>(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const n = Number(raw);
          if (Number.isFinite(n) && n >= min && n <= max) return n;
        }
      } catch {
        /* ignore */
      }
      return fallback;
    });
    return [v, set] as const;
  };

  const useStoredString = <K extends string>(
    key: string,
    fallback: K,
    valid: readonly K[],
  ) => {
    const [v, set] = useState<K>(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw && (valid as readonly string[]).includes(raw)) {
          return raw as K;
        }
      } catch {
        /* ignore */
      }
      return fallback;
    });
    return [v, set] as const;
  };

  const useStoredBool = (key: string, fallback: boolean) => {
    const [v, set] = useState<boolean>(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === "1" || raw === "0") return raw === "1";
      } catch {
        /* ignore */
      }
      return fallback;
    });
    return [v, set] as const;
  };

  // -- state ------------------------------------------------------------
  // 6-step font scale: 0.85 / 0.95 / 1.0 / 1.1 / 1.2 / 1.3.
  const [fontScale, setFontScale] = useStoredNumber(
    "hermes-font-scale",
    1.1,
    0.8,
    1.4,
  );

  // Code / mono scale: 0.9 / 1.0 / 1.1 / 1.2 / 1.3.  Decoupled from
  // the body font-scale above because code blocks deserve their own
  // readability curve — at 1.1× body + 1.0× mono the dashboard's
  // ToolCall previews still read small.  Drives --hermes-mono-scale,
  // which every <code>/<pre>/<kbd>/.font-mono rule picks up, and which
  // ChatPage's xterm tier-multiplier reads at every re-fit.
  const [monoScale, setMonoScale] = useStoredNumber(
    "hermes-mono-scale",
    1.1,
    0.85,
    1.5,
  );

  // Density: compact / standard / comfy.  Multiplies Tailwind spacing
  // via --theme-spacing-mul (read by the @theme inline `--spacing` rule
  // in index.css).
  const [density, setDensity] = useStoredString(
    "hermes-density",
    "comfy",
    ["compact", "standard", "comfy"] as const,
  );

  // Corner radius: 0 / 4 / 8 px.  Applied via [data-hermes-radius]
  // selector on <html>.
  const [radius, setRadius] = useStoredString(
    "hermes-radius",
    "none",
    ["none", "sm", "md"] as const,
  );

  // Content width: 60 / 72 / 84 / 96 rem.  Applied via
  // --hermes-content-max on <html>, consumed by .hermes-content-frame.
  const [width, setWidth] = useStoredString(
    "hermes-content-width",
    "standard",
    ["compact", "standard", "wide", "full"] as const,
  );

  // Auto-fit: when on, html font-size flexes with viewport (clamp-like
  // formula in index.css).  When off, the user-chosen step above
  // wins.  --hermes-auto-fit is read in the html {} font-size calc.
  const [autoFit, setAutoFit] = useStoredBool("hermes-auto-fit", false);

  // -- writers ----------------------------------------------------------
  // The `--hermes-font-scale` and `--theme-spacing-mul` writers are
  // attached to useEffects below the state declarations.  The writers
  // for `--hermes-radius-scale`, `--hermes-content-max` and
  // `--hermes-auto-fit` are inline in the onClick handlers so the value
  // they read is the freshest one (no closure-staleness).

  useEffect(() => {
    const html = document.documentElement;
    html.style.setProperty("--hermes-font-scale", String(fontScale));
    try {
      localStorage.setItem("hermes-font-scale", String(fontScale));
    } catch {
      /* ignore */
    }
  }, [fontScale]);

  // -- Code / mono scale ----------------------------------------------
  // Write the chosen value to <html> as --hermes-mono-scale (consumed
  // by the `code` / `pre` / `.font-mono` rules in index.css) and to
  // localStorage for the next page load.  Decoupled from the body
  // font-scale effect above so changing one never touches the other.
  useEffect(() => {
    const html = document.documentElement;
    html.style.setProperty("--hermes-mono-scale", String(monoScale));
    try {
      localStorage.setItem("hermes-mono-scale", String(monoScale));
    } catch {
      /* ignore */
    }
  }, [monoScale]);

  useEffect(() => {
    const html = document.documentElement;
    const mul = density === "compact" ? 0.85 : density === "standard" ? 1 : 1.15;
    html.style.setProperty("--theme-spacing-mul", String(mul));
    try {
      localStorage.setItem("hermes-density", density);
    } catch {
      /* ignore */
    }
  }, [density]);

  // Read-back on initial mount: apply the saved values to <html> so
  // the first paint of any subsequent page already uses the right
  // size.  Re-runs only on mount (no deps).
  useEffect(() => {
    const html = document.documentElement;
    const applyRadius = () => {
      const r =
        (localStorage.getItem("hermes-radius") as ReturnType<
          typeof getRadiusValue
        > | null) || "none";
      html.dataset.hermesRadius = r;
      html.style.setProperty(
        "--hermes-radius-scale",
        String(radiusToScale(r)),
      );
    };
    const applyWidth = () => {
      const w = (localStorage.getItem("hermes-content-width") as
        | "compact"
        | "standard"
        | "wide"
        | "full"
        | null) || "standard";
      html.style.setProperty("--hermes-content-max", widthToRem(w));
    };
    const applyAutoFit = () => {
      const v = localStorage.getItem("hermes-auto-fit") === "1" ? 1 : 0;
      html.style.setProperty("--hermes-auto-fit", String(v));
    };
    const applyMono = () => {
      const raw = localStorage.getItem("hermes-mono-scale");
      const n = raw ? Number(raw) : 1.1;
      const v = Number.isFinite(n) && n >= 0.85 && n <= 1.5 ? n : 1.1;
      html.style.setProperty("--hermes-mono-scale", String(v));
    };
    applyRadius();
    applyWidth();
    applyAutoFit();
    applyMono();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- reset ------------------------------------------------------------
  const DEFAULTS = {
    fontScale: 1.1,
    monoScale: 1.1,
    density: "comfy" as const,
    radius: "none" as const,
    width: "standard" as const,
    autoFit: false,
  };
  const reset = () => {
    setFontScale(DEFAULTS.fontScale);
    setMonoScale(DEFAULTS.monoScale);
    setDensity(DEFAULTS.density);
    setRadius(DEFAULTS.radius);
    setWidth(DEFAULTS.width);
    setAutoFit(DEFAULTS.autoFit);

    const html = document.documentElement;
    html.style.setProperty("--hermes-font-scale", String(DEFAULTS.fontScale));
    html.style.setProperty(
      "--hermes-mono-scale",
      String(DEFAULTS.monoScale),
    );
    html.style.setProperty(
      "--theme-spacing-mul",
      "1.15", // DEFAULTS.density is "comfy" → 1.15
    );
    html.style.setProperty(
      "--hermes-radius-scale",
      String(radiusToScale(DEFAULTS.radius)),
    );
    html.style.setProperty(
      "--hermes-content-max",
      widthToRem(DEFAULTS.width),
    );
    html.style.setProperty(
      "--hermes-auto-fit",
      DEFAULTS.autoFit ? "1" : "0",
    );
    try {
      localStorage.setItem("hermes-font-scale", String(DEFAULTS.fontScale));
      localStorage.setItem("hermes-mono-scale", String(DEFAULTS.monoScale));
      localStorage.setItem("hermes-density", DEFAULTS.density);
      localStorage.setItem("hermes-radius", DEFAULTS.radius);
      localStorage.setItem("hermes-content-width", DEFAULTS.width);
      localStorage.setItem("hermes-auto-fit", DEFAULTS.autoFit ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // -- the page itself --------------------------------------------------
  const fontSteps = [
    { value: 0.85, labelKey: "XS" },
    { value: 0.95, labelKey: "S" },
    { value: 1.0, labelKey: "M" },
    { value: 1.1, labelKey: "L" },
    { value: 1.2, labelKey: "XL" },
    { value: 1.3, labelKey: "XXL" },
  ];

  // Code / mono scale: 0.9 / 1.0 / 1.1 / 1.2 / 1.3 — keeps the same
  // six-step look as the body font scale (so the two sliders feel
  // like siblings) but with a slightly tighter range: code rarely
  // needs 1.3×, and <0.9× is unreadable for anyone trying to scan
  // a stack trace.
  const monoSteps = [
    { value: 0.9, labelKey: "XS" },
    { value: 1.0, labelKey: "S" },
    { value: 1.1, labelKey: "M" },
    { value: 1.2, labelKey: "L" },
    { value: 1.3, labelKey: "XL" },
    { value: 1.4, labelKey: "XXL" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <H2
        variant="sm"
        className="flex items-center gap-2 text-muted-foreground"
      >
        <Settings className="h-4 w-4" /> {lyt("title")}
      </H2>
      <Card>
        <CardContent className="grid gap-6 py-4 lg:grid-cols-2">
          {/* ── Language ─────────────────────────────────────── */}
          <div className="grid gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {t.language.switchTo}
            </div>
            <div className="flex flex-wrap gap-2">
              {allLocales.map(([code, meta]) => {
                const selected = code === locale;
                return (
                  <Button
                    key={code}
                    size="sm"
                    outlined={!selected}
                    onClick={() => setLocale(code)}
                    aria-pressed={selected}
                    className={cn(
                      "min-w-[5.5rem] normal-case tracking-normal font-normal",
                      selected && "ring-1 ring-primary",
                    )}
                  >
                    {meta.name}
                    {selected && <Check className="ml-1.5 h-3.5 w-3.5" />}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* ── Font size ────────────────────────────────────── */}
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {lyt("fontSize")}
              </span>
              <span className="text-xs text-muted-foreground">
                {(fontScale * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {fontSteps.map((step) => {
                const selected = Math.abs(fontScale - step.value) < 0.01;
                return (
                  <Button
                    key={step.value}
                    size="sm"
                    outlined={!selected}
                    onClick={() => setFontScale(step.value)}
                    aria-pressed={selected}
                    className={cn(
                      "min-w-[3rem] normal-case tracking-normal font-normal",
                      selected && "ring-1 ring-primary",
                    )}
                  >
                    <span
                      style={{
                        fontSize: `${step.value}rem`,
                        lineHeight: 1,
                      }}
                    >
                      Aa
                    </span>
                    <span className="ml-1 text-[0.65rem] opacity-70">
                      {step.labelKey}
                    </span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {lyt("fontSizeHint")}
            </p>
          </div>

          {/* ── Code / mono size ─────────────────────────────── */}
          {/* Six-step scale matching the body font slider so the two
              feel like siblings.  Drives --hermes-mono-scale which
              index.css's `code` / `pre` / `.font-mono` rules pick
              up, and which ChatPage's xterm tier-multiplier reads
              at every re-fit. */}
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {lyt("monoSize")}
              </span>
              <span className="text-xs text-muted-foreground">
                {(monoScale * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {monoSteps.map((step) => {
                const selected = Math.abs(monoScale - step.value) < 0.01;
                return (
                  <Button
                    key={step.value}
                    size="sm"
                    outlined={!selected}
                    onClick={() => setMonoScale(step.value)}
                    aria-pressed={selected}
                    className={cn(
                      "min-w-[3.5rem] normal-case tracking-normal font-normal",
                      selected && "ring-1 ring-primary",
                    )}
                  >
                    <span
                      aria-hidden
                      className="font-mono-ui"
                      style={{
                        fontSize: `${step.value}rem`,
                        lineHeight: 1,
                      }}
                    >
                      {`>_`}
                    </span>
                    <span className="ml-1 text-[0.65rem] opacity-70">
                      {step.labelKey}
                    </span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {lyt("monoSizeHint")}
            </p>
          </div>

          {/* ── Spacing / density ────────────────────────────── */}
          <div className="grid gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {lyt("density")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["compact", lyt("densityCompact")],
                  ["standard", lyt("densityStandard")],
                  ["comfy", lyt("densityComfy")],
                ] as const
              ).map(([k, label]) => (
                <Button
                  key={k}
                  size="sm"
                  outlined={density !== k}
                  onClick={() => setDensity(k)}
                  aria-pressed={density === k}
                  className={cn(
                    "normal-case tracking-normal font-normal",
                    density === k && "ring-1 ring-primary",
                  )}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {lyt("densityHint")}
            </p>
          </div>

          {/* ── Corner radius ────────────────────────────────── */}
          <div className="grid gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {lyt("radius")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["none", lyt("radiusNone"), 0],
                  ["sm", lyt("radiusSm"), 4],
                  ["md", lyt("radiusMd"), 8],
                ] as const
              ).map(([k, label, px]) => (
                <Button
                  key={k}
                  size="sm"
                  outlined={radius !== k}
                  onClick={() => {
                    setRadius(k);
                    document.documentElement.style.setProperty(
                      "--hermes-radius-scale",
                      String(px / 4),
                    );
                    document.documentElement.dataset.hermesRadius = k;
                  }}
                  aria-pressed={radius === k}
                  className={cn(
                    "normal-case tracking-normal font-normal",
                    radius === k && "ring-1 ring-primary",
                  )}
                >
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block h-3 w-3 border border-current"
                    style={{ borderRadius: `${px}px` }}
                  />
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{lyt("radiusHint")}</p>
          </div>

          {/* ── Content width ────────────────────────────────── */}
          <div className="grid gap-2 lg:col-span-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {lyt("contentWidth")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["compact", lyt("widthCompact"), "60rem"],
                  ["standard", lyt("widthStandard"), "72rem"],
                  ["wide", lyt("widthWide"), "84rem"],
                  ["full", lyt("widthFull"), "100%"],
                ] as const
              ).map(([k, label, rem]) => (
                <Button
                  key={k}
                  size="sm"
                  outlined={width !== k}
                  onClick={() => {
                    setWidth(k);
                    document.documentElement.style.setProperty(
                      "--hermes-content-max",
                      rem,
                    );
                  }}
                  aria-pressed={width === k}
                  className={cn(
                    "normal-case tracking-normal font-normal",
                    width === k && "ring-1 ring-primary",
                  )}
                >
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block h-2.5 border-b border-current"
                    style={{ width: k === "compact" ? "1.5rem" : k === "standard" ? "2.5rem" : k === "wide" ? "3.5rem" : "4.5rem" }}
                  />
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {lyt("contentWidthHint")}
            </p>
          </div>

          {/* ── Auto-fit ─────────────────────────────────────── */}
          <div className="grid gap-2 lg:col-span-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-700"
                checked={autoFit}
                onChange={(e) => {
                  setAutoFit(e.target.checked);
                  document.documentElement.style.setProperty(
                    "--hermes-auto-fit",
                    e.target.checked ? "1" : "0",
                  );
                }}
              />
              <div className="grid gap-1">
                <span className="text-sm font-medium text-foreground">
                  {lyt("autoFit")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lyt("autoFitHint")}
                </span>
              </div>
            </label>
          </div>

          {/* ── Reset ────────────────────────────────────────── */}
          <div className="grid gap-2 lg:col-span-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground max-w-md">
                {lyt("resetHint")}
              </p>
              <Button
                size="sm"
                outlined
                onClick={reset}
                className="normal-case tracking-normal font-normal"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                {lyt("reset")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// English fallbacks for `t.layout.*` when a non-English locale hasn't
// translated the layout section yet.  Mirrors the values in en.ts.
const EN_FALLBACKS: Record<string, string> = {
  title: "Layout & appearance",
  fontSize: "Font size",
  fontSizeHint:
    "Adjust the base text size. The change applies to every page immediately.",
  monoSize: "Code font",
  monoSizeHint:
    "Size of code blocks, inline code and the embedded terminal. Independent from the body text size above, so you can keep prose small and code readable (or vice versa).",
  density: "Spacing",
  densityHint:
    "Tighten or loosen the gap between elements. Compact fits more rows on a list; Comfortable gives cards more breathing room.",
  densityCompact: "Compact",
  densityStandard: "Standard",
  densityComfy: "Comfortable",
  radius: "Corner radius",
  radiusHint: "Sharper corners read more editorial; softer corners feel more app-like.",
  radiusNone: "None",
  radiusSm: "Small",
  radiusMd: "Medium",
  contentWidth: "Content width",
  contentWidthHint:
    "Maximum width of the main content area. Choose Compact for prose, Wide for tables, Full to use the whole window.",
  widthCompact: "Compact",
  widthStandard: "Standard",
  widthWide: "Wide",
  widthFull: "Full",
  autoFit: "Auto-fit to window",
  autoFitHint:
    "Scale text and spacing with the window size. Off keeps a fixed step chosen above; On flexes from 13px at small viewports up to 18px on wide displays.",
  reset: "Reset to defaults",
  resetHint:
    "Restore body text, code font, spacing, radius, content width, and auto-fit to the recommended values.",
  preview: "Preview",
};

// Helpers used by the writers / reset path.  Pulled out of the
// component body so they're easy to read in isolation.
function radiusToScale(r: "none" | "sm" | "md"): number {
  return r === "sm" ? 1 : r === "md" ? 2 : 0;
}
function widthToRem(w: "compact" | "standard" | "wide" | "full"): string {
  return w === "compact" ? "60rem" : w === "wide" ? "84rem" : w === "full" ? "100%" : "72rem";
}
// `getRadiusValue` is referenced (via ReturnType) by the read-back
// effect's localStorage cast; not called directly.  Kept for typing.
declare function getRadiusValue(): "none" | "sm" | "md";
