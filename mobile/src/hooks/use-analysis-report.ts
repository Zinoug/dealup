import { useEffect, useMemo, useState } from 'react';

import { reportFixtures } from '@/data/dev-report-fixtures';
import { runtime } from '@/services/runtime';
import { useAppStore } from '@/store/app-store';
import type { AnalysisResult } from '@/types/domain';

export function useAnalysisReport(id?: string) {
  const { reports, loadAnalysis } = useAppStore();
  const fixture = useMemo(
    () => runtime.devTools ? Object.values(reportFixtures).find((item) => item.id === id) : undefined,
    [id],
  );
  const [failedId, setFailedId] = useState<string | null>(null);
  const report = (id ? reports[id] : undefined) ?? fixture as AnalysisResult | undefined;

  useEffect(() => {
    if (!id || reports[id] || fixture) return;
    let active = true;
    loadAnalysis(id)
      .then((result) => { if (active && !result) setFailedId(id); });
    return () => { active = false; };
  }, [fixture, id, loadAnalysis, reports]);

  return {
    report,
    loading: Boolean(id && !report && failedId !== id),
    loadError: Boolean(id && failedId === id),
  };
}
