export type AiModelOption = { id: string; name: string; owned_by?: string };

export type AiSettings = {
  provider: "nanogpt";
  textModel: string;
  imageModel: string;
  videoModel: string;
  autonomyLevel: number;
  updatedAt: string;
};

const STORAGE_KEY = "proads_ai_settings";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "nanogpt",
  textModel: "zai-org/glm-5.2",
  imageModel: "gpt-image-2",
  videoModel: "happyhorse-1.1",
  autonomyLevel: 3,
  updatedAt: new Date(0).toISOString(),
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      ...DEFAULT_AI_SETTINGS,
      ...parsed,
      provider: "nanogpt",
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(next: Partial<AiSettings>): AiSettings {
  const merged: AiSettings = {
    ...loadAiSettings(),
    ...next,
    provider: "nanogpt",
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}
