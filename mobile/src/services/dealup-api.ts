import type {
  AccountProfile,
  AnalysisResult,
  AnalysisSummary,
  CompatibleDevicesCatalog,
  DeviceProfile,
  ListingTeaser,
  PurchaseMode,
  Usage,
} from '@/types/domain';
import { runtime } from '@/services/runtime';

const API_URL = runtime.apiUrl;
const wait = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));
type TokenProvider = (options?: { skipCache?: boolean }) => Promise<string | null>;

let tokenProvider: TokenProvider | null = null;

export class DealUpApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'DealUpApiError';
  }
}

export interface StartAnalysisInput {
  identificationId: string;
  purchaseMode: PurchaseMode;
  alreadyContacted: boolean;
  sellerReply?: string;
  sellerMediaUris?: string[];
}

interface UploadPresignResponse {
  media_id: string;
  upload: { url: string; fields: Record<string, string> };
}

async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL manque dans le fichier .env.');
  const usesSession = token === undefined;
  let bearer = usesSession && tokenProvider ? await tokenProvider() : token;
  if (usesSession && !bearer) {
    throw new DealUpApiError('Ta session est en cours de restauration.', 'AUTH_TOKEN_UNAVAILABLE', 401);
  }

  const send = (authorization: string | null | undefined) => fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
        ...init.headers,
      },
    });

  let response = await send(bearer);
  if (response.status === 401 && token !== '' && tokenProvider) {
    bearer = await tokenProvider({ skipCache: true });
    if (bearer) response = await send(bearer);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
      message?: string;
    } | null;
    throw new DealUpApiError(
      payload?.error?.message ?? payload?.message ?? 'DealUp n’a pas pu terminer cette action.',
      payload?.error?.code ?? `HTTP_${response.status}`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function mapListing(raw: Record<string, any>, identificationId: string): ListingTeaser {
  return {
    identificationId,
    sourceUrl: '',
    title: raw.title,
    priceCents: raw.asking_price_cents ?? 0,
    currency: raw.currency,
    thumbnailUrl: raw.thumbnail_url,
    thumbnailMediaId: raw.thumbnail_media_id,
    previewPhotoUrls: raw.thumbnail_url ? [raw.thumbnail_url] : [],
    location: raw.location ?? '',
    photoCount: raw.photo_count ?? 0,
    facts: [],
    sellerName: 'Vendeur Leboncoin',
    postedLabel: 'Annonce analysée',
  };
}

function mapIdentification(response: any, sourceUrl = ''): ListingTeaser {
  const device = response.compatibility.device ? mapDevice(response.compatibility.device) : null;
  return {
    identificationId: response.identification_id,
    sourceUrl,
    title: response.teaser.title,
    priceCents: response.teaser.asking_price_cents ?? 0,
    currency: response.teaser.currency,
    thumbnailUrl: response.teaser.thumbnail_url,
    previewPhotoUrls: response.teaser.preview_photo_urls ?? [],
    location: response.teaser.location ?? '',
    photoCount: response.teaser.photo_count,
    facts: response.teaser.facts,
    sellerName: 'Vendeur Leboncoin',
    postedLabel: 'Annonce identifiée',
    compatibility: { status: response.compatibility.status, reason: response.compatibility.reason, device },
    existingAnalysisId: response.existing_analysis_id ?? null,
  };
}

function mapDevice(value: Record<string, unknown>): DeviceProfile {
  return {
    category: value.category as DeviceProfile['category'],
    profileCode: String(value.profile_code),
    displayName: String(value.display_name),
    specs: (value.specs ?? {}) as Record<string, string | number>,
    catalogVersion: String(value.catalog_version),
  };
}

function mapUsage(raw: any): Usage {
  const periodEnd = raw.included.period_ends_at ? new Date(raw.included.period_ends_at) : null;
  const daysUntilNextCredit = periodEnd
    ? Math.max(1, Math.ceil((periodEnd.getTime() - Date.now()) / 86_400_000))
    : null;
  return {
    plan: raw.plan,
    active: raw.entitlement === 'active',
    used: raw.included.used,
    limit: raw.included.limit,
    includedRemaining: raw.included.remaining,
    topUpRemaining: raw.top_up.remaining,
    renewsLabel: daysUntilNextCredit
      ? `+${raw.included.limit} crédits dans ${daysUntilNextCredit} j`
      : 'Aucune formule active',
  };
}

function mapReport(raw: Record<string, any>, id: string, createdAt: string, purchaseMode: PurchaseMode): AnalysisResult {
  const listing = raw.listing;
  return {
    id,
    schemaVersion: '2.0',
    templateId: raw.template_id,
    listing: mapListing(listing, id),
    device: mapDevice(raw.device),
    createdAt,
    purchaseMode,
    verdict: {
      type: raw.verdict.type,
      dealScore: raw.verdict.deal_score,
      confidence: raw.verdict.confidence,
      headline: raw.verdict.headline,
      explanation: raw.verdict.explanation,
    },
    scoreBreakdown: Object.fromEntries(
      Object.entries(raw.score_breakdown).map(([key, value]: [string, any]) => [
        key,
        { score: value.score, rationale: value.rationale },
      ]),
    ),
    primaryAction: {
      type: raw.primary_action.type,
      label: raw.primary_action.label,
      reason: raw.primary_action.reason,
    },
    pricing: {
      status: raw.pricing.status,
      currency: raw.pricing.currency,
      askingPriceCents: raw.pricing.asking_price_cents,
      marketLowCents: raw.pricing.market_low_cents,
      marketMedianCents: raw.pricing.market_median_cents,
      marketHighCents: raw.pricing.market_high_cents,
      fairPriceCents: raw.pricing.fair_price_cents,
      openingOfferCents: raw.pricing.opening_offer_cents,
      agreementZoneLowCents: raw.pricing.agreement_zone_low_cents,
      agreementZoneHighCents: raw.pricing.agreement_zone_high_cents,
      maxRecommendedCents: raw.pricing.max_recommended_cents,
      potentialSavingsCents: raw.pricing.potential_savings_cents,
      confidence: raw.pricing.confidence,
      commentary: raw.pricing.commentary,
    },
    risks: {
      level: raw.risks.level,
      items: raw.risks.items.map((item: any) => ({
        code: item.code,
        canonicalTitle: item.canonical_title,
        status: item.status,
        severity: item.severity,
        displayTitle: item.display_title,
        commentary: item.commentary,
        recommendedCheck: item.recommended_check,
      })),
    },
    positiveSignals: raw.positive_signals,
    missingInformation: raw.missing_information.map((item: any) => ({
      code: item.code,
      priority: item.priority,
      label: item.label,
      reason: item.reason ?? 'Les éléments fournis ne permettent pas encore de confirmer ce point.',
      question: item.question,
      evidence: item.evidence ?? [],
    })),
    messages: {
      requestProofs: raw.messages.request_proofs,
      makeOffer: raw.messages.make_offer,
      decline: raw.messages.decline,
    },
    checklist: {
      beforeMeeting: raw.checklist.before_meeting,
      duringMeeting: raw.checklist.during_meeting,
      beforePayment: raw.checklist.before_payment,
    },
    availableActions: raw.available_actions,
    expertNote: raw.expert_note,
    changeSummary: raw.change_summary,
  };
}

function mimeForUri(uri: string): 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp' {
  const clean = uri.toLowerCase().split('?', 1)[0];
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.heic') || clean.endsWith('.heif')) return 'image/heic';
  if (clean.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function uploadPrivateMedia(uri: string, token?: string): Promise<string> {
  const local = await fetch(uri);
  if (!local.ok) throw new Error('Cette image locale ne peut pas être lue.');
  const blob = await local.blob();
  const contentType = mimeForUri(uri);
  const presign = await request<UploadPresignResponse>(
    '/v1/uploads/presign',
    { method: 'POST', body: JSON.stringify({ content_type: contentType, size_bytes: blob.size }) },
    token,
  );
  try {
    const form = new FormData();
    Object.entries(presign.upload.fields).forEach(([key, value]) => form.append(key, value));
    form.append('file', blob, `seller-media-${presign.media_id}`);
    const uploaded = await fetch(presign.upload.url, { method: 'POST', body: form });
    if (!uploaded.ok) throw new Error('Le stockage privé a refusé cette image.');
    await request(
      `/v1/uploads/${presign.media_id}/complete`,
      { method: 'POST', body: JSON.stringify({}) },
      token,
    );
    return presign.media_id;
  } catch (error) {
    await request(`/v1/uploads/${presign.media_id}`, { method: 'DELETE' }, token).catch(() => undefined);
    throw error;
  }
}

async function uploadPrivateMediaBatch(uris: string[], token?: string): Promise<string[]> {
  return Promise.all(uris.slice(0, 10).map((uri) => uploadPrivateMedia(uri, token)));
}

export const dealupApi = {
  setTokenProvider(provider: TokenProvider | null) {
    tokenProvider = provider;
  },

  async compatibleDevices(): Promise<CompatibleDevicesCatalog> {
    const raw = await request<any>('/v1/catalog/compatible-devices', { method: 'GET' }, '');
    return {
      version: raw.version,
      categories: raw.categories.map((item: any) => ({
        code: item.code,
        label: item.label,
        supportedRange: item.supported_range,
        assetKey: item.asset_key,
        models: item.models,
      })),
      comingLater: raw.coming_later,
    };
  },

  async identify(url: string, token?: string): Promise<ListingTeaser> {
    const response = await request<any>(
      '/v1/listings/identify',
      { method: 'POST', body: JSON.stringify({ url }) },
      token,
    );
    return mapIdentification(response, url);
  },

  async getIdentification(id: string, token?: string): Promise<ListingTeaser> {
    const response = await request<any>(`/v1/listings/${id}`, { method: 'GET' }, token);
    return mapIdentification(response);
  },

  async listPendingIdentifications(token?: string): Promise<AnalysisSummary[]> {
    const response = await request<any>('/v1/listings', { method: 'GET' }, token);
    return response.items.map((item: any) => {
      const listing = mapIdentification(item);
      return {
        entryType: 'identification' as const,
        id: item.identification_id,
        latestAnalysisId: item.identification_id,
        status: 'identified' as const,
        kind: 'initial' as const,
        device: listing.compatibility?.device ?? null,
        listing,
        verdict: null,
        templateId: null,
        createdAt: item.created_at,
        completedAt: null,
      };
    });
  },

  async startAnalysis(input: StartAnalysisInput, token?: string): Promise<{ analysisId: string }> {
    const mediaIds = await uploadPrivateMediaBatch(input.sellerMediaUris ?? [], token);
    const response = await request<{ analysis_id: string }>(
      '/v1/analyses',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': `mobile-${Date.now()}-${input.identificationId}` },
        body: JSON.stringify({
          identification_id: input.identificationId,
          purchase_mode: input.purchaseMode,
          seller_context: {
            already_contacted: input.alreadyContacted,
            reply_text: input.sellerReply || null,
            media_ids: mediaIds,
          },
        }),
      },
      token,
    );
    return { analysisId: response.analysis_id };
  },

  async reanalyze(
    parentId: string,
    input: { reply?: string; mediaUris?: string[]; purchaseMode?: PurchaseMode },
    token?: string,
  ): Promise<{ analysisId: string }> {
    const mediaIds = await uploadPrivateMediaBatch(input.mediaUris ?? [], token);
    const response = await request<{ analysis_id: string }>(
      `/v1/analyses/${parentId}/reanalyze`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': `mobile-reanalysis-${Date.now()}-${parentId}` },
        body: JSON.stringify({
          reply_text: input.reply?.trim() || null,
          media_ids: mediaIds,
          purchase_mode: input.purchaseMode ?? null,
        }),
      },
      token,
    );
    return { analysisId: response.analysis_id };
  },

  async refresh(parentId: string, token?: string): Promise<{ analysisId: string }> {
    const response = await request<{ analysis_id: string }>(
      `/v1/analyses/${parentId}/refresh`,
      { method: 'POST', headers: { 'Idempotency-Key': `mobile-refresh-${Date.now()}-${parentId}` } },
      token,
    );
    return { analysisId: response.analysis_id };
  },

  async deleteAnalysis(id: string, token?: string): Promise<void> {
    await request(`/v1/analyses/${id}`, { method: 'DELETE' }, token);
  },

  async retryAnalysis(id: string, token?: string): Promise<void> {
    await request(`/v1/analyses/${id}/retry`, { method: 'POST', body: JSON.stringify({}) }, token);
  },

  async getAnalysis(id: string, token?: string): Promise<AnalysisResult> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await request<any>(`/v1/analyses/${id}`, { method: 'GET' }, token);
      if (response.status === 'completed' && response.result) {
        return mapReport(response.result, response.id, response.created_at, response.purchase_mode);
      }
      if (response.status === 'failed') {
        throw new Error(response.error_message ?? 'L’analyse n’a pas pu aboutir.');
      }
      await wait(1500);
    }
    throw new Error('L’analyse continue en arrière-plan. Tu peux revenir dans quelques instants.');
  },

  async getAnalysisNow(id: string, token?: string): Promise<AnalysisResult> {
    const response = await request<any>(`/v1/analyses/${id}`, { method: 'GET' }, token);
    if (response.status !== 'completed' || !response.result) {
      throw new Error('Cette analyse n’est pas encore disponible.');
    }
    return mapReport(response.result, response.id, response.created_at, response.purchase_mode);
  },

  async listAnalyses(token?: string): Promise<AnalysisSummary[]> {
    const response = await request<any>('/v1/analyses?limit=50', { method: 'GET' }, token);
    return response.items.map((item: any) => ({
      entryType: 'analysis' as const,
      id: item.id,
      latestAnalysisId: item.latest_analysis_id,
      status: item.status,
      kind: item.kind,
      device: item.device ? mapDevice(item.device) : null,
      listing: item.listing ? mapListing(item.listing, item.latest_analysis_id) : null,
      verdict: item.verdict ? {
        type: item.verdict.type,
        dealScore: item.verdict.deal_score,
        confidence: item.verdict.confidence,
        headline: item.verdict.headline,
        explanation: item.verdict.explanation,
      } : null,
      templateId: item.template_id,
      createdAt: item.created_at,
      completedAt: item.completed_at,
    }));
  },

  async getUsage(token?: string): Promise<Usage> {
    const raw = await request<any>('/v1/me/usage', { method: 'GET' }, token);
    return mapUsage(raw);
  },

  async getMe(token?: string): Promise<AccountProfile> {
    const raw = await request<any>('/v1/me', { method: 'GET' }, token);
    return {
      id: raw.id,
      clerkUserId: raw.clerk_user_id,
      email: raw.email ?? null,
      displayName: raw.display_name ?? null,
      authProvider: raw.auth_provider ?? null,
      createdAt: raw.created_at,
      usage: mapUsage(raw.usage),
    };
  },

  async deleteAccount(token?: string): Promise<void> {
    await request('/v1/me', { method: 'DELETE' }, token);
  },

  async syncBilling(token?: string): Promise<void> {
    await request('/v1/billing/sync', { method: 'POST', body: JSON.stringify({}) }, token);
  },

  async registerPushDevice(pushToken: string, token?: string): Promise<{ id: string }> {
    return request<{ id: string }>(
      '/v1/devices',
      { method: 'POST', body: JSON.stringify({ push_token: pushToken, platform: 'ios' }) },
      token,
    );
  },

  async deletePushDevice(deviceId: string, token?: string): Promise<void> {
    await request(`/v1/devices/${deviceId}`, { method: 'DELETE' }, token);
  },

  async getAnalysisMedia(id: string, token?: string): Promise<{ listing: string[]; seller: string[] }> {
    const raw = await request<any>(`/v1/analyses/${id}/media`, { method: 'GET' }, token);
    return {
      listing: raw.items.filter((item: any) => item.role === 'listing_photo').map((item: any) => item.url),
      seller: raw.items.filter((item: any) => item.role === 'seller_media').map((item: any) => item.url),
    };
  },
};
