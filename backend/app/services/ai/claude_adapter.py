import anthropic

from app.services.ai.base import AIServiceInterface


class ClaudeAdapter(AIServiceInterface):
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    async def generate_summary(self, text: str, max_tokens: int = 500) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system="你是一个专业的图书分析助手。请为以下图书内容生成简洁的摘要，包含核心论点和主要观点。",
            messages=[{"role": "user", "content": text[:5000]}],
        )
        return response.content[0].text

    async def generate_tags(self, text: str, max_tags: int = 5) -> list[str]:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=100,
            system=f"分析以下图书内容，生成{max_tags}个最相关的标签（主题、领域、难度等级）。只返回标签列表，用逗号分隔。",
            messages=[{"role": "user", "content": text[:3000]}],
        )
        tags_str = response.content[0].text
        return [tag.strip() for tag in tags_str.split(",") if tag.strip()][:max_tags]

    async def get_embedding(self, text: str) -> list[float]:
        # Claude doesn't have native embedding, fall back to OpenAI-compatible
        raise NotImplementedError("Claude does not provide embeddings. Use OpenAI or Ollama.")

    async def chat(
        self,
        messages: list[dict],
        context: str | None = None,
        max_tokens: int = 1000,
    ) -> str:
        system_msg = "你是一个专业的图书助手，可以帮助用户理解和分析图书内容。"
        if context:
            system_msg += f"\n\n参考上下文：\n{context}"

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_msg,
            messages=[{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"],
        )
        return response.content[0].text
