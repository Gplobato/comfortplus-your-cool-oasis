import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CampaignStatus, Platform } from "@/types/proads";
import { Facebook, Chrome, Music2, Linkedin } from "lucide-react";

const statusMap: Record<CampaignStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Ativa", className: "bg-success-soft text-success border-success/20" },
  PAUSED: { label: "Pausada", className: "bg-warning-soft text-warning border-warning/20" },
  DRAFT: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
  ARCHIVED: { label: "Arquivada", className: "bg-muted text-muted-foreground border-border" },
  REVIEW: { label: "Em análise", className: "bg-blue-soft text-blue-soft-foreground border-primary/20" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { label, className } = statusMap[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}

const platformMap: Record<Platform, { label: string; icon: typeof Facebook; className: string }> = {
  meta: { label: "Meta", icon: Facebook, className: "text-[#1877F2]" },
  google: { label: "Google", icon: Chrome, className: "text-[#4285F4]" },
  tiktok: { label: "TikTok", icon: Music2, className: "text-foreground" },
  linkedin: { label: "LinkedIn", icon: Linkedin, className: "text-[#0A66C2]" },
};

export function PlatformBadge({ platform, showLabel = true }: { platform: Platform; showLabel?: boolean }) {
  const { label, icon: Icon, className } = platformMap[platform];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <Icon className={cn("h-3.5 w-3.5", className)} />
      {showLabel && label}
    </span>
  );
}
