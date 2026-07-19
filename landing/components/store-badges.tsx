"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { capturePostHogEvent } from "@/lib/posthog";
import { APP_STORE_URL } from "@/lib/site";

type Store = "app_store" | "google_play";

type StoreBadgesProps = {
  compact?: boolean;
  location: string;
  showGooglePlay?: boolean;
};

const stores = {
  app_store: {
    alt: "Télécharger dans l’App Store",
    height: 105,
    src: "/store-badges/app-store-fr.webp",
    width: 330,
  },
  google_play: {
    alt: "Disponible sur Google Play",
    height: 142,
    src: "/store-badges/google-play-fr.png",
    width: 478,
  },
} as const;

export function StoreBadges({
  compact = false,
  location,
  showGooglePlay = true,
}: StoreBadgesProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  useEffect(() => {
    if (!selectedStore) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedStore(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedStore]);

  const selectStore = (store: Store) => {
    capturePostHogEvent("store_badge_clicked", {
      cta_location: location,
      store,
      status: store === "app_store" && APP_STORE_URL ? "available" : "coming_soon",
    });

    if (store === "app_store" && APP_STORE_URL) {
      window.open(APP_STORE_URL, "_blank", "noopener,noreferrer");
      return;
    }

    setSelectedStore(store);
  };

  const visibleStores: Store[] = showGooglePlay
    ? ["app_store", "google_play"]
    : ["app_store"];

  return (
    <>
      <div className={`store-badges${compact ? " store-badges--compact" : ""}`}>
        {visibleStores.map((store) => {
          const badge = stores[store];
          const available = store === "app_store" && Boolean(APP_STORE_URL);
          return (
            <button
              aria-label={available ? badge.alt : `${badge.alt} — bientôt disponible`}
              className="store-badge"
              key={store}
              onClick={() => selectStore(store)}
              type="button"
            >
              <Image
                alt={badge.alt}
                height={badge.height}
                priority={location === "hero" || location === "header"}
                src={badge.src}
                width={badge.width}
              />
            </button>
          );
        })}
      </div>

      {selectedStore ? (
        <div
          aria-labelledby="store-modal-title"
          aria-modal="true"
          className="store-modal"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSelectedStore(null);
          }}
          role="dialog"
        >
          <div className="store-modal__panel">
            <Image
              alt=""
              className="store-modal__icon"
              height={72}
              src="/dealup-app-icon-256.webp"
              width={72}
            />
            <h2 id="store-modal-title">Bientôt disponible.</h2>
            <p>DealUp arrive bientôt.</p>
            <button onClick={() => setSelectedStore(null)} type="button">
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
