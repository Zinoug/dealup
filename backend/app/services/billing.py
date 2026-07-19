import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import DealUpError
from app.integrations import RevenueCatClient
from app.models import (
    RevenueCatEvent,
    SubscriptionPlan,
    SubscriptionStatus,
    UsageEvent,
    UsageEventKind,
    User,
)
from app.repositories import BillingRepository, UsageRepository, UserRepository
from app.schemas.api import BillingSyncResponse
from app.services.usage import UsageService


def _from_ms(value: Any) -> datetime | None:
    if not isinstance(value, (int, float)):
        return None
    return datetime.fromtimestamp(value / 1000, timezone.utc)


def _from_iso(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class BillingService:
    def __init__(
        self, session: Session, settings: Settings, client: RevenueCatClient
    ) -> None:
        self.session = session
        self.settings = settings
        self.client = client
        self.repo = BillingRepository(session)
        self.users = UserRepository(session)
        self.usage = UsageRepository(session)

    def _plan(self, product_id: str | None) -> SubscriptionPlan:
        if product_id == self.settings.revenuecat_weekly_product_id:
            return SubscriptionPlan.WEEKLY
        if product_id == self.settings.revenuecat_monthly_product_id:
            return SubscriptionPlan.MONTHLY
        return SubscriptionPlan.NONE

    def verify_webhook(
        self,
        raw_body: bytes,
        authorization: str | None,
        signature_header: str | None,
    ) -> None:
        expected = self.settings.revenuecat_webhook_authorization
        if expected and not hmac.compare_digest(authorization or "", expected):
            raise DealUpError("WEBHOOK_UNAUTHORIZED", "Webhook non autorisé.", 401)
        secret = self.settings.revenuecat_webhook_hmac_secret
        if not secret:
            return
        try:
            parts = dict(
                part.split("=", 1) for part in (signature_header or "").split(",")
            )
            timestamp, received = parts["t"], parts["v1"]
            age = abs(datetime.now(timezone.utc).timestamp() - int(timestamp))
        except (KeyError, ValueError) as exc:
            raise DealUpError(
                "WEBHOOK_UNAUTHORIZED", "Signature invalide.", 401
            ) from exc
        if age > 300:
            raise DealUpError("WEBHOOK_UNAUTHORIZED", "Signature expirée.", 401)
        signed = timestamp.encode() + b"." + raw_body
        computed = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(computed, received):
            raise DealUpError("WEBHOOK_UNAUTHORIZED", "Signature invalide.", 401)

    def process_webhook(self, payload: dict[str, Any]) -> None:
        event = payload.get("event")
        if not isinstance(event, dict):
            raise DealUpError("INVALID_WEBHOOK", "Événement RevenueCat invalide.", 422)
        event_id = event.get("id")
        event_type = event.get("type")
        if not isinstance(event_id, str) or not isinstance(event_type, str):
            raise DealUpError("INVALID_WEBHOOK", "Événement RevenueCat invalide.", 422)
        if self.repo.event_exists(event_id):
            return
        app_user_id = event.get("app_user_id") or event.get("original_app_user_id")
        user: User | None = None
        if isinstance(app_user_id, str) and app_user_id:
            user, _ = self.users.get_or_create(app_user_id)

        product_id = event.get("product_id")
        transaction_id = event.get("transaction_id")
        topup_source_id = (
            f"revenuecat-transaction:{transaction_id}"
            if isinstance(transaction_id, str) and transaction_id
            else event_id
        )
        if (
            user
            and product_id == self.settings.revenuecat_topup_product_id
            and event_type in {"INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"}
            and not self.usage.has_source_event(topup_source_id)
        ):
            self.usage.add_event(
                UsageEvent(
                    user_id=user.id,
                    kind=UsageEventKind.TOPUP_CREDIT,
                    amount=10,
                    source_event_id=topup_source_id,
                )
            )

        plan = self._plan(product_id if isinstance(product_id, str) else None)
        if user and plan != SubscriptionPlan.NONE:
            subscription = self.repo.get_or_create_subscription(user.id)
            subscription.plan = plan
            subscription.product_id = str(product_id)
            subscription.current_period_started_at = (
                _from_ms(event.get("purchased_at_ms"))
                or subscription.current_period_started_at
            )
            subscription.current_period_ends_at = (
                _from_ms(event.get("expiration_at_ms"))
                or subscription.current_period_ends_at
            )
            subscription.environment = event.get("environment")
            if event_type == "EXPIRATION":
                subscription.status = SubscriptionStatus.INACTIVE
                subscription.will_renew = False
            elif event_type == "CANCELLATION":
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.will_renew = False
            elif event_type == "BILLING_ISSUE":
                subscription.status = SubscriptionStatus.GRACE_PERIOD
                subscription.will_renew = False
            else:
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.will_renew = event_type not in {
                    "CANCELLATION",
                    "EXPIRATION",
                }

        self.repo.add_event(
            RevenueCatEvent(
                id=event_id,
                event_type=event_type,
                app_user_id=app_user_id if isinstance(app_user_id, str) else None,
                payload=payload,
            )
        )
        self.session.commit()

    def sync(self, user: User) -> BillingSyncResponse:
        existing = self.repo.get_subscription(user.id)
        now = datetime.now(timezone.utc)
        if self.settings.app_env != "production" and existing and existing.environment == "manual":
            period_end = existing.current_period_ends_at
            if period_end and not period_end.tzinfo:
                period_end = period_end.replace(tzinfo=timezone.utc)
            if (
                existing.status == SubscriptionStatus.ACTIVE
                and existing.plan in {SubscriptionPlan.WEEKLY, SubscriptionPlan.MONTHLY}
                and period_end
            ):
                period_days = 7 if existing.plan == SubscriptionPlan.WEEKLY else 31
                if existing.will_renew:
                    while period_end <= now:
                        existing.current_period_started_at = period_end
                        period_end += timedelta(days=period_days)
                    existing.current_period_ends_at = period_end
                    self.session.commit()
                if period_end > now:
                    usage = UsageService(self.session).snapshot(user)
                    return BillingSyncResponse(
                        synced=True, plan=usage.plan, entitlement=usage.entitlement
                    )

        payload = self.client.get_subscriber(user.clerk_user_id)
        subscriber = payload.get("subscriber", {})
        entitlements = (
            subscriber.get("entitlements", {}) if isinstance(subscriber, dict) else {}
        )
        entitlement = entitlements.get(self.settings.revenuecat_entitlement_id, {})

        non_subscriptions = (
            subscriber.get("non_subscriptions", {})
            if isinstance(subscriber, dict)
            else {}
        )
        topup_transactions = (
            non_subscriptions.get(self.settings.revenuecat_topup_product_id, [])
            if isinstance(non_subscriptions, dict)
            else []
        )
        if isinstance(topup_transactions, list):
            for transaction in topup_transactions:
                if not isinstance(transaction, dict):
                    continue
                transaction_id = transaction.get("id") or transaction.get(
                    "transaction_id"
                )
                if not isinstance(transaction_id, str) or not transaction_id:
                    continue
                source_id = f"revenuecat-transaction:{transaction_id}"
                if not self.usage.has_source_event(source_id):
                    self.usage.add_event(
                        UsageEvent(
                            user_id=user.id,
                            kind=UsageEventKind.TOPUP_CREDIT,
                            amount=10,
                            source_event_id=source_id,
                        )
                    )
        subscription = self.repo.get_or_create_subscription(user.id)
        expires_at = (
            _from_iso(entitlement.get("expires_date"))
            if isinstance(entitlement, dict)
            else None
        )
        product_id = (
            entitlement.get("product_identifier")
            if isinstance(entitlement, dict)
            else None
        )
        active = bool(entitlement) and (expires_at is None or expires_at > now)
        subscription.plan = self._plan(
            product_id if isinstance(product_id, str) else None
        )
        subscription.product_id = product_id if isinstance(product_id, str) else None
        subscription.current_period_started_at = (
            _from_iso(entitlement.get("purchase_date"))
            if isinstance(entitlement, dict)
            else None
        )
        subscription.current_period_ends_at = expires_at
        subscription.status = (
            SubscriptionStatus.ACTIVE if active else SubscriptionStatus.INACTIVE
        )
        subscription.will_renew = active and not bool(
            entitlement.get("unsubscribe_detected_at")
            if isinstance(entitlement, dict)
            else None
        )
        self.session.commit()
        usage = UsageService(self.session).snapshot(user)
        return BillingSyncResponse(
            synced=True, plan=usage.plan, entitlement=usage.entitlement
        )
