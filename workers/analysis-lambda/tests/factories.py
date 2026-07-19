def candidate_payload(
    *,
    category: str = "IPHONE",
    score: int = 88,
    risk_code: str | None = None,
    risk_status: str = "UNVERIFIED",
    risk_severity: str = "HIGH",
    invalid_pricing: bool = False,
    sensitive_commentary: bool = False,
) -> dict:
    del category
    risks = []
    if risk_code:
        risks.append(
            {
                "code": risk_code,
                "status": risk_status,
                "severity": risk_severity,
                "title": "Point à contrôler",
                "comment": (
                    "La religion supposée du vendeur serait un risque."
                    if sensitive_commentary
                    else "Les éléments disponibles ne permettent pas encore de confirmer ce point."
                ),
                "check": "Demander une preuve claire avant le paiement.",
                "evidence": ["DESCRIPTION"],
            }
        )
    market_low = 650
    market_mid = 700
    market_high = 760
    fair = 700
    if invalid_pricing:
        market_low, market_high, fair = 760, 650, 900
    dimension = {
        "value": score,
        "reason": "Évaluation fondée sur les éléments visibles et déclarés.",
    }
    return {
        "confidence": "HIGH",
        "headline": "Une annonce à considérer avec méthode",
        "summary": "Les preuves visibles sont cohérentes, sous réserve des contrôles indiqués dans le rapport.",
        "scores": {
            "price": dimension,
            "condition": dimension,
            "proofs": dimension,
            "consistency": dimension,
            "transaction": dimension,
        },
        "pricing": {
            "market_low": market_low,
            "market_mid": market_mid,
            "market_high": market_high,
            "fair_price": fair,
            "first_offer": 650,
            "agreement_low": 670,
            "agreement_high": 700,
            "maximum": 720,
            "confidence": "HIGH",
            "comment": "La configuration et l’état apparent ont été pris en compte.",
        },
        "risks": risks,
        "positive_signals": [
            {
                "code": "PRICE_PLAUSIBLE",
                "label": "Le prix reste plausible pour le marché observé.",
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
        "action_reason": "Les contrôles sur place restent la prochaine étape utile.",
        "messages": {
            "request_proofs": "Bonjour, pouvez-vous envoyer une preuve d’achat ?",
            "make_offer": "Bonjour, je vous propose 680 € sous réserve des vérifications.",
        },
        "changes": [],
    }


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
