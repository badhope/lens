import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SidebarTooltip, type TooltipWarmRef } from "@/components/SidebarTooltip";
import type { Translations } from "@/i18n/types";
import type { ComponentType } from "react";

export interface NavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  labelKey?: string;
  path: string;
}

export interface SidebarNavLinkProps {
  closeMobile: () => void;
  collapsed: boolean;
  item: NavItem;
  t: Translations;
  tooltipWarmRef: TooltipWarmRef;
}

export function SidebarNavLink({
  closeMobile,
  collapsed,
  item,
  tooltipWarmRef,
  t,
}: SidebarNavLinkProps) {
  const { path, label, labelKey, icon: Icon } = item;
  const liRef = useRef<HTMLLIElement>(null);
  const [hovered, setHovered] = useState(false);

  const navLabel = labelKey
    ? ((t.app.nav as Record<string, string>)[labelKey] ?? label)
    : label;

  return (
    <li
      ref={liRef}
      onMouseEnter={collapsed ? () => setHovered(true) : undefined}
      onMouseLeave={collapsed ? () => setHovered(false) : undefined}
    >
      <NavLink
        to={path}
        end={path === "/sessions"}
        onClick={closeMobile}
        aria-label={collapsed ? navLabel : undefined}
        onFocus={collapsed ? () => setHovered(true) : undefined}
        onBlur={collapsed ? () => setHovered(false) : undefined}
        className={({ isActive }) =>
          cn(
            "group/nav relative flex items-center gap-2.5",
            "px-5 py-2",
            "text-sm",
            "whitespace-nowrap transition-colors cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            isActive
              ? "text-foreground font-medium paper-nav-active"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn(
              "h-4 w-4 shrink-0",
              isActive ? "text-foreground" : "text-muted-foreground",
            )} />

            <span
              className={cn(
                "truncate transition-opacity duration-200",
                collapsed ? "lg:opacity-0" : "lg:opacity-100",
              )}
            >
              {navLabel}
            </span>

            {isActive && (
              <span
                aria-hidden
                className="absolute right-3 text-[0.65rem] font-mono text-muted-foreground/70"
              >
                →
              </span>
            )}
          </>
        )}
      </NavLink>

      {collapsed && hovered && liRef.current && (
        <SidebarTooltip anchor={liRef.current} label={navLabel} warmRef={tooltipWarmRef} />
      )}
    </li>
  );
}
