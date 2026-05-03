import pytest
from app.services.ai.base import AIServiceInterface
from app.services.ai.openai_adapter import OpenAIAdapter
from app.services.ai.claude_adapter import ClaudeAdapter
from app.services.ai.ollama_adapter import OllamaAdapter


def test_ai_interface_has_methods():
    assert hasattr(AIServiceInterface, 'generate_summary')
    assert hasattr(AIServiceInterface, 'generate_tags')
    assert hasattr(AIServiceInterface, 'get_embedding')
    assert hasattr(AIServiceInterface, 'chat')


def test_openai_adapter_implements_interface():
    adapter = OpenAIAdapter(api_key="test-key")
    assert isinstance(adapter, AIServiceInterface)


def test_claude_adapter_implements_interface():
    adapter = ClaudeAdapter(api_key="test-key")
    assert isinstance(adapter, AIServiceInterface)


def test_ollama_adapter_implements_interface():
    adapter = OllamaAdapter(base_url="http://localhost:11434")
    assert isinstance(adapter, AIServiceInterface)
