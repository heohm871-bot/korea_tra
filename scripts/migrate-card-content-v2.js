#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require('crypto');
const admin = require('firebase-admin');

const LOCALES = ['ko', 'en', 'jp', 'cn', 'th', 'ar', 'ru', 'fr'];
const PREFIX = {
  ko: 'KO',
  en: 'EN',
  jp: 'JP',
  cn: 'CN',
  th: 'TH',
  ar: 'AR',
  ru: 'RU',
  fr: 'FR'
};

const TAG_MAP = {
  맛집: 'delicious',
  식사: 'meal',
  아이와함께: 'withKids',
  카페: 'cafe',
  디저트: 'dessert',
  여행: 'travel',
  인생샷: 'photoSpot',
  산책: 'walk',
  힐링: 'healing',
  쇼핑: 'shopping',
  기념품: 'souvenir',
  로컬: 'local',
  핫플: 'hotPlace',
  바다: 'sea',
  야경: 'nightView',
  전통시장: 'traditionalMarket',
  데이트: 'date',
  비오는날: 'rainyDay',
  혼자여행: 'soloTrip'
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const limitArg = process.argv.find((x) => x.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function toPrefix(locale) {
  return PREFIX[locale] || String(locale || 'XX').toUpperCase();
}

function toPlaceholder(locale, source) {
  const base = String(source || '').trim();
  if (!base) return '';
  if (locale === 'ko') return base;
  return `[${toPrefix(locale)}] ${base}`;
}

function ensure3(items) {
  const out = Array.isArray(items) ? items.map((x) => String(x || '').trim()) : [];
  while (out.length < 3) out.push('');
  return out.slice(0, 3);
}

function getFirstDefined(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  const vals = Object.values(obj).filter((x) => typeof x !== 'undefined' && x !== null);
  return vals.length ? vals[0] : undefined;
}

function hashCustomTag(raw) {
  return `custom_${crypto.createHash('sha1').update(String(raw || '')).digest('hex').slice(0, 8)}`;
}

function cleanTag(raw) {
  return String(raw || '').trim().replace(/^#/, '');
}

function extractLegacyStory(data) {
  const cko = data?.cardContent?.ko || {};
  const src = data?.cardContentSource || {};
  return (
    String(data?.cardContentV2?.story?.ko || '').trim() ||
    String(cko.story || '').trim() ||
    String(cko.storyBody || '').trim() ||
    String(src.story || '').trim() ||
    String(src.storyBody || src.background || '').trim() ||
    ''
  );
}

function extractLegacyTips(data) {
  const cko = data?.cardContent?.ko || {};
  const src = data?.cardContentSource || {};
  const v2 = data?.cardContentV2?.tips?.ko;
  const base = Array.isArray(v2) ? v2 : (Array.isArray(cko.tips) ? cko.tips : (Array.isArray(src.tips) ? src.tips : []));
  return ensure3(base);
}

function extractLegacyTags(data) {
  const v2 = data?.cardContentV2?.tags;
  if (Array.isArray(v2) && v2.length) return v2.map((x) => String(x || '').trim()).filter(Boolean);
  const cko = data?.cardContent?.ko || {};
  const src = data?.cardContentSource || {};
  const raw = Array.isArray(cko.tags) ? cko.tags : (Array.isArray(src.tags) ? src.tags : []);
  return raw.map((x) => cleanTag(x)).filter(Boolean);
}

function normalizeTagIds(rawTags, tagLabels) {
  const ids = [];
  const labels = { ...(tagLabels || {}) };
  for (const raw of rawTags) {
    const clean = cleanTag(raw);
    if (!clean) continue;
    const mapped = TAG_MAP[clean];
    if (mapped) {
      ids.push(mapped);
      continue;
    }
    const customId = hashCustomTag(clean);
    ids.push(customId);
    if (!labels[customId] || typeof labels[customId] !== 'object') labels[customId] = {};
    for (const locale of LOCALES) {
      if (!labels[customId][locale]) {
        labels[customId][locale] = toPlaceholder(locale, clean);
      }
    }
  }
  return {
    ids: Array.from(new Set(ids)).slice(0, 6),
    labels
  };
}

function mergeLocaleMap(existing, koValue, isArray = false) {
  const out = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  const baseKo = isArray ? ensure3(Array.isArray(out.ko) ? out.ko : koValue) : String(out.ko || koValue || '').trim();

  if (isArray) {
    out.ko = ensure3(baseKo);
    const koArr = ensure3(out.ko);
    for (const locale of LOCALES) {
      if (!Array.isArray(out[locale]) || !out[locale].length) {
        out[locale] = ensure3(koArr.map((item) => toPlaceholder(locale, item)));
      } else {
        out[locale] = ensure3(out[locale]);
      }
    }
    return out;
  }

  out.ko = baseKo;
  for (const locale of LOCALES) {
    if (!String(out[locale] || '').trim()) {
      out[locale] = toPlaceholder(locale, baseKo);
    }
  }
  return out;
}

async function run() {
  let query = db.collection('places');
  if (limit > 0) query = query.limit(limit);

  const snap = await query.get();
  console.log(`[migrate] places fetched: ${snap.size}`);

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const currentV2 = data.cardContentV2 || {};

    const storyKo = extractLegacyStory(data);
    const tipsKo = extractLegacyTips(data);
    const rawTags = extractLegacyTags(data);

    if (!storyKo && tipsKo.every((x) => !x) && rawTags.length === 0) {
      skipped += 1;
      continue;
    }

    const story = mergeLocaleMap(currentV2.story, storyKo, false);
    const tips = mergeLocaleMap(currentV2.tips, tipsKo, true);
    const normalizedTags = normalizeTagIds(rawTags, currentV2.tagLabels);

    const nextV2 = {
      ...currentV2,
      story,
      tips,
      tags: normalizedTags.ids,
      tagLabels: normalizedTags.labels,
      schemaVersion: 2,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!dryRun) {
      batch.set(doc.ref, { cardContentV2: nextV2 }, { merge: true });
      batchCount += 1;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    updated += 1;
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  console.log(`[migrate] updated: ${updated}, skipped: ${skipped}, dryRun: ${dryRun}`);
}

run().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
