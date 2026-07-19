import argparse
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.session import session_factory
from app.models import SubscriptionPlan, SubscriptionStatus, User
from app.repositories import BillingRepository


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(
        description="Grant or revoke an internal DealUp subscription outside production."
    )
    command.add_argument("--email", required=True)
    command.add_argument("--plan", choices=["weekly", "monthly"], default="monthly")
    command.add_argument("--revoke", action="store_true")
    return command


def main() -> None:
    args = parser().parse_args()
    settings = get_settings()
    if settings.app_env == "production":
        raise SystemExit(
            "Manual access is disabled in production. Use RevenueCat/App Store instead."
        )
    email = args.email.strip().lower()
    now = datetime.now(timezone.utc)
    with session_factory()() as session:
        users = list(
            session.scalars(
                select(User).where(
                    func.lower(User.email) == email,
                    User.deleted_at.is_(None),
                )
            )
        )
        if not users:
            raise SystemExit(f"No active DealUp user found for {email}")
        if len(users) > 1:
            raise SystemExit(f"Multiple DealUp users found for {email}")

        subscription = BillingRepository(session).get_or_create_subscription(users[0].id)
        if args.revoke:
            subscription.plan = SubscriptionPlan.NONE
            subscription.status = SubscriptionStatus.INACTIVE
            subscription.product_id = None
            subscription.current_period_started_at = None
            subscription.current_period_ends_at = None
            subscription.will_renew = False
            subscription.environment = "manual"
            action = "revoked"
        else:
            plan = SubscriptionPlan(args.plan)
            period_days = 7 if plan == SubscriptionPlan.WEEKLY else 31
            subscription.plan = plan
            subscription.status = SubscriptionStatus.ACTIVE
            subscription.product_id = f"manual_{args.plan}"
            subscription.current_period_started_at = now
            subscription.current_period_ends_at = now + timedelta(days=period_days)
            subscription.will_renew = True
            subscription.environment = "manual"
            action = f"granted renewable {args.plan} access"
        session.commit()

    print(f"DealUp access {action}: {email}")


if __name__ == "__main__":
    main()
