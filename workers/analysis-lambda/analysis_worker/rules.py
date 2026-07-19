"""Worker-owned deterministic analysis rules."""

from typing import Any


REPORT_SCHEMA_VERSION = "2.0"

SCORE_WEIGHTS = {
    "price": 0.25,
    "condition": 0.20,
    "proofs": 0.25,
    "consistency": 0.15,
    "transaction": 0.15,
}

SCORE_CAPS = {
    "confirmed_critical": 29,
    "blocking_unresolved": 59,
    "two_high_unresolved": 64,
}

COMMON_RISKS: dict[str, dict[str, Any]] = {
    "PRICE_ANOMALY_LOW": {"title": "Prix anormalement bas", "blocking": True},
    "PRICE_ABOVE_MARKET": {"title": "Prix supérieur au marché", "blocking": False},
    "LISTING_INCONSISTENCY": {"title": "Incohérence dans l’annonce", "blocking": False},
    "PHOTO_INCONSISTENCY": {"title": "Photos incohérentes", "blocking": True},
    "PRODUCT_IDENTITY_UNCLEAR": {
        "title": "Identité du produit incertaine",
        "blocking": True,
    },
    "OWNERSHIP_PROOF_UNVERIFIED": {
        "title": "Preuve d’achat non vérifiée",
        "blocking": True,
    },
    "CONDITION_NOT_VERIFIED": {
        "title": "État non suffisamment vérifié",
        "blocking": False,
    },
    "REPAIR_HISTORY_UNVERIFIED": {
        "title": "Historique de réparation non vérifié",
        "blocking": False,
    },
    "WARRANTY_CLAIM_UNVERIFIED": {
        "title": "Garantie annoncée non vérifiée",
        "blocking": False,
    },
    "SELLER_HISTORY_LIMITED": {"title": "Historique vendeur limité", "blocking": False},
    "PAYMENT_OUTSIDE_PLATFORM": {
        "title": "Paiement demandé hors plateforme",
        "blocking": True,
    },
    "ADVANCE_PAYMENT_REQUESTED": {
        "title": "Acompte demandé avant vérification",
        "blocking": True,
    },
    "MEETING_REFUSED": {"title": "Remise en main propre refusée", "blocking": True},
    "DELIVERY_PRESSURE": {
        "title": "Pression pour une livraison rapide",
        "blocking": True,
    },
    "COMMUNICATION_INCONSISTENT": {
        "title": "Réponses vendeur incohérentes",
        "blocking": False,
    },
    "OTHER": {"title": "Autre point à vérifier", "blocking": False},
}

IPHONE_RISKS: dict[str, dict[str, Any]] = {
    "BATTERY_HEALTH_UNVERIFIED": {
        "title": "État de batterie non vérifié",
        "blocking": False,
    },
    "BATTERY_SERVICE_RECOMMENDED": {
        "title": "Batterie à remplacer prochainement",
        "blocking": False,
    },
    "PARTS_HISTORY_UNVERIFIED": {
        "title": "Historique des pièces non vérifié",
        "blocking": False,
    },
    "UNKNOWN_PART_WARNING": {"title": "Pièce inconnue signalée", "blocking": True},
    "FACE_ID_UNVERIFIED": {"title": "Face ID non vérifié", "blocking": False},
    "ACTIVATION_LOCK_UNVERIFIED": {
        "title": "Verrouillage d’activation non vérifié",
        "blocking": True,
    },
    "IMEI_STATUS_UNVERIFIED": {"title": "Statut IMEI non vérifié", "blocking": True},
    "CARRIER_LOCK_UNVERIFIED": {
        "title": "Verrouillage opérateur non vérifié",
        "blocking": False,
    },
    "MODEL_REGION_MISMATCH": {
        "title": "Variante régionale à confirmer",
        "blocking": False,
    },
    "STORAGE_MISMATCH": {"title": "Stockage incohérent", "blocking": True},
    "COLOR_MISMATCH": {"title": "Couleur incohérente", "blocking": False},
}

MACBOOK_RISKS: dict[str, dict[str, Any]] = {
    "BATTERY_CYCLES_UNVERIFIED": {
        "title": "Cycles de batterie non vérifiés",
        "blocking": False,
    },
    "BATTERY_CONDITION_WARNING": {
        "title": "État de batterie préoccupant",
        "blocking": False,
    },
    "ACTIVATION_LOCK_UNVERIFIED": {
        "title": "Verrouillage d’activation non vérifié",
        "blocking": True,
    },
    "MDM_ENROLLMENT_UNVERIFIED": {
        "title": "Gestion d’entreprise MDM non vérifiée",
        "blocking": True,
    },
    "SYSTEM_SPECS_MISMATCH": {
        "title": "Caractéristiques système incohérentes",
        "blocking": True,
    },
    "DISPLAY_CONDITION_UNVERIFIED": {
        "title": "État de l’écran non vérifié",
        "blocking": False,
    },
    "KEYBOARD_TRACKPAD_UNVERIFIED": {
        "title": "Clavier et trackpad non vérifiés",
        "blocking": False,
    },
    "PORTS_CHARGING_UNVERIFIED": {
        "title": "Ports et charge non vérifiés",
        "blocking": False,
    },
    "CHARGER_UNVERIFIED": {"title": "Chargeur non vérifié", "blocking": False},
    "LIQUID_DAMAGE_RISK": {"title": "Risque de dommage liquide", "blocking": True},
    "SERIAL_MODEL_MISMATCH": {
        "title": "Numéro de série ou modèle incohérent",
        "blocking": True,
    },
}

COMMON_POSITIVE_CODES = {
    "MATCHING_PHOTO_SET",
    "PRICE_PLAUSIBLE",
    "DETAILED_LISTING",
    "SELLER_HISTORY_AVAILABLE",
    "PROOF_OF_PURCHASE_PROVIDED",
    "SERIAL_DETAILS_PROVIDED",
    "SAFE_PAYMENT_METHOD",
    "IN_PERSON_MEETING_ACCEPTED",
}
IPHONE_POSITIVE_CODES = {
    "BATTERY_SCREEN_VISIBLE",
    "PARTS_HISTORY_VISIBLE",
    "DEVICE_RESET_SCREEN_VISIBLE",
    "MODEL_DETAILS_CONSISTENT",
}
MACBOOK_POSITIVE_CODES = {
    "SYSTEM_INFORMATION_VISIBLE",
    "BATTERY_CYCLES_VISIBLE",
    "SERIAL_DETAILS_CONSISTENT",
    "APPLE_DIAGNOSTICS_PASSED",
    "ORIGINAL_CHARGER_INCLUDED",
}

COMMON_MISSING_CODES = {
    "PROOF_OF_PURCHASE",
    "PARTIAL_SERIAL",
    "DEVICE_CONDITION",
    "REPAIR_HISTORY",
    "WARRANTY_DETAILS",
    "SAFE_TRANSACTION_METHOD",
    "ACCESSORIES_INCLUDED",
}
IPHONE_MISSING_CODES = {
    "BATTERY_HEALTH",
    "BATTERY_CYCLES",
    "ACTIVATION_LOCK_STATUS",
    "IMEI_PARTIAL",
    "PARTS_AND_SERVICE_HISTORY",
    "CARRIER_LOCK_STATUS",
}
MACBOOK_MISSING_CODES = {
    "BATTERY_CYCLES",
    "ACTIVATION_LOCK_STATUS",
    "MDM_STATUS",
    "SYSTEM_SPECS",
    "SERIAL_PARTIAL",
    "CHARGER_DETAILS",
}

CHECKLISTS: dict[str, dict[str, list[dict[str, Any]]]] = {
    "IPHONE": {
        "before_meeting": [
            {
                "code": "CONFIRM_SAFE_TRANSACTION",
                "label": "Confirmer un rendez-vous ou un paiement sécurisé",
                "critical": True,
            },
            {
                "code": "NO_ADVANCE_PAYMENT",
                "label": "Ne verser aucun acompte avant vérification",
                "critical": True,
            },
            {
                "code": "REQUEST_PROOF_OF_PURCHASE",
                "label": "Demander la preuve d’achat",
                "critical": True,
            },
        ],
        "during_meeting": [
            {
                "code": "IPHONE_CHECK_ACTIVATION_LOCK",
                "label": "Vérifier que Localiser et le verrouillage d’activation sont désactivés",
                "critical": True,
            },
            {
                "code": "IPHONE_CHECK_BATTERY",
                "label": "Contrôler la santé et les cycles de batterie",
                "critical": True,
            },
            {
                "code": "IPHONE_CHECK_PARTS",
                "label": "Ouvrir l’historique des pièces et réparations",
                "critical": True,
            },
            {
                "code": "IPHONE_TEST_FACE_ID",
                "label": "Configurer et tester Face ID",
                "critical": True,
            },
            {
                "code": "IPHONE_TEST_DISPLAY",
                "label": "Tester l’écran, le tactile et la luminosité",
                "critical": True,
            },
            {
                "code": "IPHONE_TEST_CAMERAS_AUDIO",
                "label": "Tester les caméras, micros et haut-parleurs",
                "critical": False,
            },
        ],
        "before_payment": [
            {
                "code": "WITNESS_SIGN_OUT_AND_ERASE",
                "label": "Voir le vendeur se déconnecter puis effacer l’appareil",
                "critical": True,
            },
            {
                "code": "ACTIVATE_AS_BUYER",
                "label": "Commencer l’activation avec ton propre compte",
                "critical": True,
            },
            {
                "code": "KEEP_SALE_PROOF",
                "label": "Conserver une preuve écrite de la vente",
                "critical": False,
            },
        ],
    },
    "MACBOOK": {
        "before_meeting": [
            {
                "code": "CONFIRM_SAFE_TRANSACTION",
                "label": "Confirmer un rendez-vous ou un paiement sécurisé",
                "critical": True,
            },
            {
                "code": "NO_ADVANCE_PAYMENT",
                "label": "Ne verser aucun acompte avant vérification",
                "critical": True,
            },
            {
                "code": "REQUEST_PROOF_OF_PURCHASE",
                "label": "Demander la preuve d’achat",
                "critical": True,
            },
        ],
        "during_meeting": [
            {
                "code": "MACBOOK_MATCH_SERIAL_SPECS",
                "label": "Comparer le numéro de série, la puce, la RAM et le stockage",
                "critical": True,
            },
            {
                "code": "MACBOOK_CHECK_ACTIVATION_LOCK",
                "label": "Vérifier Activation Lock et Localiser",
                "critical": True,
            },
            {
                "code": "MACBOOK_CHECK_MDM",
                "label": "Vérifier l’absence de gestion MDM",
                "critical": True,
            },
            {
                "code": "MACBOOK_CHECK_BATTERY",
                "label": "Contrôler l’état et les cycles de batterie",
                "critical": True,
            },
            {
                "code": "MACBOOK_TEST_DISPLAY_INPUTS",
                "label": "Tester écran, clavier et trackpad",
                "critical": True,
            },
            {
                "code": "MACBOOK_TEST_PORTS_CHARGING",
                "label": "Tester tous les ports et la charge",
                "critical": False,
            },
        ],
        "before_payment": [
            {
                "code": "WITNESS_SIGN_OUT_AND_ERASE",
                "label": "Voir le vendeur se déconnecter puis effacer l’appareil",
                "critical": True,
            },
            {
                "code": "ACTIVATE_AS_BUYER",
                "label": "Commencer l’activation avec ton propre compte",
                "critical": True,
            },
            {
                "code": "KEEP_SALE_PROOF",
                "label": "Conserver une preuve écrite de la vente",
                "critical": False,
            },
        ],
    },
}


def risk_catalog(category: str) -> dict[str, dict[str, Any]]:
    return {**COMMON_RISKS, **(IPHONE_RISKS if category == "IPHONE" else MACBOOK_RISKS)}


def positive_codes(category: str) -> set[str]:
    return COMMON_POSITIVE_CODES | (
        IPHONE_POSITIVE_CODES if category == "IPHONE" else MACBOOK_POSITIVE_CODES
    )


def missing_codes(category: str) -> set[str]:
    return COMMON_MISSING_CODES | (
        IPHONE_MISSING_CODES if category == "IPHONE" else MACBOOK_MISSING_CODES
    )
