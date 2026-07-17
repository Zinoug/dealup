from analysis_worker.schemas import GeminiCandidateV2


def candidate_payload(
    *,
    category: str = "IPHONE",
    score: int = 88,
    risk_code: str | None = None,
    risk_status: str = "UNVERIFIED",
    risk_severity: str = "HIGH",
    invalid_pricing: bool = False,
    sensitive_commentary: bool = False,
) -> GeminiCandidateV2:
    is_mac = category == "MACBOOK"
    risks = []
    if risk_code:
        risks.append(
            {
                "code": risk_code,
                "status": risk_status,
                "severity": risk_severity,
                "evidence_refs": [
                    {"source_type": "LISTING_TEXT", "ref": "listing_text"}
                ],
                "generated_content": {
                    "display_title": "Point à contrôler",
                    "commentary": (
                        "La religion supposée du vendeur serait un risque."
                        if sensitive_commentary
                        else "Les éléments disponibles ne permettent pas encore de confirmer ce point."
                    ),
                    "recommended_check": "Demander une preuve claire avant le paiement.",
                },
            }
        )
    market_low = 65000
    market_median = 70000
    market_high = 76000
    fair = 70000
    if invalid_pricing:
        market_low, market_high, fair = 76000, 65000, 90000
    dimension = {
        "score": score,
        "rationale": "Évaluation fondée sur les éléments visibles et déclarés.",
        "evidence_refs": [{"source_type": "LISTING_TEXT", "ref": "listing_text"}],
    }
    return GeminiCandidateV2.model_validate(
        {
            "schema_version": "2.0",
            "device_identity": {
                "category": category,
                "profile_code": "MACBOOK_AIR_M2" if is_mac else "IPHONE_15_PRO",
                "display_name": "MacBook Air M2" if is_mac else "iPhone 15 Pro",
                "specs": {"chip": "M2"} if is_mac else {"storage": "256 Go"},
                "confidence": "HIGH",
            },
            "verdict_candidate": "BUY",
            "confidence": "HIGH",
            "headline": "Une annonce à considérer avec méthode",
            "summary": "Les preuves visibles sont cohérentes, sous réserve des contrôles indiqués dans le rapport.",
            "score_breakdown": {
                "PRICE_VALUE": dimension,
                "CONDITION": dimension,
                "PROOFS_OWNERSHIP": dimension,
                "LISTING_CONSISTENCY": dimension,
                "TRANSACTION_SAFETY": dimension,
            },
            "observations": [],
            "pricing": {
                "currency": "EUR",
                "asking_price_cents": 72000,
                "market_low_cents": market_low,
                "market_median_cents": market_median,
                "market_high_cents": market_high,
                "fair_price_cents": fair,
                "opening_offer_cents": 65000,
                "agreement_zone_low_cents": 67000,
                "agreement_zone_high_cents": 70000,
                "max_recommended_cents": 72000,
                "confidence": "HIGH",
                "commentary": "La configuration et l’état apparent ont été pris en compte.",
            },
            "risks": risks,
            "positive_signals": [
                {
                    "code": "PRICE_PLAUSIBLE",
                    "label": "Le prix reste plausible pour le marché observé.",
                    "evidence_refs": [
                        {"source_type": "WEB_MARKET", "ref": "web_market"}
                    ],
                }
            ],
            "missing_information": [
                {
                    "code": "PROOF_OF_PURCHASE",
                    "priority": "USEFUL",
                    "label": "Preuve d’achat",
                    "question": "Pouvez-vous transmettre une preuve d’achat en masquant vos données ?",
                }
            ],
            "primary_action_candidate": {
                "type": "START_CHECKLIST",
                "reason": "Les contrôles sur place restent la prochaine étape utile.",
            },
            "messages": {
                "request_proofs": "Bonjour, pouvez-vous envoyer une preuve d’achat ?",
                "make_offer": "Bonjour, je vous propose 680 € sous réserve des vérifications.",
                "decline": "Merci, je préfère ne pas donner suite.",
            },
            "checklist_selection": {
                "before_meeting": ["REQUEST_PROOF_OF_PURCHASE"],
                "during_meeting": [
                    "MACBOOK_CHECK_MDM" if is_mac else "IPHONE_CHECK_BATTERY"
                ],
                "before_payment": ["KEEP_SALE_PROOF"],
            },
            "available_actions": [
                "REQUEST_PROOFS",
                "MAKE_OFFER",
                "START_CHECKLIST",
                "COMPARE_ANOTHER",
            ],
            "expert_note": "Les textes restent personnalisés sans modifier les règles déterministes.",
            "change_summary": [],
        }
    )


def normalized_listing(category: str = "IPHONE") -> dict:
    return {
        "title": "MacBook Air M2 16 Go"
        if category == "MACBOOK"
        else "iPhone 15 Pro 256 Go",
        "asking_price_cents": 72000,
        "currency": "EUR",
        "location": {"city": "Paris", "postal_code": "75011"},
        "photos": [],
    }


def device_profile(category: str = "IPHONE") -> dict:
    return {
        "category": category,
        "profile_code": "MACBOOK_AIR_M2" if category == "MACBOOK" else "IPHONE_15_PRO",
        "display_name": "MacBook Air M2" if category == "MACBOOK" else "iPhone 15 Pro",
        "specs": {"chip": "M2"} if category == "MACBOOK" else {"storage": "256 Go"},
        "catalog_version": "1.0",
    }
