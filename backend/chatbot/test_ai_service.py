from django.test import SimpleTestCase, override_settings

from chatbot.services.ai_service import (
    AIConfigurationError,
    MissingAPIKeyError,
    MissingModelError,
    UnsupportedProviderError,
    get_context_message_limit,
    load_ai_config,
    stream_chat,
)


@override_settings(
    AI_PROVIDER="openai",
    AI_TIMEOUT_SECONDS=60,
    AI_CONTEXT_MESSAGE_LIMIT=20,
    AI_BASE_URL="",
)
class AIServiceConfigTests(SimpleTestCase):
    @override_settings(AI_API_KEY="", AI_MODEL="test-model")
    def test_missing_api_key(self):
        with self.assertRaises(MissingAPIKeyError) as ctx:
            load_ai_config()
        self.assertEqual(ctx.exception.code, "missing_api_key")
        self.assertIn("API key", ctx.exception.message)

    @override_settings(AI_API_KEY="test-key", AI_MODEL="")
    def test_missing_model(self):
        with self.assertRaises(MissingModelError) as ctx:
            load_ai_config()
        self.assertEqual(ctx.exception.code, "missing_model")

    @override_settings(AI_API_KEY="", AI_MODEL="test-model")
    def test_stream_chat_does_not_call_provider_without_key(self):
        with self.assertRaises(MissingAPIKeyError):
            list(stream_chat([{"role": "user", "content": "hi"}]))

    @override_settings(
        AI_API_KEY="test-key",
        AI_MODEL="from-settings-model",
        AI_TIMEOUT_SECONDS=45,
        AI_BASE_URL="",
    )
    def test_reads_configuration_from_settings(self):
        config = load_ai_config()
        self.assertEqual(config["model"], "from-settings-model")
        self.assertEqual(config["timeout_seconds"], 45.0)
        self.assertIsNone(config["base_url"])
        self.assertEqual(get_context_message_limit(), 20)

    @override_settings(AI_PROVIDER="other", AI_API_KEY="test-key", AI_MODEL="test-model")
    def test_unsupported_provider(self):
        with self.assertRaises(UnsupportedProviderError):
            load_ai_config()

    @override_settings(AI_API_KEY="test-key", AI_MODEL="test-model", AI_CONTEXT_MESSAGE_LIMIT=0)
    def test_context_limit_must_be_positive(self):
        with self.assertRaises(AIConfigurationError):
            get_context_message_limit()

    @override_settings(AI_API_KEY="test-key", AI_MODEL="test-model", AI_TIMEOUT_SECONDS=0)
    def test_timeout_must_be_positive(self):
        with self.assertRaises(AIConfigurationError):
            load_ai_config()

    @override_settings(
        AI_API_KEY="test-key",
        AI_MODEL="test-model",
        AI_BASE_URL="https://platform.openai.com/settings/organization/api-keys",
    )
    def test_dashboard_base_url_is_sanitized_to_none(self):
        config = load_ai_config()
        self.assertIsNone(config["base_url"])

    def test_rate_limit_classification_quota_exhausted(self):
        from unittest.mock import MagicMock
        from chatbot.services.ai_service import _classify_rate_limit, AIQuotaExceededError

        mock_exc = MagicMock()
        mock_exc.code = "credit_balance_exhausted"
        mock_exc.type = "insufficient_quota"
        mock_exc.message = "You have no credits remaining."
        mock_exc.body = {"error": {"code": "credit_balance_exhausted", "type": "insufficient_quota"}}

        res = _classify_rate_limit(mock_exc)
        self.assertIsInstance(res, AIQuotaExceededError)
        self.assertEqual(res.code, "quota_exceeded")
        self.assertIn("quota/credits", res.message)

    def test_rate_limit_classification_genuine_rate_limit(self):
        from unittest.mock import MagicMock
        from chatbot.services.ai_service import _classify_rate_limit, AIRateLimitError

        mock_exc = MagicMock()
        mock_exc.code = "rate_limit_exceeded"
        mock_exc.type = "requests"
        mock_exc.message = "Rate limit reached for requests per min."
        mock_exc.body = {"error": {"code": "rate_limit_exceeded", "type": "requests"}}

        res = _classify_rate_limit(mock_exc)
        self.assertIsInstance(res, AIRateLimitError)
        self.assertEqual(res.code, "rate_limit_exceeded")
        self.assertIn("rate limit reached", res.message)


@override_settings(
    AI_PROVIDER="gemini",
    AI_API_KEY="gemini-test-key",
    AI_MODEL="gemini-3.6-flash",
    AI_TIMEOUT_SECONDS=30,
    AI_CONTEXT_MESSAGE_LIMIT=15,
    AI_BASE_URL="",
)
class GeminiServiceTests(SimpleTestCase):
    def test_gemini_config_loads_properly(self):
        config = load_ai_config()
        self.assertEqual(config["provider"], "gemini")
        self.assertEqual(config["model"], "gemini-3.6-flash")
        self.assertEqual(config["timeout_seconds"], 30.0)
        self.assertIsNone(config["base_url"])

    @override_settings(AI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/")
    def test_gemini_sanitizes_openai_base_url(self):
        config = load_ai_config()
        self.assertIsNone(config["base_url"])

    def test_gemini_stream_chat_maps_roles_and_streams_tokens(self):
        from unittest.mock import MagicMock, patch

        mock_chunk1 = MagicMock()
        mock_chunk1.text = "Hello "
        mock_chunk2 = MagicMock()
        mock_chunk2.text = "Vivek!"

        with patch("chatbot.services.ai_service.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_client.models.generate_content_stream.return_value = [mock_chunk1, mock_chunk2]

            messages = [
                {"role": "user", "content": "My name is Vivek."},
                {"role": "assistant", "content": "Nice to meet you!"},
                {"role": "user", "content": "What is my name?"},
            ]

            deltas = list(stream_chat(messages))
            self.assertEqual(deltas, ["Hello ", "Vivek!"])

            mock_client.models.generate_content_stream.assert_called_once()
            call_kwargs = mock_client.models.generate_content_stream.call_args[1]
            contents = call_kwargs["contents"]
            self.assertEqual(len(contents), 3)
            self.assertEqual(contents[0].role, "user")
            self.assertEqual(contents[0].parts[0].text, "My name is Vivek.")
            self.assertEqual(contents[1].role, "model")
            self.assertEqual(contents[1].parts[0].text, "Nice to meet you!")
            self.assertEqual(contents[2].role, "user")
            self.assertEqual(contents[2].parts[0].text, "What is my name?")
            self.assertTrue(call_kwargs["config"].automatic_function_calling.disable)

    def test_gemini_stream_timeout_maps_to_ai_timeout_error(self):
        from unittest.mock import MagicMock, patch
        import httpx
        from chatbot.services.ai_service import AITimeoutError

        with patch("chatbot.services.ai_service.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_client.models.generate_content_stream.side_effect = httpx.ReadTimeout("Timeout")

            with self.assertRaises(AITimeoutError):
                list(stream_chat([{"role": "user", "content": "Hello"}]))

    def test_gemini_stream_connection_error_maps_to_ai_connection_error(self):
        from unittest.mock import MagicMock, patch
        import httpx
        from chatbot.services.ai_service import AIConnectionError

        with patch("chatbot.services.ai_service.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_client.models.generate_content_stream.side_effect = httpx.ConnectError("Network fail")

            with self.assertRaises(AIConnectionError):
                list(stream_chat([{"role": "user", "content": "Hello"}]))

