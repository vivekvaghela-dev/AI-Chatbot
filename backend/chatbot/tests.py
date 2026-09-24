import json
import uuid

from django.test import RequestFactory, TestCase, override_settings
from rest_framework.test import APIClient

from config.urls import bad_request_handler, page_not_found_handler, server_error_handler

from .models import Conversation, Message


class ConversationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_list_retrieve_delete_and_404(self):
        create = self.client.post("/api/conversations/")
        self.assertEqual(create.status_code, 201)
        self.assertEqual(create.data["title"], "New Chat")
        conversation_id = create.data["id"]

        listing = self.client.get("/api/conversations/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data), 1)
        self.assertNotIn("messages", listing.data[0])

        Message.objects.create(
            conversation_id=conversation_id,
            role=Message.Role.USER,
            content="keep for cascade check",
        )
        detail = self.client.get(f"/api/conversations/{conversation_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.data["messages"]), 1)
        self.assertEqual(detail.data["messages"][0]["role"], "user")

        missing = self.client.get(f"/api/conversations/{uuid.uuid4()}/")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.data["error"]["code"], "conversation_not_found")

        deleted = self.client.delete(f"/api/conversations/{conversation_id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Conversation.objects.filter(pk=conversation_id).exists())
        self.assertEqual(Message.objects.count(), 0)

        gone = self.client.delete(f"/api/conversations/{conversation_id}/")
        self.assertEqual(gone.status_code, 404)

    def test_clear_keeps_conversation_and_removes_messages(self):
        conversation = Conversation.objects.create(title="Old title")
        Message.objects.create(
            conversation=conversation, role=Message.Role.USER, content="hello"
        )
        Message.objects.create(
            conversation=conversation, role=Message.Role.ASSISTANT, content="hi"
        )

        response = self.client.delete(f"/api/conversations/{conversation.id}/clear/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "New Chat")
        self.assertNotIn("messages", response.data)

        conversation.refresh_from_db()
        self.assertEqual(conversation.title, "New Chat")
        self.assertEqual(conversation.messages.count(), 0)
        self.assertTrue(Conversation.objects.filter(pk=conversation.id).exists())

        missing_clear = self.client.delete(f"/api/conversations/{uuid.uuid4()}/clear/")
        self.assertEqual(missing_clear.status_code, 404)
        self.assertEqual(missing_clear.data["error"]["code"], "conversation_not_found")

    def test_invalid_uuid_in_path_returns_400_json(self):
        response = self.client.get("/api/conversations/not-a-uuid/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "invalid_request")
        self.assertNotIn("Traceback", str(response.data))

    def test_invalid_uuid_clear_returns_400_json(self):
        response = self.client.delete("/api/conversations/not-a-uuid/clear/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "invalid_request")
        self.assertEqual(response.data["error"]["message"], "conversation_id must be a valid UUID.")
        self.assertNotIn("Traceback", str(response.data))


@override_settings(DEBUG=False)
class ErrorHandlerTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_non_existent_route_returns_404_json(self):
        response = self.client.get("/api/this-route-does-not-exist/")
        self.assertEqual(response.status_code, 404)
        self.assertIn("application/json", response.headers.get("Content-Type", ""))
        self.assertEqual(
            response.json(),
            {
                "error": {
                    "code": "not_found",
                    "message": "Resource not found.",
                }
            },
        )
        self.assertNotIn("html", response.content.decode("utf-8").lower())
        self.assertNotIn("Traceback", response.content.decode("utf-8"))

    def test_server_error_handler_returns_500_json(self):
        request = RequestFactory().get("/api/causes-500/")
        response = server_error_handler(request)
        self.assertEqual(response.status_code, 500)
        self.assertIn("application/json", response.headers.get("Content-Type", ""))
        self.assertEqual(
            json.loads(response.content.decode("utf-8")),
            {
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred.",
                }
            },
        )

    def test_bad_request_handler_returns_400_json(self):
        request = RequestFactory().get("/api/bad-request/")
        response = bad_request_handler(request)
        self.assertEqual(response.status_code, 400)
        self.assertIn("application/json", response.headers.get("Content-Type", ""))
        self.assertEqual(
            json.loads(response.content.decode("utf-8")),
            {
                "error": {
                    "code": "invalid_request",
                    "message": "Bad request.",
                }
            },
        )

