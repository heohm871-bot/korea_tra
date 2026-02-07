export type LocalizedCardContent = {
  language: string;
  title: string;
  storyTitle: string;
  storyBody: string;
  tips: string[];
  tags: string[];
  categoryLabel: string;
};

export function normalizeLanguage(lang: string | undefined | null): string {
  const raw = String(lang ?? "").trim();
  if (!raw) return "ko";
  const lower = raw.toLowerCase();
  if (lower === "jp") return "ja";
  if (lower === "cn" || lower === "zh-cn") return "zh-CN";
  return raw;
}

export function extractStrictJson(rawText: string): unknown {
  const raw = String(rawText ?? "").trim();
  if (!raw.startsWith("{") || !raw.endsWith("}")) {
    throw new Error("LLM response must be a JSON object only.");
  }
  return JSON.parse(raw);
}

export function validateLocalizedCardContent(
  payload: unknown,
  targetLanguage: string
): LocalizedCardContent {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid payload object.");
  }

  const record = payload as Record<string, unknown>;
  const stringFields: Array<keyof LocalizedCardContent> = [
    "language",
    "title",
    "storyTitle",
    "storyBody",
    "categoryLabel"
  ];
  for (const key of stringFields) {
    if (typeof record[key] !== "string" || String(record[key]).trim().length === 0) {
      throw new Error(`Invalid or missing string field: ${String(key)}`);
    }
  }

  if (!Array.isArray(record.tips) || record.tips.length !== 3 || record.tips.some((x) => typeof x !== "string")) {
    throw new Error("tips must be string[3].");
  }
  if (!Array.isArray(record.tags) || record.tags.length !== 3 || record.tags.some((x) => typeof x !== "string")) {
    throw new Error("tags must be string[3].");
  }

  const normalizedTarget = normalizeLanguage(targetLanguage);
  const normalizedPayloadLang = normalizeLanguage(String(record.language));
  if (normalizedPayloadLang !== normalizedTarget) {
    throw new Error(`language mismatch. expected=${normalizedTarget}, got=${normalizedPayloadLang}`);
  }

  return {
    language: normalizedPayloadLang,
    title: String(record.title).trim(),
    storyTitle: String(record.storyTitle).trim(),
    storyBody: String(record.storyBody).trim(),
    tips: (record.tips as unknown[]).map((x) => String(x).trim()),
    tags: (record.tags as unknown[]).map((x) => String(x).trim()),
    categoryLabel: String(record.categoryLabel).trim()
  };
}

export function coerceSourceFromPlace(
  docData: Record<string, unknown>,
  sourceLanguage: string
): LocalizedCardContent | null {
  const normalizeLoose = (
    raw: Record<string, unknown>,
    fallbackLanguage: string
  ): LocalizedCardContent => {
    const tips = Array.isArray(raw.tips) ? raw.tips.slice(0, 3) : [];
    const tags = Array.isArray(raw.tags) ? raw.tags.slice(0, 3) : [];
    while (tips.length < 3) tips.push("");
    while (tags.length < 3) tags.push("");
    return {
      language: normalizeLanguage(String(raw.language ?? fallbackLanguage)),
      title: String(raw.title ?? "").trim(),
      storyTitle: String(raw.storyTitle ?? raw.hook ?? "").trim(),
      storyBody: String(raw.storyBody ?? raw.background ?? "").trim(),
      tips: tips.map((x) => String(x).trim()),
      tags: tags.map((x) => String(x).trim()),
      categoryLabel: String(raw.categoryLabel ?? "").trim()
    };
  };

  const cardContent = docData.cardContent as Record<string, unknown> | undefined;
  if (cardContent && typeof cardContent === "object") {
    const bySource = cardContent[sourceLanguage];
    if (bySource && typeof bySource === "object") {
      return normalizeLoose(bySource as Record<string, unknown>, sourceLanguage);
    }
    const byKo = cardContent.ko;
    if (byKo && typeof byKo === "object") {
      return normalizeLoose(byKo as Record<string, unknown>, "ko");
    }
  }

  const cardContentSource = docData.cardContentSource as Record<string, unknown> | undefined;
  if (cardContentSource && typeof cardContentSource === "object") {
    const tips = Array.isArray(cardContentSource.tips) ? cardContentSource.tips.slice(0, 3) : [];
    const tags = Array.isArray(cardContentSource.tags) ? cardContentSource.tags.slice(0, 3) : [];
    while (tips.length < 3) tips.push("");
    while (tags.length < 3) tags.push("");

    return {
      language: sourceLanguage,
      title: String(cardContentSource.title ?? docData.title ?? "").trim(),
      storyTitle: String(cardContentSource.storyTitle ?? cardContentSource.hook ?? docData.title ?? "").trim(),
      storyBody: String(cardContentSource.storyBody ?? cardContentSource.background ?? docData.address ?? "").trim(),
      tips: tips.map((x) => String(x).trim()),
      tags: tags.map((x) => String(x).trim()),
      categoryLabel: String(cardContentSource.categoryLabel ?? docData.category ?? "").trim()
    };
  }

  return null;
}
