import { compatibleDevicesCatalog, demoAnalysis, demoListing } from '@/data/mock';
import type {
  AnalysisResult,
  CompatibleDevicesCatalog,
  DeviceProfile,
  ListingTeaser,
  PurchaseMode,
} from '@/types/domain';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const useMocks = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false' || !API_URL;
const wait = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

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
  const response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      message?: string;
    } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? 'DealUp n’a pas pu terminer cette action.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
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

function mapReport(raw: Record<string, any>, id: string, createdAt: string, purchaseMode: PurchaseMode): AnalysisResult {
  const listing = raw.listing;
  return {
    id,
    schemaVersion: '2.0',
    templateId: raw.template_id,
    listing: {
      identificationId: id,
      sourceUrl: '',
      title: listing.title,
      priceCents: listing.asking_price_cents ?? 0,
      currency: listing.currency,
      thumbnailUrl: listing.thumbnail_url,
      thumbnailMediaId: listing.thumbnail_media_id,
      location: listing.location ?? '',
      photoCount: listing.photo_count,
      facts: [],
      sellerName: 'Vendeur Leboncoin',
      postedLabel: 'Annonce analysée',
    },
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
    missingInformation: raw.missing_information,
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
  get isMock() {
    return useMocks;
  },

  async compatibleDevices(): Promise<CompatibleDevicesCatalog> {
    if (useMocks) return compatibleDevicesCatalog;
    const raw = await request<any>('/v1/catalog/compatible-devices', { method: 'GET' });
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
    if (useMocks) {
      await wait(900);
      return { ...demoListing, sourceUrl: url };
    }
    const response = await request<any>(
      '/v1/listings/identify',
      { method: 'POST', body: JSON.stringify({ url }) },
      token,
    );
    const device = response.compatibility.device
      ? mapDevice(response.compatibility.device)
      : null;
    return {
      identificationId: response.identification_id,
      sourceUrl: url,
      title: response.teaser.title,
      priceCents: response.teaser.asking_price_cents ?? 0,
      currency: response.teaser.currency,
      thumbnailUrl: response.teaser.thumbnail_url,
      location: response.teaser.location ?? '',
      photoCount: response.teaser.photo_count,
      facts: response.teaser.facts,
      sellerName: 'Vendeur Leboncoin',
      postedLabel: 'Annonce identifiée',
      compatibility: {
        status: response.compatibility.status,
        reason: response.compatibility.reason,
        device,
      },
    };
  },

  async startAnalysis(input: StartAnalysisInput, token?: string): Promise<{ analysisId: string }> {
    if (useMocks) {
      await wait(700);
      return { analysisId: demoAnalysis.id };
    }
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
    if (useMocks) {
      await wait(600);
      return { analysisId: `reanalysis_${Date.now()}` };
    }
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
    if (useMocks) return;
    await request(`/v1/analyses/${id}`, { method: 'DELETE' }, token);
  },

  async getAnalysis(id: string, token?: string): Promise<AnalysisResult> {
    if (useMocks) {
      await wait(3500);
      return { ...demoAnalysis, id };
    }
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
};
