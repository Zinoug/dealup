"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type CategoryCode = "iphone" | "macbook";

const categories = {
  iphone: {
    image: "/devices/iphone-family-apple.webp",
    name: "iPhone",
    summary: "iPhone 11 et générations suivantes",
    supported: [
      "iPhone 11, 11 Pro et 11 Pro Max",
      "Gammes iPhone 12 et iPhone 13",
      "iPhone SE 2 et iPhone SE 3",
      "iPhone 14 et générations suivantes",
    ],
  },
  macbook: {
    image: "/devices/macbook-family-apple.webp",
    name: "MacBook",
    summary: "MacBook Air et Pro avec puce Apple",
    supported: [
      "MacBook Air avec puce Apple M1 ou plus récente",
      "MacBook Pro 13 pouces Apple Silicon",
      "MacBook Pro 14 et 16 pouces Apple Silicon",
    ],
  },
} as const;

export function DeviceCategories() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryCode | null>(null);
  const selected = selectedCategory ? categories[selectedCategory] : null;

  useEffect(() => {
    if (!selectedCategory) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCategory(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCategory]);

  return (
    <>
      <div className="device-categories">
        {(Object.entries(categories) as [CategoryCode, (typeof categories)[CategoryCode]][]).map(
          ([code, category]) => (
            <button
              aria-label={`Voir les ${category.name} compatibles`}
              className="device-category"
              key={code}
              onClick={() => setSelectedCategory(code)}
              type="button"
            >
              <span className="device-category__visual">
                <Image
                  alt={`Gamme ${category.name}`}
                  fill
                  sizes="(max-width: 760px) 100vw, 50vw"
                  src={category.image}
                />
              </span>
              <span className="device-category__copy">
                <strong>{category.name}</strong>
                <small>{category.summary}</small>
                <span>Voir les modèles</span>
              </span>
            </button>
          ),
        )}
      </div>

      {selected ? (
        <div
          aria-labelledby="device-modal-title"
          aria-modal="true"
          className="device-modal"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSelectedCategory(null);
          }}
          role="dialog"
        >
          <div className="device-modal__panel">
            <div className="device-modal__heading">
              <div>
                <span>Appareils compatibles</span>
                <h2 id="device-modal-title">{selected.name}</h2>
              </div>
              <button
                aria-label="Fermer la modale"
                onClick={() => setSelectedCategory(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <ul>
              {selected.supported.map((device) => <li key={device}>{device}</li>)}
            </ul>
            <p>Les appareils non reconnus sont refusés avant le paiement.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
