import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { useSystemActions } from "@/contexts/useSystemActions";
import type { SystemAction } from "@/contexts/system-actions-context";
import { SidebarStatusStrip } from "@/components/SidebarStatusStrip";
import { GatewayDot } from "@/components/GatewayDot";
import { SystemActionButton } from "@/components/SystemActionButton";
import type { SystemActionItem } from "@/components/SystemActionButton";
import { RotateCw, Download } from "lucide-react";
import type { TooltipWarmRef } from "@/components/SidebarTooltip";
import type { StatusResponse } from "@/lib/api";

export interface SidebarSystemActionsProps {
  collapsed: boolean;
  onNavigate: () => void;
  status: StatusResponse | null;
  tooltipWarmRef: TooltipWarmRef;
}

export function SidebarSystemActions({
  collapsed,
  onNavigate,
  status,
  tooltipWarmRef,
}: SidebarSystemActionsProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { activeAction, isBusy, isRunning, pendingAction, runAction } =
    useSystemActions();

  const items: SystemActionItem[] = [
    {
      action: "restart",
      icon: RotateCw,
      label: t.status.restartGateway,
      runningLabel: t.status.restartingGateway,
      spin: true,
    },
    {
      action: "update",
      icon: Download,
      label: t.status.updateHermes,
      runningLabel: t.status.updatingHermes,
      spin: false,
    },
  ];

  const handleClick = (action: SystemAction) => {
    if (isBusy) return;
    void runAction(action);
    navigate("/sessions");
    onNavigate();
  };

  return (
    <div
      className={cn(
        "shrink-0 flex flex-col",
        "border-t border-current/10",
        "py-1",
      )}
    >
      <span
        className={cn(
          "px-5 pt-0.5 pb-0.5",
          "font-mondwest text-display text-xs tracking-[0.12em] text-text-tertiary",
          collapsed && "lg:hidden",
        )}
      >
        {t.app.system}
      </span>

      <div className={cn(collapsed && "lg:hidden")}>
        <SidebarStatusStrip status={status} />
      </div>

      <GatewayDot collapsed={collapsed} status={status} tooltipWarmRef={tooltipWarmRef} />

      <ul className="flex flex-col">
        {items.map((item) => (
          <SystemActionButton
            key={item.action}
            collapsed={collapsed}
            disabled={isBusy && !(pendingAction === item.action || (activeAction === item.action && isRunning))}
            tooltipWarmRef={tooltipWarmRef}
            isPending={pendingAction === item.action}
            isRunning={activeAction === item.action && isRunning && pendingAction !== item.action}
            item={item}
            onClick={() => handleClick(item.action)}
          />
        ))}
      </ul>
    </div>
  );
}
