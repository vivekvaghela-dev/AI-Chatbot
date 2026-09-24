"""AI chat streaming service supporting Google Gemini and OpenAI providers."""

import logging
from django.conf import settings
import httpx
from google import genai
from google.genai import types, errors

logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    code = "ai_provider_error"

    def __init__(self, message):
        self.message = message
        super().__init__(message)


class MissingAPIKeyError(AIServiceError):
    code = "missing_api_key"


class MissingModelError(AIServiceError):
    code = "missing_model"


class UnsupportedProviderError(AIServiceError):
    code = "ai_provider_error"


class InvalidAPIKeyError(AIServiceError):
    code = "invalid_api_key"


class AIQuotaExceededError(AIServiceError):
    code = "quota_exceeded"


class AIRateLimitError(AIServiceError):
    code = "rate_limit_exceeded"


class AIModelUnavailableError(AIServiceError):
    code = "model_unavailable"


class AITimeoutError(AIServiceError):
    code = "ai_timeout"


class AIConnectionError(AIServiceError):
    code = "ai_connection_error"


class AIProviderError(AIServiceError):
    code = "ai_provider_error"


class AIConfigurationError(AIServiceError):
    code = "invalid_request"


def _require_text(value, error_class, message):
    if value is None or str(value).strip() == "":
        raise error_class(message)
    return str(value).strip()


def load_ai_config():
    """Read AI settings from Django (sourced from backend .env). Never logs secrets."""
    raw_provider = getattr(settings, "AI_PROVIDER", "")
    provider = (raw_provider or "").strip().lower() or "gemini"
    if provider not in ("gemini", "openai"):
        raise UnsupportedProviderError("The configured AI provider is not supported.")

    api_key = _require_text(
        getattr(settings, "AI_API_KEY", ""),
        MissingAPIKeyError,
        "AI API key is not configured.",
    )
    model = _require_text(
        getattr(settings, "AI_MODEL", ""),
        MissingModelError,
        "AI model is not configured.",
    )

    timeout_seconds = getattr(settings, "AI_TIMEOUT_SECONDS", None)
    if timeout_seconds is None:
        raise AIConfigurationError("AI_TIMEOUT_SECONDS is not configured.")
    try:
        timeout_seconds = float(timeout_seconds)
    except (TypeError, ValueError) as exc:
        raise AIConfigurationError("AI_TIMEOUT_SECONDS is not configured.") from exc
    if timeout_seconds <= 0:
        raise AIConfigurationError("AI_TIMEOUT_SECONDS must be a positive number.")

    base_url = (getattr(settings, "AI_BASE_URL", "") or "").strip() or None
    if base_url:
        # Sanitize dashboard URLs or cross-provider proxy URLs
        lower_url = base_url.lower()
        if (
            "platform.openai.com" in lower_url
            or "/settings/" in lower_url
            or (provider == "gemini" and "/openai" in lower_url)
        ):
            logger.info("AI_BASE_URL is incompatible with provider '%s'. Using default provider endpoint.", provider)
            base_url = None

    return {
        "provider": provider,
        "api_key": api_key,
        "model": model,
        "base_url": base_url,
        "timeout_seconds": timeout_seconds,
    }


def get_context_message_limit():
    """Cap how many recent messages are sent to the model. Does not query the database."""
    limit = getattr(settings, "AI_CONTEXT_MESSAGE_LIMIT", None)
    if limit is None:
        raise AIConfigurationError("AI_CONTEXT_MESSAGE_LIMIT is not configured.")
    try:
        limit = int(limit)
    except (TypeError, ValueError) as exc:
        raise AIConfigurationError("AI_CONTEXT_MESSAGE_LIMIT is not configured.") from exc
    if limit < 1:
        raise AIConfigurationError("AI_CONTEXT_MESSAGE_LIMIT must be a positive integer.")
    return limit


def _classify_rate_limit(exc):
    """
    Distinguish between insufficient quota / credit exhaustion vs RPM/TPM rate limits.
    Never exposes secrets or headers.
    """
    body = getattr(exc, "body", None)
    err_dict = {}
    if isinstance(body, dict):
        err_dict = body.get("error") if isinstance(body.get("error"), dict) else body

    err_code = str(getattr(exc, "code", None) or err_dict.get("code") or "").lower()
    err_type = str(getattr(exc, "type", None) or err_dict.get("type") or "").lower()
    err_status = str(getattr(exc, "status", None) or "").lower()
    err_msg = str(getattr(exc, "message", None) or err_dict.get("message") or "").lower()

    logger.warning(
        "AI HTTP 429 received: code=%s, type=%s, status=%s, message=%s",
        err_code,
        err_type,
        err_status,
        err_msg[:200],
    )

    if (
        err_code in ("credit_balance_exhausted", "insufficient_quota", "billing_not_active")
        or err_type == "insufficient_quota"
        or "credit" in err_msg
        or "quota" in err_msg
        or "billing" in err_msg
        or "free tier" in err_msg
        or "resource_exhausted" in err_status
        or "limit: 0" in err_msg
    ):
        return AIQuotaExceededError("AI API quota/credits are unavailable or exhausted.")

    return AIRateLimitError("AI rate limit reached. Please try again shortly.")


def _stream_gemini(config, messages):
    """Stream chat deltas from Google Gemini using google-genai SDK."""
    http_opts = {}
    if config.get("timeout_seconds"):
        http_opts["timeout"] = int(config["timeout_seconds"] * 1000)
    if config.get("base_url"):
        http_opts["base_url"] = config["base_url"]

    client_kwargs = {"api_key": config["api_key"]}
    if http_opts:
        client_kwargs["http_options"] = types.HttpOptions(**http_opts)

    client = genai.Client(**client_kwargs)

    system_instructions = []
    contents = []
    for item in messages:
        role = item.get("role")
        content = item.get("content") or ""
        if role == "system":
            system_instructions.append(content)
        elif role == "assistant":
            contents.append(types.Content(role="model", parts=[types.Part.from_text(text=content)]))
        else:
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=content)]))

    # Gemini multi-turn chat requires starting with a user turn
    while contents and contents[0].role != "user":
        contents.pop(0)

    if not contents:
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text="")]))

    gen_config_kwargs = {
        "automatic_function_calling": types.AutomaticFunctionCallingConfig(disable=True),
    }
    if system_instructions:
        gen_config_kwargs["system_instruction"] = "\n\n".join(system_instructions)

    gen_config = types.GenerateContentConfig(**gen_config_kwargs)

    try:
        response_stream = client.models.generate_content_stream(
            model=config["model"],
            contents=contents,
            config=gen_config,
        )
        for chunk in response_stream:
            if chunk.text:
                yield chunk.text
    except GeneratorExit:
        return
    except httpx.TimeoutException as exc:
        logger.warning("Gemini request timed out")
        raise AITimeoutError("Gemini request timed out. Please try again.") from exc
    except (httpx.NetworkError, httpx.RequestError) as exc:
        logger.warning("Gemini connection error: %s", str(exc)[:200])
        raise AIConnectionError("Could not reach Gemini API. Check your network connection.") from exc
    except errors.APIError as exc:
        code = getattr(exc, "code", None)
        status_val = str(getattr(exc, "status", "") or "").upper()
        msg_str = str(getattr(exc, "message", "") or "").lower()

        logger.warning("Gemini APIError: code=%s, status=%s, message=%s", code, status_val, msg_str[:200])

        if code == 429 or status_val == "RESOURCE_EXHAUSTED":
            raise _classify_rate_limit(exc) from exc
        if code in (401, 403) or (code == 400 and ("api key" in msg_str or "api_key" in msg_str or "unauthenticated" in msg_str)):
            raise InvalidAPIKeyError("Gemini authentication failed. Check the API key.") from exc
        if code == 404 or "not found" in msg_str or "is not supported for generatecontent" in msg_str:
            raise AIModelUnavailableError(f"The configured Gemini model '{config['model']}' is unavailable.") from exc
        if code == 400 and "model" in msg_str:
            raise AIModelUnavailableError(f"The configured Gemini model '{config['model']}' is unavailable.") from exc
        if code in (500, 503) or status_val in ("INTERNAL", "UNAVAILABLE"):
            raise AIProviderError("Gemini service is temporarily unavailable. Please try again later.") from exc
        raise AIProviderError("Gemini provider error. Check backend terminal for details.") from exc
    except AIServiceError:
        raise
    except Exception as exc:
        logger.exception("Unexpected error during Gemini stream")
        raise AIProviderError("Gemini provider error. Check backend terminal for details.") from exc


def _stream_openai(config, messages):
    """Stream chat deltas from OpenAI (lazy-loaded if OpenAI is configured)."""
    try:
        from openai import (
            APIConnectionError,
            APIStatusError,
            APITimeoutError,
            AuthenticationError,
            BadRequestError,
            InternalServerError,
            NotFoundError,
            OpenAI,
            PermissionDeniedError,
            RateLimitError,
        )
    except ImportError as exc:
        raise UnsupportedProviderError("OpenAI SDK is not installed.") from exc

    kwargs = {
        "api_key": config["api_key"],
        "timeout": config["timeout_seconds"],
    }
    if config["base_url"]:
        kwargs["base_url"] = config["base_url"]

    client = OpenAI(**kwargs)
    stream = None

    try:
        stream = client.chat.completions.create(
            model=config["model"],
            messages=messages,
            stream=True,
        )
        for chunk in stream:
            choices = getattr(chunk, "choices", None) or []
            if not choices:
                continue
            delta = getattr(choices[0], "delta", None)
            content = getattr(delta, "content", None) if delta is not None else None
            if content:
                yield content
    except GeneratorExit:
        return
    except AuthenticationError as exc:
        logger.warning("OpenAI authentication failed (401)")
        raise InvalidAPIKeyError("OpenAI authentication failed. Check the API key.") from exc
    except RateLimitError as exc:
        raise _classify_rate_limit(exc) from exc
    except NotFoundError as exc:
        logger.warning("OpenAI model/resource not found (404): model=%s", config.get("model"))
        raise AIModelUnavailableError("The configured OpenAI model is unavailable for this API project.") from exc
    except PermissionDeniedError as exc:
        logger.warning("OpenAI permission denied (403)")
        raise AIProviderError("OpenAI permission denied. The API key does not have permission for this request or model.") from exc
    except BadRequestError as exc:
        err_msg = str(exc).lower()
        logger.warning("OpenAI bad request (400): %s", err_msg[:200])
        if "model" in err_msg:
            raise AIModelUnavailableError("The configured OpenAI model is unavailable for this API project.") from exc
        raise AIProviderError("Invalid request sent to OpenAI.") from exc
    except APITimeoutError as exc:
        logger.warning("OpenAI request timed out")
        raise AITimeoutError("OpenAI request timed out. Please try again.") from exc
    except APIConnectionError as exc:
        logger.warning("OpenAI connection error: %s", str(exc)[:200])
        raise AIConnectionError("Could not reach OpenAI. Check your network connection.") from exc
    except InternalServerError as exc:
        logger.warning("OpenAI internal server error: %s", str(exc)[:200])
        raise AIProviderError("OpenAI service is temporarily unavailable. Please try again later.") from exc
    except APIStatusError as exc:
        status_code = getattr(exc, "status_code", None)
        err_msg = str(exc).lower()
        logger.warning("OpenAI APIStatusError (%s): %s", status_code, err_msg[:200])
        if status_code == 401:
            raise InvalidAPIKeyError("OpenAI authentication failed. Check the API key.") from exc
        if status_code == 404 or "model" in err_msg:
            raise AIModelUnavailableError("The configured OpenAI model is unavailable for this API project.") from exc
        raise AIProviderError("OpenAI provider error. Check the backend terminal for details.") from exc
    except AIServiceError:
        raise
    except Exception as exc:
        logger.exception("Unexpected error during OpenAI stream")
        raise AIProviderError("OpenAI provider error. Check the backend terminal for details.") from exc
    finally:
        closer = getattr(stream, "close", None)
        if closer is not None:
            try:
                closer()
            except Exception:
                pass


def stream_chat(messages):
    """
    Yield assistant text deltas for the given chat messages.

    `messages` is a list of {"role": "user"|"assistant"|"system", "content": str}.
    Dispatches to provider-specific streaming implementation.
    """
    config = load_ai_config()
    provider = config.get("provider", "gemini")

    if provider == "gemini":
        yield from _stream_gemini(config, messages)
    elif provider == "openai":
        yield from _stream_openai(config, messages)
    else:
        raise UnsupportedProviderError("The configured AI provider is not supported.")
