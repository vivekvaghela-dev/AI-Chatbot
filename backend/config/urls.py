from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def bad_request_handler(request, exception=None):
    return JsonResponse(
        {
            "error": {
                "code": "invalid_request",
                "message": "Bad request.",
            }
        },
        status=400,
    )


def page_not_found_handler(request, exception=None):
    return JsonResponse(
        {
            "error": {
                "code": "not_found",
                "message": "Resource not found.",
            }
        },
        status=404,
    )


def server_error_handler(request):
    return JsonResponse(
        {
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred.",
            }
        },
        status=500,
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("chatbot.urls")),
]

handler400 = bad_request_handler
handler404 = page_not_found_handler
handler500 = server_error_handler

