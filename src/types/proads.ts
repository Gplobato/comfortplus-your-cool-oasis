export type Platform = "meta" | "google" | "tiktok" | "linkedin";
export type CampaignStatus = "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED" | "REVIEW";
export type CampaignObjective =
  | "leads"
  | "conversions"
  | "traffic"
  | "awareness"
  | "engagement"
  | "sales";
export type CreativeType = "image" | "video" | "carousel" | "story" | "reel" | "banner";
export type CreativeStatus = "approved" | "pending" | "rejected" | "draft";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalType =
  | "new_campaign"
  | "budget_change"
  | "new_creative"
  | "new_audience"
  | "activate_campaign"
  | "pause_campaign";
export type RiskLevel = "low" | "medium" | "high";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
export type AgentRole =
  | "director"
  | "researcher"
  | "strategist"
  | "copywriter"
  | "creative_director"
  | "media_buyer"
  | "analyst"
  | "auditor";
export type UserRoleName = "admin" | "manager" | "analyst" | "creative" | "approver" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRoleName;
  jobTitle: string;
  avatarUrl?: string;
  status: "active" | "invited" | "suspended";
  lastAccess: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  segment: string;
  website: string;
  description: string;
  logoUrl?: string;
  brandColors: string[];
  toneOfVoice: string;
  services: string[];
  regions: string[];
  audience: string;
  differentials: string[];
  forbiddenWords: string[];
}

export interface AdAccount {
  id: string;
  name: string;
  platform: Platform;
  currency: string;
  status: "active" | "disabled";
}

export interface Campaign {
  id: string;
  name: string;
  platform: Platform;
  objective: CampaignObjective;
  status: CampaignStatus;
  dailyBudget: number;
  totalBudget: number;
  spend: number;
  leads: number;
  cpl: number;
  roas: number;
  ctr: number;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate?: string;
  createdBy: string;
  createdByAI: boolean;
  approvalStatus: ApprovalStatus;
  updatedAt: string;
  accountId: string;
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  status: CampaignStatus;
  audienceId: string;
  dailyBudget: number;
  spend: number;
}

export interface Ad {
  id: string;
  adSetId: string;
  name: string;
  creativeId: string;
  status: CampaignStatus;
  impressions: number;
  clicks: number;
  leads: number;
}

export interface Creative {
  id: string;
  name: string;
  type: CreativeType;
  format: string;
  resolution: string;
  sizeKb: number;
  thumbnailUrl: string;
  status: CreativeStatus;
  platform: Platform;
  campaignIds: string[];
  createdBy: string;
  createdByAI: boolean;
  performance: { ctr: number; cpl: number; leads: number };
  createdAt: string;
  headline?: string;
  primaryText?: string;
  cta?: string;
}

export interface Audience {
  id: string;
  name: string;
  type:
    | "interest"
    | "custom"
    | "lookalike"
    | "remarketing"
    | "customer_list"
    | "website_visitors"
    | "engagement";
  size: number;
  platform: Platform;
  origin: string;
  campaignIds: string[];
  performance: { cpl: number; ctr: number };
  status: "active" | "archived";
  ageRange?: [number, number];
  location?: string;
  interests?: string[];
  exclusions?: string[];
  overlap?: number;
}

export interface Approval {
  id: string;
  type: ApprovalType;
  title: string;
  description: string;
  requestedBy: string;
  requestedByAgent?: AgentRole;
  riskLevel: RiskLevel;
  confidence: number;
  beforeValue?: string;
  afterValue?: string;
  impact?: string;
  status: ApprovalStatus;
  createdAt: string;
  platform?: Platform;
  urgency: "low" | "medium" | "high";
}

export interface AgentToolExecution {
  id: string;
  tool: string;
  status: "running" | "completed" | "error";
  input?: string;
  output?: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agent?: AgentRole;
  createdAt: string;
  attachments?: { name: string; url: string }[];
  toolsUsed?: AgentToolExecution[];
  actions?: { label: string; kind: "primary" | "secondary" | "ghost" }[];
  status?: "sending" | "sent" | "error";
  imageUrl?: string;
  modelUsed?: string;
}

export interface AgentConversation {
  id: string;
  title: string;
  updatedAt: string;
  favorite: boolean;
  messagesCount: number;
}

export interface Recommendation {
  id: string;
  title: string;
  explanation: string;
  impact: string;
  confidence: number;
  action: "increase_budget" | "pause_ad" | "test_creative" | "change_audience" | "fix_landing" | "reduce_overlap";
}

export interface Integration {
  id: string;
  provider: string;
  name: string;
  category: "ads" | "messaging" | "automation" | "analytics" | "ai" | "crm" | "media";
  description: string;
  status: IntegrationStatus;
  lastSync?: string;
  icon: string;
}

export interface AuditLog {
  id: string;
  createdAt: string;
  user: string;
  agent?: AgentRole;
  action: string;
  module: string;
  account?: string;
  description: string;
  status: "success" | "warning" | "error";
  approvedBy?: string;
  before?: string;
  after?: string;
  result?: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  kind: "info" | "warning" | "success" | "error";
}

export interface MetricPoint {
  date: string;
  leads: number;
  cpl: number;
  spend: number;
  impressions: number;
}
