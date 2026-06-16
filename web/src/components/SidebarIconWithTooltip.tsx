import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SidebarTooltip, type TooltipWarmRef } from "@/components/SidebarTooltip";

export interface SidebarIconWithTooltipProps {
  children: ReactNode;
  collapsed: boolean;
  label: string;
  tooltipWarmRef: TooltipWarmRef;
}

export function SidebarIconWithTooltip({
  children,
  collapsed,
  label,
  tooltipWarmRef,
}: SidebarIconWithTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-fit",
        collapsed && "group/icon",
      )}
      onMouseEnter={collapsed ? () => setHovered(true) : undefined}
      onMouseLeave={collapsed ? () => setHovered(false) : undefined}
    >
      {children}

      {collapsed && (
        <span
          aria-hidden
          className="absolute inset-y-0 inset-x-[-0.375rem] bg-midground opacity-0 pointer-events-none transition-opacity duration-200 group-hover/icon:opacity-5 hidden lg:block"
        />
      )}

      {collapsed && hovered && ref.current && (
        <SidebarTooltip anchor={ref.current} label={label} warmRef={tooltipWarmRef} />
      )}
    </div>
  );
}
