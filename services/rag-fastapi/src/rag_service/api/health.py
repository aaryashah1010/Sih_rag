from fastapi import APIRouter

router = APIRouter()


@router.get("/internal/v1/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
