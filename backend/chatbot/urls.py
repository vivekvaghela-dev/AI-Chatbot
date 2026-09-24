from django.urls import path

from .views import (
    ChatView,
    ConversationClearView,
    ConversationDetailView,
    ConversationListCreateView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view()),
    path("conversations/<str:id>/clear/", ConversationClearView.as_view()),
    path("conversations/<str:id>/", ConversationDetailView.as_view()),
    path("chat/", ChatView.as_view()),
]
