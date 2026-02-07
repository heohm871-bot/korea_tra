import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { buildLocalizationPrompt, translateWithLLM } from "./lib/llm";
import {
  coerceSourceFromPlace,
  extractStrictJson,
  normalizeLanguage,
  validateLocalizedCardContent
} from "./lib/validate";

initializeApp();
setGlobalOptions({ maxInstances: 10, region: "asia-northeast3" });

const db = getFirestore();
const TRANSLATION_VERSION = 1;
const SUPPORTED_LANGS = new Set([
  "ko",
  "en",
  "ja",
  "jp",
  "cn",
  "zh",
  "zh-CN",
  "th",
  "ar",
  "ru",
  "fr"
]);

type LocalizeCardContentInput = {
  placeId?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  force?: boolean;
};

export const localizeCardContent = onCall(async (request) => {
  const data = (request.data ?? {}) as LocalizeCardContentInput;
  const placeId = String(data.placeId ?? "").trim();
  const rawTargetLanguage = String(data.targetLanguage ?? "").trim();
  const rawSourceLanguage = String(data.sourceLanguage ?? "ko").trim();
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

  const docData = (snap.data() ?? {}) as Record<string, unknown>;
  const existingCardContent = (docData.cardContent as Record<string, unknown> | undefined)?.[targetLanguage];
  if (existingCardContent && !force) {
    return {
      placeId,
      targetLanguage,
      sourceLanguage,
      reused: true,
      cardContent: existingCardContent
    };
  }

  const sourceContent = coerceSourceFromPlace(docData, sourceLanguage);
  if (!sourceContent) {
    throw new HttpsError("failed-precondition", "No source content available for localization.");
  }

  let localized;
  if (targetLanguage === sourceLanguage) {
    localized = { ...sourceContent, language: targetLanguage };
  } else {
    const placePromptContext = {
      title: docData.title ?? "",
      address: docData.address ?? "",
      category: docData.category ?? ""
    };
    const prompt = buildLocalizationPrompt({
      targetLanguage,
      sourceLanguage,
      place: placePromptContext,
      cardContentSource: sourceContent
    });

    const llmRaw = await translateWithLLM(prompt);
    const parsed = extractStrictJson(llmRaw);
    localized = validateLocalizedCardContent(parsed, targetLanguage);
  }

  await placeRef.set(
    {
      cardContent: {
        [targetLanguage]: localized
      },
      translationVersion: TRANSLATION_VERSION,
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
