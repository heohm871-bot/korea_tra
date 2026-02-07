#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://korea-tra.pages.dev";
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data_places_final.js");

const CATEGORY_LABELS = {
  restaurant: "맛집",
  cafe: "카페",
  hotel: "호텔/리조트",
  tourism: "관광지",
  drama: "드라마 촬영지",
  activity: "액티비티",
  shop: "쇼핑",
  nature: "자연",
  photo: "포토존",
};

const PROVINCE_SLUGS = {
  서울: "seoul",
  부산: "busan",
  대구: "daegu",
  인천: "incheon",
  광주: "gwangju",
  대전: "daejeon",
  울산: "ulsan",
  세종: "sejong",
  경기: "gyeonggi",
  강원: "gangwon",
  충북: "chungbuk",
  충남: "chungnam",
  전북: "jeonbuk",
  전남: "jeonnam",
  경북: "gyeongbuk",
  경남: "gyeongnam",
  제주: "jeju",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readPlaceData() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const match = raw.match(/const\s+placeData\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!match) throw new Error("Failed to parse placeData from data_places_final.js");
  return JSON.parse(match[1]);
}

function normalizeSlug(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sortByCountDesc(entries) {
  return entries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
}

function layoutHtml({ title, description, canonical, h1, intro, listItemsHtml, breadcrumbsJsonLd, itemListJsonLd }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="K-Spotlight">
  <meta name="theme-color" content="#0071e3">
  <meta name="format-detection" content="telephone=no">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="ko-KR" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}">
  <meta property="og:site_name" content="K-Spotlight">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${SITE_URL}/og-image.svg">
  <meta property="og:locale" content="ko_KR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.svg">
  <meta name="robots" content="index,follow">
  <link rel="stylesheet" href="/style.css">
  <link rel="icon" href="/favicon.svg" type="image/jpeg">
  <style>
    .seo-wrap { max-width: 980px; margin: 0 auto; padding: 24px 16px 56px; }
    .seo-nav { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .seo-nav a { color: #0071e3; font-weight: 700; text-decoration: none; }
    .seo-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
    .seo-card h1 { margin: 0 0 10px; font-size: 28px; }
    .seo-card p { margin: 0 0 16px; color: #374151; line-height: 1.6; }
    .seo-list { display: grid; gap: 10px; padding-left: 18px; }
    .seo-list li { line-height: 1.5; }
    .seo-list a { color: #111827; text-decoration: none; font-weight: 700; }
    .seo-list span { color: #6b7280; font-size: 13px; }
  </style>
  <script type="application/ld+json">${JSON.stringify(breadcrumbsJsonLd)}</script>
  <script type="application/ld+json">${JSON.stringify(itemListJsonLd)}</script>
</head>
<body>
  <div class="seo-wrap">
    <nav class="seo-nav" aria-label="SEO 탐색 링크">
      <a href="/">홈</a>
      <a href="/region/index.html">지역별</a>
      <a href="/category/index.html">카테고리별</a>
      <a href="/about.html">소개</a>
      <a href="/contact.html">문의</a>
    </nav>
    <section class="seo-card">
      <h1>${escapeHtml(h1)}</h1>
      <p>${escapeHtml(intro)}</p>
      <ol class="seo-list">
        ${listItemsHtml}
      </ol>
    </section>
  </div>
</body>
</html>`;
}

function buildRegionPages(placeData) {
  const regionDir = path.join(ROOT, "region");
  ensureDir(regionDir);

  const regionMap = new Map();
  for (const item of placeData) {
    const province = String(item.province || "").trim();
    if (!province) continue;
    if (!regionMap.has(province)) regionMap.set(province, []);
    regionMap.get(province).push(item);
  }

  const summary = sortByCountDesc(
    [...regionMap.entries()].map(([name, list]) => ({ name, count: list.length }))
  );

  const createdUrls = [];

  for (const entry of summary) {
    const province = entry.name;
    const slug = PROVINCE_SLUGS[province] || normalizeSlug(province);
    const fileName = `${slug}.html`;
    const filePath = path.join(regionDir, fileName);
    const url = `${SITE_URL}/region/${fileName}`;
    const places = (regionMap.get(province) || []).slice(0, 120);
    const listItemsHtml = places
      .map((p) => `<li><a href="/">${escapeHtml(p.title)}</a> <span>${escapeHtml(p.city || "")} · ${escapeHtml(CATEGORY_LABELS[p.category] || p.category || "기타")}</span></li>`)
      .join("\n");

    const breadcrumbsJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "지역별", item: `${SITE_URL}/region/index.html` },
        { "@type": "ListItem", position: 3, name: `${province} 여행 추천`, item: url },
      ],
    };
    const itemListJsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${province} 여행 추천 장소`,
      url,
      inLanguage: "ko-KR",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: places.slice(0, 30).map((p, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: p.title,
          url: `${SITE_URL}/`,
        })),
      },
    };

    fs.writeFileSync(
      filePath,
      layoutHtml({
        title: `${province} 여행 추천 장소 | K-Spotlight`,
        description: `${province} 지역의 맛집, 카페, 숙소, 관광, 액티비티 추천 장소를 정리했습니다.`,
        canonical: url,
        h1: `${province} 여행 추천 장소`,
        intro: `${province} 지역에서 많이 찾는 여행 장소를 카테고리별로 정리했습니다. 지속적으로 업데이트됩니다.`,
        listItemsHtml,
        breadcrumbsJsonLd,
        itemListJsonLd,
      }),
      "utf8"
    );

    createdUrls.push(url);
  }

  const hubItems = summary
    .map((x) => {
      const slug = PROVINCE_SLUGS[x.name] || normalizeSlug(x.name);
      return `<li><a href="/region/${slug}.html">${escapeHtml(x.name)} 추천</a> <span>${x.count.toLocaleString("ko-KR")}개</span></li>`;
    })
    .join("\n");

  const hubUrl = `${SITE_URL}/region/index.html`;
  fs.writeFileSync(
    path.join(regionDir, "index.html"),
    layoutHtml({
      title: "지역별 여행 추천 | K-Spotlight",
      description: "대한민국 지역별 여행 추천 장소를 정적 페이지로 제공합니다.",
      canonical: hubUrl,
      h1: "지역별 여행 추천",
      intro: "각 지역의 추천 장소를 정적 페이지로 제공해 검색엔진과 사용자가 더 빠르게 탐색할 수 있습니다.",
      listItemsHtml: hubItems,
      breadcrumbsJsonLd: {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "지역별", item: hubUrl },
        ],
      },
      itemListJsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "지역별 여행 추천",
        url: hubUrl,
        inLanguage: "ko-KR",
      },
    }),
    "utf8"
  );
  createdUrls.push(hubUrl);

  return createdUrls;
}

function buildCategoryPages(placeData) {
  const categoryDir = path.join(ROOT, "category");
  ensureDir(categoryDir);

  const categoryMap = new Map();
  for (const item of placeData) {
    const category = String(item.category || "").trim();
    if (!category) continue;
    if (!categoryMap.has(category)) categoryMap.set(category, []);
    categoryMap.get(category).push(item);
  }

  const summary = sortByCountDesc(
    [...categoryMap.entries()].map(([name, list]) => ({ name, count: list.length }))
  );

  const createdUrls = [];

  for (const entry of summary) {
    const category = entry.name;
    const label = CATEGORY_LABELS[category] || category;
    const slug = normalizeSlug(category);
    const fileName = `${slug}.html`;
    const filePath = path.join(categoryDir, fileName);
    const url = `${SITE_URL}/category/${fileName}`;
    const places = (categoryMap.get(category) || []).slice(0, 120);
    const listItemsHtml = places
      .map((p) => `<li><a href="/">${escapeHtml(p.title)}</a> <span>${escapeHtml(p.province || "")} ${escapeHtml(p.city || "")}</span></li>`)
      .join("\n");

    const breadcrumbsJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "카테고리별", item: `${SITE_URL}/category/index.html` },
        { "@type": "ListItem", position: 3, name: `${label} 추천`, item: url },
      ],
    };
    const itemListJsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${label} 추천 장소`,
      url,
      inLanguage: "ko-KR",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: places.slice(0, 30).map((p, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: p.title,
          url: `${SITE_URL}/`,
        })),
      },
    };

    fs.writeFileSync(
      filePath,
      layoutHtml({
        title: `${label} 추천 장소 | K-Spotlight`,
        description: `${label} 카테고리의 여행 추천 장소를 지역별로 정리했습니다.`,
        canonical: url,
        h1: `${label} 추천 장소`,
        intro: `${label} 카테고리의 주요 장소를 정적 페이지로 제공합니다.`,
        listItemsHtml,
        breadcrumbsJsonLd,
        itemListJsonLd,
      }),
      "utf8"
    );

    createdUrls.push(url);
  }

  const hubItems = summary
    .map((x) => `<li><a href="/category/${normalizeSlug(x.name)}.html">${escapeHtml(CATEGORY_LABELS[x.name] || x.name)}</a> <span>${x.count.toLocaleString("ko-KR")}개</span></li>`)
    .join("\n");
  const hubUrl = `${SITE_URL}/category/index.html`;
  fs.writeFileSync(
    path.join(categoryDir, "index.html"),
    layoutHtml({
      title: "카테고리별 여행 추천 | K-Spotlight",
      description: "맛집, 카페, 숙소, 관광지 등 카테고리별 추천 장소를 제공합니다.",
      canonical: hubUrl,
      h1: "카테고리별 여행 추천",
      intro: "관심 카테고리 중심으로 여행 장소를 빠르게 탐색할 수 있는 정적 페이지입니다.",
      listItemsHtml: hubItems,
      breadcrumbsJsonLd: {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "카테고리별", item: hubUrl },
        ],
      },
      itemListJsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "카테고리별 여행 추천",
        url: hubUrl,
        inLanguage: "ko-KR",
      },
    }),
    "utf8"
  );
  createdUrls.push(hubUrl);

  return createdUrls;
}

function updateSitemaps(extraUrls) {
  const baseUrls = [
    `${SITE_URL}/`,
    `${SITE_URL}/about.html`,
    `${SITE_URL}/geo.html`,
    `${SITE_URL}/contact.html`,
    `${SITE_URL}/privacy.html`,
    `${SITE_URL}/terms.html`,
  ];
  const all = [...new Set([...baseUrls, ...extraUrls])];

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...all.map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>`),
    `</urlset>`,
    ``,
  ].join("\n");

  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
  fs.writeFileSync(path.join(ROOT, "sitemap.txt"), `${all.join("\n")}\n`, "utf8");
}

function run() {
  const placeData = readPlaceData();
  const regionUrls = buildRegionPages(placeData);
  const categoryUrls = buildCategoryPages(placeData);
  updateSitemaps([...regionUrls, ...categoryUrls]);
  console.log(`Generated ${regionUrls.length} region URLs and ${categoryUrls.length} category URLs.`);
}

run();
