from fastapi import APIRouter

from app.api.v1 import analyses, billing, catalog, listings, media, system, users

router = APIRouter()
router.include_router(system.router)
router.include_router(catalog.router)
router.include_router(users.router)
router.include_router(listings.router)
router.include_router(analyses.router)
router.include_router(media.router)
router.include_router(billing.router)
