import httpx


class PushClient:
    endpoint = "https://exp.host/--/api/v2/push/send"

    def send_analysis_ready(self, tokens: list[str], analysis_id: str) -> None:
        if not tokens:
            return
        messages = [
            {
                "to": token,
                "title": "Ton analyse DealUp est prête",
                "body": "Découvre le verdict, le juste prix et la meilleure action.",
                "data": {"analysis_id": analysis_id, "type": "analysis_completed"},
                "sound": "default",
            }
            for token in tokens
        ]
        try:
            httpx.post(self.endpoint, json=messages, timeout=10.0).raise_for_status()
        except httpx.HTTPError:
            # A push failure must never fail or roll back a completed analysis.
            return
