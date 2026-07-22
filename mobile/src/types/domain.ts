export type PurchaseMode = 'face_to_face' | 'delivery' | 'unknown';
export type VerdictType = 'BUY' | 'NEGOTIATE' | 'VERIFY_FIRST' | 'PASS';
export type ReportTemplate = VerdictType;
export type DeviceCategory = 'IPHONE' | 'MACBOOK';
export type CompatibilityStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FindingStatus = 'CONFIRMED' | 'LIKELY' | 'UNVERIFIED' | 'RESOLVED';
export type ActionType =
  | 'REQUEST_PROOFS'
  | 'MAKE_OFFER'
  | 'START_CHECKLIST'
  | 'COMPARE_ANOTHER'
  | 'AVOID_LISTING';

export type PlanId = 'weekly' | 'monthly';

export interface DeviceProfile {
  category: DeviceCategory;
  profileCode: string;
  displayName: string;
  specs: Record<string, string | number>;
  catalogVersion: string;
}

export interface ListingCompatibility {
  status: CompatibilityStatus;
  reason?: string | null;
  device?: DeviceProfile | null;
}

export interface ListingTeaser {
  identificationId: string;
  sourceUrl: string;
  title: string;
  priceCents: number;
  currency?: string;
  thumbnailUrl?: string | null;
  thumbnailMediaId?: string | null;
  previewPhotoUrls: string[];
  location: string;
  photoCount: number;
  facts: string[];
  sellerName: string;
  postedLabel: string;
  compatibility?: ListingCompatibility;
  existingAnalysisId?: string | null;
}

export interface RiskItem {
  code: string;
  canonicalTitle: string;
  status: FindingStatus;
  severity: Severity;
  displayTitle: string;
  commentary: string;
  recommendedCheck: string;
}

export interface ChecklistItem {
  code: string;
  label: string;
  critical?: boolean;
}

export interface ScoreDimension {
  score: number;
  rationale: string;
}

export interface AnalysisResult {
  id: string;
  schemaVersion: '2.0';
  templateId: ReportTemplate;
  listing: ListingTeaser;
  device: DeviceProfile;
  createdAt: string;
  purchaseMode: PurchaseMode;
  verdict: {
    type: VerdictType;
    dealScore: number;
    confidence: Confidence;
    headline: string;
    explanation: string;
  };
  scoreBreakdown: Record<string, ScoreDimension>;
  primaryAction: {
    type: ActionType;
    label: string;
    reason: string;
  };
  pricing: {
    status: 'AVAILABLE' | 'UNAVAILABLE';
    currency: string;
    askingPriceCents: number | null;
    marketLowCents: number | null;
    marketMedianCents: number | null;
    marketHighCents: number | null;
    fairPriceCents: number | null;
    openingOfferCents: number | null;
    agreementZoneLowCents: number | null;
    agreementZoneHighCents: number | null;
    maxRecommendedCents: number | null;
    potentialSavingsCents: number | null;
    confidence: Confidence;
    commentary: string;
  };
  risks: { level: Severity; items: RiskItem[] };
  positiveSignals: { code: string; label: string }[];
  missingInformation: { code: string; priority: 'BLOCKING' | 'USEFUL'; label: string; reason: string; question: string; evidence: string[] }[];
  messages: { requestProofs: string; makeOffer: string; decline: string };
  checklist: {
    beforeMeeting: ChecklistItem[];
    duringMeeting: ChecklistItem[];
    beforePayment: ChecklistItem[];
  };
  availableActions: ActionType[];
  expertNote?: string | null;
  changeSummary?: string[];
}

export interface CompatibleDeviceCategory {
  code: DeviceCategory;
  label: string;
  supportedRange: string;
  assetKey?: string | null;
  models: string[];
}

export interface CompatibleDevicesCatalog {
  version: string;
  categories: CompatibleDeviceCategory[];
  comingLater: string[];
}

export interface Usage {
  plan: PlanId | 'promotional' | 'none';
  active: boolean;
  used: number;
  limit: number;
  includedRemaining: number;
  topUpRemaining: number;
  renewsLabel: string;
}

export interface AccountProfile {
  id: string;
  clerkUserId: string;
  email: string | null;
  displayName: string | null;
  authProvider: 'email' | 'apple' | 'google' | null;
  createdAt: string;
  usage: Usage;
}

export interface AnalysisSummary {
  entryType: 'analysis' | 'identification';
  id: string;
  latestAnalysisId: string;
  status: 'identified' | 'pending' | 'processing' | 'completed' | 'failed';
  kind: 'initial' | 'reanalysis' | 'refresh';
  device: DeviceProfile | null;
  listing: ListingTeaser | null;
  verdict: AnalysisResult['verdict'] | null;
  templateId: ReportTemplate | null;
  createdAt: string;
  completedAt: string | null;
}
