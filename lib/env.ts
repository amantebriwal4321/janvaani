export const env = {
  slngApiKey: process.env.SLNG_API_KEY ?? "",
  slngAgentId: process.env.SLNG_AGENT_ID ?? "janvaani-dev",
  slngRegion: process.env.SLNG_REGION ?? "in",
  byok: {
    url: process.env.LLM_BYOK_URL ?? "",
    key: process.env.LLM_BYOK_KEY ?? "",
    model: process.env.LLM_BYOK_MODEL ?? "",
  },
};

export const hasSlng = () => env.slngApiKey.length > 0;

export const slngHosts = () => ({
  api: `https://${env.slngRegion}.api.slng.ai`,
  ws: `wss://${env.slngRegion}.api.slng.ai`,
  router: `https://${env.slngRegion}.context-router.slng.ai/v1`,
  agents: "https://api.agents.slng.ai",
});
