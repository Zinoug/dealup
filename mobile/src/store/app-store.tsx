import { useAuth, useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { resetInAppReviewRequestForDevelopment } from '@/services/app-review';
import { dealupApi } from '@/services/dealup-api';
import {
  enableDailyReminder,
  forgetRegisteredPushDeviceId,
  getExpoPushTokenIfAuthorized,
  getRegisteredPushDeviceId,
  rememberRegisteredPushDeviceId,
} from '@/services/notifications';
import { revenueCat, type BillingProducts, type TopUpQuantity } from '@/services/revenuecat';
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

type ListingSubmissionSource = 'manual' | 'share_extension';
type IdentifyListingResult = ListingTeaser | 'PAYWALL_REQUIRED' | null;

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
  identifyListing: (url: string, source?: ListingSubmissionSource) => Promise<IdentifyListingResult>;
  openIdentification: (id: string) => Promise<ListingTeaser | null>;
  choosePlan: (plan: PlanId) => void;
  purchasePlan: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  purchaseTopUp: (quantity: TopUpQuantity) => Promise<boolean>;
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
  includedRemaining: 0,
  topUpRemaining: 0,
  renewsLabel: 'Aucune formule active',
};

const emptyProducts: BillingProducts = { weekly: null, monthly: null, topUp15: null, topUp40: null };
const AppStoreContext = createContext<AppState | null>(null);

function errorMessage(reason: unknown, fallback: string): string {
  if (typeof reason === 'object' && reason && 'userCancelled' in reason && reason.userCancelled) return '';
  return reason instanceof Error ? reason.message : fallback;
}

function errorCode(reason: unknown): string {
  if (typeof reason === 'object' && reason && 'code' in reason && typeof reason.code === 'string') return reason.code;
  return 'UNKNOWN_ERROR';
}

function isPurchaseCancelled(reason: unknown): boolean {
  return Boolean(typeof reason === 'object' && reason && 'userCancelled' in reason && reason.userCancelled);
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
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? '';

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
      const [completed, pending] = await Promise.all([
        dealupApi.listAnalyses(),
        dealupApi.listPendingIdentifications(),
      ]);
      setAnalyses([...completed, ...pending].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    } catch (reason) {
      telemetry.error(reason, { operation: 'load_history' });
      setError(errorMessage(reason, 'Ton historique n’a pas pu être chargé.'));
    }
  }, [isSignedIn]);

  const refreshUsage = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const nextUsage = await dealupApi.getUsage();
      setUsage(nextUsage);
      telemetry.setPersonProperties({
        plan: nextUsage.plan,
        subscription_active: nextUsage.active,
        quota_limit: nextUsage.limit,
        quota_used: nextUsage.used,
        quota_remaining: nextUsage.includedRemaining + nextUsage.topUpRemaining,
        topup_remaining: nextUsage.topUpRemaining,
      });
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
        subscription_active: account.usage.active,
        quota_limit: account.usage.limit,
        quota_used: account.usage.used,
        quota_remaining: account.usage.includedRemaining + account.usage.topUpRemaining,
        topup_remaining: account.usage.topUpRemaining,
        onboarding_completed: persisted.onboardingComplete,
        account_created_at: account.createdAt,
      });
    } catch (reason) {
      telemetry.error(reason, { operation: 'load_account' });
      await refreshUsage();
    }
    await history;
  }, [isSignedIn, loadHistory, persisted.onboardingComplete, refreshUsage]);

  const syncPushDeviceRegistration = useCallback(async () => {
    if (!isSignedIn) return;
    const pushToken = await getExpoPushTokenIfAuthorized();
    if (!pushToken) return;
    const previousDeviceId = await getRegisteredPushDeviceId();
    const authToken = await getToken();
    const device = await dealupApi.registerPushDevice(pushToken, authToken ?? undefined);
    await rememberRegisteredPushDeviceId(device.id);
    if (previousDeviceId && previousDeviceId !== device.id) {
      await dealupApi.deletePushDevice(previousDeviceId, authToken ?? undefined).catch(() => undefined);
    }
  }, [getToken, isSignedIn]);

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
    revenueCat.initialize(userId, userEmail)
      .then(({ products }) => { if (active) setBillingProducts(products); })
      .catch((reason) => telemetry.error(reason, { operation: 'initialize_revenuecat' }));
    void Promise.resolve().then(refreshAccount);
    void syncPushDeviceRegistration().catch((reason) => {
      telemetry.error(reason, { operation: 'register_push_device' });
    });
    return () => { active = false; };
  }, [isSignedIn, refreshAccount, syncPushDeviceRegistration, userEmail, userId]);

  const completeOnboarding = useCallback(() => {
    telemetry.capture('onboarding_completed');
    telemetry.setPersonProperties({ onboarding_completed: true });
    setPersisted((state) => ({ ...state, onboardingComplete: true }));
  }, []);

  const beginOnboarding = useCallback(() => {
    setPersisted((state) => ({ ...state, onboardingComplete: false }));
  }, []);

  const requestNotifications = useCallback(async () => {
    try {
      const result = await enableDailyReminder();
      if (result === 'enabled') await syncPushDeviceRegistration();
      telemetry.capture('notification_permission_finished', { result });
      return result;
    } catch (reason) {
      telemetry.error(reason, { operation: 'enable_notifications' });
      return 'unavailable' as const;
    }
  }, [syncPushDeviceRegistration]);

  const signOut = useCallback(async () => {
    setIsBusy(true);
    try {
      const deviceId = await getRegisteredPushDeviceId();
      if (deviceId) {
        await dealupApi.deletePushDevice(deviceId).catch((reason) => {
          telemetry.error(reason, { operation: 'unregister_push_device' });
        });
        await forgetRegisteredPushDeviceId();
      }
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
      await forgetRegisteredPushDeviceId();
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

  const identifyListing = useCallback(async (url: string, source: ListingSubmissionSource = 'manual') => {
    setIsBusy(true);
    setError(null);
    telemetry.capture('listing_url_submitted', { source });
    try {
      // A share extension can cold-open the app while Clerk is still restoring its
      // session. Fetch and pass the token explicitly so the identification cannot
      // race the global API token provider effect.
      let token = await getToken();
      for (let attempt = 0; !token && attempt < 4; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getToken();
      }
      if (!token) throw new Error('Ta session est en cours de restauration. Réessaie dans un instant.');
      const listing = await dealupApi.identify(url, token);
      setIdentification(listing);
      setPendingUrl(null);
      await loadHistory();
      const compatibilityStatus = listing.compatibility?.status ?? 'UNKNOWN';
      const deviceCategory = listing.compatibility?.device?.category ?? null;
      telemetry.capture('listing_identified', {
        source,
        compatibility_status: compatibilityStatus,
        device_category: deviceCategory,
        photo_count: listing.photoCount,
      });
      if (compatibilityStatus !== 'SUPPORTED') {
        telemetry.capture('listing_incompatible', {
          source,
          compatibility_status: compatibilityStatus,
          device_category: deviceCategory,
        });
      }
      return listing;
    } catch (reason) {
      if (errorCode(reason) === 'FREE_IDENTIFICATION_LIMIT_REACHED') {
        setIdentification(null);
        setPendingUrl(url);
        telemetry.capture('paywall_required_after_identification_limit', { source });
        return 'PAYWALL_REQUIRED';
      }
      setError(errorMessage(reason, 'Cette annonce n’a pas pu être identifiée.'));
      telemetry.capture('listing_identification_failed', { source, error_code: errorCode(reason) });
      telemetry.error(reason, { operation: 'identify_listing' });
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [getToken, loadHistory]);

  const openIdentification = useCallback(async (id: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const listing = await dealupApi.getIdentification(id);
      setIdentification(listing);
      setPurchaseMode(null);
      setAlreadyContacted(false);
      setSellerReply('');
      setSellerMediaUris([]);
      return listing;
    } catch (reason) {
      setError(errorMessage(reason, 'Cette annonce n’a pas pu être chargée.'));
      telemetry.error(reason, { operation: 'open_identification' });
      return null;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const choosePlan = useCallback((plan: PlanId) => {
    telemetry.capture('paywall_plan_selected', { plan });
    setPersisted((state) => ({ ...state, selectedPlan: plan }));
  }, []);

  const purchasePlan = useCallback(async () => {
    if (!userId) return false;
    setIsBusy(true);
    setError(null);
    telemetry.capture('purchase_started', { plan: persisted.selectedPlan, product_type: 'subscription' });
    try {
      await revenueCat.purchasePlan(userId, persisted.selectedPlan);
      await refreshAccount();
      telemetry.capture('purchase_completed', { plan: persisted.selectedPlan, product_type: 'subscription' });
      return true;
    } catch (reason) {
      const message = errorMessage(reason, 'L’achat n’a pas pu être finalisé.');
      if (message) setError(message);
      if (isPurchaseCancelled(reason)) {
        telemetry.capture('purchase_cancelled', { plan: persisted.selectedPlan, product_type: 'subscription' });
      } else {
        telemetry.capture('purchase_failed', { plan: persisted.selectedPlan, product_type: 'subscription', error_code: errorCode(reason) });
        telemetry.error(reason, { operation: 'purchase_plan' });
      }
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

  const purchaseTopUp = useCallback(async (quantity: TopUpQuantity) => {
    if (!userId) return false;
    setIsBusy(true);
    setError(null);
    try {
      const previousBalance = usage.topUpRemaining;
      telemetry.capture('purchase_started', { product_type: 'top_up', quantity });
      await revenueCat.purchaseTopUp(userId, quantity);
      let synchronizedUsage: Usage | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await dealupApi.syncBilling();
        synchronizedUsage = await dealupApi.getUsage();
        setUsage(synchronizedUsage);
        if (synchronizedUsage.topUpRemaining >= previousBalance + quantity) break;
        await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
      }
      if (!synchronizedUsage || synchronizedUsage.topUpRemaining < previousBalance + quantity) {
        setError('Ton achat est validé. Le solde est encore en cours de synchronisation. Réessaie dans un instant.');
        telemetry.capture('topup_sync_pending', { quantity });
        return false;
      }
      telemetry.capture('topup_purchased', { quantity });
      return true;
    } catch (reason) {
      const message = errorMessage(reason, 'Le pack n’a pas pu être ajouté.');
      if (message) setError(message);
      if (isPurchaseCancelled(reason)) {
        telemetry.capture('purchase_cancelled', { product_type: 'top_up', quantity });
      } else {
        telemetry.capture('purchase_failed', { product_type: 'top_up', quantity, error_code: errorCode(reason) });
        telemetry.error(reason, { operation: 'purchase_topup', quantity });
      }
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [usage.topUpRemaining, userId]);

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
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY),
      resetInAppReviewRequestForDevelopment(),
    ]);
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
    userEmail,
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
    openIdentification,
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
  }), [activeAnalysisId, alreadyContacted, analyses, authLoaded, beginOnboarding, billingProducts, choosePlan, clearError, completeAnalysis, completeOnboarding, deleteAccount, error, identification, identifyListing, isBusy, isSignedIn, loadAnalysis, loadHistory, loadReplayMedia, openIdentification, pendingUrl, persisted, purchaseMode, purchasePlan, purchaseTopUp, reanalyze, refreshAccount, reports, requestNotifications, resetLocalDevelopmentState, restorePurchases, retryAnalysis, sellerMediaUris, sellerReply, setSellerContext, signOut, startAnalysis, storageReady, toggleChecklist, usage, user, userEmail, userId]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error('useAppStore doit être utilisé dans AppStoreProvider.');
  return value;
}
