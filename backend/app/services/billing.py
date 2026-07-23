import hashlib
import hmac
from datetime import datetime, timezone
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

SUBSCRIPTION_CREDIT_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "NON_RENEWING_PURCHASE",
    "TEMPORARY_ENTITLEMENT_GRANT",
}
TOPUP_CREDIT_EVENTS = {"INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"}
ACTIVE_SUBSCRIPTION_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "NON_RENEWING_PURCHASE",
    "PRODUCT_CHANGE",
    "SUBSCRIPTION_EXTENDED",
    "UNCANCELLATION",
    "TEMPORARY_ENTITLEMENT_GRANT",
}


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


def _revenuecat_user_ids(event: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("app_user_id", "original_app_user_id"):
        value = event.get(key)
        if isinstance(value, str) and value:
            values.append(value)
    aliases = event.get("aliases")
    if isinstance(aliases, list):
        values.extend(value for value in aliases if isinstance(value, str) and value)

    result: list[str] = []
    for value in values:
        if value.startswith("$RCAnonymousID:"):
            continue
        if value not in result:
            result.append(value)
    return result


def _revenuecat_transfer_ids(event: dict[str, Any], key: str) -> list[str]:
    values = event.get(key)
    if not isinstance(values, list):
        return []
    result: list[str] = []
    for value in values:
        if (
            isinstance(value, str)
            and value
            and not value.startswith("$RCAnonymousID:")
            and value not in result
        ):
            result.append(value)
    return result


def _transaction_ids(transaction: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for key in ("transaction_id", "store_transaction_id", "id"):
        value = transaction.get(key)
        if isinstance(value, str) and value and value not in result:
            result.append(value)
    return result


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

    def _plan(
        self, product_id: str | None, *, promotional: bool = False
    ) -> SubscriptionPlan:
        if product_id == self.settings.revenuecat_weekly_product_id:
            return SubscriptionPlan.WEEKLY
        if product_id == self.settings.revenuecat_monthly_product_id:
            return SubscriptionPlan.MONTHLY
        if promotional or (product_id or "").startswith("rc_promo_"):
            return SubscriptionPlan.PROMOTIONAL
        return SubscriptionPlan.NONE

    def _topup_amount(self, product_id: str | None) -> int | None:
        if product_id == self.settings.revenuecat_topup_15_product_id:
            return 15
        if product_id == self.settings.revenuecat_topup_40_product_id:
            return 40
        return None

    def _grant_subscription_credit(
        self,
        user: User,
        plan: SubscriptionPlan,
        product_id: str,
        purchased_at: datetime | None,
        period_ends_at: datetime | None,
    ) -> None:
        if purchased_at is None or plan not in {
            SubscriptionPlan.WEEKLY,
            SubscriptionPlan.MONTHLY,
            SubscriptionPlan.PROMOTIONAL,
        }:
            return
        source_id = f"subscription-period:{product_id}:{int(purchased_at.timestamp())}"
        existing_credit = self.usage.get_source_event(source_id)
        if existing_credit is None:
            amount = 60 if plan == SubscriptionPlan.MONTHLY else 15
            self.usage.add_event(
                UsageEvent(
                    user_id=user.id,
                    kind=UsageEventKind.INCLUDED_CREDIT,
                    amount=amount,
                    source_event_id=source_id,
                    period_started_at=purchased_at,
                    period_ends_at=period_ends_at,
                )
            )
            return

        if (
            existing_credit.user_id == user.id
            or period_ends_at is None
            or existing_credit.period_ends_at is None
        ):
            return

        remaining = self.usage.included_period_balance(
            existing_credit.user_id,
            existing_credit.period_started_at or purchased_at,
            existing_credit.period_ends_at,
        )
        if remaining <= 0:
            return
        transfer_key = hashlib.sha256(f"{source_id}:{user.id}".encode()).hexdigest()[
            :24
        ]
        outgoing_source = f"subscription-reassignment:{transfer_key}:out"
        incoming_source = f"subscription-reassignment:{transfer_key}:in"
        if self.usage.has_source_event(incoming_source):
            return
        self.usage.add_event(
            UsageEvent(
                user_id=existing_credit.user_id,
                kind=UsageEventKind.INCLUDED_DEBIT,
                amount=-remaining,
                source_event_id=outgoing_source,
                period_started_at=existing_credit.period_started_at or purchased_at,
                period_ends_at=existing_credit.period_ends_at,
            )
        )
        self.usage.add_event(
            UsageEvent(
                user_id=user.id,
                kind=UsageEventKind.INCLUDED_CREDIT,
                amount=remaining,
                source_event_id=incoming_source,
                period_started_at=purchased_at,
                period_ends_at=period_ends_at,
            )
        )

    def _process_transfer(self, event: dict[str, Any], event_id: str) -> str | None:
        target_ids = _revenuecat_transfer_ids(event, "transferred_to")
        source_ids = _revenuecat_transfer_ids(event, "transferred_from")
        if not target_ids:
            return None

        target, _ = self.users.get_or_create(target_ids[0])
        source = next(
            (
                candidate
                for clerk_user_id in source_ids
                if (candidate := self.users.get_by_clerk_id(clerk_user_id)) is not None
                and candidate.id != target.id
            ),
            None,
        )
        if source is None:
            return target.clerk_user_id

        source_subscription = self.repo.get_subscription(source.id)
        if source_subscription is None:
            return target.clerk_user_id
        target_subscription = self.repo.get_or_create_subscription(target.id)

        period_start = source_subscription.current_period_started_at
        period_end = source_subscription.current_period_ends_at
        if period_start is not None and period_end is not None:
            remaining = self.usage.included_period_balance(
                source.id, period_start, period_end
            )
            incoming_source = f"revenuecat-transfer:{event_id}:in"
            if remaining > 0 and not self.usage.has_source_event(incoming_source):
                self.usage.add_event(
                    UsageEvent(
                        user_id=source.id,
                        kind=UsageEventKind.INCLUDED_DEBIT,
                        amount=-remaining,
                        source_event_id=f"revenuecat-transfer:{event_id}:out",
                        period_started_at=period_start,
                        period_ends_at=period_end,
                    )
                )
                self.usage.add_event(
                    UsageEvent(
                        user_id=target.id,
                        kind=UsageEventKind.INCLUDED_CREDIT,
                        amount=remaining,
                        source_event_id=incoming_source,
                        period_started_at=period_start,
                        period_ends_at=period_end,
                    )
                )

        target_subscription.plan = source_subscription.plan
        target_subscription.status = source_subscription.status
        target_subscription.product_id = source_subscription.product_id
        target_subscription.current_period_started_at = period_start
        target_subscription.current_period_ends_at = period_end
        target_subscription.will_renew = source_subscription.will_renew
        target_subscription.environment = source_subscription.environment
        source_subscription.status = SubscriptionStatus.INACTIVE
        source_subscription.will_renew = False
        return target.clerk_user_id

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
        app_user_id = (
            self._process_transfer(event, event_id)
            if event_type == "TRANSFER"
            else next(iter(_revenuecat_user_ids(event)), None)
        )
        user: User | None = None
        if app_user_id and event_type != "TRANSFER":
            user, _ = self.users.get_or_create(app_user_id)

        product_id = event.get("product_id")
        transaction_id = event.get("transaction_id")
        topup_source_id = (
            f"revenuecat-transaction:{transaction_id}"
            if isinstance(transaction_id, str) and transaction_id
            else event_id
        )
        topup_amount = self._topup_amount(
            product_id if isinstance(product_id, str) else None
        )
        if (
            user
            and topup_amount is not None
            and event_type in TOPUP_CREDIT_EVENTS
            and not self.usage.has_source_event(topup_source_id)
        ):
            self.usage.add_event(
                UsageEvent(
                    user_id=user.id,
                    kind=UsageEventKind.TOPUP_CREDIT,
                    amount=topup_amount,
                    source_event_id=topup_source_id,
                )
            )

        entitlement_ids = event.get("entitlement_ids")
        has_expected_entitlement = (
            isinstance(entitlement_ids, list)
            and self.settings.revenuecat_entitlement_id in entitlement_ids
        ) or event.get("entitlement_id") == self.settings.revenuecat_entitlement_id
        promotional = has_expected_entitlement and (
            event.get("store") == "PROMOTIONAL"
            or event.get("period_type") == "PROMOTIONAL"
            or (isinstance(product_id, str) and product_id.startswith("rc_promo_"))
        )
        plan = self._plan(
            product_id if isinstance(product_id, str) else None,
            promotional=promotional,
        )
        if user and plan != SubscriptionPlan.NONE:
            subscription = self.repo.get_or_create_subscription(user.id)
            purchased_at = _from_ms(event.get("purchased_at_ms"))
            expires_at = _from_ms(event.get("expiration_at_ms"))
            if event_type in SUBSCRIPTION_CREDIT_EVENTS:
                self._grant_subscription_credit(
                    user,
                    plan,
                    str(product_id),
                    purchased_at,
                    expires_at,
                )
            subscription.plan = plan
            subscription.product_id = str(product_id)
            subscription.current_period_started_at = (
                purchased_at or subscription.current_period_started_at
            )
            subscription.current_period_ends_at = (
                expires_at or subscription.current_period_ends_at
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
            elif event_type == "SUBSCRIPTION_PAUSED":
                subscription.status = SubscriptionStatus.INACTIVE
                subscription.will_renew = False
            elif event_type == "UNCANCELLATION":
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.will_renew = plan != SubscriptionPlan.PROMOTIONAL
            elif event_type in ACTIVE_SUBSCRIPTION_EVENTS:
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.will_renew = plan != SubscriptionPlan.PROMOTIONAL
            else:
                subscription.status = subscription.status or SubscriptionStatus.ACTIVE

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
        now = datetime.now(timezone.utc)
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
        topup_products = {
            self.settings.revenuecat_topup_15_product_id: 15,
            self.settings.revenuecat_topup_40_product_id: 40,
        }
        for topup_product_id, amount in topup_products.items():
            topup_transactions = (
                non_subscriptions.get(topup_product_id, [])
                if isinstance(non_subscriptions, dict)
                else []
            )
            if not isinstance(topup_transactions, list):
                continue
            for transaction in topup_transactions:
                if not isinstance(transaction, dict):
                    continue
                transaction_ids = _transaction_ids(transaction)
                if not transaction_ids:
                    continue
                source_ids = [
                    f"revenuecat-transaction:{transaction_id}"
                    for transaction_id in transaction_ids
                ]
                source_id = source_ids[0]
                existing_credits = [
                    event
                    for event in self.usage.source_events(user.id, source_ids)
                    if event.kind == UsageEventKind.TOPUP_CREDIT
                ]
                if not existing_credits:
                    self.usage.add_event(
                        UsageEvent(
                            user_id=user.id,
                            kind=UsageEventKind.TOPUP_CREDIT,
                            amount=amount,
                            source_event_id=source_id,
                        )
                    )
                    continue

                duplicate_count = len(existing_credits) - 1
                deduplication_source = f"revenuecat-dedup:{transaction_ids[0]}"
                if duplicate_count > 0 and not self.usage.has_source_event(
                    deduplication_source
                ):
                    self.usage.add_event(
                        UsageEvent(
                            user_id=user.id,
                            kind=UsageEventKind.TOPUP_DEBIT,
                            amount=-(amount * duplicate_count),
                            source_event_id=deduplication_source,
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
        plan = self._plan(product_id if isinstance(product_id, str) else None)
        purchased_at = (
            _from_iso(entitlement.get("purchase_date"))
            if isinstance(entitlement, dict)
            else None
        )
        if active and isinstance(product_id, str):
            self._grant_subscription_credit(
                user, plan, product_id, purchased_at, expires_at
            )
        subscription.plan = plan
        subscription.product_id = product_id if isinstance(product_id, str) else None
        subscription.current_period_started_at = purchased_at
        subscription.current_period_ends_at = expires_at
        subscription.status = (
            SubscriptionStatus.ACTIVE if active else SubscriptionStatus.INACTIVE
        )
        subscription.will_renew = (
            active
            and plan != SubscriptionPlan.PROMOTIONAL
            and not bool(
                entitlement.get("unsubscribe_detected_at")
                if isinstance(entitlement, dict)
                else None
            )
        )
        self.session.commit()
        usage = UsageService(self.session).snapshot(user)
        return BillingSyncResponse(
            synced=True, plan=usage.plan, entitlement=usage.entitlement
        )
