import httpx

from app.services.ai.base import AIServiceInterface


class OllamaAdapter(AIServiceInterface):
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.1"):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.embedding_model = "nomic-embed-text"

    async def generate_summary(self, text: str, max_tokens: int = 500) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": f"请为以下图书内容生成简洁的摘要，包含核心论点和主要观点：\n\n{text[:5000]}",
                    "stream": False,
                    "options": {"num_predict": max_tokens},
                },
                timeout=60,
            )
            response.raise_for_status()
            return response.json()["response"]

    async def generate_tags(self, text: str, max_tags: int = 5) -> list[str]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": f"分析以下图书内容，生成{max_tags}个最相关的标签。只返回标签列表，用逗号分隔。\n\n{text[:3000]}",
                    "stream": False,
                    "options": {"num_predict": 100},
                },
                timeout=30,
            )
            response.raise_for_status()
            tags_str = response.json()["response"]
            return [tag.strip() for tag in tags_str.split(",") if tag.strip()][:max_tags]

    async def get_embedding(self, text: str) -> list[float]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={
                    "model": self.embedding_model,
                    "prompt": text[:8000],
                },
                timeout=30,
            )
            response.raise_for_status()
            return response.json()["embedding"]

    async def chat(
        self,
        messages: list[dict],
        context: str | None = None,
        max_tokens: int = 1000,
    ) -> str:
        system_msg = "你是一个专业的图书助手，可以帮助用户理解和分析图书内容。"
        if context:
            system_msg += f"\n\n参考上下文：\n{context}"

        ollama_messages = [{"role": "system", "content": system_msg}]
        for msg in messages:
            ollama_messages.append({"role": msg["role"], "content": msg["content"]})

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": ollama_messages,
                    "stream": False,
                    "options": {"num_predict": max_tokens},
                },
                timeout=60,
            )
            response.raise_for_status()
            return response.json()["message"]["content"]
