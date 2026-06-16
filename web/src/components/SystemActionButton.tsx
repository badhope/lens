import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { SidebarTooltip, type TooltipWarmRef } from "@/components/SidebarTooltip";
import type { SystemAction } from "@/contexts/system-actions-context";
import type { ComponentType } from "react";

export interface SystemActionItem {
  action: SystemAction;
  icon: ComponentType<{ className?: string }>;
  label: string;
  runningLabel: string;
  spin: boolean;
}

export interface SystemActionButtonProps {
  collapsed: boolean;
  disabled: boolean;
  isPending: boolean;
  isRunning: boolean;
  item: SystemActionItem;
  onClick: () => void;
  tooltipWarmRef: TooltipWarmRef;
}

export function SystemActionButton({
  collapsed,
  disabled,
  isPending,
  isRunning: isActionRunning,
  item,
  onClick,
  tooltipWarmRef,
}: SystemActionButtonProps) {
  const { icon: Icon, label, runningLabel, spin } = item;
  const liRef = useRef<HTMLLIElement>(null);
  const [hovered, setHovered] = useState(false);
  const busy = isPending || isActionRunning;
  const displayLabel = isActionRunning ? runningLabel : label;

  return (
    <li
      ref={liRef}
      onMouseEnter={collapsed ? () => setHovered(true) : undefined}
      onMouseLeave={collapsed ? () => setHovered(false) : undefined}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        aria-busy={busy}
        aria-label={collapsed ? displayLabel : undefined}
        onFocus={collapsed ? () => setHovered(true) : undefined}
        onBlur={collapsed ? () => setHovered(false) : undefined}
        type="button"
        className={cn(
          "group/action relative flex w-full items-center gap-3",
          "px-5 py-2.5",
          "font-mondwest text-display text-xs tracking-[0.1em]",
          "whitespace-nowrap transition-colors cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
          busy
            ? "text-midground"
            : "text-text-secondary hover:text-midground",
          "disabled:text-text-disabled disabled:cursor-not-allowed",
        )}
      >
        {isPending ? (
          <Spinner className="shrink-0 text-[0.875rem]" />
        ) : isActionRunning && spin ? (
          <Spinner className="shrink-0 text-[0.875rem]" />
        ) : (
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              isActionRunning && !spin && "animate-pulse",
            )}
          />
        )}

        <span className={cn(
          "truncate transition-opacity duration-300",
          collapsed ? "lg:opacity-0" : "lg:opacity-100",
        )}>
          {displayLabel}
        </span>

        <span
          aria-hidden
          className="absolute inset-y-0.5 left-1.5 right-1.5 bg-midground opacity-0 pointer-events-none transition-opacity duration-200 group-hover/action:opacity-5"
        />

        {busy && (
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-px bg-midground"
          />
        )}
      </button>

      {collapsed && hovered && liRef.current && (
        <SidebarTooltip anchor={liRef.current} label={displayLabel} warmRef={tooltipWarmRef} />
      )}
    </li>
  );
}
