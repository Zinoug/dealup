import { useAuth, useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { dealupApi } from '@/services/dealup-api';
import { enableAnalysisNotifications } from '@/services/notifications';
import { revenueCat, type BillingProducts } from '@/services/revenuecat';
import { telemetry } from '@/services/telemetry';
import type {
  AnalysisResult,
  AnalysisSummary,
  ListingTeaser,
  PlanId,
  PurchaseMode,
  Usage,
} from '@/types/domain';

const STORAGE_KEY = '@dealup/app-state/v2';

interface PersistedState {
  onboardingComplete: boolean;
  selectedPlan: PlanId;
  checklistDone: string[];
}

interface StartAnalysisContext {
  alreadyContacted: boolean;
  sellerReply?: string;
  sellerMediaUris?: string[];
}

interface AppState extends PersistedState {
  isReady: boolean;
  isSignedIn: boolean;
  userId: string | null;
  userName: string;
  userEmail: string;
  hasSubscription: boolean;
  usage: Usage;
  billingProducts: BillingProducts;
  pendingUrl: string | null;
  identification: ListingTeaser | null;
  purchaseMode: PurchaseMode | null;
  alreadyContacted: boolean;
  sellerReply: string;
  sellerMediaUris: string[];
  analyses: AnalysisSummary[];
  reports: Record<string, AnalysisResult>;
  activeAnalysisId: string | null;
  isBusy: boolean;
  error: string | null;
  completeOnboarding: () => void;
  beginOnboarding: () => void;
  requestNotifications: () => Promise<'enabled' | 'denied' | 'unavailable'>;
  deleteAccount: () => Promise<boolean>;
  signOut: () => Promise<void>;
  setPendingUrl: (url: string | null) => void;
  identifyListing: (url: string) => Promise<ListingTeaser | null>;
  choosePlan: (plan: PlanId) => void;
  purchasePlan: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  purchaseTopUp: () => Promise<boolean>;
  refreshAccount: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadAnalysis: (id: string, force?: boolean) => Promise<AnalysisResult | null>;
  loadReplayMedia: (id: string) => Promise<{ listing: string[]; seller: string[] }>;
  setPurchaseMode: (mode: PurchaseMode) => void;
  setSellerContext: (contacted: boolean, reply?: string, mediaUris?: string[]) => void;
  startAnalysis: (context?: StartAnalysisContext) => Promise<string | null>;
  completeAnalysis: (id: string) => Promise<AnalysisResult | null>;
  retryAnalysis: (id: string) => Promise<boolean>;
  reanalyze: (parentId: string, reply: string, mediaUris: string[]) => Promise<string | null>;
  toggleChecklist: (code: string) => void;
  clearError: () => void;
  resetLocalDevelopmentState: () => Promise<void>;
}

const initialPersisted: PersistedState = {
  onboardingComplete: false,
  selectedPlan: 'monthly',
  checklistDone: [],
};

const emptyUsage: Usage = {
  plan: 'none',
  active: false,
  used: 0,
  limit: 0,
  topUpRemaining: 0,
  renewsLabel: 'Aucune formule active',
};

const emptyProducts: BillingProducts = { weekly: null, monthly: null, topUp: null };
const AppStoreContext = createContext<AppState | null>(null);

function errorMessage(reason: unknown, fallback: string): string {
  if (typeof reason === 'object' && reason && 'userCancelled' in reason && reason.userCancelled) return '';
  return reason instanceof Error ? reason.message : fallback;
}

export function AppStoreProvider({ children }: PropsWithChildren) {
  const { isLoaded: authLoaded, isSignedIn: clerkSignedIn, userId, getToken, signOut: clerkSignOut } = useAuth();
  const { user } = useUser();
  const [persisted, setPersisted] = useState(initialPersisted);
  const [storageReady, setStorageReady] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [identification, setIdentification] = useState<ListingTeaser | null>(null);
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode | null>(null);
  const [alreadyContacted, setAlreadyContacted] = useState(false);
  const [sellerReply, setSellerReply] = useState('');
  const [sellerMediaUris, setSellerMediaUris] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [reports, setReports] = useState<Record<string, AnalysisResult>>({});
  const [usage, setUsage] = useState<Usage>(emptyUsage);
  const [billingProducts, setBillingProducts] = useState<BillingProducts>(emptyProducts);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignedIn = Boolean(clerkSignedIn && userId);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setPersisted({ ...initialPersisted, ...(JSON.parse(value) as Partial<PersistedState>) });
      })
      .catch((reason) => telemetry.error(reason, { operation: 'restore_local_state' }))
      .finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (storageReady) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch((reason) => telemetry.error(reason, { operation: 'persist_local_state' }));
  }, [persisted, storageReady]);

  useEffect(() => {
    dealupApi.setTokenProvider(isSignedIn ? () => getToken() : null);
    return () => dealupApi.setTokenProvider(null);
  }, [getToken, isSignedIn]);

  const loadHistory = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      setAnalyses(await dealupApi.listAnalyses());
    } catch (reason) {
      telemetry.error(reason, { operation: 'load_history' });
      setError(errorMessage(reason, 'Ton historique n’a pas pu être chargé.'));
    }
  }, [isSignedIn]);

  const refreshUsage = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      setUsage(await dealupApi.getUsage());
    } catch (reason) {
      telemetry.error(reason, { operation: 'load_usage' });
    }
  }, [isSignedIn]);

  const refreshAccount = useCallback(async () => {
    if (!isSignedIn) return;
    const history = loadHistory();
    try {
      await dealupApi.syncBilling();
    } catch (reason) {
      telemetry.error(reason, { operation: 'sync_billing' });
    }
    try {
      const account = await dealupApi.getMe();
      setUsage(account.usage);
      telemetry.identify(account.id, {
        email: account.email,
        auth_provider: account.authProvider,
        plan: account.usage.plan,
        account_created_at: account.createdAt,
      });
    } catch (reason) {
      telemetry.error(reason, { operation: 'load_account' });
      await refreshUsage();
    }
    await history;
  }, [isSignedIn, loadHistory, refreshUsage]);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      void Promise.resolve().then(() => {
        setAnalyses([]);
        setReports({});
        setUsage(emptyUsage);
        setBillingProducts(emptyProducts);
      });
      return;
    }
    let active = true;
    revenueCat.initialize(userId)
      .then(({ products }) => { if (active) setBillingProducts(products); })
      .catch((reason) => telemetry.error(reason, { operation: 'initialize_revenuecat' }));
    void Promise.resolve().then(refreshAccount);
    return () => { active = false; };
  }, [isSignedIn, refreshAccount, userId]);

  const completeOnboarding = useCallback(() => {
    telemetry.capture('onboarding_completed');
    setPersisted((state) => ({ ...state, onboardingComplete: true }));
  }, []);

  const beginOnboarding = useCallback(() => {
    setPersisted((state) => ({ ...state, onboardingComplete: false }));
  }, []);

  const requestNotifications = useCallback(async () => {
    try {
      const result = await enableAnalysisNotifications();
      telemetry.capture('notification_permission_finished', { result });
      return result;
    } catch (reason) {
      telemetry.error(reason, { operation: 'enable_notifications' });
      return 'unavailable' as const;
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsBusy(true);
    try {
      await revenueCat.logout();
      await clerkSignOut();
      telemetry.reset();
      setIdentification(null);
      setPendingUrl(null);
      setAnalyses([]);
      setReports({});
      setUsage(emptyUsage);
    } finally {
      setIsBusy(false);
    }
  }, [clerkSignOut]);

  const deleteAccount = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      await dealupApi.deleteAccount();
      await revenueCat.logout().catch(() => undefined);
      await clerkSignOut().catch(() => undefined);
      telemetry.clearPersonProperties();
      telemetry.capture('account_deleted');
      telemetry.reset();
      await AsyncStorage.removeItem(STORAGE_KEY);
      setPersisted(initialPersisted);
      setIdentification(null);
      setPendingUrl(null);
      setAnalyses([]);
      setReports({});
      setUsage(emptyUsage);
      return true;
    } catch (reason) {
      setError(errorMessage(reason, 'Ton compte n’a pas pu être supprimé. Réessaie.'));
      telemetry.error(reason, { operation: 'delete_account' });
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [clerkSignOut]);

  const identifyListing = useCallback(async (url: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const listing = await dealupApi.identify(url);
      setIdentification(listing);
      setPendingUrl(null);
      telemetry.capture('listing_identified', { source: 'leboncoin' });
      return listing;
    } catch (reason) {
      setError(errorMessage(reason, 'Cette annonce n’a pas pu être identifiée.'));
      telemetry.error(reason, { operation: 'identify_listing' });
      return null;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const choosePlan = useCallback((plan: PlanId) => setPersisted((state) => ({ ...state, selectedPlan: plan })), []);

  const purchasePlan = useCallback(async () => {
    if (!userId) return false;
    setIsBusy(true);
    setError(null);
    try {
      await revenueCat.purchasePlan(userId, persisted.selectedPlan);
      await refreshAccount();
      telemetry.capture('subscription_started', { plan: persisted.selectedPlan });
      return true;
    } catch (reason) {
      const message = errorMessage(reason, 'L’achat n’a pas pu être finalisé.');
      if (message) setError(message);
      telemetry.error(reason, { operation: 'purchase_plan' });
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [persisted.selectedPlan, refreshAccount, userId]);

  const restorePurchases = useCallback(async () => {
    if (!userId) return false;
    setIsBusy(true);
    setError(null);
    try {
      await revenueCat.restore(userId);
      await refreshAccount();
      telemetry.capture('purchases_restored');
      return true;
    } catch (reason) {
      setError(errorMessage(reason, 'Les achats n’ont pas pu être restaurés.'));
      telemetry.error(reason, { operation: 'restore_purchases' });
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [refreshAccount, userId]);

  const purchaseTopUp = useCallback(async () => {
    if (!userId) return false;
    setIsBusy(true);
    setError(null);
    try {
      await revenueCat.purchaseTopUp(userId);
      await refreshAccount();
      telemetry.capture('topup_purchased', { quantity: 10 });
      return true;
    } catch (reason) {
      const message = errorMessage(reason, 'Le pack n’a pas pu être ajouté.');
      if (message) setError(message);
      telemetry.error(reason, { operation: 'purchase_topup' });
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [refreshAccount, userId]);

  const setSellerContext = useCallback((contacted: boolean, reply = '', mediaUris: string[] = []) => {
    setAlreadyContacted(contacted);
    setSellerReply(reply);
    setSellerMediaUris(mediaUris);
  }, []);

  const startAnalysis = useCallback(async (context?: StartAnalysisContext) => {
    if (!identification || !purchaseMode) return null;
    const analysisAlreadyContacted = context?.alreadyContacted ?? alreadyContacted;
    const analysisSellerReply = context?.sellerReply ?? sellerReply;
    const analysisSellerMediaUris = context?.sellerMediaUris ?? sellerMediaUris;
    setIsBusy(true);
    setError(null);
    try {
      const { analysisId } = await dealupApi.startAnalysis({
        identificationId: identification.identificationId,
        purchaseMode,
        alreadyContacted: analysisAlreadyContacted,
        sellerReply: analysisSellerReply,
        sellerMediaUris: analysisSellerMediaUris,
      });
      setActiveAnalysisId(analysisId);
      telemetry.capture('analysis_started', { purchase_mode: purchaseMode, has_seller_context: analysisAlreadyContacted });
      return analysisId;
    } catch (reason) {
      setError(errorMessage(reason, 'L’analyse n’a pas pu démarrer.'));
      telemetry.error(reason, { operation: 'start_analysis' });
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [alreadyContacted, identification, purchaseMode, sellerMediaUris, sellerReply]);

  const loadAnalysis = useCallback(async (id: string, force = false) => {
    if (!force && reports[id]) return reports[id];
    try {
      const report = await dealupApi.getAnalysisNow(id);
      setReports((items) => ({ ...items, [report.id]: report }));
      return report;
    } catch (reason) {
      setError(errorMessage(reason, 'Cette analyse n’a pas pu être chargée.'));
      telemetry.error(reason, { operation: 'load_analysis' });
      return null;
    }
  }, [reports]);

  const completeAnalysis = useCallback(async (id: string) => {
    try {
      const report = await dealupApi.getAnalysis(id);
      setReports((items) => ({ ...items, [report.id]: report }));
      await Promise.all([loadHistory(), refreshUsage()]);
      telemetry.capture('analysis_completed', { score: report.verdict.dealScore, verdict: report.verdict.type });
      return report;
    } catch (reason) {
      telemetry.error(reason, { operation: 'complete_analysis' });
      throw reason instanceof Error ? reason : new Error('L’analyse n’a pas pu se terminer.');
    }
  }, [loadHistory, refreshUsage]);

  const retryAnalysis = useCallback(async (id: string) => {
    setError(null);
    try {
      await dealupApi.retryAnalysis(id);
      telemetry.capture('analysis_retried');
      return true;
    } catch (reason) {
      setError(errorMessage(reason, 'L’analyse n’a pas pu être relancée.'));
      telemetry.error(reason, { operation: 'retry_analysis' });
      return false;
    }
  }, []);

  const loadReplayMedia = useCallback(async (id: string) => {
    try {
      return await dealupApi.getAnalysisMedia(id);
    } catch (reason) {
      telemetry.error(reason, { operation: 'load_replay_media' });
      const report = reports[id];
      return { listing: report?.listing.thumbnailUrl ? [report.listing.thumbnailUrl] : [], seller: [] };
    }
  }, [reports]);

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
      setError(errorMessage(reason, 'La réanalyse n’a pas pu démarrer.'));
      telemetry.error(reason, { operation: 'start_reanalysis' });
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

  const clearError = useCallback(() => setError(null), []);

  const resetLocalDevelopmentState = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPersisted(initialPersisted);
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
    isReady: storageReady && authLoaded,
    isSignedIn,
    userId: userId ?? null,
    userName: user?.fullName || user?.firstName || 'Ton compte',
    userEmail: user?.primaryEmailAddress?.emailAddress ?? '',
    hasSubscription: usage.active,
    usage,
    billingProducts,
    pendingUrl,
    identification,
    purchaseMode,
    alreadyContacted,
    sellerReply,
    sellerMediaUris,
    analyses,
    reports,
    activeAnalysisId,
    isBusy,
    error,
    completeOnboarding,
    beginOnboarding,
    requestNotifications,
    deleteAccount,
    signOut,
    setPendingUrl,
    identifyListing,
    choosePlan,
    purchasePlan,
    restorePurchases,
    purchaseTopUp,
    refreshAccount,
    loadHistory,
    loadAnalysis,
    loadReplayMedia,
    setPurchaseMode,
    setSellerContext,
    startAnalysis,
    completeAnalysis,
    retryAnalysis,
    reanalyze,
    toggleChecklist,
    clearError,
    resetLocalDevelopmentState,
  }), [activeAnalysisId, alreadyContacted, analyses, authLoaded, beginOnboarding, billingProducts, choosePlan, clearError, completeAnalysis, completeOnboarding, deleteAccount, error, identification, identifyListing, isBusy, isSignedIn, loadAnalysis, loadHistory, loadReplayMedia, pendingUrl, persisted, purchaseMode, purchasePlan, purchaseTopUp, reanalyze, refreshAccount, reports, requestNotifications, resetLocalDevelopmentState, restorePurchases, retryAnalysis, sellerMediaUris, sellerReply, setSellerContext, signOut, startAnalysis, storageReady, toggleChecklist, usage, user, userId]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error('useAppStore doit être utilisé dans AppStoreProvider.');
  return value;
}
