import json
import uuid
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from chatbot.services.ai_service import AIProviderError
from chatbot.views import MAX_MESSAGE_LENGTH

from .models import Conversation, Message

AI_OK = dict(
    AI_PROVIDER="openai",
    AI_API_KEY="test-key",
    AI_MODEL="test-model",
    AI_TIMEOUT_SECONDS=60,
    AI_CONTEXT_MESSAGE_LIMIT=20,
    AI_BASE_URL="",
)


def parse_sse(raw):
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    events = []
    for block in raw.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        event_name = None
        data_lines = []
        for line in block.splitlines():
            if line.startswith("event:"):
                event_name = line[6:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].strip())
        events.append({"event": event_name, "data": json.loads("\n".join(data_lines))})
    return events


def read_stream(response):
    return b"".join(response.streaming_content)


@override_settings(**AI_OK)
class ChatAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_empty_message_returns_400(self):
        for payload in (
            {"message": ""},
            {"message": "   "},
            {},
            {"message": None, "conversation_id": None},
        ):
            response = self.client.post("/api/chat/", payload, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data["error"]["code"], "empty_message")
            self.assertEqual(response.data["error"]["message"], "Message cannot be empty.")

    def test_invalid_message_type_returns_400(self):
        response = self.client.post("/api/chat/", {"message": 123}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "invalid_request")

    def test_message_too_long_returns_400(self):
        response = self.client.post(
            "/api/chat/",
            {"message": "a" * (MAX_MESSAGE_LENGTH + 1)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "message_too_long")

    def test_missing_conversation_returns_404(self):
        response = self.client.post(
            "/api/chat/",
            {"conversation_id": str(uuid.uuid4()), "message": "Hello"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"]["code"], "conversation_not_found")
        self.assertEqual(Message.objects.count(), 0)

    def test_invalid_conversation_id_returns_400(self):
        response = self.client.post(
            "/api/chat/",
            {"conversation_id": "not-a-uuid", "message": "Hello"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "invalid_request")

    @override_settings(AI_API_KEY="")
    def test_missing_api_key_returns_503(self):
        response = self.client.post("/api/chat/", {"message": "Hello"}, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"]["code"], "missing_api_key")
        self.assertFalse(response.get("Content-Type", "").startswith("text/event-stream"))
        self.assertEqual(Message.objects.count(), 0)
        self.assertEqual(Conversation.objects.count(), 0)

    @override_settings(AI_API_KEY="")
    def test_missing_api_key_with_existing_conversation_does_not_add_message(self):
        conv = Conversation.objects.create(title="Existing")
        response = self.client.post(
            "/api/chat/",
            {"conversation_id": str(conv.id), "message": "Hello"},
            format="json",
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"]["code"], "missing_api_key")
        self.assertEqual(conv.messages.count(), 0)
        self.assertEqual(Conversation.objects.count(), 1)

    @patch("chatbot.views.stream_chat")
    def test_first_message_creates_conversation_and_persists_user(self, mock_stream):
        mock_stream.return_value = iter(["Hi", " there"])
        response = self.client.post(
            "/api/chat/",
            {"conversation_id": None, "message": "Hello from user"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("text/event-stream"))

        events = parse_sse(read_stream(response))
        self.assertEqual([item["event"] for item in events], ["meta", "token", "token", "done"])
        self.assertEqual(events[1]["data"]["delta"], "Hi")
        self.assertEqual(events[2]["data"]["delta"], " there")

        conversation_id = events[0]["data"]["conversation_id"]
        user_message_id = events[0]["data"]["user_message_id"]
        assistant_id = events[-1]["data"]["assistant_message_id"]
        self.assertEqual(events[-1]["data"]["title"], "Hello from user")

        conversation = Conversation.objects.get(pk=conversation_id)
        self.assertEqual(conversation.title, "Hello from user")
        self.assertEqual(conversation.messages.count(), 2)
        user = Message.objects.get(pk=user_message_id)
        assistant = Message.objects.get(pk=assistant_id)
        self.assertEqual(user.role, Message.Role.USER)
        self.assertEqual(user.content, "Hello from user")
        self.assertEqual(assistant.role, Message.Role.ASSISTANT)
        self.assertEqual(assistant.content, "Hi there")

    @patch("chatbot.views.stream_chat")
    def test_context_limit_and_conversation_isolation(self, mock_stream):
        mock_stream.return_value = iter(["ok"])
        other = Conversation.objects.create(title="Other")
        Message.objects.create(conversation=other, role=Message.Role.USER, content="secret")

        conversation = Conversation.objects.create(title="Mine")
        for index in range(5):
            role = Message.Role.USER if index % 2 == 0 else Message.Role.ASSISTANT
            Message.objects.create(
                conversation=conversation,
                role=role,
                content=f"old-{index}",
            )

        with override_settings(AI_CONTEXT_MESSAGE_LIMIT=3):
            response = self.client.post(
                "/api/chat/",
                {"conversation_id": str(conversation.id), "message": "newest"},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        parse_sse(read_stream(response))
        mock_stream.assert_called_once()
        sent = mock_stream.call_args[0][0]
        self.assertEqual(len(sent), 3)
        self.assertEqual([item["content"] for item in sent], ["old-3", "old-4", "newest"])
        self.assertEqual([item["role"] for item in sent], ["assistant", "user", "user"])
        self.assertNotIn("secret", [item["content"] for item in sent])
        self.assertEqual(conversation.messages.count(), 7)

    @patch("chatbot.views.stream_chat")
    def test_failed_stream_does_not_save_assistant(self, mock_stream):
        def failing(_messages):
            yield "partial"
            raise AIProviderError("The AI provider failed to generate a response.")

        mock_stream.side_effect = failing
        response = self.client.post("/api/chat/", {"message": "Hello"}, format="json")
        self.assertEqual(response.status_code, 200)
        events = parse_sse(read_stream(response))
        self.assertEqual([item["event"] for item in events], ["meta", "token", "error"])
        self.assertEqual(events[-1]["data"]["code"], "ai_provider_error")
        self.assertFalse(any(item["event"] == "done" for item in events))
        self.assertEqual(Message.objects.filter(role=Message.Role.USER).count(), 1)
        self.assertEqual(Message.objects.filter(role=Message.Role.ASSISTANT).count(), 0)

    @patch("chatbot.views.stream_chat")
    def test_aborted_stream_does_not_save_assistant_or_send_done(self, mock_stream):
        def slow(_messages):
            yield "Hel"
            yield "lo"
            yield "!"

        mock_stream.side_effect = slow
        response = self.client.post("/api/chat/", {"message": "Stop me"}, format="json")
        self.assertEqual(response.status_code, 200)
        iterator = iter(response.streaming_content)
        meta = next(iterator)
        token = next(iterator)
        self.assertIn(b"event: meta", meta)
        self.assertIn(b"event: token", token)
        response.close()

        self.assertEqual(Message.objects.filter(role=Message.Role.USER).count(), 1)
        self.assertEqual(Message.objects.filter(role=Message.Role.ASSISTANT).count(), 0)
        self.assertEqual(Conversation.objects.count(), 1)

    @override_settings(AI_CONTEXT_MESSAGE_LIMIT=0)
    @patch("chatbot.views.stream_chat")
    def test_non_positive_context_limit_returns_503_without_calling_stream(self, mock_stream):
        response = self.client.post("/api/chat/", {"message": "Hello"}, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"]["code"], "invalid_request")
        self.assertIn("positive integer", response.data["error"]["message"])
        mock_stream.assert_not_called()
        self.assertEqual(Conversation.objects.count(), 0)
        self.assertEqual(Message.objects.count(), 0)

