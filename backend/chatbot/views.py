import json
import uuid

from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from chatbot.services.ai_service import (
    AIConfigurationError,
    AIConnectionError,
    AIModelUnavailableError,
    AIProviderError,
    AIQuotaExceededError,
    AIRateLimitError,
    AIServiceError,
    AITimeoutError,
    InvalidAPIKeyError,
    MissingAPIKeyError,
    MissingModelError,
    UnsupportedProviderError,
    get_context_message_limit,
    load_ai_config,
    stream_chat,
)

from .exceptions import (
    ConversationNotFound,
    EmptyMessage,
    InvalidRequest,
    MessageTooLong,
)
from .models import Conversation, Message
from .serializers import ConversationDetailSerializer, ConversationSummarySerializer

MAX_MESSAGE_LENGTH = 4000
TITLE_MAX_LENGTH = 80


def get_conversation(conversation_id):
    if not isinstance(conversation_id, uuid.UUID):
        try:
            conversation_id = uuid.UUID(str(conversation_id))
        except (ValueError, TypeError, AttributeError) as exc:
            raise InvalidRequest("conversation_id must be a valid UUID.") from exc
    try:
        return Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist as exc:
        raise ConversationNotFound() from exc


class ConversationListCreateView(APIView):
    def get(self, request):
        conversations = Conversation.objects.all()
        serializer = ConversationSummarySerializer(conversations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        conversation = Conversation.objects.create()
        serializer = ConversationSummarySerializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    def get(self, request, id):
        conversation = get_conversation(id)
        serializer = ConversationDetailSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        conversation = get_conversation(id)
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConversationClearView(APIView):
    def delete(self, request, id):
        conversation = get_conversation(id)
        conversation.messages.all().delete()
        conversation.title = "New Chat"
        conversation.save()
        serializer = ConversationSummarySerializer(conversation)
        return Response(serializer.data, status=status.HTTP_200_OK)


def conversation_title_from_message(message):
    text = " ".join(message.split())
    field_limit = Conversation._meta.get_field("title").max_length
    max_len = min(TITLE_MAX_LENGTH, field_limit)
    if len(text) <= max_len:
        return text
    truncated = text[:max_len].rsplit(" ", 1)[0].rstrip(".,;:!?")
    return (truncated or text[:max_len])[:field_limit]


def _sse(event, payload):
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _is_client_disconnect(exc):
    if isinstance(exc, (BrokenPipeError, ConnectionResetError, GeneratorExit)):
        return True
    if isinstance(exc, OSError) and getattr(exc, "errno", None) in (32, 104):
        return True
    if isinstance(exc, OSError) and getattr(exc, "winerror", None) in (10053, 10054):
        return True
    return False


def _ai_http_status(exc):
    if isinstance(
        exc,
        (
            MissingAPIKeyError,
            MissingModelError,
            AIConfigurationError,
            UnsupportedProviderError,
        ),
    ):
        return status.HTTP_503_SERVICE_UNAVAILABLE
    if isinstance(exc, AITimeoutError):
        return status.HTTP_504_GATEWAY_TIMEOUT
    if isinstance(
        exc,
        (
            InvalidAPIKeyError,
            AIRateLimitError,
            AIQuotaExceededError,
            AIModelUnavailableError,
            AIConnectionError,
            AIProviderError,
        ),
    ):
        return status.HTTP_502_BAD_GATEWAY
    return status.HTTP_500_INTERNAL_SERVER_ERROR


def _error_response(exc):
    if isinstance(exc, AIServiceError):
        return Response(
            {"error": {"code": exc.code, "message": exc.message}},
            status=_ai_http_status(exc),
        )
    return Response(
        {
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred.",
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _parse_conversation_id(raw_id):
    if raw_id is None or raw_id == "":
        return None
    try:
        return uuid.UUID(str(raw_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise InvalidRequest("conversation_id must be a valid UUID or null.") from exc


def _validated_message(data):
    if not isinstance(data, dict):
        raise InvalidRequest("Request body must be a JSON object.")
    if "message" not in data or data.get("message") is None:
        raise EmptyMessage()
    message = data.get("message")
    if not isinstance(message, str):
        raise InvalidRequest("Message must be a string.")
    message = message.strip()
    if message == "":
        raise EmptyMessage()
    if len(message) > MAX_MESSAGE_LENGTH:
        raise MessageTooLong()
    return message


from rest_framework.renderers import BaseRenderer, JSONRenderer


class ServerSentEventRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "sse"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class ChatView(APIView):
    """Validate input, persist the user message, then stream assistant tokens as SSE."""
    renderer_classes = [JSONRenderer, ServerSentEventRenderer]

    def post(self, request):
        message = _validated_message(request.data)
        conversation_id = _parse_conversation_id(
            request.data.get("conversation_id") if isinstance(request.data, dict) else None
        )
        if conversation_id is not None:
            conversation = get_conversation(conversation_id)
        else:
            conversation = None

        try:
            load_ai_config()
            context_limit = get_context_message_limit()
        except AIServiceError as exc:
            return _error_response(exc)

        if conversation is None:
            conversation = Conversation.objects.create()

        is_first_user = not conversation.messages.filter(role=Message.Role.USER).exists()
        user_message = Message.objects.create(
            conversation=conversation,
            role=Message.Role.USER,
            content=message,
        )
        if is_first_user:
            conversation.title = conversation_title_from_message(message)
        conversation.save()

        recent = list(
            conversation.messages.order_by("-created_at")[:context_limit]
        )
        recent.reverse()
        context_messages = [
            {"role": item.role, "content": item.content} for item in recent
        ]

        def event_stream():
            assistant_parts = []
            try:
                yield _sse(
                    "meta",
                    {
                        "conversation_id": str(conversation.id),
                        "user_message_id": str(user_message.id),
                    },
                )
                for delta in stream_chat(context_messages):
                    assistant_parts.append(delta)
                    yield _sse("token", {"delta": delta})
                assistant_message = Message.objects.create(
                    conversation=conversation,
                    role=Message.Role.ASSISTANT,
                    content="".join(assistant_parts),
                )
                conversation.save(update_fields=["updated_at"])
                yield _sse(
                    "done",
                    {
                        "assistant_message_id": str(assistant_message.id),
                        "title": conversation.title,
                    },
                )
            except GeneratorExit:
                raise
            except OSError as exc:
                if _is_client_disconnect(exc):
                    return
                yield _sse(
                    "error",
                    {
                        "code": "internal_error",
                        "message": "An unexpected error occurred.",
                    },
                )
            except AIServiceError as exc:
                yield _sse("error", {"code": exc.code, "message": exc.message})
            except Exception:
                yield _sse(
                    "error",
                    {
                        "code": "internal_error",
                        "message": "An unexpected error occurred.",
                    },
                )

        response = StreamingHttpResponse(
            event_stream(),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
