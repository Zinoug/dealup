"""Run an existing pending analysis with the exact Lambda composition."""

import argparse
import json
import logging
import time

from analysis_worker.config import get_settings
from analysis_worker.integrations.gemini import RESPONSE_EXAMPLE
from analysis_worker.repositories import AnalysisRepository
from handler import handler


def main() -> None:
    logging.basicConfig(
        level=logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%H:%M:%S",
    )
    logging.getLogger("analysis_worker").setLevel(logging.INFO)
    parser = argparse.ArgumentParser(
        description="Process one pending DealUp analysis from local PostgreSQL."
    )
    parser.add_argument(
        "analysis_id", nargs="?", help="UUID returned by POST /v1/analyses"
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Continuously process pending jobs created by the local API.",
    )
    parser.add_argument(
        "--response-example",
        action="store_true",
        help="Print the JSON example requested from Gemini without calling it.",
    )
    args = parser.parse_args()
    if args.response_example:
        print(RESPONSE_EXAMPLE, flush=True)
        return
    if args.watch:
        repository = AnalysisRepository(get_settings().database_url)
        print(
            "DealUp local worker is watching pending analyses. Ctrl-C to stop.",
            flush=True,
        )
        try:
            while True:
                analysis_id = repository.next_pending_id()
                if analysis_id:
                    print(f"Picked analysis {analysis_id}.", flush=True)
                    result = handler({"analysis_id": analysis_id}, None)
                    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
                else:
                    time.sleep(1)
        except KeyboardInterrupt:
            return
    if not args.analysis_id:
        parser.error("analysis_id is required unless --watch is used")
    result = handler({"analysis_id": args.analysis_id}, None)
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
