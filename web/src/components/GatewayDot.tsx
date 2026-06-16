import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { gatewayLine } from "@/components/SidebarStatusStrip";
import { SidebarTooltip, type TooltipWarmRef } from "@/components/SidebarTooltip";
import type { StatusResponse } from "@/lib/api";

export interface GatewayDotProps {
  collapsed: boolean;
  status: StatusResponse | null;
  tooltipWarmRef: TooltipWarmRef;
}

export function GatewayDot({ collapsed, status, tooltipWarmRef }: GatewayDotProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const toneToColor: Record<string, string> = {
    "text-success": "bg-success",
    "text-warning": "bg-warning",
    "text-destructive": "bg-destructive",
    "text-muted-foreground": "bg-muted-foreground",
  };

  let color: string;
  let label: string;

  if (!status) {
    color = "bg-midground/20";
    label = t.status.gateway;
  } else {
    const gw = gatewayLine(status, t);
    color = toneToColor[gw.tone] ?? "bg-muted-foreground";
    label = `${t.status.gateway} ${gw.label}`;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "hidden lg:flex py-3 pl-[1.625rem] transition-opacity duration-300",
        collapsed ? "lg:opacity-100" : "lg:opacity-0 lg:h-0 lg:py-0 lg:overflow-hidden",
      )}
      role="status"
      aria-label={label}
      tabIndex={collapsed ? 0 : -1}
      onMouseEnter={collapsed ? () => setHovered(true) : undefined}
      onMouseLeave={collapsed ? () => setHovered(false) : undefined}
      onFocus={collapsed ? () => setHovered(true) : undefined}
      onBlur={collapsed ? () => setHovered(false) : undefined}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", color)}
      />

      {hovered && ref.current && (
        <SidebarTooltip anchor={ref.current} label={label} warmRef={tooltipWarmRef} />
      )}
    </div>
  );
}
