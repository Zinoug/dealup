"use client";

import { useState } from "react";
import { DeviceMockup } from "./device-mockup";

const features = [
  {
    description: "Un score, un verdict et la prochaine action à effectuer.",
    label: "Verdict clair",
    screenshot: "/screens/official/report-overview.webp",
  },
  {
    description: "Les points forts, la prochaine action utile et les contrôles à effectuer.",
    label: "Signaux et action",
    screenshot: "/screens/official/report-pricing.webp",
  },
  {
    description: "Les preuves manquantes, les risques utiles et les contrôles à réaliser.",
    label: "Vérifications",
    screenshot: "/screens/official/report-risks.webp",
  },
] as const;

export function FeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFeature = features[activeIndex];

  return (
    <div className="feature-showcase">
      <div className="feature-showcase__phone">
        <DeviceMockup
          alt={`Capture DealUp AI : ${activeFeature.label}`}
          screenshot={activeFeature.screenshot}
        />
        <div aria-label="Choisir l’écran présenté" className="feature-showcase__dots">
          {features.map((feature, index) => (
            <button
              aria-label={`Afficher l’écran ${index + 1} : ${feature.label}`}
              aria-pressed={index === activeIndex}
              className={index === activeIndex ? "is-active" : ""}
              key={feature.label}
              onClick={() => setActiveIndex(index)}
              type="button"
            />
          ))}
        </div>
      </div>

      <div aria-label="Fonctionnalités du rapport" className="feature-showcase__tabs" role="tablist">
        {features.map((feature, index) => {
          const active = index === activeIndex;
          return (
            <button
              aria-selected={active}
              className={active ? "is-active" : ""}
              key={feature.label}
              onClick={() => setActiveIndex(index)}
              role="tab"
              type="button"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{feature.label}</strong>
                <p>{feature.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
