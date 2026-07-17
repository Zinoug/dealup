"use client";

import { capturePostHogEvent } from "@/lib/posthog";
import { useEffect } from "react";

type PageViewProps = {
  page: string;
};

export function PageView({ page }: PageViewProps) {
  useEffect(() => {
    capturePostHogEvent("landing_page_viewed", { page });
  }, [page]);

  return null;
}
