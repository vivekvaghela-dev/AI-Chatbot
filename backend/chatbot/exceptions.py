from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ConversationNotFound(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Conversation not found."
    default_code = "conversation_not_found"


class EmptyMessage(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Message cannot be empty."
    default_code = "empty_message"


class MessageTooLong(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Message is too long."
    default_code = "message_too_long"


class InvalidRequest(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Invalid request."
    default_code = "invalid_request"


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred.",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, APIException):
        detail = exc.detail
        if isinstance(detail, list):
            message = str(detail[0])
        else:
            message = str(detail)
        response.data = {
            "error": {
                "code": getattr(exc, "default_code", "invalid_request") or "invalid_request",
                "message": message,
            }
        }

    return response
