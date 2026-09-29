from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_BASE = "https://ipsakti.example/problems/"


class ProblemError(Exception):
    """An error returned to the caller as an RFC 9457 Problem Details body."""

    def __init__(self, status: int, code: str, title: str, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.code = code
        self.title = title
        self.detail = detail


def problem_response(request: Request, status: int, code: str, title: str, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        content={
            "type": PROBLEM_BASE + code.lower().replace("_", "-"),
            "title": title,
            "status": status,
            "detail": detail,
            "instance": request.url.path,
            "request_id": getattr(request.state, "request_id", None),
            "code": code,
        },
    )


def install_problem_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProblemError)
    async def handle_problem(request: Request, error: ProblemError) -> JSONResponse:
        return problem_response(request, error.status, error.code, error.title, error.detail)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, error: RequestValidationError) -> JSONResponse:
        fields = ", ".join(".".join(str(part) for part in item["loc"][1:]) or "body" for item in error.errors())
        return problem_response(request, 422, "VALIDATION_FAILED", "Invalid request", f"Invalid fields: {fields}")

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(request: Request, error: StarletteHTTPException) -> JSONResponse:
        code = "NOT_FOUND" if error.status_code == 404 else "HTTP_ERROR"
        return problem_response(request, error.status_code, code, str(error.detail), str(error.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, _error: Exception) -> JSONResponse:
        return problem_response(
            request, 500, "INTERNAL_ERROR", "Internal Server Error", "The request could not be completed."
        )
