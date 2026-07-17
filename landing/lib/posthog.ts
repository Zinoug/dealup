type EventProperties = Record<string, string | number | boolean | null | undefined>;

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const host =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

let initialization: Promise<typeof import("posthog-js").default | null> | null = null;

async function getPostHog() {
  if (typeof window === "undefined" || !key) {
    return null;
  }

  if (!initialization) {
    initialization = import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(key, {
          api_host: host,
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: true,
          persistence: "localStorage+cookie",
        });
        return posthog;
      })
      .catch(() => null);
  }

  return initialization;
}

export function capturePostHogEvent(
  event: string,
  properties: EventProperties = {},
) {
  void getPostHog().then((posthog) => {
    posthog?.capture(event, {
      event_source: "landing",
      page_path: window.location.pathname,
      ...properties,
    });
  });
}

