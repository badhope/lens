import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type TooltipWarmRef = React.RefObject<number>;

export interface SidebarTooltipProps {
  anchor: HTMLElement;
  label: string;
  warmRef?: TooltipWarmRef;
}

export function SidebarTooltip({ anchor, label, warmRef }: SidebarTooltipProps) {
  const rect = anchor.getBoundingClientRect();
  const sidebar = document.getElementById("app-sidebar");
  const sidebarRight = sidebar?.getBoundingClientRect().right ?? rect.right;

  const isWarm = warmRef ? Date.now() - warmRef.current < 300 : false;

  useEffect(() => {
    if (warmRef) warmRef.current = Date.now();
    return () => {
      if (warmRef) warmRef.current = Date.now();
    };
  }, [warmRef]);

  return createPortal(
    <span
      className={cn(
        "fixed z-[100] pointer-events-none",
        "px-2 py-1",
        "bg-background-base/95 border border-current/20 backdrop-blur-sm shadow-lg",
        "font-mondwest text-display text-xs tracking-[0.1em] text-midground uppercase",
      )}
      style={{
        top: rect.top + rect.height / 2,
        left: sidebarRight + 8,
        transform: "translateY(-50%)",
        opacity: isWarm ? 1 : undefined,
        animation: isWarm ? "none" : "sidebar-tooltip-in 120ms ease-out",
      }}
    >
      {label}
    </span>,
    document.body,
  );
}
