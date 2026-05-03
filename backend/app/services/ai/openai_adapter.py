from typing import Optional
import openai

from app.services.ai.base import AIServiceInterface


class OpenAIAdapter(AIServiceInterface):
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", model: str = "gpt-4o-mini"):
        self.client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.embedding_model = "text-embedding-3-small"

    async def generate_summary(self, text: str, max_tokens: int = 500) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个专业的图书分析助手。请为以下图书内容生成简洁的摘要，包含核心论点和主要观点。"},
                {"role": "user", "content": text[:5000]},
            ],
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def generate_tags(self, text: str, max_tags: int = 5) -> list[str]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": f"分析以下图书内容，生成{max_tags}个最相关的标签（主题、领域、难度等级）。只返回标签列表，用逗号分隔。"},
                {"role": "user", "content": text[:3000]},
            ],
            max_tokens=100,
        )
        tags_str = response.choices[0].message.content or ""
        return [tag.strip() for tag in tags_str.split(",") if tag.strip()][:max_tags]

    async def get_embedding(self, text: str) -> list[float]:
        response = await self.client.embeddings.create(
            model=self.embedding_model,
            input=text[:8000],
        )
        return response.data[0].embedding

    async def chat(
        self,
        messages: list[dict],
        context: Optional[str] = None,
        max_tokens: int = 1000,
    ) -> str:
        system_msg = "你是一个专业的图书助手，可以帮助用户理解和分析图书内容。"
        if context:
            system_msg += f"\n\n参考上下文：\n{context}"

        full_messages = [{"role": "system", "content": system_msg}] + messages

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
