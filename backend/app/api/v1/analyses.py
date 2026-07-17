from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response, status

from app.api.dependencies import (
    CurrentUser,
    DbSession,
    analytics_dependency,
    invoker_dependency,
    storage_dependency,
)
from app.integrations import AnalysisInvoker, Analytics, MediaStorage
from app.schemas.analysis import (
    AnalysisAccepted,
    AnalysisCreate,
    AnalysisList,
    AnalysisRead,
    ReanalysisCreate,
)
from app.services import AnalysisService

router = APIRouter(prefix="/v1/analyses", tags=["analyses"])
IdempotencyKey = Annotated[
    str, Header(alias="Idempotency-Key", min_length=8, max_length=255)
]


def service(
    session: DbSession,
    invoker: AnalysisInvoker = Depends(invoker_dependency),
    analytics: Analytics = Depends(analytics_dependency),
    storage: MediaStorage = Depends(storage_dependency),
) -> AnalysisService:
    return AnalysisService(session, invoker, analytics, storage)


@router.post("", response_model=AnalysisAccepted, status_code=status.HTTP_202_ACCEPTED)
def create_analysis(
    body: AnalysisCreate,
    idempotency_key: IdempotencyKey,
    user: CurrentUser,
    analyses: AnalysisService = Depends(service),
) -> AnalysisAccepted:
    return analyses.create(user, body, idempotency_key)


@router.get("", response_model=AnalysisList)
def list_analyses(
    user: CurrentUser,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    analyses: AnalysisService = Depends(service),
) -> AnalysisList:
    return analyses.list(user, cursor, limit)


@router.get("/{analysis_id}", response_model=AnalysisRead)
def get_analysis(
    analysis_id: str,
    user: CurrentUser,
    analyses: AnalysisService = Depends(service),
) -> AnalysisRead:
    return analyses.get(user, analysis_id)


@router.post(
    "/{analysis_id}/reanalyze",
    response_model=AnalysisAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def reanalyze(
    analysis_id: str,
    body: ReanalysisCreate,
    idempotency_key: IdempotencyKey,
    user: CurrentUser,
    analyses: AnalysisService = Depends(service),
) -> AnalysisAccepted:
    return analyses.reanalyze(user, analysis_id, body, idempotency_key)


@router.post(
    "/{analysis_id}/refresh",
    response_model=AnalysisAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def refresh(
    analysis_id: str,
    idempotency_key: IdempotencyKey,
    user: CurrentUser,
    analyses: AnalysisService = Depends(service),
) -> AnalysisAccepted:
    return analyses.refresh(user, analysis_id, idempotency_key)


@router.post(
    "/{analysis_id}/retry",
    response_model=AnalysisAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def retry(
    analysis_id: str,
    user: CurrentUser,
    analyses: AnalysisService = Depends(service),
) -> AnalysisAccepted:
    return analyses.retry(user, analysis_id)


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(
    analysis_id: str,
    user: CurrentUser,
    analyses: AnalysisService = Depends(service),
) -> Response:
    analyses.delete(user, analysis_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
