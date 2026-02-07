const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
setGlobalOptions({ maxInstances: 10, region: "asia-northeast3" });

const db = getFirestore();

const SUPPORTED_LANGS = new Set(["ko", "en", "ja", "jp", "cn", "zh", "zh-CN", "th", "ar", "ru", "fr"]);

function normalizeLanguage(lang) {
  const raw = String(lang || "").trim();
  if (!raw) return "ko";
  const lower = raw.toLowerCase();
  if (lower === "jp") return "ja";
  if (lower === "cn" || lower === "zh-cn") return "zh-CN";
  return raw;
}

function extractStrictJson(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw.startsWith("{") || !raw.endsWith("}")) {
    throw new Error("LLM response must be JSON object only.");
  }
  return JSON.parse(raw);
}

function validateLocalizedCardContent(payload, targetLanguage) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid payload object.");
  }

  const requiredString = ["language", "title", "storyTitle", "storyBody", "categoryLabel"];
  for (const key of requiredString) {
    if (typeof payload[key] !== "string" || payload[key].trim().length === 0) {
      throw new Error(`Invalid or missing string field: ${key}`);
    }
  }

  if (!Array.isArray(payload.tips) || payload.tips.length !== 3 || payload.tips.some((x) => typeof x !== "string")) {
    throw new Error("tips must be string[3].");
  }

  if (!Array.isArray(payload.tags) || payload.tags.length !== 3 || payload.tags.some((x) => typeof x !== "string")) {
    throw new Error("tags must be string[3].");
  }

  const normalizedTarget = normalizeLanguage(targetLanguage);
  const normalizedPayloadLang = normalizeLanguage(payload.language);
  if (normalizedPayloadLang !== normalizedTarget) {
    throw new Error(`language mismatch. expected=${normalizedTarget}, got=${normalizedPayloadLang}`);
  }
}

function coerceSourceFromLegacy(docData, sourceLanguage) {
  const cardContent = docData?.cardContent;
  if (cardContent && typeof cardContent === "object") {
    if (cardContent[sourceLanguage]) return cardContent[sourceLanguage];
    if (cardContent.ko) return cardContent.ko;
  }

  const source = docData?.cardContentSource;
  if (source && typeof source === "object") {
    const title = String(source.title || docData?.title || "").trim();
    const storyTitle = String(source.storyTitle || source.hook || title).trim();
    const storyBody = String(source.storyBody || source.background || docData?.address || "").trim();
    const tips = Array.isArray(source.tips) ? source.tips.slice(0, 3) : [];
    const tags = Array.isArray(source.tags) ? source.tags.slice(0, 3) : [];

    return {
      language: sourceLanguage,
      title,
      storyTitle,
      storyBody,
      tips: [tips[0] || "", tips[1] || "", tips[2] || ""],
      tags: [tags[0] || "", tags[1] || "", tags[2] || ""],
      categoryLabel: String(source.categoryLabel || docData?.category || "").trim()
    };
  }

  const fallbackTitle = String(docData?.title || "").trim();
  return {
    language: sourceLanguage,
    title: fallbackTitle,
    storyTitle: fallbackTitle,
    storyBody: String(docData?.address || "").trim(),
    tips: ["", "", ""],
    tags: ["", "", ""],
    categoryLabel: String(docData?.category || "").trim()
  };
}

function buildPrompt({ cardContentSource, sourceLanguage, targetLanguage }) {
  return `
당신은 여행/장소 카드 콘텐츠를 다국어로 “현지화 번역”하는 편집자입니다.
반드시 targetLanguage 한 언어로만 결과를 작성하세요. 다른 언어가 섞이면 실패입니다.

## 목표
- 입력으로 주어진 cardContentSource(원문 콘텐츠)를 targetLanguage로 자연스럽게 번역/현지화합니다.
- 결과는 Firestore에 cardContent.<lang>로 저장 가능합니다.

## 중요한 제약
1) 출력은 반드시 "JSON 객체 하나"만 반환하세요. 코드블록(\`\`\`) 금지, 설명문 금지.
2) 스키마를 100% 지키세요:
{
  "language": "<targetLanguage>",
  "title": "...",
  "storyTitle": "...",
  "storyBody": "...",
  "tips": ["...", "...", "..."],
  "tags": ["...", "...", "..."],
  "categoryLabel": "..."
}
3) 사실 추가 금지: 입력에 없는 사실/수치/평가를 만들어내지 마세요.
4) 번역 금지 항목은 원문 유지:
   - 주소, 전화번호, URL, 좌표, 숫자, 시간, 고유명사(브랜드/지명 표기)
5) 문체:
   - 카드 UI에 맞게 간결/명확/자연스러운 문장
   - 과장/광고성 문구 금지

## 입력
sourceLanguage: ${sourceLanguage}
targetLanguage: ${targetLanguage}
cardContentSource:
${JSON.stringify(cardContentSource)}
`.trim();
}

async function translateWithLLM(prompt) {
  // TODO: Replace with your production LLM gateway/client.
  // Keep API keys/secrets in env vars or Secret Manager, never hardcode.
  // Example: call your internal translation endpoint with strict JSON-mode.
  throw new Error("translateWithLLM is not implemented. Wire this to your LLM provider.");
}

exports.localizeCardContent = onCall(async (request) => {
  const data = request.data || {};
  const placeId = String(data.placeId || "").trim();
  const rawTargetLanguage = String(data.targetLanguage || "").trim();
  const rawSourceLanguage = String(data.sourceLanguage || "ko").trim();
  const force = Boolean(data.force);

  if (!placeId) {
    throw new HttpsError("invalid-argument", "placeId is required.");
  }
  if (!rawTargetLanguage) {
    throw new HttpsError("invalid-argument", "targetLanguage is required.");
  }

  const targetLanguage = normalizeLanguage(rawTargetLanguage);
  const sourceLanguage = normalizeLanguage(rawSourceLanguage || "ko");

  if (!SUPPORTED_LANGS.has(targetLanguage)) {
    throw new HttpsError("invalid-argument", `Unsupported targetLanguage: ${targetLanguage}`);
  }

  const placeRef = db.collection("places").doc(placeId);
  const snap = await placeRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Place not found.");
  }

  const docData = snap.data() || {};
  const existing = docData?.cardContent?.[targetLanguage];
  if (existing && !force) {
    return {
      placeId,
      targetLanguage,
      sourceLanguage,
      reused: true,
      cardContent: existing
    };
  }

  const sourceContent = coerceSourceFromLegacy(docData, sourceLanguage);
  if (!sourceContent || typeof sourceContent !== "object") {
    throw new HttpsError("failed-precondition", "No source content available for localization.");
  }

  let localized = null;

  if (targetLanguage === sourceLanguage) {
    localized = { ...sourceContent, language: targetLanguage };
  } else {
    const prompt = buildPrompt({
      cardContentSource: sourceContent,
      sourceLanguage,
      targetLanguage
    });
    const llmRaw = await translateWithLLM(prompt);
    localized = extractStrictJson(llmRaw);
  }

  validateLocalizedCardContent(localized, targetLanguage);

  await placeRef.set(
    {
      cardContent: {
        [targetLanguage]: localized
      },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return {
    placeId,
    targetLanguage,
    sourceLanguage,
    reused: false,
    cardContent: localized
  };
});
