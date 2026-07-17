import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { demoHistory, demoUsage } from '@/data/mock';
import { dealupApi } from '@/services/dealup-api';
import { telemetry } from '@/services/telemetry';
import type { AnalysisResult, ListingTeaser, PlanId, PurchaseMode, Usage } from '@/types/domain';

const STORAGE_KEY = '@dealup/app-state/v1';

interface PersistedState {
  onboardingComplete: boolean;
  isSignedIn: boolean;
  hasSubscription: boolean;
  selectedPlan: PlanId;
  usage: Usage;
  checklistDone: string[];
}

interface AppState extends PersistedState {
  isReady: boolean;
  pendingUrl: string | null;
  identification: ListingTeaser | null;
  purchaseMode: PurchaseMode | null;
  alreadyContacted: boolean;
  sellerReply: string;
  sellerMediaUris: string[];
  analyses: AnalysisResult[];
  activeAnalysisId: string | null;
  isBusy: boolean;
  error: string | null;
  completeOnboarding: () => void;
  signInDemo: (method: 'apple' | 'google' | 'email') => void;
  signOut: () => void;
  setPendingUrl: (url: string | null) => void;
  identifyListing: (url: string) => Promise<ListingTeaser | null>;
  choosePlan: (plan: PlanId) => void;
  purchasePlan: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  purchaseTopUp: () => Promise<void>;
  setPurchaseMode: (mode: PurchaseMode) => void;
  setSellerContext: (contacted: boolean, reply?: string, mediaUris?: string[]) => void;
  startAnalysis: () => Promise<string | null>;
  completeAnalysis: (id: string) => Promise<AnalysisResult | null>;
  reanalyze: (parentId: string, reply: string, mediaUris: string[]) => Promise<string | null>;
  toggleChecklist: (code: string) => void;
  clearError: () => void;
  resetDemo: () => Promise<void>;
}

const initialPersisted: PersistedState = {
  onboardingComplete: false,
  isSignedIn: false,
  hasSubscription: false,
  selectedPlan: 'monthly',
  usage: demoUsage,
  checklistDone: [],
};

const AppStoreContext = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [persisted, setPersisted] = useState(initialPersisted);
  const [isReady, setIsReady] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [identification, setIdentification] = useState<ListingTeaser | null>(null);
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode | null>(null);
  const [alreadyContacted, setAlreadyContacted] = useState(false);
  const [sellerReply, setSellerReply] = useState('');
  const [sellerMediaUris, setSellerMediaUris] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>(demoHistory);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setPersisted({ ...initialPersisted, ...(JSON.parse(value) as Partial<PersistedState>) });
      })
      .catch(() => undefined)
      .finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (isReady) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => undefined);
  }, [isReady, persisted]);

  const completeOnboarding = useCallback(() => {
    telemetry.capture('onboarding_completed');
    setPersisted((state) => ({ ...state, onboardingComplete: true }));
  }, []);

  const signInDemo = useCallback((method: 'apple' | 'google' | 'email') => {
    telemetry.capture('signed_in', { method, mock: dealupApi.isMock });
    setPersisted((state) => ({ ...state, isSignedIn: true }));
  }, []);

  const signOut = useCallback(() => {
    setPersisted((state) => ({ ...state, isSignedIn: false }));
    setIdentification(null);
    setPendingUrl(null);
  }, []);

  const identifyListing = useCallback(async (url: string) => {
    setIsBusy(true);
    setError(null);
    setPendingUrl(url);
    try {
      const listing = await dealupApi.identify(url);
      setIdentification(listing);
      telemetry.capture('listing_identified', { source: 'leboncoin', mock: dealupApi.isMock });
      return listing;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cette annonce n’a pas pu être identifiée.');
      return null;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const choosePlan = useCallback((plan: PlanId) => {
    setPersisted((state) => ({ ...state, selectedPlan: plan }));
  }, []);

  const purchasePlan = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setPersisted((state) => ({
      ...state,
      hasSubscription: true,
      usage: { ...state.usage, plan: state.selectedPlan, limit: state.selectedPlan === 'weekly' ? 15 : 60, used: 0 },
    }));
    telemetry.capture('subscription_started', { plan: persisted.selectedPlan, mock: true });
    setIsBusy(false);
  }, [persisted.selectedPlan]);

  const restorePurchases = useCallback(async () => {
    setIsBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setPersisted((state) => ({ ...state, hasSubscription: true }));
    setIsBusy(false);
  }, []);

  const purchaseTopUp = useCallback(async () => {
    setIsBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setPersisted((state) => ({
      ...state,
      usage: { ...state.usage, topUpRemaining: state.usage.topUpRemaining + 10 },
    }));
    telemetry.capture('topup_purchased', { quantity: 10, mock: true });
    setIsBusy(false);
  }, []);

  const setSellerContext = useCallback((contacted: boolean, reply = '', mediaUris: string[] = []) => {
    setAlreadyContacted(contacted);
    setSellerReply(reply);
    setSellerMediaUris(mediaUris);
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!identification || !purchaseMode) return null;
    setIsBusy(true);
    setError(null);
    try {
      const { analysisId } = await dealupApi.startAnalysis({
        identificationId: identification.identificationId,
        purchaseMode,
        alreadyContacted,
        sellerReply,
        sellerMediaUris,
      });
      setActiveAnalysisId(analysisId);
      telemetry.capture('analysis_started', { purchase_mode: purchaseMode, has_seller_context: alreadyContacted });
      return analysisId;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'L’analyse n’a pas pu démarrer.');
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [alreadyContacted, identification, purchaseMode, sellerMediaUris, sellerReply]);

  const completeAnalysis = useCallback(async (id: string) => {
    try {
      const result = await dealupApi.getAnalysis(id);
      const base = dealupApi.isMock && id.startsWith('reanalysis_')
        ? {
            ...result,
            verdict: { ...result.verdict, dealScore: 84, headline: 'Les nouvelles preuves renforcent le deal' },
            changeSummary: [
              'La facture confirme la date et l’origine de l’appareil.',
              'La capture batterie confirme 91 % et 284 cycles.',
              'Le risque principal passe d’élevé à modéré.',
            ],
          }
        : result;
      const hydrated = dealupApi.isMock && identification
        ? { ...base, id, listing: identification, purchaseMode: purchaseMode ?? result.purchaseMode }
        : { ...base, id };
      setAnalyses((items) => [hydrated, ...items.filter((item) => item.id !== id)]);
      if (!id.startsWith('reanalysis_')) {
        setPersisted((state) => ({ ...state, usage: { ...state.usage, used: Math.min(state.usage.limit, state.usage.used + 1) } }));
      }
      telemetry.capture('analysis_completed', { score: hydrated.verdict.dealScore, verdict: hydrated.verdict.type });
      return hydrated;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'L’analyse n’a pas pu se terminer.');
      return null;
    }
  }, [identification, purchaseMode]);

  const reanalyze = useCallback(async (parentId: string, reply: string, mediaUris: string[]) => {
    setSellerContext(true, reply, mediaUris);
    setIsBusy(true);
    setError(null);
    try {
      const { analysisId } = await dealupApi.reanalyze(parentId, { reply, mediaUris });
      setActiveAnalysisId(analysisId);
      telemetry.capture('reanalysis_started', { has_reply: Boolean(reply), media_count: mediaUris.length });
      return analysisId;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La réanalyse n’a pas pu démarrer.');
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [setSellerContext]);

  const toggleChecklist = useCallback((code: string) => {
    setPersisted((state) => ({
      ...state,
      checklistDone: state.checklistDone.includes(code)
        ? state.checklistDone.filter((item) => item !== code)
        : [...state.checklistDone, code],
    }));
  }, []);

  const resetDemo = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPersisted(initialPersisted);
    setPendingUrl(null);
    setIdentification(null);
    setPurchaseMode(null);
    setAlreadyContacted(false);
    setSellerReply('');
    setSellerMediaUris([]);
    setActiveAnalysisId(null);
    setError(null);
  }, []);

  const value = useMemo<AppState>(() => ({
    ...persisted,
    isReady,
    pendingUrl,
    identification,
    purchaseMode,
    alreadyContacted,
    sellerReply,
    sellerMediaUris,
    analyses,
    activeAnalysisId,
    isBusy,
    error,
    completeOnboarding,
    signInDemo,
    signOut,
    setPendingUrl,
    identifyListing,
    choosePlan,
    purchasePlan,
    restorePurchases,
    purchaseTopUp,
    setPurchaseMode,
    setSellerContext,
    startAnalysis,
    completeAnalysis,
    reanalyze,
    toggleChecklist,
    clearError: () => setError(null),
    resetDemo,
  }), [activeAnalysisId, alreadyContacted, analyses, choosePlan, completeAnalysis, completeOnboarding, error, identification, identifyListing, isBusy, isReady, pendingUrl, persisted, purchaseMode, purchasePlan, purchaseTopUp, reanalyze, resetDemo, restorePurchases, sellerMediaUris, sellerReply, setSellerContext, signInDemo, signOut, startAnalysis, toggleChecklist]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error('useAppStore doit être utilisé dans AppStoreProvider.');
  return value;
}
