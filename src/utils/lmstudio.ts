interface OpenAIModel {
  id?: string;
}

interface OpenAIModelsResponse {
  data?: OpenAIModel[];
}

const DEFAULT_LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1';

export function resolveLmStudioBaseUrl(rawBaseUrl?: string): string {
  const base = (rawBaseUrl ?? process.env.LMSTUDIO_BASE_URL ?? DEFAULT_LMSTUDIO_BASE_URL).trim();
  const normalized = base.replace(/\/+$/, '');
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

export async function getLmStudioModels(): Promise<string[]> {
  const baseUrl = resolveLmStudioBaseUrl();
  const apiKey = process.env.LMSTUDIO_API_KEY?.trim();

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });

    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as OpenAIModelsResponse;
    return (body.data ?? [])
      .map((model) => model.id?.trim())
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}
