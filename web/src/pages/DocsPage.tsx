import { useLayoutEffect, useState } from "react";
import { ExternalLink, BookOpen, Github } from "lucide-react";
import { useI18n } from "@/i18n";
import { usePageHeader } from "@/contexts/usePageHeader";
import { cn } from "@/lib/utils";
import { PluginSlot } from "@/plugins";

export const HERMES_DOCS_URL = "https://github.com/badhope/HermesAgent#readme";
const HERMES_REPO_URL = "https://github.com/badhope/HermesAgent";

const DS_BUTTON_OUTLINED_LINK_CN = cn(
  "group relative inline-grid grid-cols-[auto_1fr_auto] items-center",
  "px-[.9em_.75em] py-[1.25em] gap-2",
  "leading-0 font-bold tracking-[0.2em] uppercase",
  "text-midground bg-transparent shadow-midground",
  "shadow-[inset_-1px_-1px_0_0_#00000080,inset_1px_1px_0_0_#ffffff80]",
);

export default function DocsPage() {
  const { t } = useI18n();
  const { setEnd } = usePageHeader();
  const [iframeFailed, setIframeFailed] = useState(false);

  useLayoutEffect(() => {
    setEnd(
      <a
        href={HERMES_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={DS_BUTTON_OUTLINED_LINK_CN}
      >
        <ExternalLink className="size-3.5" />
        {t.app.openDocumentation}
      </a>,
    );
    return () => {
      setEnd(null);
    };
  }, [setEnd, t]);

  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col",
        "pt-1 sm:pt-2",
      )}
    >
      <PluginSlot name="docs:top" />

      {iframeFailed ? (
        <div
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center",
            "gap-4 px-6 py-12 text-center",
            "rounded-sm border border-border bg-card",
          )}
        >
          <BookOpen className="size-10 text-muted-foreground" strokeWidth={1.25} />
          <div className="space-y-1.5">
            <h2 className="font-mono-ui text-sm tracking-wide text-foreground">
              {t.app.nav.documentation}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              The in-dashboard docs viewer couldn't reach the upstream site.
              Browse the full documentation on GitHub instead.
            </p>
          </div>
          <a
            href={HERMES_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2",
              "px-3.5 py-2",
              "border border-border bg-background",
              "font-mono-ui text-xs tracking-wide text-foreground",
              "transition-colors hover:border-foreground/40 hover:bg-muted/40",
            )}
          >
            <Github className="size-3.5" />
            badhope/HermesAgent
            <ExternalLink className="size-3 text-muted-foreground" />
          </a>
        </div>
      ) : (
        <iframe
          title={t.app.nav.documentation}
          src={HERMES_DOCS_URL}
          onError={() => setIframeFailed(true)}
          className={cn(
            "min-h-0 w-full min-w-0 flex-1",
            "rounded-sm border border-current/20",
            // GitHub's README uses a transparent <html> / <body> and
            // inherits the browser's light canvas by default. Force a
            // light color scheme + white background on the iframe element
            // so the docs render cleanly regardless of the active
            // dashboard theme or the user's prefers-color-scheme.
            "[color-scheme:light] bg-white",
          )}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      <PluginSlot name="docs:bottom" />
    </div>
  );
}
