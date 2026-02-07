/**
 * K-Local Vibe - Interactive Restaurant Map with Leaflet.js
 * Phase 2: Leaflet.js Map Implementation
 */

let currentLang = 'ko';
let map = null;
let markers = [];
let currentFilter = 'all';
let mapMode = 'province'; // 'province' | 'detail'
let provinceSummaryLayer = null;
let currentDataSet = [];
let useMapMarkers = true;
let searchQuery = ''; // Add searchQuery variable
let listRenderLimit = 120;

let flaggedItems = [];
let flaggedItemKeys = new Set();

let lastRestaurantDetailId = null;
let currentRankingPeriodDays = 0; // 0 = all time

const CATEGORY_NORMALIZE_VERSION = 7;
const PLACE_FEEDBACK_STORAGE_KEY = 'kspotlight.placeFeedback.v1';
const PLACE_LIKED_STORAGE_KEY = 'kspotlight.placeFeedbackLiked.v1';
const PLACE_SEARCH_STORAGE_KEY = 'kspotlight.placeSearch.v1';
const PLACE_SEARCH_TERM_STORAGE_KEY = 'kspotlight.searchTerms.v1';
const LOCAL_UID_STORAGE_KEY = 'kspotlight.localUid.v1';
const COMMENTER_NAME_STORAGE_KEY = 'kspotlight.commenterName.v1';
const PLANNER_ORIGIN_STORAGE_KEY = 'k-local-vibe-planner-origin';
const PLACE_COMMENT_MAX_LENGTH = 200;
const PLACE_COMMENT_VISIBLE_LIMIT = 20;
const ADSENSE_CLIENT_ID = 'ca-pub-9451611288918928';
let adsenseLoadAttempted = false;
let categoryChartMode = 'all'; // 'all' | 'filtered'

function hasPublisherContentReady() {
    const main = document.querySelector('.main-content');
    if (!main) return false;
    const text = String(main.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 200) return false;
    const grid = document.getElementById('contentGrid');
    if (!grid) return false;
    return true;
}

function injectAdSenseScript() {
    if (adsenseLoadAttempted) return;
    adsenseLoadAttempted = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
}

function maybeLoadAdSense() {
    if (adsenseLoadAttempted) return;
    if (typeof placeData === 'undefined' || !Array.isArray(placeData) || placeData.length === 0) return;
    if (!hasPublisherContentReady()) return;
    injectAdSenseScript();
}

function looksLikeRestaurant(place) {
    const title = String(place?.title ?? '').trim();
    const type = String(place?.type ?? '').trim();
    const address = String(place?.address ?? '').trim();
    const hay = `${title} ${type} ${address}`;

    // Strong cues: if these appear in title/address, it's very likely food/restaurant.
    if (/(막국수|국수|면|국밥|반점|중식|중국집|짜장|짬뽕|탕수육|갈비|곱창|삼겹|횟집|초밥|스시|돈까스|족발|보쌈|해장국|설렁탕|곰탕|감자탕|김치찌개|된장찌개|식당|맛집|전문점)/.test(hay)) {
        return true;
    }

    // Common restaurant-ish suffixes (avoid overly broad tokens like '집')
    return /(가든|회관|정식|기사식당)/.test(title);
}

const specialtiesByProvince = {
    강원: [
        { name: '감자', note: '대표 농산물' },
        { name: '메밀', note: '막국수/메밀전병 등' },
        { name: '황태', note: '건어물/해장국 재료로 유명' }
    ],
    제주: [
        { name: '감귤', note: '제철/가공품 다양' },
        { name: '흑돼지', note: '대표 먹거리' },
        { name: '한라봉', note: '선물용 인기' }
    ],
    경기: [
        { name: '이천 쌀', note: '쌀 산지로 유명' },
        { name: '안성 한우', note: '지역 브랜드' },
        { name: '도자기', note: '여주/이천 도예 문화' }
    ]
};

function getSpecialtiesForProvince(provinceKey) {
    const key = String(provinceKey ?? '').trim();
    if (!key) return [];
    return Array.isArray(specialtiesByProvince[key]) ? specialtiesByProvince[key] : [];
}

function renderSpecialtiesCardForProvince(prov) {
    const provinceKey = String(prov ?? '').trim();
    if (!provinceKey || provinceKey === '기타') return '';
    const items = getSpecialtiesForProvince(provinceKey);
    if (!items || items.length === 0) return '';

    const title = `${getProvinceName(provinceKey)} 특산품`;
    const rows = items.slice(0, 6).map((x, i) => {
        return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:${i === 0 ? 'none' : '1px solid #f2f2f7'};">\n  <div style="font-weight:1000;color:#111827;min-width:84px;">${escapeHtmlAttr(x.name)}</div>\n  <div style="font-size:12px;color:#6b7280;font-weight:800;line-height:1.4;">${escapeHtmlAttr(x.note || '')}</div>\n</div>`;
    }).join('');

    return `\n<div style="grid-column: 1/-1; background:#ffffff; border-radius:16px; padding:14px 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); margin-bottom: 10px;">\n  <div style="font-weight:1000;margin-bottom:6px;color:#111827;">${escapeHtmlAttr(title)}</div>\n  <div style="font-size:12px;color:#6b7280;font-weight:800;margin-bottom:10px;">검색 결과 상위 지역 기준으로 특산품을 소개합니다.</div>\n  ${rows}\n</div>`;
}

function renderSpecialtiesCardForTopProvince(places) {
    const top1 = groupTopNByProvince(places, 1)[0];
    if (!top1) return '';
    const prov = top1.province;
    if (prov === '기타') return '';
    return renderSpecialtiesCardForProvince(prov);
}

function resetFlaggedItems() {
    flaggedItems = [];
    flaggedItemKeys = new Set();
    ensureFlaggedReportButton();
}

function addFlaggedItemOnce(item) {
    const k = String(item?.key ?? '').trim();
    if (!k) return;
    if (flaggedItemKeys.has(k)) return;
    flaggedItemKeys.add(k);
    flaggedItems.push(item);
}

function buildFlaggedPatterns(items) {
    const m = new Map();
    items.forEach((it) => {
        const from = String(it?.rawCategory ?? '').trim() || '(empty)';
        const to = String(it?.normalizedCategory ?? '').trim() || '(empty)';
        const key = `${from} → ${to}`;
        m.set(key, (m.get(key) || 0) + 1);
    });
    return Array.from(m.entries())
        .map(([k, count]) => ({ key: k, count }))
        .sort((a, b) => b.count - a.count);
}

function ensureFlaggedReportButton() {
    let btn = document.getElementById('flaggedReportButton');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'flaggedReportButton';
        btn.type = 'button';
        btn.style.cssText = `
            position: fixed; bottom: 80px; right: 20px; z-index: 20000;
            background: #111827; color: white; border: none; padding: 12px 14px;
            border-radius: 14px; cursor: pointer; font-weight: 900; font-size: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.18);
            display: none;
        `;
        btn.addEventListener('click', () => {
            openFlaggedReportModal();
        });
        document.body.appendChild(btn);
    }
    const n = flaggedItems.length;
    btn.textContent = `정규화 리포트 (${n})`;
    btn.style.display = n > 0 ? 'inline-flex' : 'none';
}

function ensureStampButton() {
    let btn = document.getElementById('stampButton');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'stampButton';
        btn.type = 'button';
        btn.style.cssText = `
            position: fixed; bottom: 140px; right: 20px; z-index: 20000;
            background: #0071e3; color: white; border: none; padding: 12px 14px;
            border-radius: 14px; cursor: pointer; font-weight: 900; font-size: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.18);
        `;
        btn.addEventListener('click', () => {
            showStampStatus();
        });
        document.body.appendChild(btn);
    }
    btn.textContent = translations[currentLang]?.stampButton || '스탬프';
}

async function copyJsonToClipboard(jsonText) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(jsonText);
            showToast('JSON이 클립보드에 복사되었습니다');
            return;
        }
    } catch {
        // ignore
    }
    // fallback
    const ta = document.createElement('textarea');
    ta.value = jsonText;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
        document.execCommand('copy');
        showToast('JSON이 클립보드에 복사되었습니다');
    } catch {
        // ignore
    }
    document.body.removeChild(ta);
}

function downloadJson(filename, jsonText) {
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

function openFlaggedReportModal() {
    const items = flaggedItems.slice();
    const patterns = buildFlaggedPatterns(items).slice(0, 8);
    const jsonText = JSON.stringify({
        generatedAt: new Date().toISOString(),
        total: items.length,
        patterns,
        items
    }, null, 2);

    const modal = document.createElement('div');
    modal.id = 'flaggedReportModal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.45);
        z-index: 30000; display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;

    const patternRows = patterns.map((p) => {
        return `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:${p === patterns[0] ? 'none' : '1px solid #f2f2f7'};">
  <div style="font-weight:900;color:#111827;">${escapeHtmlAttr(p.key)}</div>
  <div style="font-weight:900;color:#0071e3;">${p.count.toLocaleString()}</div>
</div>`;
    }).join('');

    const preview = items.slice(0, 50).map((it) => {
        const title = String(it?.title ?? '').trim();
        const from = String(it?.rawCategory ?? '').trim();
        const to = String(it?.normalizedCategory ?? '').trim();
        const type = String(it?.type ?? '').trim();
        return `<div style="padding:10px 0;border-top:1px solid #f2f2f7;">
  <div style="font-weight:900;color:#111827;">${escapeHtmlAttr(title || '(no title)')}</div>
  <div style="font-size:12px;color:#6b7280;font-weight:800;">${escapeHtmlAttr(from)} → ${escapeHtmlAttr(to)} ${type ? `• ${escapeHtmlAttr(type)}` : ''}</div>
</div>`;
    }).join('');

    modal.innerHTML = `
        <div style="background:white;border-radius:18px;max-width:720px;width:100%;max-height:80vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.22);">
            <div style="padding:16px 18px;border-bottom:1px solid #f2f2f7;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <div>
                    <div style="font-weight:1000;font-size:16px;color:#111827;">카테고리 정규화 리포트</div>
                    <div style="font-size:12px;color:#6b7280;font-weight:800;">총 ${items.length.toLocaleString()}건 교정 감지</div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                    <button type="button" data-action="copy" style="border:none;border-radius:12px;padding:10px 12px;font-weight:900;cursor:pointer;background:#111827;color:#fff;">JSON 복사</button>
                    <button type="button" data-action="download" style="border:none;border-radius:12px;padding:10px 12px;font-weight:900;cursor:pointer;background:#f2f2f7;color:#111827;">JSON 다운로드</button>
                    <button type="button" data-action="close" style="border:none;border-radius:12px;padding:10px 12px;font-weight:900;cursor:pointer;background:#f2f2f7;color:#111827;">닫기</button>
                </div>
            </div>

            <div style="padding:16px 18px;">
                <div style="font-weight:1000;color:#111827;margin-bottom:6px;">상위 교정 패턴 Top</div>
                <div style="border:1px solid #e5e7eb;border-radius:14px;padding:10px 12px;background:#fafafa;">${patternRows || '<div style="color:#6b7280;font-weight:800;">(표시할 패턴이 없습니다)</div>'}</div>

                <div style="height:14px;"></div>

                <div style="font-weight:1000;color:#111827;margin-bottom:6px;">샘플(최대 50개)</div>
                <div style="border:1px solid #e5e7eb;border-radius:14px;padding:10px 12px;">${preview || '<div style="color:#6b7280;font-weight:800;">(표시할 항목이 없습니다)</div>'}</div>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        const t = e.target;
        if (t === modal) modal.remove();
        if (!(t instanceof HTMLElement)) return;
        const action = t.getAttribute('data-action');
        if (action === 'close') modal.remove();
        if (action === 'copy') copyJsonToClipboard(jsonText);
        if (action === 'download') downloadJson('k-local-vibe-flaggedItems.json', jsonText);
    });

    document.body.appendChild(modal);
}

function getCategoryLabel(place) {
    const c = normalizeCategory(place);
    return getCategoryTranslation(c);
}

function normalizeLang(lang) {
    if (!lang) return 'ko';
    const l = String(lang).toLowerCase();
    // Supported language keys are strictly:
    // ko, en, jp, cn, th, ar, ru, fr
    const allowed = new Set(['ko', 'en', 'jp', 'cn', 'th', 'ar', 'ru', 'fr']);
    if (allowed.has(l)) return l;
    return 'ko';
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function inferProvinceFromCoords(lat, lng) {
    if (Number.isNaN(lat) || Number.isNaN(lng)) return '';

    // Nearest major city heuristic (good enough when address is missing)
    let bestCity = '';
    let bestDist = Infinity;
    for (const [city, coord] of Object.entries(cityCoordinates)) {
        const d = haversineKm(lat, lng, coord[0], coord[1]);
        if (d < bestDist) {
            bestDist = d;
            bestCity = city;
        }
    }

    // If it's too far from any known city center, don't guess.
    if (!bestCity || bestDist > 60) return '';

    // cityCoordinates keys include some 경기권 도시(수원/성남/의정부/안양/부천/광명/평택/남양주 등)
    // Those should be classified as '경기'.
    const gyeonggiCities = new Set(['수원', '성남', '의정부', '안양', '부천', '광명', '평택', '남양주']);
    if (gyeonggiCities.has(bestCity)) return '경기';

    // 광역시/특별시/도는 대표 도시명과 동일하게 사용
    return normalizeProvinceName(bestCity);
}

function matchesCurrentFilters(place) {
    if (!place) return false;

    const province = document.getElementById('provinceSelect')?.value || 'all';
    const city = document.getElementById('citySelect')?.value || 'all';

    const normalizedCategory = normalizeCategory(place);
    if (currentFilter !== 'all' && normalizedCategory !== currentFilter) {
        return false;
    }

    if (province !== 'all' && place.province !== province) {
        return false;
    }

    if (city !== 'all' && place.city !== city) {
        return false;
    }

    const activeCompanions = document.querySelectorAll('.companion-filter.active');
    const companionTypes = Array.from(activeCompanions).map(btn => btn.dataset.companion);
    if (companionTypes.length > 0) {
        if (!place.companionTag) {
            const tags = ['couple', 'family', 'solo'];
            place.companionTag = tags[Math.floor(Math.random() * tags.length)];
        }
        if (!companionTypes.includes(place.companionTag)) {
            return false;
        }
    }

    const q = String(searchQuery ?? '').trim().toLowerCase(); // Include searchQuery in matchesCurrentFilters
    if (q) {
        const title = String(place?.title ?? '').toLowerCase();
        const address = String(place?.address ?? '').toLowerCase();
        const desc = String(place?.description?.ko ?? '').toLowerCase();
        if (!(title.includes(q) || address.includes(q) || desc.includes(q))) {
            return false;
        }
    }

    return true;
}

function normalizeCategory(place) {
    if (!place) return 'all';
    if (place.normalizedCategory && place._normalizeV === CATEGORY_NORMALIZE_VERSION) {
        return String(place.normalizedCategory);
    }

    const rawCategory = String(place?.category ?? '').trim();
    const type = String(place?.type ?? '').trim();
    const title = String(place?.title ?? '').trim();
    const address = String(place?.address ?? '').trim();
    // IMPORTANT: keyword signals should come from the human-visible strings only.
    // If we include rawCategory here, a mislabeled 'cafe' would always match cafeKw.
    const haySignals = `${type} ${title} ${address}`.toLowerCase();

    const cafeKw = ['카페', 'coffee', 'cafe', '라떼', '아메리카노', '에스프레소', '베이커리', '브런치', '디저트', '빵', '쿠키', '케이크'];
    const restKw = [
        '삼계탕', '갈비', '고기', '곱창', '국밥', '회', '초밥', '라면', '칼국수', '냉면', '백반', '한정식', '찜', '탕', '치킨', '피자', '버거', '파스타',
        // Chinese cuisine
        '중국집', '중식', '중화', '차이나', '중국', '짜장', '자장', '짬뽕', '탕수육', '마라', '훠궈', '양꼬치', '딤섬', '꿔바로우',
        // common restaurant cues
        '맛집', '식당', '반점',
        '가든', '회관', '정식', '기사식당',
        // Korean cuisine / noodles
        '한식', '분식', '일식', '양식',
        '막국수', '국수', '메밀', '면', '우동', '쫄면', '비빔면', '수제비', '만두', '김밥', '떡볶이', '순대', '해장국', '설렁탕', '곰탕', '감자탕', '김치찌개', '된장찌개',
        // BBQ / meat
        '구이', '불고기', '삼겹', '갈비탕', '닭갈비',
        // sushi/seafood cues
        '횟집', '초밥', '스시'
    ];

    // Start from raw, but do NOT let raw 'cafe' win unless we have cafe signals.
    let normalized = rawCategory || 'all';
    const cafeHit = cafeKw.some((k) => haySignals.includes(String(k).toLowerCase()));
    const restHit = restKw.some((k) => haySignals.includes(String(k).toLowerCase()));

    // Cafe should be strict: cafe keywords AND no strong restaurant cues
    if (cafeHit && !looksLikeRestaurant(place) && !restHit) {
        normalized = 'cafe';
    }

    // Restaurant wins when food cues exist
    if (restHit || looksLikeRestaurant(place)) {
        normalized = 'restaurant';
    }

    // If data says cafe but we have no cafe signals, treat it as unknown unless it was promoted by rules above.
    if (rawCategory === 'cafe' && normalized === 'cafe' && !cafeHit) {
        normalized = 'all';
    }

    // keep known categories as-is when not overridden
    const allowed = new Set(['restaurant', 'cafe', 'hotel', 'tourism', 'drama', 'activity', 'shop', 'nature', 'photo', 'all']);
    if (!allowed.has(normalized)) normalized = allowed.has(rawCategory) ? rawCategory : 'all';

    // persist on object (SSOT for UI)
    if (!place.rawCategory) place.rawCategory = rawCategory;
    place.normalizedCategory = normalized;
    place._normalizeV = CATEGORY_NORMALIZE_VERSION;

    if (rawCategory && normalized && rawCategory !== normalized) {
        addFlaggedItemOnce({
            key: String(place?.id ?? place?.key ?? place?.title ?? ''),
            title,
            rawCategory,
            normalizedCategory: normalized,
            type,
            address
        });
    }

    return normalized;
}

function getBasePlaces() {
    if (mapMode === 'province') {
        return Array.isArray(placeData) ? placeData : [];
    }
    return Array.isArray(currentDataSet) && currentDataSet.length > 0
        ? currentDataSet
        : (Array.isArray(placeData) ? placeData : []);
}

function getFilteredPlaces() {
    const base = getBasePlaces();
    return base.filter(matchesCurrentFilters);
}

function hasCoords(place) {
    const lat = parseFloat(place?.lat);
    const lng = parseFloat(place?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng);
}

function groupTopNByProvince(places, n) {
    const counts = new Map();
    places.forEach((p) => {
        const prov = String(p?.province ?? '').trim() || inferProvinceFromCoords(parseFloat(p?.lat), parseFloat(p?.lng)) || '기타';
        counts.set(prov, (counts.get(prov) || 0) + 1);
    });
    return Array.from(counts.entries())
        .map(([province, count]) => ({ province, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
}

function renderTopRegionsSummary(places, title) {
    const top3 = groupTopNByProvince(places, 3);
    if (top3.length === 0) return '';
    const rows = top3.map((x, i) => {
        const label = x.province === '기타' ? x.province : getProvinceName(x.province);
        return `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:${i === 0 ? 'none' : '1px solid #eee'};">
  <div style="font-weight:800;color:#111827;">${escapeHtmlAttr(label)}</div>
  <div style="font-weight:900;color:#0071e3;">${x.count.toLocaleString()}</div>
</div>`;
    }).join('');

    return `
<div style="grid-column: 1/-1; background:#ffffff; border-radius:16px; padding:14px 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); margin-bottom: 10px;">
  <div style="font-weight:900;margin-bottom:6px;color:#111827;">${escapeHtmlAttr(title)}</div>
  ${rows}
</div>`;
}

function generateTags(place) {
    const tags = [];
    const cat = normalizeCategory(place);
    const type = String(place?.type ?? '').trim();
    const title = String(place?.title ?? '').toLowerCase();

    if (cat === 'cafe') tags.push('#카페', '#디저트');
    if (cat === 'restaurant') tags.push('#맛집', '#식사');
    if (cat === 'tourism' || cat === 'drama') tags.push('#여행', '#인생샷');
    if (cat === 'nature') tags.push('#산책', '#힐링');
    if (cat === 'shop') tags.push('#쇼핑', '#기념품');

    if (type.includes('현지인')) tags.push('#로컬');
    if (type.includes('외지인')) tags.push('#핫플');

    if (title.includes('바다') || title.includes('해변')) tags.push('#바다');
    if (title.includes('야경')) tags.push('#야경');
    if (title.includes('시장')) tags.push('#전통시장');

    // ensure at least 3, dedupe
    const uniq = Array.from(new Set(tags));
    while (uniq.length < 3) {
        uniq.push(['#데이트', '#비오는날', '#아이와함께', '#혼자여행'][uniq.length % 4]);
    }
    return uniq.slice(0, 6);
}

function generateStory(place) {
    const baseDesc = String(place?.description?.ko ?? place?.description ?? '').trim();
    if (baseDesc) {
        return {
            hook: baseDesc.split(/\n|\.|\!/)[0].trim().slice(0, 120),
            background: baseDesc.slice(0, 240),
            tips: [
                '방문 전 운영시간/휴무를 확인하세요.',
                '혼잡 시간대를 피하면 여유롭게 즐길 수 있어요.',
                '근처 동선(카페/산책/주차)을 함께 확인해보세요.'
            ],
            moments: ['#데이트', '#혼자여행', '#아이와함께']
        };
    }

    const title = String(place?.title ?? '').trim();
    const address = String(place?.address ?? '').trim();
    const cat = normalizeCategory(place);
    const type = String(place?.type ?? '').trim();

    const hook = `${title}에서 오늘의 한 코스를 완성해보세요.`;
    const background = `${address ? `${address}에 위치한 ` : ''}${title}는 ${cat !== 'all' ? cat : '추천 장소'}${type ? `(${type})` : ''}로, 현재 정보만으로도 동선에 넣기 좋은 포인트예요.`;
    const tips = [
        '지도 좌표가 없는 경우, 네이버 검색으로 위치를 확인해 주세요.',
        '이동 동선이 길어질 수 있으니 같은 지역의 장소와 묶어보세요.',
        '사진/메모를 남겨두면 다음 여행에서 재방문이 쉬워요.'
    ];
    return { hook, background, tips, moments: generateTags(place).slice(0, 3) };
}

function normalizeProvinceName(provinceRaw) {
    if (!provinceRaw) return '';
    const p = String(provinceRaw).trim();

    const map = {
        '서울특별시': '서울',
        '부산광역시': '부산',
        '대구광역시': '대구',
        '인천광역시': '인천',
        '광주광역시': '광주',
        '대전광역시': '대전',
        '울산광역시': '울산',
        '세종특별자치시': '세종',
        '경기도': '경기',
        '강원특별자치도': '강원',
        '강원도': '강원',
        '충청북도': '충북',
        '충청남도': '충남',
        '전북특별자치도': '전북',
        '전라북도': '전북',
        '전남특별자치도': '전남',
        '전라남도': '전남',
        '경상북도': '경북',
        '경상남도': '경남',
        '제주특별자치도': '제주',
        '제주도': '제주'
    };
    if (map[p]) return map[p];

    // Fallback: remove suffixes to get a compact label
    return p
        .replace(/(특별자치시|특별시|광역시)$/g, '')
        .replace(/특별자치도$/g, '')
        .replace(/도$/g, '');
}

function getProvinceStats() {
    const provinceCenters = {
        '서울': cityCoordinates['서울'],
        '부산': cityCoordinates['부산'],
        '대구': cityCoordinates['대구'],
        '인천': cityCoordinates['인천'],
        '광주': cityCoordinates['광주'],
        '대전': cityCoordinates['대전'],
        '울산': cityCoordinates['울산'],
        '세종': cityCoordinates['세종'],
        '경기': cityCoordinates['수원'],
        '강원': cityCoordinates['강릉'],
        '충북': cityCoordinates['청주'] || cityCoordinates['대전'],
        '충남': cityCoordinates['대전'],
        '전북': cityCoordinates['전주'],
        '전남': cityCoordinates['목포'] || cityCoordinates['광주'],
        '경북': cityCoordinates['대구'],
        '경남': cityCoordinates['창원'] || cityCoordinates['부산'],
        '제주': cityCoordinates['제주']
    };

    const stats = new Map();
    const base = Array.isArray(placeData) ? placeData : [];
    const filtered = base.filter(matchesCurrentFilters);

    for (const p of filtered) {
        const prov = String(p?.province ?? '').trim();
        if (!prov) continue;
        stats.set(prov, (stats.get(prov) || 0) + 1);
    }

    return Array.from(stats.entries())
        .map(([province, count]) => {
            const center = provinceCenters[province] || cityCoordinates[province];
            if (!center) return null;
            return { province, count, lat: center[0], lng: center[1] };
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count);
}

function renderFeaturedRegions() {
    const list = document.getElementById('featuredRegionList');
    if (!list) return;
    if (!Array.isArray(placeData) || placeData.length === 0) {
        list.innerHTML = `
            <div class="featured-item featured-placeholder">
                <strong>데이터 준비 중</strong>
                <span>잠시만 기다려 주세요</span>
            </div>
        `;
        return;
    }

    const byProv = new Map();
    for (const p of placeData) {
        const prov = String(p?.province ?? '').trim();
        if (!prov) continue;
        if (!byProv.has(prov)) {
            byProv.set(prov, { count: 0, cats: new Map() });
        }
        const entry = byProv.get(prov);
        entry.count += 1;
        const cat = getCategoryKeyForStats(p);
        if (cat) {
            entry.cats.set(cat, (entry.cats.get(cat) || 0) + 1);
        }
    }

    const top = Array.from(byProv.entries())
        .map(([province, data]) => ({ province, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    if (top.length === 0) {
        list.innerHTML = `
            <div class="featured-item featured-placeholder">
                <strong>추천 지역 없음</strong>
                <span>데이터를 추가 중입니다</span>
            </div>
        `;
        return;
    }

    list.innerHTML = top.map((row) => {
        const sortedCats = Array.from(row.cats.entries()).sort((a, b) => b[1] - a[1]);
        const topCat = sortedCats[0]?.[0] || 'all';
        const secondCat = sortedCats[1]?.[0] || '';
        const thirdCat = sortedCats[2]?.[0] || '';
        const label = getCategoryDisplayLabel(topCat);
        const badges = [
            topCat ? `<span class="featured-badge badge-${getCategoryClass(topCat)}">${escapeHtmlAttr(getCategoryDisplayLabel(topCat))}</span>` : '',
            secondCat ? `<span class="featured-badge badge-${getCategoryClass(secondCat)}">${escapeHtmlAttr(getCategoryDisplayLabel(secondCat))}</span>` : '',
            thirdCat ? `<span class="featured-badge badge-${getCategoryClass(thirdCat)}">${escapeHtmlAttr(getCategoryDisplayLabel(thirdCat))}</span>` : ''
        ].filter(Boolean).join('');

        return `
            <div class="featured-item clickable" role="button" data-province="${escapeHtmlAttr(row.province)}" aria-label="${escapeHtmlAttr(row.province)} 추천 보기">
                <div class="featured-meta">
                    <strong>${escapeHtmlAttr(getProvinceName(row.province))}</strong>
                    <span>${escapeHtmlAttr(label)} · ${row.count.toLocaleString()}곳</span>
                </div>
                <div class="featured-badges">${badges}</div>
            </div>
        `;
    }).join('');
}

function renderDataSummary() {
    const totalEl = document.getElementById('statTotalCount');
    const coordsEl = document.getElementById('statCoordsRate');
    const topCatEl = document.getElementById('statTopCategory');
    if (!totalEl || !coordsEl || !topCatEl) return;

    if (!Array.isArray(placeData) || placeData.length === 0) {
        totalEl.textContent = '로딩 중';
        coordsEl.textContent = '로딩 중';
        topCatEl.textContent = '로딩 중';
        return;
    }

    const total = placeData.length;
    const coordsCount = placeData.filter(p => Number.isFinite(parseFloat(p?.lat)) && Number.isFinite(parseFloat(p?.lng))).length;
    const rate = total === 0 ? 0 : Math.round((coordsCount / total) * 100);

    const catCounts = new Map();
    for (const p of placeData) {
        const cat = getCategoryKeyForStats(p);
        if (!cat) continue;
        catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    }
    const topCat = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all';
    const topLabel = getCategoryDisplayLabel(topCat);

    totalEl.textContent = `${total.toLocaleString()}곳`;
    coordsEl.textContent = `${rate}% (${coordsCount.toLocaleString()}곳)`;
    topCatEl.textContent = topLabel;
}

function renderCategoryChart() {
    const chart = document.getElementById('categoryChart');
    if (!chart) return;
    const base = categoryChartMode === 'filtered' ? getFilteredPlaces() : (Array.isArray(placeData) ? placeData : []);
    if (!Array.isArray(placeData) || placeData.length === 0) {
        chart.innerHTML = '<div class="chart-placeholder">로딩 중</div>';
        return;
    }
    if (!Array.isArray(base) || base.length === 0) {
        chart.innerHTML = '<div class="chart-placeholder">필터 결과가 없습니다</div>';
        return;
    }

    const counts = new Map();
    let total = 0;
    for (const p of base) {
        const cat = getCategoryKeyForStats(p);
        if (!cat) continue;
        counts.set(cat, (counts.get(cat) || 0) + 1);
        total += 1;
    }

    const rows = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

    if (rows.length === 0) {
        chart.innerHTML = '<div class="chart-placeholder">표시할 카테고리가 없습니다</div>';
        return;
    }

    chart.innerHTML = rows.map(([cat, count], idx) => {
        const pct = total ? Math.round((count / total) * 100) : 0;
        const label = getCategoryDisplayLabel(cat);
        const barClass = `bar-${getCategoryClass(cat)}`;
        return `
            <div class="chart-row">
                <div class="chart-label">
                    <span>${escapeHtmlAttr(label)}</span>
                    <span>${pct}% (${count.toLocaleString()}곳)</span>
                </div>
                <div class="chart-bar">
                    <span class="${barClass}" style="width:${pct}%;"></span>
                </div>
            </div>
        `;
    }).join('');
}

function renderFilterSummaryCard() {
    const el = document.getElementById('filterSummaryCard');
    if (!el) return;

    const labels = currentLang === 'ko'
        ? { title: '현재 필터 요약', total: '결과', top: '상위 카테고리', region: '지역', city: '시/군', category: '카테고리', search: '검색' }
        : { title: 'Current Filter Summary', total: 'Results', top: 'Top Category', region: 'Region', city: 'City', category: 'Category', search: 'Search' };

    const provinceVal = document.getElementById('provinceSelect')?.value || 'all';
    const cityVal = document.getElementById('citySelect')?.value || 'all';
    const categoryVal = currentFilter || 'all';
    const q = String(searchQuery ?? '').trim();

    const tags = [];
    if (provinceVal !== 'all') tags.push(`${labels.region}: ${getProvinceName(provinceVal)}`);
    if (cityVal !== 'all') tags.push(`${labels.city}: ${getCityName(cityVal)}`);
    if (categoryVal !== 'all') tags.push(`${labels.category}: ${getCategoryDisplayLabel(categoryVal)}`);
    if (q) tags.push(`${labels.search}: ${q}`);

    const filtered = getFilteredPlaces();
    const total = filtered.length;
    const catCounts = new Map();
    for (const p of filtered) {
        const cat = getCategoryKeyForStats(p);
        if (!cat) continue;
        catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    }
    const topCat = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all';
    const topLabel = getCategoryDisplayLabel(topCat);

    el.innerHTML = `
        <div class="filter-summary-header">
            <span>${escapeHtmlAttr(labels.title)}</span>
            <span>${total.toLocaleString()}</span>
        </div>
        <div class="filter-summary-tags">
            ${tags.length ? tags.map(t => `<span class="filter-tag">${escapeHtmlAttr(t)}</span>`).join('') : `<span class="filter-tag">${escapeHtmlAttr(labels.total)}: ${total.toLocaleString()}</span>`}
        </div>
        <div class="filter-summary-stats">
            <div class="filter-stat">
                <strong>${escapeHtmlAttr(labels.total)}</strong>
                <span>${total.toLocaleString()}</span>
            </div>
            <div class="filter-stat">
                <strong>${escapeHtmlAttr(labels.top)}</strong>
                <span>${escapeHtmlAttr(topLabel)}</span>
            </div>
        </div>
    `;
}

function showProvinceSummary() {
    mapMode = 'province';
    currentFilter = 'all';
    resetFlaggedItems();
    clearMarkers();
    clearProvinceSummary();

    // 목록 영역은 안내 메시지 표시
    const grid = document.getElementById('contentGrid');
    if (grid) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🗺️</div>
                <h3 style="margin-bottom: 8px;"><span data-i18n="selectProvinceTitle">${translations[currentLang]?.selectProvinceTitle || '도(지역)를 선택해 주세요'}</span></h3>
                <p style="font-size: 14px;"><span data-i18n="provinceSummaryHint">${translations[currentLang]?.provinceSummaryHint || '초기 화면에서는 지역별 장소 수만 표시합니다.'}</span></p>
            </div>
        `;
    }

    const stats = getProvinceStats();
    stats.forEach(({ province, count, lat, lng }) => {
        const icon = L.divIcon({
            className: 'province-count-icon',
            html: `
                <div style="
                    width: 44px; height: 44px;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.96);
                    border: 2px solid rgba(17,24,39,0.12);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.14);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #111827;
                    font-weight: 900;
                    font-size: 13px;
                ">
                    ${count.toLocaleString()}
                </div>
            `,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });

        const m = L.marker([lat, lng], { icon });
        m.bindTooltip(`${province}: ${count.toLocaleString()}`, { direction: 'top', offset: [0, -18], opacity: 0.9 });
        m.on('click', () => {
            const provinceSelect = document.getElementById('provinceSelect');
            if (provinceSelect) provinceSelect.value = province;
            updateCityOptions(province);
            showProvinceDetail(province);
        });
        provinceSummaryLayer.addLayer(m);
    });

    updateResultCount();
    maybeLoadAdSense();
    renderFeaturedRegions();
    renderDataSummary();
    renderCategoryChart();
    renderFilterSummaryCard();
}

function showProvinceDetail(province) {
    mapMode = 'detail';
    resetFlaggedItems();
    clearProvinceSummary();

    currentDataSet = placeData.filter(p => (province === 'all' ? true : p.province === province));
    const coordsCount = currentDataSet.filter(p => Number.isFinite(parseFloat(p?.lat)) && Number.isFinite(parseFloat(p?.lng))).length;
    useMapMarkers = coordsCount > 0;
    if (useMapMarkers) {
        loadMarkersForData(currentDataSet);
    } else {
        clearMarkers();
        updateResultCount();
        ensureFlaggedReportButton();
        updateRestaurantList();
    }

    // 보기 좋게 해당 도의 마커에 맞춰 이동
    const latLngs = currentDataSet
        .map(p => [parseFloat(p.lat), parseFloat(p.lng)])
        .filter(([la, ln]) => !Number.isNaN(la) && !Number.isNaN(ln))
        .slice(0, 2000)
        .map(([la, ln]) => L.latLng(la, ln));
    if (latLngs.length > 0) {
        map.fitBounds(L.latLngBounds(latLngs).pad(0.2));
    }
    maybeLoadAdSense();
    renderFilterSummaryCard();
}

// City coordinates for flyTo functionality
const cityCoordinates = {
    '서울': [37.5665, 126.9780],
    '부산': [35.1796, 129.0756],
    '대구': [35.8714, 128.6014],
    '인천': [37.4563, 126.7052],
    '광주': [35.1601, 126.8514],
    '대전': [36.3504, 127.3845],
    '울산': [35.5394, 129.3114],
    '세종': [36.4801, 127.2888],
    '수원': [37.2634, 127.0286],
    '성남': [37.4371, 127.1274],
    '의정부': [37.7357, 127.0465],
    '안양': [37.3943, 126.9568],
    '부천': [37.5039, 126.7660],
    '광명': [37.4780, 126.8655],
    '평택': [36.9921, 127.1129],
    '남양주': [37.6362, 127.2153],
    '강릉': [37.7519, 128.8761],
    '원주': [37.3422, 127.9202],
    '춘천': [37.8813, 127.7299],
    '동해': [37.5224, 129.1143],
    '속초': [38.2070, 128.5925],
    '태백': [37.0539, 128.9105],
    '전주': [35.8242, 127.1480],
    '군산': [35.9677, 126.7367],
    '익산': [35.9488, 126.9545],
    '정읍': [35.5764, 126.8573],
    '남원': [35.4161, 127.3930],
    '김제': [35.8021, 126.8873],
    '목포': [34.8110, 126.3920],
    '여수': [34.7604, 127.6622],
    '순천': [34.9441, 127.4848],
    '광양': [34.9406, 127.6984],
    '나주': [35.0417, 126.7129],
    '진주': [35.1856, 128.1079],
    '창원': [35.2279, 128.6811],
    '진해': [35.1333, 128.6653],
    '마산': [35.2054, 128.5619],
    '통영': [34.8461, 128.4330],
    '사천': [34.9978, 128.0724],
    '김해': [35.2334, 128.8803],
    '거제': [34.8808, 128.6233],
    '제주': [33.4996, 126.5312],
    '서귀포': [33.2541, 126.5601]
};

function normalizeCityKey(city) {
    if (!city) return '';
    return String(city).trim()
        .replace(/(특별자치시|특별시|광역시)$/g, '')
        .replace(/(시|군|구)$/g, '');
}

function normalizeCityDisplay(cityRaw) {
    if (!cityRaw) return '';
    return String(cityRaw).trim();
}

function parseProvinceCityFromAddress(address) {
    if (!address) return { province: '', city: '' };
    const parts = String(address).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { province: '', city: '' };

    const p0 = parts[0];
    let province = '';
    if (/(특별자치도|특별자치시|특별시|광역시|도)$/.test(p0)) {
        // Province 표준 표기: "서울", "경기도" 처럼 사용
        if (/(특별자치시|특별시|광역시)$/.test(p0)) {
            province = p0.replace(/(특별자치시|특별시|광역시)$/g, '');
        } else if (/특별자치도$/.test(p0)) {
            // "제주특별자치도" -> "제주도" (사용자에게 익숙한 표기)
            province = p0.replace(/특별자치도$/g, '도');
        } else {
            // "경기도", "강원도" 등은 그대로 유지
            province = p0;
        }
    }

    let city = '';
    if (parts.length >= 2) {
        city = parts[1];
    }

    // NOTE: city는 "중구" 같은 값을 유지 (과도한 축약 방지)
    const normalizedCity = normalizeCityDisplay(city);
    return {
        province: normalizeProvinceName(province || p0),
        city: normalizedCity || city
    };
}

function ensurePlaceDataLocationFields() {
    if (typeof placeData === 'undefined' || !Array.isArray(placeData)) return;

    let missingAddressCount = 0;
    let inferredSeoulCount = 0;

    for (const place of placeData) {
        if (place) {
            if (!place.address) missingAddressCount++;

            const parsed = parseProvinceCityFromAddress(place.address);
            if (!place.province && parsed.province) place.province = parsed.province;
            if (!place.city && parsed.city) place.city = parsed.city;

            // 기존 값이 있더라도 표준화
            if (place.province) place.province = normalizeProvinceName(place.province);
            if (place.city) place.city = normalizeCityDisplay(place.city);

            // Fallback: 주소가 없어서 province가 비는 경우, 좌표로 추정
            if (!place.province) {
                const lat = parseFloat(place.lat);
                const lng = parseFloat(place.lng);
                const inferred = inferProvinceFromCoords(lat, lng);
                if (inferred) {
                    place.province = inferred;
                    if (inferred === '서울') inferredSeoulCount++;
                }
            }
        }
    }

    // Debug: show distribution to validate (can be removed later)
    try {
        const counts = new Map();
        for (const p of placeData) {
            const prov = p?.province || '(none)';
            counts.set(prov, (counts.get(prov) || 0) + 1);
        }
        const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
        console.log('[placeData] missingAddress:', missingAddressCount, 'inferredSeoul:', inferredSeoulCount);
        console.log('[placeData] province counts top:', top);
    } catch (_) {
        // ignore
    }
}

// Clear all markers
function clearMarkers() {
    markers.forEach(item => {
        markerClusterGroup.removeLayer(item.marker);
    });
    markers = [];
}

function clearProvinceSummary() {
    if (provinceSummaryLayer) {
        provinceSummaryLayer.clearLayers();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    const initialLangSelect = document.getElementById('langSelect');
    if (initialLangSelect && initialLangSelect.value) {
        currentLang = normalizeLang(initialLangSelect.value);
    }
    updateLanguage();
    setupEventListeners();
    initMap();
    updatePlannerButton();
    ensureStampButton();
    refreshPlaceRankings();
});

// 모든 리소스 로딩 완료 후 실행
window.addEventListener('load', function() {
    console.log("모든 리소스 로딩 완료. 지도 초기화 시작.");
    
    // 1. Leaflet(L) 확인
    if (typeof L === 'undefined') {
        console.error("Leaflet 라이브러리가 로드되지 않았습니다.");
        return;
    }
    
    // 2. 데이터 변수 확인
    if (typeof placeData === 'undefined') { 
        console.error("데이터 파일이 아직 로드되지 않았거나 변수명이 틀립니다.");
        return;
    }
    
    console.log(`데이터 로드 확인: ${placeData.length}개`);

    ensurePlaceDataLocationFields();
    hydrateLocationFilters();

    // 초기 화면: 도 단위 요약(숫자)만 표시
    showProvinceSummary();
});

function hydrateLocationFilters() {
    const provinceSelect = document.getElementById('provinceSelect');
    const citySelect = document.getElementById('citySelect');

    if (!provinceSelect || !citySelect) return;
    if (typeof placeData === 'undefined') return;

    // Province dropdown
    const provinces = Array.from(new Set(placeData.map(p => p.province).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'ko'));

    provinceSelect.innerHTML = '';
    const provAll = document.createElement('option');
    provAll.value = 'all';
    provAll.textContent = translations[currentLang]?.provinceAll || '도 전체';
    provinceSelect.appendChild(provAll);

    for (const prov of provinces) {
        const opt = document.createElement('option');
        opt.value = prov;
        opt.textContent = prov;
        provinceSelect.appendChild(opt);
    }

    // City dropdown starts at all
    citySelect.innerHTML = '';
    const cityAll = document.createElement('option');
    cityAll.value = 'all';
    cityAll.textContent = translations[currentLang]?.selectProvincePrompt || '도(지역)을 선택해 주세요.';
    citySelect.appendChild(cityAll);
}

// Add stamp status button to header
function addStampStatusButton() {
    const header = document.querySelector('.header');
    const button = document.createElement('button');
    button.id = 'stampStatusButton';
    button.style.cssText = `
        background: #ff9500; color: white; border: none; padding: 8px 16px;
        border-radius: 20px; cursor: pointer; font-weight: 600; font-size: 14px;
        margin-left: 12px;
    `;
    button.innerHTML = `🎯 ${translations[currentLang]?.stampStatus || '스탬프 현황'}`;
    button.onclick = showStampStatus;
    header.appendChild(button);
}

// Update city options based on selected province (dynamic from placeData)
function updateCityOptions(province) {
    const citySelect = document.getElementById('citySelect');
    if (!citySelect) return;
    if (typeof placeData === 'undefined') return;

    citySelect.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = province === 'all'
        ? (translations[currentLang]?.selectProvincePrompt || '도(지역)을 선택해 주세요.')
        : (translations[currentLang]?.cityAll || '시/군 전체');
    citySelect.appendChild(allOpt);

    const cities = placeData
        .filter(p => province === 'all' ? true : p.province === province)
        .map(p => p.city)
        .filter(Boolean);

    Array.from(new Set(cities))
        .sort((a, b) => a.localeCompare(b, 'ko'))
        .forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = getCityNameLocalizedFallback(city);
            citySelect.appendChild(opt);
        });
}

function getDisplayAddress(restaurant) {
    const prov = restaurant.province;
    const city = restaurant.city;
    if (!prov && !city) return restaurant.address;

    if (currentLang === 'ko') {
        return restaurant.address;
    }

    const region = `${getProvinceName(prov)} ${getCityName(city)}`.trim();
    if (!region) return restaurant.address;
    return `${region}\n${restaurant.address}`;
}

// Add companion filter chips
function addCompanionFilters() {
    const searchArea = document.querySelector('.top-filters');
    const filterContainer = document.createElement('div');
    filterContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
    
    const companions = [
        { id: 'couple', icon: '💕', label: '연인' },
        { id: 'family', icon: '👨‍👩‍👧‍👦', label: '가족' },
        { id: 'solo', icon: '👤', label: '혼자' }
    ];
    
    companions.forEach(comp => {
        const button = document.createElement('button');
        button.className = 'companion-filter';
        button.dataset.companion = comp.id;
        button.style.cssText = `
            background: #f2f2f7; color: #1d1d1f; border: none; padding: 8px 16px;
            border-radius: 20px; cursor: pointer; font-weight: 500; font-size: 14px;
            display: flex; align-items: center; gap: 6px;
            transition: all 0.2s ease;
        `;
        button.innerHTML = `${comp.icon} ${comp.label}`;
        button.onclick = () => toggleCompanionFilter(comp.id);
        filterContainer.appendChild(button);
    });
    
    searchArea.appendChild(filterContainer);
}

// Toggle companion filter
function toggleCompanionFilter(companionId) {
    const button = document.querySelector(`[data-companion="${companionId}"]`);
    button.classList.toggle('active');
    
    if (button.classList.contains('active')) {
        button.style.background = '#0071e3';
        button.style.color = 'white';
    } else {
        button.style.background = '#f2f2f7';
        button.style.color = '#1d1d1f';
    }
    
    filterMarkers();
}

// AI Audio Guide functionality
function addAudioGuideButton() {
    // This will be added to restaurant details modal
}

function playAudioGuide(placeTitle) {
    const place = placeData.find(r => r.title === placeTitle);
    if (!place) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const text = `${place.title}. ${getCategoryLabel(place)}. ${place.address}`;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language based on current language
    const langMap = {
        'ko': 'ko-KR',
        'en': 'en-US',
        'ja': 'ja-JP',
        'cn': 'zh-CN',
        'th': 'th-TH',
        'ar': 'ar-SA',
        'ru': 'ru-RU',
        'fr': 'fr-FR'
    };
    
    utterance.lang = langMap[currentLang] || 'ko-KR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    window.speechSynthesis.speak(utterance);
    showToast(translations[currentLang]?.audioGuidePlaying || '오디오 가이드 재생 중...');
}

// Foreigner Helper functionality
function addTaxiHelperButton() {
    // This will be added to restaurant details modal
}

function showTaxiHelper(address) {
    const modal = document.createElement('div');
    modal.id = 'taxiHelperModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="text-align: center; color: white; padding: 40px;">
            <div style="font-size: 24px; margin-bottom: 20px;">🚕 ${translations[currentLang]?.showToDriver || '기사님께 보여주세요'}</div>
            <div style="font-size: 48px; font-weight: bold; margin: 30px 0; line-height: 1.2;">${address}</div>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="
                background: #0071e3; color: white; border: none; padding: 16px 32px;
                border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 18px;
            ">${translations[currentLang]?.close || '닫기'}</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showCurrencyCalculator() {
    const modal = document.createElement('div');
    modal.id = 'restaurantDetailModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    // Fixed exchange rates (in production, use real API)
    const rates = {
        USD: 1320,
        JPY: 8.8,
        CNY: 182
    };
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; max-width: 400px; margin: 20px;">
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f;">${translations[currentLang]?.currencyCalculator || '환율 계산기'}</h2>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">KRW</label>
                <input type="number" id="krwInput" placeholder="0" style="
                    width: 100%; padding: 12px; border: 1px solid #d2d2d7; border-radius: 8px;
                    font-size: 16px; box-sizing: border-box;
                " oninput="updateCurrencyConversion()">
            </div>
            <div id="conversionResults" style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                <div>USD: $<span id="usdResult">0</span></div>
                <div>JPY: ¥<span id="jpyResult">0</span></div>
                <div>CNY: ¥<span id="cnyResult">0</span></div>
            </div>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="
                background: #0071e3; color: white; border: none; padding: 12px 20px;
                border-radius: 10px; cursor: pointer; font-weight: 600; width: 100%; margin-top: 20px;
            ">${translations[currentLang]?.close || '닫기'}</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add conversion function to global scope
    window.updateCurrencyConversion = function() {
        const krw = parseFloat(document.getElementById('krwInput').value) || 0;
        document.getElementById('usdResult').textContent = (krw / rates.USD).toFixed(2);
        document.getElementById('jpyResult').textContent = (krw / rates.JPY).toFixed(0);
        document.getElementById('cnyResult').textContent = (krw / rates.CNY).toFixed(2);
    };
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function findPlaceByKey(placeKey) {
    if (typeof placeData === 'undefined' || !Array.isArray(placeData)) return null;
    const key = String(placeKey ?? '').trim();
    if (!key) return null;

    return (
        placeData.find(r => String(r?.id ?? '').trim() === key) ||
        placeData.find(r => String(r?.title ?? '').trim() === key)
    );
}

function openNaverSearch(place) {
    const title = String(place?.title ?? '').trim();
    const q = encodeURIComponent(title);
    window.open(`https://map.naver.com/v5/search/${q}`, '_blank');
}

function openNaverSearchByKey(placeKey) {
    const place = findPlaceByKey(placeKey);
    if (place) {
        openNaverSearch(place);
        return;
    }
    const q = encodeURIComponent(String(placeKey ?? '').trim());
    if (!q) return;
    window.open(`https://map.naver.com/v5/search/${q}`, '_blank');
}

const HERITAGE_KEYWORDS = [
    '남대문',
    '숭례문',
    '불국사',
    '석굴암'
];

function isHeritagePlace(place) {
    const hay = `${String(place?.title ?? '')} ${String(place?.address ?? '')}`;
    return HERITAGE_KEYWORDS.some((k) => hay.includes(k));
}

function hasYoutube(place) {
    return Boolean(String(place?.youtubeUrl ?? place?.youtube ?? '').trim());
}

function openYoutube(place) {
    const url = String(place?.youtubeUrl ?? place?.youtube ?? '').trim();
    if (url) {
        window.open(url, '_blank');
        return;
    }
    const title = String(place?.title ?? '').trim();
    if (!title) return;
    const q = encodeURIComponent(title);
    window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank');
}

function openYoutubeByKey(placeKey) {
    const place = findPlaceByKey(placeKey);
    if (place) {
        openYoutube(place);
        return;
    }
    const title = String(placeKey ?? '').trim();
    if (!title) return;
    const q = encodeURIComponent(title);
    window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank');
}

function escapeHtmlAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toOnclickArg(value) {
    return escapeHtmlAttr(JSON.stringify(value));
}

function highlightMatch(text, query) {
    const raw = String(text ?? '');
    const q = String(query ?? '').trim();
    if (!q) return escapeHtmlAttr(raw);
    const lower = raw.toLowerCase();
    const qLower = q.toLowerCase();
    let result = '';
    let idx = 0;
    let pos = lower.indexOf(qLower, idx);
    while (pos !== -1) {
        result += escapeHtmlAttr(raw.slice(idx, pos));
        result += `<mark class="search-highlight">${escapeHtmlAttr(raw.slice(pos, pos + q.length))}</mark>`;
        idx = pos + q.length;
        pos = lower.indexOf(qLower, idx);
    }
    result += escapeHtmlAttr(raw.slice(idx));
    return result;
}

function pulseSearchUI() {
    const searchInput = document.getElementById('searchInput');
    const contentGrid = document.getElementById('contentGrid');
    if (searchInput) {
        searchInput.classList.remove('search-pulse');
        void searchInput.offsetWidth;
        searchInput.classList.add('search-pulse');
    }
    if (contentGrid) {
        contentGrid.classList.remove('search-bounce');
        void contentGrid.offsetWidth;
        contentGrid.classList.add('search-bounce');
    }
}

function getPlaceKey(place) {
    const key = String(place?.id ?? place?.title ?? '').trim();
    return key || '';
}

function hashPlaceKey(value) {
    const str = String(value ?? '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function buildPlaceFeedbackDomId(placeKey, scope = 'detail') {
    const suffix = hashPlaceKey(placeKey || 'unknown');
    return `place-feedback-${scope}-${suffix}`;
}

function isFeedbackBackendReady() {
    return Boolean(window.feedbackBackend && window.feedbackBackend.ready);
}

function loadPlaceFeedbackStore() {
    try {
        const raw = localStorage.getItem(PLACE_FEEDBACK_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function savePlaceFeedbackStore(store) {
    try {
        localStorage.setItem(PLACE_FEEDBACK_STORAGE_KEY, JSON.stringify(store || {}));
    } catch {
        // ignore
    }
}

function loadPlaceLikedStore() {
    try {
        const raw = localStorage.getItem(PLACE_LIKED_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function savePlaceLikedStore(store) {
    try {
        localStorage.setItem(PLACE_LIKED_STORAGE_KEY, JSON.stringify(store || {}));
    } catch {
        // ignore
    }
}

function loadPlaceSearchStore() {
    try {
        const raw = localStorage.getItem(PLACE_SEARCH_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function savePlaceSearchStore(store) {
    try {
        localStorage.setItem(PLACE_SEARCH_STORAGE_KEY, JSON.stringify(store || {}));
    } catch {
        // ignore
    }
}

function loadSearchTermStore() {
    try {
        const raw = localStorage.getItem(PLACE_SEARCH_TERM_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveSearchTermStore(store) {
    try {
        localStorage.setItem(PLACE_SEARCH_TERM_STORAGE_KEY, JSON.stringify(store || {}));
    } catch {
        // ignore
    }
}

function getTodayKey(ts = Date.now()) {
    try {
        const d = new Date(ts);
        return d.toISOString().slice(0, 10);
    } catch {
        return '';
    }
}

function getRecentDayKeys(days) {
    const count = Number(days || 0);
    if (count <= 0) return [];
    const keys = [];
    for (let i = 0; i < count; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        keys.push(getTodayKey(d.getTime()));
    }
    return keys;
}

function sumByDayMap(byDay, days) {
    const map = byDay && typeof byDay === 'object' ? byDay : {};
    if (!days || days <= 0) {
        return Object.values(map).reduce((acc, v) => acc + (Number(v) || 0), 0);
    }
    return getRecentDayKeys(days).reduce((acc, key) => acc + (Number(map[key]) || 0), 0);
}

function getLocalUid() {
    try {
        let uid = localStorage.getItem(LOCAL_UID_STORAGE_KEY);
        if (!uid) {
            uid = `local-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
            localStorage.setItem(LOCAL_UID_STORAGE_KEY, uid);
        }
        return uid;
    } catch {
        return 'local-guest';
    }
}

function getCommenterName() {
    try {
        return String(localStorage.getItem(COMMENTER_NAME_STORAGE_KEY) || '').trim();
    } catch {
        return '';
    }
}

function setCommenterName(name) {
    try {
        localStorage.setItem(COMMENTER_NAME_STORAGE_KEY, String(name || '').trim());
    } catch {
        // ignore
    }
}

function getPlaceFeedback(placeKey) {
    const store = loadPlaceFeedbackStore();
    const entry = store?.[placeKey];
    if (!entry || typeof entry !== 'object') {
        return { likes: 0, comments: [] };
    }
    const likes = Number(entry.likes) || 0;
    const comments = Array.isArray(entry.comments) ? entry.comments : [];
    return { likes, comments };
}

function setPlaceFeedback(placeKey, feedback) {
    const store = loadPlaceFeedbackStore();
    store[placeKey] = {
        likes: Number(feedback?.likes) || 0,
        comments: Array.isArray(feedback?.comments) ? feedback.comments : []
    };
    savePlaceFeedbackStore(store);
}

function isPlaceLiked(placeKey) {
    const liked = loadPlaceLikedStore();
    return Boolean(liked?.[placeKey]);
}

const localFeedbackProvider = {
    ready: true,
    uid: null,
    async getSummary(placeKey) {
        const feedback = getPlaceFeedback(placeKey);
        return {
            likes: Number(feedback.likes || 0),
            comments: Array.isArray(feedback.comments) ? feedback.comments.length : 0
        };
    },
    async getFeedback(placeKey) {
        const feedback = getPlaceFeedback(placeKey);
        return {
            likes: Number(feedback.likes || 0),
            comments: (feedback.comments || []).map((c) => ({
                id: c?.id || '',
                text: c?.text || '',
                ts: c?.ts,
                name: c?.name || '',
                uid: c?.uid || null,
                canDelete: c?.uid === getLocalUid()
            })),
            liked: isPlaceLiked(placeKey)
        };
    },
    async toggleLike(placeKey) {
        const key = String(placeKey ?? '').trim();
        if (!key) return;

        const likedStore = loadPlaceLikedStore();
        const feedback = getPlaceFeedback(key);
        const alreadyLiked = Boolean(likedStore?.[key]);

        if (alreadyLiked) {
            delete likedStore[key];
            feedback.likes = Math.max(0, (feedback.likes || 0) - 1);
        } else {
            likedStore[key] = true;
            feedback.likes = (feedback.likes || 0) + 1;
        }

        savePlaceLikedStore(likedStore);
        setPlaceFeedback(key, feedback);
    },
    async addComment(placeKey, payload) {
        const key = String(placeKey ?? '').trim();
        if (!key) return;
        const feedback = getPlaceFeedback(key);
        const comments = Array.isArray(feedback.comments) ? feedback.comments : [];
        const uid = getLocalUid();
        const name = String(payload?.name || '').trim();
        const safeName = name || (translations[currentLang]?.commenterAnonymous || '익명');
        comments.push({
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: String(payload?.text || '').trim(),
            ts: Date.now(),
            name: safeName,
            uid
        });
        feedback.comments = comments;
        setPlaceFeedback(key, feedback);
    },
    async deleteComment(placeKey, commentId) {
        const key = String(placeKey ?? '').trim();
        if (!key) return false;
        const feedback = getPlaceFeedback(key);
        const comments = Array.isArray(feedback.comments) ? feedback.comments : [];
        const uid = getLocalUid();
        const next = comments.filter((c) => !(c?.id === commentId && c?.uid === uid));
        if (next.length === comments.length) return false;
        feedback.comments = next;
        setPlaceFeedback(key, feedback);
        return true;
    },
    async reportComment() {
        showToast(translations[currentLang]?.commentReportDone || '신고가 접수되었습니다.');
    },
    async trackSearch(term) {
        const key = String(term ?? '').trim().toLowerCase();
        if (!key) return;
        const store = loadSearchTermStore();
        const todayKey = getTodayKey();
        const entry = store[key];
        const next = typeof entry === 'number'
            ? { total: Number(entry) || 0, byDay: {} }
            : (entry && typeof entry === 'object' ? entry : { total: 0, byDay: {} });
        next.total = (Number(next.total) || 0) + 1;
        next.byDay = next.byDay && typeof next.byDay === 'object' ? next.byDay : {};
        if (todayKey) {
            next.byDay[todayKey] = (Number(next.byDay[todayKey]) || 0) + 1;
        }
        store[key] = next;
        saveSearchTermStore(store);
    },
    async getRankings(days = 0) {
        const feedbackStore = loadPlaceFeedbackStore();
        const commentRanks = Object.entries(feedbackStore)
            .map(([key, value]) => ({
                placeKey: key,
                count: Array.isArray(value?.comments)
                    ? value.comments.filter((c) => {
                        if (!days || days <= 0) return true;
                        const ts = Number(c?.ts || 0);
                        if (!ts) return false;
                        return ts >= Date.now() - (days * 24 * 60 * 60 * 1000);
                    }).length
                    : 0
            }))
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const searchStore = loadSearchTermStore();
        const searchRanks = Object.entries(searchStore)
            .map(([term, entry]) => {
                if (typeof entry === 'number') {
                    return { term, count: Number(entry) || 0 };
                }
                const total = Number(entry?.total) || 0;
                const byDay = entry?.byDay || {};
                const count = days && days > 0 ? sumByDayMap(byDay, days) : total;
                return { term, count };
            })
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return { topCommented: commentRanks, topSearched: searchRanks };
    }
};

function getFeedbackProvider() {
    if (isFeedbackBackendReady()) return window.feedbackBackend;
    return localFeedbackProvider;
}

async function togglePlaceLike(placeKey, domId) {
    const key = String(placeKey ?? '').trim();
    if (!key) return;
    const provider = getFeedbackProvider();
    await provider.toggleLike(key);
    updatePlaceFeedbackUI(key, domId);
    updateCardFeedbackBadge(key, `card-feedback-${hashPlaceKey(key)}`);
}

async function submitPlaceComment(placeKey, domId) {
    const key = String(placeKey ?? '').trim();
    if (!key) return;
    const input = document.getElementById(`${domId}-input`);
    if (!input) return;
    const nameInput = document.getElementById(`${domId}-name`);
    const text = String(input.value ?? '').trim();
    if (!text) {
        showToast(translations[currentLang]?.commentEmpty || '댓글을 입력해 주세요.');
        return;
    }
    if (text.length > PLACE_COMMENT_MAX_LENGTH) {
        showToast(translations[currentLang]?.commentLimit || `댓글은 ${PLACE_COMMENT_MAX_LENGTH}자까지 가능합니다.`);
        return;
    }

    const name = nameInput ? String(nameInput.value ?? '').trim() : '';
    if (name) {
        setCommenterName(name);
    }
    const provider = getFeedbackProvider();
    await provider.addComment(key, { text, name });

    input.value = '';
    if (nameInput && name) {
        nameInput.value = name;
    }
    updatePlaceFeedbackUI(key, domId);
    updateCardFeedbackBadge(key, `card-feedback-${hashPlaceKey(key)}`);
    refreshPlaceRankings();
}

function formatCommentTime(ts) {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return '';
    }
}

function renderPlaceFeedbackSection(placeKey, domId) {
    const likeLabel = translations[currentLang]?.like || '좋아요';
    const commentsLabel = translations[currentLang]?.comments || '댓글';
    const placeholder = translations[currentLang]?.commentPlaceholder || '여행 팁이나 경험을 남겨보세요';
    const submitLabel = translations[currentLang]?.addComment || '댓글 남기기';
    const nameLabel = translations[currentLang]?.commenterName || '닉네임';
    const namePlaceholder = translations[currentLang]?.commenterPlaceholder || '닉네임(선택)';
    const noteLocal = translations[currentLang]?.feedbackLocalNote || '이 댓글/좋아요는 현재 기기(LocalStorage)에만 저장됩니다.';
    const noteCloud = translations[currentLang]?.feedbackCloudNote || '이 댓글/좋아요는 익명 로그인 후 서버에 저장됩니다.';
    const note = isFeedbackBackendReady() ? noteCloud : noteLocal;
    const savedName = getCommenterName();

    return `
        <div class="place-feedback" id="${domId}" data-place-key="${escapeHtmlAttr(placeKey)}">
            <div class="place-feedback-header">
                <div class="place-feedback-title">💬 <span data-i18n="comments">${commentsLabel}</span></div>
                <div class="place-feedback-like">
                    <button class="place-like-btn" id="${domId}-like-btn" type="button" onclick="togglePlaceLike(${toOnclickArg(placeKey)}, '${domId}')">
                        <span class="like-icon">❤️</span>
                        <span data-i18n="like">${likeLabel}</span>
                    </button>
                    <span class="place-like-count" id="${domId}-like-count">0</span>
                </div>
            </div>
            <div class="place-feedback-list" id="${domId}-comments"></div>
            <div class="place-feedback-form">
                <div class="place-feedback-name-row">
                    <label for="${domId}-name" data-i18n="commenterName">${escapeHtmlAttr(nameLabel)}</label>
                    <input id="${domId}-name" data-i18n="commenterPlaceholder" placeholder="${escapeHtmlAttr(namePlaceholder)}" value="${escapeHtmlAttr(savedName)}" />
                </div>
                <textarea id="${domId}-input" data-i18n="commentPlaceholder" maxlength="${PLACE_COMMENT_MAX_LENGTH}" placeholder="${escapeHtmlAttr(placeholder)}"></textarea>
                <button type="button" onclick="submitPlaceComment(${toOnclickArg(placeKey)}, '${domId}')">
                    <span data-i18n="addComment">${submitLabel}</span>
                </button>
            </div>
            <div class="place-feedback-note"><span data-i18n="feedbackLocalNote">${note}</span></div>
        </div>
    `;
}

async function updatePlaceFeedbackUI(placeKey, domId) {
    const key = String(placeKey ?? '').trim();
    if (!key) return;
    const provider = getFeedbackProvider();
    const feedback = await provider.getFeedback(key);
    const liked = Boolean(feedback?.liked);

    const likeBtn = document.getElementById(`${domId}-like-btn`);
    const likeCount = document.getElementById(`${domId}-like-count`);
    const listEl = document.getElementById(`${domId}-comments`);
    const noteEl = document.querySelector(`#${domId} .place-feedback-note span`);

    if (likeBtn) {
        likeBtn.classList.toggle('is-liked', liked);
    }
    if (likeCount) {
        likeCount.textContent = String(feedback.likes || 0);
    }
    if (noteEl) {
        noteEl.textContent = isFeedbackBackendReady()
            ? (translations[currentLang]?.feedbackCloudNote || '이 댓글/좋아요는 익명 로그인 후 서버에 저장됩니다.')
            : (translations[currentLang]?.feedbackLocalNote || '이 댓글/좋아요는 현재 기기(LocalStorage)에만 저장됩니다.');
    }

    if (listEl) {
        const comments = Array.isArray(feedback.comments) ? feedback.comments : [];
        const display = comments.slice(-PLACE_COMMENT_VISIBLE_LIMIT);
        if (display.length === 0) {
            listEl.innerHTML = `<div class="place-feedback-empty">${translations[currentLang]?.noComments || '아직 댓글이 없어요. 첫 댓글을 남겨보세요!'}</div>`;
        } else {
            const deleteLabel = translations[currentLang]?.commentDelete || '삭제';
            const reportLabel = translations[currentLang]?.commentReport || '신고';
            const anonymousLabel = translations[currentLang]?.commenterAnonymous || '익명';
            listEl.innerHTML = display.map((comment) => {
                const safeText = escapeHtmlAttr(comment?.text ?? '');
                const time = formatCommentTime(comment?.ts);
                const name = escapeHtmlAttr(String(comment?.name || anonymousLabel));
                const canDelete = Boolean(comment?.canDelete);
                const commentId = escapeHtmlAttr(String(comment?.id || ''));
                return `
                    <div class="place-feedback-item">
                        <div class="place-feedback-text">${safeText}</div>
                        <div class="place-feedback-meta">
                            <span class="place-feedback-name">${name}</span>
                            <span class="place-feedback-time">${escapeHtmlAttr(time)}</span>
                            <span class="place-feedback-actions">
                                ${canDelete ? `<button type="button" onclick="deletePlaceComment(${toOnclickArg(key)}, '${domId}', '${commentId}')">${deleteLabel}</button>` : ''}
                                <button type="button" onclick="reportPlaceComment(${toOnclickArg(key)}, '${domId}', '${commentId}')">${reportLabel}</button>
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

async function deletePlaceComment(placeKey, domId, commentId) {
    const key = String(placeKey ?? '').trim();
    if (!key) return;
    if (!commentId) return;
    const confirmLabel = translations[currentLang]?.commentDeleteConfirm || '이 댓글을 삭제할까요?';
    if (!window.confirm(confirmLabel)) return;
    const provider = getFeedbackProvider();
    const ok = await provider.deleteComment(key, commentId);
    if (!ok) {
        showToast(translations[currentLang]?.commentDeleteDenied || '삭제할 수 없습니다.');
        return;
    }
    updatePlaceFeedbackUI(key, domId);
    updateCardFeedbackBadge(key, `card-feedback-${hashPlaceKey(key)}`);
    refreshPlaceRankings();
}

async function reportPlaceComment(placeKey, domId, commentId) {
    const key = String(placeKey ?? '').trim();
    if (!key) return;
    if (!commentId) return;
    const confirmLabel = translations[currentLang]?.commentReportConfirm || '이 댓글을 신고할까요?';
    if (!window.confirm(confirmLabel)) return;
    const provider = getFeedbackProvider();
    await provider.reportComment(key, commentId);
    showToast(translations[currentLang]?.commentReportDone || '신고가 접수되었습니다.');
}

function trackSearchTermHit() {
    const q = String(searchQuery ?? '').trim();
    if (!q) return;
    const provider = getFeedbackProvider();
    if (provider?.trackSearch) {
        provider.trackSearch(q).then(() => refreshPlaceRankings()).catch(() => {});
    }
}

async function refreshPlaceRankings() {
    const panel = document.getElementById('rankingPanel');
    if (!panel) return;
    const provider = getFeedbackProvider();
    const rankings = await provider.getRankings(currentRankingPeriodDays);
    renderRankingPanel(rankings);
}

function getPlaceTitleByKey(placeKey) {
    const place = findPlaceByKey(placeKey);
    return place?.title || String(placeKey || '');
}

async function updateCardFeedbackBadge(placeKey, domId) {
    const key = String(placeKey ?? '').trim();
    if (!key) return;
    const el = document.getElementById(domId);
    if (!el) return;
    const provider = getFeedbackProvider();
    if (!provider?.getSummary) return;
    const summary = await provider.getSummary(key);
    const likes = Number(summary?.likes || 0);
    const comments = Number(summary?.comments || 0);
    el.innerHTML = `
        <span class="card-feedback-pill">❤️ ${likes.toLocaleString()}</span>
        <span class="card-feedback-pill">💬 ${comments.toLocaleString()}</span>
    `;
}

function hydrateCardFeedbackBadges(places) {
    const items = Array.isArray(places) ? places : [];
    items.forEach((place) => {
        const key = getPlaceKey(place);
        if (!key) return;
        const domId = `card-feedback-${hashPlaceKey(key)}`;
        updateCardFeedbackBadge(key, domId);
    });
}

function refreshCardFeedbackBadges() {
    document.querySelectorAll('.card-feedback-badges').forEach((el) => {
        const key = el.getAttribute('data-place-key');
        if (!key) return;
        updateCardFeedbackBadge(key, el.id);
    });
}

function renderRankingPanel(rankings) {
    const panel = document.getElementById('rankingPanel');
    if (!panel) return;
    const topCommented = Array.isArray(rankings?.topCommented) ? rankings.topCommented : [];
    const topSearched = Array.isArray(rankings?.topSearched) ? rankings.topSearched : [];
    const title = translations[currentLang]?.rankingTitle || '인기 순위';
    const labelComments = translations[currentLang]?.rankingComments || '댓글 많은 장소';
    const labelSearches = translations[currentLang]?.rankingSearches || '인기 검색어';
    const emptyLabel = translations[currentLang]?.rankingEmpty || '아직 데이터가 없습니다.';
    const commentSuffix = translations[currentLang]?.comments || '댓글';
    const searchSuffix = translations[currentLang]?.rankingSearchCount || '검색';
    const periodLabel = translations[currentLang]?.rankingPeriodLabel || '기간';
    const periodAll = translations[currentLang]?.rankingPeriodAll || '전체';
    const period7d = translations[currentLang]?.rankingPeriod7d || '7일';
    const period30d = translations[currentLang]?.rankingPeriod30d || '30일';

    const renderList = (items, suffix, type) => {
        if (!items.length) {
            return `<div class="ranking-empty">${emptyLabel}</div>`;
        }
        return items.map((item, idx) => {
            const name = type === 'search'
                ? escapeHtmlAttr(String(item.term || '').trim())
                : escapeHtmlAttr(getPlaceTitleByKey(item.placeKey));
            const dataAttr = type === 'search'
                ? `data-search-term="${escapeHtmlAttr(String(item.term || '').trim())}"`
                : `data-place-key="${escapeHtmlAttr(item.placeKey)}"`;
            return `
                <button type="button" class="ranking-item" ${dataAttr}>
                    <span class="ranking-rank">${idx + 1}</span>
                    <span class="ranking-name">${name}</span>
                    <span class="ranking-count">${(item.count || 0).toLocaleString()} ${suffix}</span>
                </button>
            `;
        }).join('');
    };

    panel.innerHTML = `
        <div class="ranking-card">
            <div class="ranking-head">🏆 <span data-i18n="rankingTitle">${title}</span></div>
            <div class="ranking-filters">
                <span class="ranking-filter-label" data-i18n="rankingPeriodLabel">${periodLabel}</span>
                <button type="button" class="ranking-filter ${currentRankingPeriodDays === 0 ? 'active' : ''}" data-period="0">${periodAll}</button>
                <button type="button" class="ranking-filter ${currentRankingPeriodDays === 7 ? 'active' : ''}" data-period="7">${period7d}</button>
                <button type="button" class="ranking-filter ${currentRankingPeriodDays === 30 ? 'active' : ''}" data-period="30">${period30d}</button>
            </div>
            <div class="ranking-grid">
                <div class="ranking-section">
                    <div class="ranking-label"><span data-i18n="rankingComments">${labelComments}</span></div>
                    <div class="ranking-list">
                        ${renderList(topCommented, commentSuffix, 'comment')}
                    </div>
                </div>
                <div class="ranking-section">
                    <div class="ranking-label"><span data-i18n="rankingSearches">${labelSearches}</span></div>
                    <div class="ranking-list">
                        ${renderList(topSearched, searchSuffix, 'search')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Enhanced showRestaurantDetails with all features
function showRestaurantDetails(restaurantId) {
    const restaurant = findPlaceByKey(restaurantId);
    if (!restaurant) return;

    lastRestaurantDetailId = restaurantId;
    const placeKey = getPlaceKey(restaurant);
    const feedbackDomId = buildPlaceFeedbackDomId(placeKey, 'modal');
    
    // Update stamp count
    updateStampCount(restaurant.category);
    
    const modal = document.createElement('div');
    modal.id = 'restaurantDetailsModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; max-width: 500px; max-height: 80vh; overflow-y: auto; margin: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="width: 100px; height: 100px; background: #f2f2f7; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; font-size: 48px;">
                    ${restaurant.category === 'cafe' ? '☕' : '🍽️'}
                </div>
                <h2 style="margin: 0 0 10px 0; color: #1d1d1f;">${restaurant.title} ${isHeritagePlace(restaurant) ? '🏛️' : ''} 🎥 ${hasYoutube(restaurant) ? '✅' : '❌'}</h2>
                <p style="color: #666; margin: 5px 0;">${restaurant.city ? getCityName(restaurant.city) : ''} ${restaurant.city ? '•' : ''} ${getCategoryTranslation(restaurant.category)}</p>
                ${restaurant.type ? `<p style="color: #0071e3; margin: 5px 0; font-weight: 600;">${getTypeTranslation(restaurant.type)}</p>` : ''}
            </div>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <strong style="color: #1d1d1f;"><span data-i18n="addressLabel">${translations[currentLang]?.addressLabel || '주소'}</span></strong><br>
                ${restaurant.address}
                <button onclick="showTaxiHelper('${restaurant.address}')" style="
                    background: #0071e3; color: white; border: none; padding: 8px 12px;
                    border-radius: 6px; cursor: pointer; margin-top: 10px; width: 100%;
                ">🚕 <span data-i18n="showToDriver">${translations[currentLang]?.showToDriver || '기사님께 보여주세요'}</span></button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <button onclick="playAudioGuide(${toOnclickArg(restaurant.title)})" style="
                    background: #34c759; color: white; border: none; padding: 12px;
                    border-radius: 10px; cursor: pointer; font-weight: 600;
                ">🎧 <span data-i18n="audioGuide">${translations[currentLang]?.audioGuide || '오디오 가이드'}</span></button>
                <button onclick="showCurrencyCalculator()" style="
                    background: #ff9500; color: white; border: none; padding: 12px;
                    border-radius: 10px; cursor: pointer; font-weight: 600;
                ">💱 <span data-i18n="currencyCalculator">${translations[currentLang]?.currencyCalculator || '환율 계산기'}</span></button>
            </div>

            ${renderPlaceFeedbackSection(placeKey, feedbackDomId)}
            
            <div style="display: flex; gap: 10px;">
                <button onclick="addToPlanner(${toOnclickArg(restaurant.title)})" style="
                    background: #0071e3; color: white; border: none; padding: 12px 20px;
                    border-radius: 10px; cursor: pointer; font-weight: 600; flex: 1;
                ">➕ <span data-i18n="addToPlanner">${translations[currentLang]?.addToPlanner || '플래너 추가'}</span></button>
                <button onclick="openNaverSearchByKey(${toOnclickArg(restaurant.title)})" style="
                    background: #03c75a; color: white; border: none; padding: 12px 20px;
                    border-radius: 10px; cursor: pointer; font-weight: 600; flex: 1;
                ">N <span data-i18n="details">${translations[currentLang]?.details || '상세 정보'}</span></button>
                ${(restaurant.youtubeUrl || restaurant.youtube) ? `
                <button onclick="openYoutubeByKey(${toOnclickArg(restaurant.title)})" style="
                    background: #ff0000; color: white; border: none; padding: 12px 20px;
                    border-radius: 10px; cursor: pointer; font-weight: 600; flex: 1;
                ">▶ <span data-i18n="youtube">${translations[currentLang]?.youtube || '유튜브'}</span></button>
                ` : ''}
                <button onclick="this.closest('div[style*=fixed]').remove()" style="
                    background: #f2f2f7; color: #1d1d1f; border: none; padding: 12px 20px;
                    border-radius: 10px; cursor: pointer; font-weight: 600;
                "><span data-i18n="close">${translations[currentLang]?.close || '닫기'}</span></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    updatePlaceFeedbackUI(placeKey, feedbackDomId);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Toast notification system
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8); color: white; padding: 12px 20px;
        border-radius: 8px; z-index: 10000; font-size: 14px; font-weight: 500;
        animation: slideUp 0.3s ease-out;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 2000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }
    @keyframes slideDown {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, 20px); }
    }
    .companion-filter.active {
        background: #0071e3 !important;
        color: white !important;
    }
`;
document.head.appendChild(style);

// Initialize Leaflet map
let markerClusterGroup; // 클러스터 그룹 추가

function initMap() {
    map = L.map('map').setView([36.5, 127.5], 7);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // ⚡ 핵심 성능 최적화: MarkerCluster 설정
    markerClusterGroup = L.markerClusterGroup({
        chunkedLoading: true,     // 브라우저 멈춤 방지
        chunkInterval: 100,       // 100ms 마다 처리 (더 빠르게)
        chunkDelay: 30,           // 30ms 휴식 (더 짧게)
        disableClusteringAtZoom: 14, // 줌 14 이상에서는 클러스터 해제 (더 빨리 해제)
        spiderfyOnMaxZoom: true,  // 최대 줌에서 스파이더파이
        showCoverageOnHover: false, // 호버 효과 제거 (성능 향상)
        zoomToBoundsOnClick: true,
        maxClusterRadius: 50      // 클러스터 반경 줄임
    });
    
    map.addLayer(markerClusterGroup);

    provinceSummaryLayer = L.layerGroup();
    provinceSummaryLayer.addTo(map);
}

// Setup event listeners
function setupEventListeners() {
    // Language selector
    document.getElementById('langSelect').addEventListener('change', function(e) {
        currentLang = normalizeLang(e.target.value);
        updateLanguage();
    });
    
    // City selector
    document.getElementById('citySelect').addEventListener('change', function(e) {
        const selectedCity = e.target.value;
        if (selectedCity !== 'all') {
            flyToCity(selectedCity);
        }
        filterMarkers();
    });
    
    // Province selector
    document.getElementById('provinceSelect').addEventListener('change', function(e) {
        updateCityOptions(e.target.value);
        if (e.target.value === 'all') {
            showProvinceSummary();
        } else {
            showProvinceDetail(e.target.value);
            const topCat = getTopCategoryFromPlaces(currentDataSet, true);
            selectCategoryTab(topCat);
        }
    });
    
    // Category tabs
    const categoryHintEl = document.getElementById('categoryHint');
    const categoryHintKeyMap = {
        restaurant: 'categoryHintRestaurant',
        cafe: 'categoryHintCafe',
        tourism: 'categoryHintTourism',
        hotel: 'categoryHintHotel',
        drama: 'categoryHintDrama',
        activity: 'categoryHintActivity',
        shop: 'categoryHintShop',
        nature: 'categoryHintNature',
        photo: 'categoryHintPhoto'
    };
    const categoryHintDefaultText = '카테고리를 선택하면 해당 기준이 표시됩니다.';
    const updateCategoryHint = (category) => {
        if (!categoryHintEl) return;
        const key = categoryHintKeyMap[category];
        const translated = key ? translations[currentLang]?.[key] : null;
        const fallback = translations[currentLang]?.categoryHintDefault || categoryHintDefaultText;
        categoryHintEl.textContent = translated || fallback;
        categoryHintEl.setAttribute('data-category', category || 'default');
    };

    document.querySelectorAll('.filter-tab, .sub-tab').forEach(tab => {
        tab.addEventListener('click', function(e) {
            // 모든 탭에서 active 클래스 제거
            document.querySelectorAll('.filter-tab, .sub-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.category;
            updateCategoryHint(currentFilter);
            filterMarkers();
        });
    });
    updateCategoryHint(currentFilter);
    window.addEventListener('app:langChange', () => updateCategoryHint(currentFilter));

    // Search input
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const searchButton = document.getElementById('searchButton');
    if (searchInput) {
        let t = null;
        const apply = () => {
            searchQuery = String(searchInput.value ?? '');
            listRenderLimit = 120;
            if (searchClear) searchClear.style.display = searchQuery.trim() ? 'inline-flex' : 'none';
            filterMarkers();
        };

        searchInput.addEventListener('input', () => {
            if (t) clearTimeout(t);
            t = setTimeout(apply, 180);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                apply();
            }
            if (e.key === 'Enter') {
                if (t) clearTimeout(t);
                apply();
                trackSearchTermHit();
            }
        });

        if (searchButton) {
            searchButton.addEventListener('click', () => {
                if (t) clearTimeout(t);
                apply();
                trackSearchTermHit();
            });
        }
    }
    if (searchClear && searchInput) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            listRenderLimit = 120;
            searchClear.style.display = 'none';
            filterMarkers();
            searchInput.focus();
        });
    }

    // Featured region click -> set province filter
    const featuredList = document.getElementById('featuredRegionList');
    if (featuredList) {
        featuredList.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const card = target.closest('.featured-item');
            if (!card) return;
            const province = card.getAttribute('data-province');
            if (!province) return;
            const provinceSelect = document.getElementById('provinceSelect');
            if (provinceSelect) {
                provinceSelect.value = province;
                updateCityOptions(province);
            }
            showProvinceDetail(province);
            const topCat = getTopCategoryFromPlaces(currentDataSet, true);
            selectCategoryTab(topCat);
            const appBody = document.querySelector('.app-body');
            if (appBody && typeof appBody.scrollIntoView === 'function') {
                appBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // Category chart toggle
    document.querySelectorAll('.chart-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            if (!(el instanceof HTMLElement)) return;
            const mode = el.getAttribute('data-chart') || 'all';
            categoryChartMode = mode === 'filtered' ? 'filtered' : 'all';
            document.querySelectorAll('.chart-toggle-btn').forEach((b) => b.classList.remove('active'));
            el.classList.add('active');
            renderCategoryChart();
        });
    });

    const rankingPanel = document.getElementById('rankingPanel');
    if (rankingPanel) {
        rankingPanel.addEventListener('click', (e) => {
            const target = e.target.closest('.ranking-item');
            const filterBtn = e.target.closest('.ranking-filter');
            if (filterBtn) {
                const days = Number(filterBtn.getAttribute('data-period') || 0);
                currentRankingPeriodDays = Number.isNaN(days) ? 0 : days;
                refreshPlaceRankings();
                return;
            }
            if (!target) return;
            const searchTerm = target.getAttribute('data-search-term');
            if (searchTerm) {
                const searchInput = document.getElementById('searchInput');
                const searchClear = document.getElementById('searchClear');
                if (searchInput) {
                    searchInput.value = searchTerm;
                }
                searchQuery = searchTerm;
                listRenderLimit = 120;
                if (searchClear) searchClear.style.display = searchQuery.trim() ? 'inline-flex' : 'none';
                filterMarkers();
                trackSearchTermHit();
                pulseSearchUI();
                return;
            }
            const placeKey = target.getAttribute('data-place-key');
            if (!placeKey) return;
            const place = findPlaceByKey(placeKey);
            if (place) {
                showPlaceDetail(place);
            }
        });
    }
}

// Load restaurant data and create markers
function loadMarkersForData(data) {
    console.log('loadRestaurantData called');
    
    if (typeof placeData === 'undefined') {
        console.error('placeData is not available');
        return;
    }
    
    const dataArray = Array.isArray(data) ? data : [];
    console.log(`data length: ${dataArray.length}`);
    
    if (dataArray.length === 0) {
        console.error('placeData is empty');
        return;
    }
    
    console.log('Sample data:', dataArray[0]);
    
    // Clear existing markers
    clearMarkers();
    
    console.log(`Total data to load: ${dataArray.length} items`);
    
    // 성능 최적화: 처음 500개만 로드 (테스트 증가)
    const initialLoad = dataArray.slice(0, 500);
    
    // Create markers for each place and add to cluster
    initialLoad.forEach((place, index) => {
        console.log(`Processing item ${index}:`, place);
        
        if (!place.lat || !place.lng) {
            console.warn('Missing coordinates for:', place);
            return;
        }
        
        try {
            const marker = L.marker([parseFloat(place.lat), parseFloat(place.lng)])
                .bindPopup(createPopupContent(place));
            
            // 클릭 이벤트 추가 (팝업보다 먼저 동작하도록)
            marker.on('click', function(e) {
                console.log('마커 클릭:', place);
                e.originalEvent.stopPropagation(); // 이벤트 전파 방지
                showPlaceDetail(place);
            });
            
            markers.push({
                marker: marker,
                data: place
            });
            
            // 클러스터 그룹에 마커 추가
            if (markerClusterGroup) {
                markerClusterGroup.addLayer(marker);
            } else {
                console.error('markerClusterGroup is not defined');
            }
        } catch (error) {
            console.error('Error creating marker:', error);
        }
    });
    
    console.log(`Loaded ${markers.length} places on the map (initial load)`);

    updateResultCount();
    updateRestaurantList();

    ensureFlaggedReportButton();

    if (flaggedItems.length > 0) {
        window.flaggedItems = flaggedItems;
        console.log(`[category normalization] corrected: ${flaggedItems.length}`);
        try { console.table(flaggedItems.slice(0, 50)); } catch { /* ignore */ }
    }
    
    // 로딩 인디케이터 숨기기
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }

    // 백그라운드에서 나머지 데이터 로드
    setTimeout(() => {
        loadRemainingData();
    }, 600);
}

function loadRemainingData() {
    const remainingData = (Array.isArray(currentDataSet) ? currentDataSet : []).slice(500);
    let loadedCount = 0;

    if (remainingData.length === 0) {
        updateResultCount();
        return;
    }

    console.log(`Remaining data to load: ${remainingData.length} items`);

    const loadBatch = (startIndex) => {
        if (startIndex >= remainingData.length) {
            console.log(`Background loading complete: ${loadedCount} additional places loaded`);
            updateResultCount();
            return;
        }

        const batch = remainingData.slice(startIndex, startIndex + 200);
        batch.forEach(place => {
            if (!place?.lat || !place?.lng) return;
            const marker = L.marker([parseFloat(place.lat), parseFloat(place.lng)])
                .bindPopup(createPopupContent(place));

            marker.on('click', function(e) {
                e.originalEvent.stopPropagation();
                showPlaceDetail(place);
            });

            markers.push({ marker, data: place });
            if (markerClusterGroup) {
                markerClusterGroup.addLayer(marker);
            }
            loadedCount++;
        });

        updateResultCount();

        const progressEl = document.getElementById('loadingProgress');
        if (progressEl) {
            const percent = Math.round((loadedCount / remainingData.length) * 100);
            progressEl.textContent = `백그라운드 로딩: ${loadedCount}/${remainingData.length} (${percent}%)`;
        }

        setTimeout(() => loadBatch(startIndex + 200), 300);
    };

    loadBatch(0);
}

// 상세 정보 표시 함수
function showPlaceDetail(place) {
    console.log('showPlaceDetail called with:', place);
    
    // 결과를 표시할 HTML 요소 선택
    const resultContainer = document.getElementById('contentGrid');
    
    if (!resultContainer) {
        console.error('contentGrid 요소를 찾을 수 없습니다.');
        console.log('현재 DOM 요소들:', document.querySelectorAll('#contentGrid, .contentGrid, [id*="content"]'));
        return;
    }
    
    console.log('contentGrid 요소 찾음:', resultContainer);
    
    // "검색 결과가 없습니다" 내용을 지우고 선택된 데이터로 채움
    const safeKeyArg = toOnclickArg(place?.title ?? '');
    const ytOk = hasYoutube(place);
    const story = generateStory(place);
    const tags = generateTags(place);
    const tagsHtml = tags.map((x) => `<span style="display:inline-flex;align-items:center;font-size:12px;font-weight:900;background:#f2f2f7;border-radius:999px;padding:6px 10px;color:#111827;">${escapeHtmlAttr(x)}</span>`).join(' ');
    const noMapBadge = hasCoords(place) ? '' : `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;background:#fef2f2;border-radius:999px;padding:6px 10px;color:#991b1b;">지도 표시 불가</span>`;
    const placeKey = getPlaceKey(place);
    const feedbackDomId = buildPlaceFeedbackDomId(placeKey, 'detail');
    resultContainer.innerHTML = `
        <div class="place-detail-card" style="
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 700px;
        ">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px; line-height:1.2;">
                    ${place.title}
                    ${isHeritagePlace(place) ? ' 🏛️' : ''}
                </h3>
                <div style="font-size: 13px; font-weight: 800; color: #111827; white-space: nowrap; padding-top: 2px;">
                    🎥 ${ytOk ? '✅' : '❌'}
                </div>
            </div>
            <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong><span data-i18n="addressLabel">${translations[currentLang]?.addressLabel || '주소'}</span>:</strong> ${place.address || ''}</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Category:</strong> ${normalizeCategory(place) || ''}</p>
            ${place.image ? `<img src="${place.image}" style="width:100%;height:auto;border-radius:8px;margin-top:10px;">` : ''}

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">${noMapBadge} ${tagsHtml}</div>

            <div style="margin-top: 16px; padding: 14px 14px; border: 1px solid #eee; border-radius: 12px; background: #fafafa;">
                <div style="font-weight: 900; color:#111827; margin-bottom: 8px;">스토리</div>
                <div style="font-size: 14px; font-weight: 900; color:#111827; margin-bottom: 6px;">${escapeHtmlAttr(story.hook || '')}</div>
                <div style="font-size: 13px; color:#374151; line-height: 1.6; white-space: pre-line;">${escapeHtmlAttr(story.background || '')}</div>
                <div style="margin-top: 10px; font-size: 13px; color:#111827;">
                    <div style="font-weight: 900; margin-bottom: 6px;">Tips 3</div>
                    <div style="display:grid; gap:6px;">
                        <div>1) ${escapeHtmlAttr(story.tips?.[0] || '')}</div>
                        <div>2) ${escapeHtmlAttr(story.tips?.[1] || '')}</div>
                        <div>3) ${escapeHtmlAttr(story.tips?.[2] || '')}</div>
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-top: 14px; flex-wrap: wrap;">
                <button onclick="addToPlanner(${safeKeyArg})" style="
                    background: #0071e3; color: white; border: none; padding: 10px 14px;
                    border-radius: 10px; cursor: pointer; font-weight: 800;
                ">➕ <span data-i18n="addToPlanner">${translations[currentLang]?.addToPlanner || '플래너 추가'}</span></button>

                <button onclick="openNaverSearchByKey(${safeKeyArg})" style="
                    background: #03c75a; color: white; border: none; padding: 10px 14px;
                    border-radius: 10px; cursor: pointer; font-weight: 800;
                ">N <span data-i18n="details">${translations[currentLang]?.details || '상세 정보'}</span></button>

                <button ${ytOk ? `onclick=\"openYoutubeByKey(${safeKeyArg})\"` : ''} style="
                    background: ${ytOk ? '#ff0000' : '#e5e7eb'}; color: ${ytOk ? 'white' : '#6b7280'}; border: none; padding: 10px 14px;
                    border-radius: 10px; cursor: ${ytOk ? 'pointer' : 'not-allowed'}; font-weight: 900;
                    opacity: ${ytOk ? '1' : '0.9'};
                " ${ytOk ? '' : 'disabled'}>▶ <span data-i18n="youtube">${translations[currentLang]?.youtube || '유튜브'}</span></button>
            </div>

            ${renderPlaceFeedbackSection(placeKey, feedbackDomId)}

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; display:flex; justify-content:flex-end;">
                <button onclick="clearPlaceDetail()" style="
                    background: #f2f2f7; color: #1d1d1f; border: none; padding: 10px 14px; 
                    border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 800;
                ">← ${translations[currentLang]?.close || '닫기'}</button>
            </div>
        </div>
    `;
    
    updatePlaceFeedbackUI(placeKey, feedbackDomId);
    console.log('상세 정보 표시 완료');
}

// 상세 정보 지우기 함수
function clearPlaceDetail() {
    const resultContainer = document.getElementById('contentGrid');
    if (resultContainer) {
        resultContainer.innerHTML = `
            <div id="loadingIndicator" style="text-align: center; padding: 40px;">
                <div style="font-size: 24px; margin-bottom: 10px;">🔍</div>
                <h3 style="margin-bottom: 8px;">${translations[currentLang]?.noResults || '검색 결과가 없습니다'}</h3>
                <p style="font-size: 14px;">${translations[currentLang]?.adjustFilters || '필터를 조정해보세요'}</p>
            </div>
        `;
    }
}
function createPopupContent(place) {
    const safeTitleArg = toOnclickArg(place.title);
    const heritageBadge = isHeritagePlace(place) ? '🏛️' : '';
    const youtubeBadge = `🎥 ${hasYoutube(place) ? '✅' : '❌'}`;
    return `
        <div style="padding: 10px; min-width: 250px;">
            <h4 style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold;">${place.title} ${heritageBadge} <span style="font-size:12px;font-weight:900;color:#111827;opacity:.9;">${youtubeBadge}</span></h4>
            <p style="font-size: 12px; color: #666; margin: 2px 0;">${escapeHtmlAttr(getCategoryLabel(place))}</p>
            <p style="font-size: 13px; margin: 5px 0; line-height: 1.4; white-space: pre-line;">${place.address}</p>
            ${place.image ? `<img src="${place.image}" style="width:100%;height:auto;border-radius:4px;margin-top:5px;">` : ''}
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                <button onclick="showRestaurantDetails(${safeTitleArg})" style="
                    background: #0071e3; color: white; border: none; padding: 6px 12px; 
                    border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 5px;
                ">${translations[currentLang]?.details || '상세 정보'}</button>
                <button onclick="addToPlanner(${safeTitleArg})" style="
                    background: #34c759; color: white; border: none; padding: 6px 12px; 
                    border-radius: 6px; cursor: pointer; font-size: 12px;
                ">${translations[currentLang]?.addToPlanner || '플래너 추가'}</button>
            </div>
        </div>
    `;
}

// Enhanced translations for 8 languages
const translations = {
    ko: {
        title: 'K-Spotlight',
        subtitle: '여행 계획할 때 ‘어디부터 볼지’ 고민 줄이기—지역별로 한 번에 모아 보여드립니다.',
        heroTitle: '지역별 추천을 한 번에 정리한 여행 큐레이션',
        heroDesc: '맛집·카페·숙박·관광·액티비티 정보를 지역별로 묶어, 여행 계획의 첫 단계를 빠르게 시작할 수 있게 돕습니다.',
        heroUpdated: '최종 업데이트: 2026-02-05',
        heroOperator: '운영자: K-Spotlight',
        highlightQualityTitle: '품질 기준',
        highlightQualityDesc: '중복/카테고리/기본 정보 충실도를 점검해 반영합니다.',
        highlightUpdateTitle: '업데이트',
        highlightUpdateDesc: '월 1회 이상 갱신, 제보는 우선 확인 후 반영합니다.',
        highlightSourceTitle: '데이터 출처',
        highlightSourceDesc: '공개 자료와 현지 추천 정보를 바탕으로 큐레이션합니다.',
        guideTitle: '이용 가이드',
        guideStep1: '도/시군을 선택해 지역 범위를 좁혀보세요.',
        guideStep2: '카테고리를 클릭해 관심 분야만 추려보세요.',
        guideStep3: '지도 마커를 눌러 상세 정보를 확인하세요.',
        principlesTitle: '콘텐츠 운영 원칙',
        principlesItem1: '과장·낚시성 문구, 성인/도박/불법 유도 콘텐츠는 배제합니다.',
        principlesItem2: '정보가 불충분한 항목은 보완 후 반영합니다.',
        principlesItem3: '사용자 제보는 사실 확인 후 반영합니다.',
        featuredRegionsTitle: '대표 지역 추천',
        statTotalLabel: '전체 장소 수',
        statCoordsLabel: '좌표 포함 비율',
        statTopCategoryLabel: '상위 카테고리',
        statUpdatedLabel: '최근 업데이트',
        chartTitle: '카테고리 비율',
        chartToggleAll: '전체 데이터',
        chartToggleFiltered: '현재 필터',
        extraRequestTitle: '데이터 보완 요청',
        extraRequestDesc: '주소, 운영 시간, 폐업 여부 등 변경 사항은 “장소명 + 지역 + 수정 내용”으로 제보해 주세요. 검토 후 순차 반영합니다.',
        extraTrustTitle: '신뢰와 투명성',
        // NOTE: 광고 문구는 애드센스 승인 후에만 추가합니다.
        extraTrustDesc: '표시되는 정보는 공개 자료와 제보를 기반으로 하며, 검증 후 반영합니다.',
        featuredLoadingTitle: '데이터 준비 중',
        featuredLoadingDesc: '잠시만 기다려 주세요',
        chartLoading: '로딩 중',
        groupFood: '🍽️ 음식',
        groupStay: '🏨 숙박',
        groupTourism: '🏛️ 관광',
        groupShopping: '🛍️ 쇼핑',
        groupNature: '🌳 자연',
        all: '전체',
        restaurant: '맛집',
        cafe: '카페',
        hotel: '호텔/리조트',
        tourism: '관광지',
        drama: '드라마촬영지',
        activity: '액티비티',
        shop: '쇼핑',
        history: '관광',
        nature: '자연',
        photo: '포토존',
        searchPlaceholder: '검색...',
        youtube: '유튜브',
        addressLabel: '주소',
        details: '상세 정보',
        addToPlanner: '플래너 추가',
        provinceAll: '도 전체',
        cityAll: '시/군 전체',
        selectProvincePrompt: '도(지역)을 선택해 주세요.',
        selectProvinceTitle: '도(지역)를 선택해 주세요',
        provinceSummaryHint: '초기 화면에서는 지역별 장소 수만 표시합니다.',
        localFavorite: '현지인 맛집',
        touristPopular: '외지인 맛집',
        commonPopular: '공통 맛집',
        noResults: '검색 결과가 없습니다',
        adjustFilters: '필터를 조정해보세요',
        myTrip: '나만의 코스',
        stampStatus: '스탬프 현황',
        resultsCount: '결과',
        showToDriver: '기사님께 보여주세요',
        audioGuide: '오디오 가이드',
        currencyCalculator: '환율 계산기',
        like: '좋아요',
        comments: '댓글',
        addComment: '댓글 남기기',
        commentPlaceholder: '여행 팁이나 경험을 남겨보세요',
        feedbackLocalNote: '이 댓글/좋아요는 현재 기기(LocalStorage)에만 저장됩니다.',
        feedbackCloudNote: '이 댓글/좋아요는 익명 로그인 후 서버에 저장됩니다.',
        noComments: '아직 댓글이 없어요. 첫 댓글을 남겨보세요!',
        commentEmpty: '댓글을 입력해 주세요.',
        commentLimit: '댓글은 200자까지 가능합니다.',
        commenterName: '닉네임',
        commenterPlaceholder: '닉네임(선택)',
        commenterAnonymous: '익명',
        commentDelete: '삭제',
        commentDeleteConfirm: '이 댓글을 삭제할까요?',
        commentDeleteDenied: '삭제할 수 없습니다.',
        commentReport: '신고',
        commentReportConfirm: '이 댓글을 신고할까요?',
        commentReportDone: '신고가 접수되었습니다.',
        rankingTitle: '인기 순위',
        rankingComments: '댓글 많은 장소',
        rankingSearches: '인기 검색어',
        rankingSearchCount: '검색',
        rankingEmpty: '아직 데이터가 없습니다.',
        rankingPeriodLabel: '기간',
        rankingPeriodAll: '전체',
        rankingPeriod7d: '7일',
        rankingPeriod30d: '30일',
        googleMapsRoute: '구글 맵 경로 보기',
        close: '닫기',
        remove: '제거',
        addedToPlanner: '플래너에 추가되었습니다',
        removedFromPlanner: '플래너에서 제거되었습니다',
        plannerEmpty: '플래너에 추가된 장소가 없습니다.',
        needMoreLocations: '경로를 생성하려면 최소 2개 이상의 장소가 필요합니다.',
        audioGuidePlaying: '오디오 가이드 재생 중...',
        stampButton: '스탬프',
        regionHint: '지역을 선택하면 해당 지역의 인기 카테고리를 먼저 보여드립니다.',
        categoryHintDefault: '카테고리를 선택하면 해당 기준이 표시됩니다.',
        categoryHintRestaurant: '맛집: 지역 대표성/정보 충실도를 우선해 선별했습니다(중복·정보 불충분 항목은 제외).',
        categoryHintCafe: '카페: 지역 대표성/정보 충실도를 우선해 선별했습니다(중복·정보 불충분 항목은 제외).',
        categoryHintTourism: '관광: 대표 포인트와 동선을 고려해 탐색하기 쉽게 구성했습니다.',
        categoryHintHotel: '숙박: 위치/가격대/후기 정보를 기준으로 기본 정보를 정리했습니다.',
        categoryHintDrama: '드라마촬영지: 대표 장면 및 동선을 고려해 정리했습니다.',
        categoryHintActivity: '액티비티: 체험 중심 장소를 우선 선별했습니다(중복·정보 불충분 항목은 제외).',
        categoryHintShop: '쇼핑: 지역 특화 상품/시장 중심으로 묶었습니다.',
        categoryHintNature: '자연: 이동 동선을 고려해 탐색하기 쉽게 구성했습니다.',
        categoryHintPhoto: '포토존: 촬영 포인트를 기준으로 정리했습니다.',
        footerCurationLine1: 'K-Spotlight는 공개 정보/제보를 바탕으로 중복·카테고리·기본 정보를 확인해 반영합니다.',
        footerCurationLine2: '수정·삭제 요청은 메일로 접수되며 확인 후 순차 반영됩니다.'
    },
    en: {
        title: 'K-Spotlight',
        subtitle: 'Plan your trip with less guesswork — see each region\'s highlights in one place.',
        heroTitle: 'Curated regional highlights in one place',
        heroDesc: 'We group food, cafes, stays, sightseeing, and activities by region to help you start planning fast.',
        heroUpdated: 'Last updated: 2026-02-05',
        heroOperator: 'Operator: K-Spotlight',
        highlightQualityTitle: 'Quality checks',
        highlightQualityDesc: 'We verify duplicates, categories, and basic information before publishing.',
        highlightUpdateTitle: 'Updates',
        highlightUpdateDesc: 'Updated at least monthly; tips are verified first.',
        highlightSourceTitle: 'Data sources',
        highlightSourceDesc: 'Curated from public sources and local recommendations.',
        guideTitle: 'How to use',
        guideStep1: 'Select a province/city to narrow your area.',
        guideStep2: 'Click a category to filter your interests.',
        guideStep3: 'Tap map markers to see details.',
        principlesTitle: 'Content principles',
        principlesItem1: 'No exaggerated, adult, gambling, or illegal content.',
        principlesItem2: 'Items with insufficient info are completed before listing.',
        principlesItem3: 'User tips are verified before publishing.',
        featuredRegionsTitle: 'Featured regions',
        statTotalLabel: 'Total places',
        statCoordsLabel: 'With coordinates',
        statTopCategoryLabel: 'Top category',
        statUpdatedLabel: 'Last updated',
        chartTitle: 'Category share',
        chartToggleAll: 'All data',
        chartToggleFiltered: 'Current filters',
        extraRequestTitle: 'Request corrections',
        extraRequestDesc: 'Send place name + area + changes (address, hours, closures). We will review and update.',
        extraTrustTitle: 'Trust & transparency',
        extraTrustDesc: 'Information is based on public sources and tips, and is verified before publishing.',
        groupFood: '🍽️ Food',
        groupStay: '🏨 Stay',
        groupTourism: '🏛️ Tourism',
        groupShopping: '🛍️ Shopping',
        groupNature: '🌳 Nature',
        all: 'All',
        restaurant: 'Restaurant',
        cafe: 'Cafe',
        hotel: 'Hotel/Resort',
        tourism: 'Tourism',
        drama: 'Drama Location',
        activity: 'Activity',
        shop: 'Shopping',
        history: 'Tourism',
        nature: 'Nature',
        photo: 'Photo Zone',
        searchPlaceholder: 'Search...',
        youtube: 'YouTube',
        addressLabel: 'Address',
        details: 'Details',
        addToPlanner: 'Add to Planner',
        provinceAll: 'All Provinces',
        cityAll: 'All Cities',
        selectProvincePrompt: 'Please select a province.',
        selectProvinceTitle: 'Please select a province',
        provinceSummaryHint: 'On the first screen, only the count per region is shown.',
        localFavorite: 'Local Favorite',
        touristPopular: 'Tourist Popular',
        commonPopular: 'Popular',
        nature: 'Nature',
        photo: 'Photo Zone',
        noResults: 'No results found',
        adjustFilters: 'Try adjusting your filters',
        myTrip: 'My Course',
        details: 'Details',
        addToPlanner: 'Add to Planner',
        // 중분류 추가
        btnRestaurant: 'Restaurant',
        btnCafe: 'Cafe',
        btnHotel: 'Hotel/Resort',
        btnTourism: 'Tourism',
        btnDrama: 'Drama Location',
        btnActivity: 'Activity',
        btnShop: 'Shopping',
        btnNature: 'Nature',
        btnPhoto: 'Photo Zone',

        stampStatus: 'Stamp status',
        resultsCount: 'results',
        showToDriver: 'Show to driver',
        audioGuide: 'Audio guide',
        currencyCalculator: 'Currency calculator',
        like: 'Like',
        comments: 'Comments',
        addComment: 'Post comment',
        commentPlaceholder: 'Share a tip or your experience',
        feedbackLocalNote: 'Comments/likes are stored only on this device (LocalStorage).',
        feedbackCloudNote: 'Comments/likes are stored on the server after anonymous sign-in.',
        noComments: 'No comments yet. Be the first!',
        commentEmpty: 'Please enter a comment.',
        commentLimit: 'Comments can be up to 200 characters.',
        commenterName: 'Nickname',
        commenterPlaceholder: 'Nickname (optional)',
        commenterAnonymous: 'Anonymous',
        commentDelete: 'Delete',
        commentDeleteConfirm: 'Delete this comment?',
        commentDeleteDenied: 'You cannot delete this comment.',
        commentReport: 'Report',
        commentReportConfirm: 'Report this comment?',
        commentReportDone: 'Report submitted.',
        rankingTitle: 'Top Rankings',
        rankingComments: 'Most Commented',
        rankingSearches: 'Top Searches',
        rankingSearchCount: 'searches',
        rankingEmpty: 'No data yet.',
        rankingPeriodLabel: 'Period',
        rankingPeriodAll: 'All',
        rankingPeriod7d: '7 days',
        rankingPeriod30d: '30 days',
        googleMapsRoute: 'Google Maps route',
        close: 'Close',
        remove: 'Remove',
        addedToPlanner: 'Added to planner',
        removedFromPlanner: 'Removed from planner',
        plannerEmpty: 'No places in your planner.',
        needMoreLocations: 'You need at least 2 places to create a route.',
        audioGuidePlaying: 'Playing audio guide...',
        stampButton: 'Stamps',
        regionHint: 'Select a region to see its most popular categories first.',
        categoryHintDefault: 'Select a category to see its criteria.',
        categoryHintRestaurant: 'Restaurants: Selected for local relevance and information completeness (duplicates/insufficient info removed).',
        categoryHintCafe: 'Cafes: Selected for local relevance and information completeness (duplicates/insufficient info removed).',
        categoryHintTourism: 'Tourism: Organized for easy browsing considering key spots and routes.',
        categoryHintHotel: 'Stay: Organized using location, price range, and review info.',
        categoryHintDrama: 'Drama locations: Organized by notable scenes and routes.',
        categoryHintActivity: 'Activities: Prioritized experience-based spots (duplicates/insufficient info removed).',
        categoryHintShop: 'Shopping: Grouped around local specialties and markets.',
        categoryHintNature: 'Nature: Organized for easy exploration based on routes.',
        categoryHintPhoto: 'Photo zones: Organized around key photo spots.',
        footerCurationLine1: 'K-Spotlight uses public info and tips after checking duplicates, categories, and basics.',
        footerCurationLine2: 'Edit/removal requests are handled by email after verification.'
    },
    jp: {
        title: 'K-Spotlight',
        subtitle: '旅行計画の「どこから見るか」を減らして、地域別にまとめて表示します。',
        heroTitle: '地域別おすすめを一度にまとめた旅行キュレーション',
        heroDesc: 'グルメ・カフェ・宿泊・観光・体験情報を地域別にまとめ、計画をすぐ始められます。',
        heroUpdated: '最終更新: 2026-02-05',
        heroOperator: '運営: K-Spotlight',
        highlightQualityTitle: '品質基準',
        highlightQualityDesc: '重複・カテゴリ・基本情報の充実度を確認します。',
        highlightUpdateTitle: '更新',
        highlightUpdateDesc: '月1回以上更新し、投稿は確認後に反映します。',
        highlightSourceTitle: 'データ出所',
        highlightSourceDesc: '公開情報と現地おすすめを基にキュレーションします。',
        guideTitle: '使い方',
        guideStep1: '都道府県/市区を選んで範囲を絞ってください。',
        guideStep2: 'カテゴリをクリックして興味を絞り込みます。',
        guideStep3: '地図マーカーをタップして詳細を確認します。',
        principlesTitle: '運用原則',
        principlesItem1: '誇張・成人・ギャンブル・違法コンテンツは除外。',
        principlesItem2: '情報不足の項目は補完後に掲載。',
        principlesItem3: 'ユーザー投稿は確認後に反映。',
        featuredRegionsTitle: '代表地域おすすめ',
        statTotalLabel: '総件数',
        statCoordsLabel: '座標あり',
        statTopCategoryLabel: '上位カテゴリ',
        statUpdatedLabel: '最終更新',
        chartTitle: 'カテゴリ比率',
        chartToggleAll: '全体データ',
        chartToggleFiltered: '現在のフィルタ',
        extraRequestTitle: '情報修正の依頼',
        extraRequestDesc: '住所/営業時間/閉店などは「名称+地域+修正内容」でご連絡ください。',
        extraTrustTitle: '信頼と透明性',
        extraTrustDesc: '公開情報と投稿を基にし、確認後に反映します。',
        groupFood: '🍽️ 食',
        groupStay: '🏨 宿泊',
        groupTourism: '🏛️ 観光',
        groupShopping: '🛍️ ショッピング',
        groupNature: '🌳 自然',
        all: 'すべて',
        restaurant: 'レストラン',
        cafe: 'カフェ',
        hotel: 'ホテル/リゾート',
        tourism: '観光',
        drama: 'ドラマロケ地',
        activity: 'アクティビティ',
        shop: 'ショッピング',
        nature: '自然',
        photo: 'フォトゾーン',
        searchPlaceholder: '検索...',
        youtube: 'YouTube',
        noResults: '検索結果が見つかりません',
        adjustFilters: 'フィルターを調整してください',
        details: '詳細情報',
        addToPlanner: 'プランナーに追加',
        myTrip: 'マイコース',
        selectProvincePrompt: '地域（都道府県）を選択してください。',
        selectProvinceTitle: '地域（都道府県）を選択してください',
        provinceSummaryHint: '初期画面では地域別の件数のみ表示されます。',
        // 중분류 추가
        btnRestaurant: 'レストラン',
        btnCafe: 'カフェ',
        btnHotel: 'ホテル/リゾート',
        btnTourism: '観光',
        btnDrama: 'ドラマロケ地',
        btnActivity: 'アクティビティ',
        btnShop: 'ショッピング',
        btnNature: '自然',
        btnPhoto: 'フォトゾーン',

        stampStatus: 'スタンプ状況',
        resultsCount: '結果',
        showToDriver: '運転手に見せる',
        audioGuide: 'オーディオガイド',
        currencyCalculator: '為替計算機',
        like: 'いいね',
        comments: 'コメント',
        addComment: 'コメントする',
        commentPlaceholder: '旅のヒントや体験を共有してください',
        feedbackLocalNote: 'コメント/いいねはこの端末のローカルに保存されます。',
        noComments: 'まだコメントがありません。最初のコメントをどうぞ。',
        commentEmpty: 'コメントを入力してください。',
        commentLimit: 'コメントは200文字までです。',
        feedbackCloudNote: 'コメント/いいねは匿名ログイン後にサーバーへ保存されます。',
        commenterName: 'ニックネーム',
        commenterPlaceholder: 'ニックネーム（任意）',
        commenterAnonymous: '匿名',
        commentDelete: '削除',
        commentDeleteConfirm: 'このコメントを削除しますか？',
        commentDeleteDenied: '削除できません。',
        commentReport: '報告',
        commentReportConfirm: 'このコメントを報告しますか？',
        commentReportDone: '報告が送信されました。',
        rankingTitle: '人気ランキング',
        rankingComments: 'コメント数トップ',
        rankingSearches: '人気検索ワード',
        rankingSearchCount: '検索',
        rankingEmpty: 'まだデータがありません。',
        rankingPeriodLabel: '期間',
        rankingPeriodAll: '全期間',
        rankingPeriod7d: '7日',
        rankingPeriod30d: '30日',
        googleMapsRoute: 'Google マップで経路',
        close: '閉じる',
        remove: '削除',
        addedToPlanner: 'プランナーに追加しました',
        removedFromPlanner: 'プランナーから削除しました',
        plannerEmpty: 'プランナーに場所がありません。',
        needMoreLocations: 'ルート作成には2か所以上必要です。',
        audioGuidePlaying: 'オーディオガイド再生中...',
        stampButton: 'スタンプ',
        regionHint: '地域を選ぶと、その地域の人気カテゴリーを先に表示します。',
        categoryHintDefault: 'カテゴリを選ぶと基準が表示されます。',
        categoryHintRestaurant: 'レストラン：地域性と情報の充実度を重視して選定しました（重複・情報不足は除外）。',
        categoryHintCafe: 'カフェ：地域性と情報の充実度を重視して選定しました（重複・情報不足は除外）。',
        categoryHintTourism: '観光：主要スポットと動線を考慮して見やすく整理しました。',
        categoryHintHotel: '宿泊：立地・価格帯・レビュー情報を基準に整理しました。',
        categoryHintDrama: 'ドラマロケ地：代表シーンと動線を考慮して整理しました。',
        categoryHintActivity: 'アクティビティ：体験型スポットを優先して選定しました（重複・情報不足は除外）。',
        categoryHintShop: 'ショッピング：地域特化の店舗や市場を中心にまとめました。',
        categoryHintNature: '自然：移動動線を考慮して見やすく整理しました。',
        categoryHintPhoto: 'フォトゾーン：撮影ポイントを基準に整理しました。',
        footerCurationLine1: 'K-Spotlightは公開情報/提供情報を基に、重複・カテゴリ・基本情報を確認して反映します。',
        footerCurationLine2: '修正・削除はメールで受付し、確認後に順次反映します。'
    },
    cn: {
        title: 'K-Spotlight',
        subtitle: '旅行规划不再纠结从哪里看起——按地区一次性汇总展示。',
        heroTitle: '按地区整合的旅行推荐',
        heroDesc: '将美食、咖啡、住宿、观光、活动按地区整理，帮助快速开始规划。',
        heroUpdated: '最近更新: 2026-02-05',
        heroOperator: '运营方: K-Spotlight',
        highlightQualityTitle: '质量标准',
        highlightQualityDesc: '核对重复、类别与基础信息后再发布。',
        highlightUpdateTitle: '更新',
        highlightUpdateDesc: '每月至少更新一次，投稿先核实后收录。',
        highlightSourceTitle: '数据来源',
        highlightSourceDesc: '基于公开资料与本地推荐进行整理。',
        guideTitle: '使用指南',
        guideStep1: '选择省/市缩小范围。',
        guideStep2: '点击类别筛选兴趣。',
        guideStep3: '点击地图标记查看详情。',
        principlesTitle: '内容原则',
        principlesItem1: '不收录夸张、成人、赌博、违法内容。',
        principlesItem2: '信息不足的条目补充后再发布。',
        principlesItem3: '用户投稿核实后发布。',
        featuredRegionsTitle: '推荐地区',
        statTotalLabel: '地点总数',
        statCoordsLabel: '含坐标',
        statTopCategoryLabel: '热门类别',
        statUpdatedLabel: '最近更新',
        chartTitle: '类别占比',
        chartToggleAll: '全部数据',
        chartToggleFiltered: '当前筛选',
        extraRequestTitle: '信息更正',
        extraRequestDesc: '请提供“地点名+地区+修改内容（地址/营业时间/停业）”，审核后更新。',
        extraTrustTitle: '可信与透明',
        extraTrustDesc: '信息来自公开资料与投稿，核实后发布。',
        groupFood: '🍽️ 美食',
        groupStay: '🏨 住宿',
        groupTourism: '🏛️ 观光',
        groupShopping: '🛍️ 购物',
        groupNature: '🌳 自然',
        all: '全部',
        restaurant: '美食',
        cafe: '咖啡',
        hotel: '酒店/度假村',
        tourism: '观光',
        drama: '拍摄地',
        activity: '活动',
        shop: '购物',
        nature: '自然',
        photo: '拍照区',
        searchPlaceholder: '搜索...',
        youtube: 'YouTube',
        noResults: '未找到搜索结果',
        adjustFilters: '请调整筛选条件',
        details: '详细信息',
        addToPlanner: '添加到计划',
        myTrip: '我的行程',
        selectProvincePrompt: '请选择地区（省/市）。',
        selectProvinceTitle: '请选择地区（省/市）',
        provinceSummaryHint: '初始画面仅显示各地区的数量。',
        // 중분류 추가
        btnRestaurant: '美食',
        btnCafe: '咖啡',
        btnHotel: '酒店/度假村',
        btnTourism: '观光',
        btnDrama: '拍摄地',
        btnActivity: '活动',
        btnShop: '购物',
        btnNature: '自然',
        btnPhoto: '拍照区',

        stampStatus: '印章状态',
        resultsCount: '结果',
        showToDriver: '给司机看',
        audioGuide: '语音导览',
        currencyCalculator: '汇率计算器',
        like: '点赞',
        comments: '评论',
        addComment: '发表评论',
        commentPlaceholder: '分享旅行小贴士或体验',
        feedbackLocalNote: '评论/点赞仅保存在此设备（LocalStorage）。',
        noComments: '还没有评论，快来第一个留言吧！',
        commentEmpty: '请输入评论。',
        commentLimit: '评论最多200字。',
        feedbackCloudNote: '评论/点赞在匿名登录后保存到服务器。',
        commenterName: '昵称',
        commenterPlaceholder: '昵称（可选）',
        commenterAnonymous: '匿名',
        commentDelete: '删除',
        commentDeleteConfirm: '删除这条评论吗？',
        commentDeleteDenied: '无法删除该评论。',
        commentReport: '举报',
        commentReportConfirm: '举报这条评论吗？',
        commentReportDone: '举报已提交。',
        rankingTitle: '热门排行',
        rankingComments: '评论最多',
        rankingSearches: '热门搜索词',
        rankingSearchCount: '搜索',
        rankingEmpty: '暂无数据。',
        rankingPeriodLabel: '周期',
        rankingPeriodAll: '全部',
        rankingPeriod7d: '7天',
        rankingPeriod30d: '30天',
        googleMapsRoute: 'Google 地图路线',
        close: '关闭',
        remove: '移除',
        addedToPlanner: '已添加到计划',
        removedFromPlanner: '已从计划移除',
        plannerEmpty: '计划中暂无地点。',
        needMoreLocations: '至少需要 2 个地点生成路线。',
        audioGuidePlaying: '正在播放语音导览...',
        stampButton: '印章',
        regionHint: '选择地区后，将优先显示该地区的热门分类。',
        categoryHintDefault: '选择分类后会显示对应标准。',
        categoryHintRestaurant: '美食：优先考虑地区代表性与信息完整度（去重并剔除信息不足）。',
        categoryHintCafe: '咖啡：优先考虑地区代表性与信息完整度（去重并剔除信息不足）。',
        categoryHintTourism: '观光：结合代表景点与动线，便于浏览。',
        categoryHintHotel: '住宿：按位置/价位/评价信息整理。',
        categoryHintDrama: '拍摄地：按代表场景与动线整理。',
        categoryHintActivity: '活动：优先体验类场所（去重并剔除信息不足）。',
        categoryHintShop: '购物：围绕本地特产与市场进行归类。',
        categoryHintNature: '自然：结合动线整理，便于探索。',
        categoryHintPhoto: '拍照区：以主要拍摄点为标准整理。',
        footerCurationLine1: 'K-Spotlight基于公开信息与投稿，核查重复、分类与基本信息后收录。',
        footerCurationLine2: '修改/删除请通过邮件提交，确认后处理。'
    },
    th: {
        title: 'K-Spotlight',
        subtitle: 'วางแผนเที่ยวได้ง่ายขึ้น—รวมไว้ให้ดูตามภูมิภาคในที่เดียว',
        heroTitle: 'คัดสรรแนะนำตามภูมิภาคในที่เดียว',
        heroDesc: 'รวมอาหาร คาเฟ่ ที่พัก ท่องเที่ยว และกิจกรรมตามภูมิภาคเพื่อเริ่มวางแผนได้เร็วขึ้น',
        heroUpdated: 'อัปเดตล่าสุด: 2026-02-05',
        heroOperator: 'ผู้ดูแล: K-Spotlight',
        highlightQualityTitle: 'มาตรฐานคุณภาพ',
        highlightQualityDesc: 'ตรวจสอบความซ้ำ หมวดหมู่ และข้อมูลพื้นฐานก่อนเผยแพร่',
        highlightUpdateTitle: 'การอัปเดต',
        highlightUpdateDesc: 'อัปเดตอย่างน้อยเดือนละครั้ง ตรวจสอบข้อมูลก่อนเผยแพร่',
        highlightSourceTitle: 'แหล่งข้อมูล',
        highlightSourceDesc: 'คัดสรรจากข้อมูลสาธารณะและคำแนะนำท้องถิ่น',
        guideTitle: 'วิธีใช้งาน',
        guideStep1: 'เลือกจังหวัด/เมืองเพื่อจำกัดพื้นที่',
        guideStep2: 'คลิกหมวดหมู่เพื่อกรองสิ่งที่สนใจ',
        guideStep3: 'แตะหมุดบนแผนที่เพื่อดูรายละเอียด',
        principlesTitle: 'หลักการเนื้อหา',
        principlesItem1: 'ไม่เผยแพร่เนื้อหาเกินจริง ผู้ใหญ่ การพนัน หรือผิดกฎหมาย',
        principlesItem2: 'รายการที่ข้อมูลไม่ครบจะปรับปรุงก่อนเผยแพร่',
        principlesItem3: 'ตรวจสอบข้อมูลจากผู้ใช้ก่อนเผยแพร่',
        featuredRegionsTitle: 'ภูมิภาคแนะนำ',
        statTotalLabel: 'จำนวนทั้งหมด',
        statCoordsLabel: 'มีพิกัด',
        statTopCategoryLabel: 'หมวดหมู่ยอดนิยม',
        statUpdatedLabel: 'อัปเดตล่าสุด',
        chartTitle: 'สัดส่วนหมวดหมู่',
        chartToggleAll: 'ข้อมูลทั้งหมด',
        chartToggleFiltered: 'ตัวกรองปัจจุบัน',
        extraRequestTitle: 'ขอแก้ไขข้อมูล',
        extraRequestDesc: 'ส่ง “ชื่อสถานที่ + พื้นที่ + รายละเอียดแก้ไข” แล้วเราจะตรวจสอบและปรับปรุง',
        extraTrustTitle: 'ความน่าเชื่อถือและความโปร่งใส',
        extraTrustDesc: 'ข้อมูลมาจากแหล่งสาธารณะและคำแนะนำ และตรวจสอบก่อนเผยแพร่',
        groupFood: '🍽️ อาหาร',
        groupStay: '🏨 ที่พัก',
        groupTourism: '🏛️ ท่องเที่ยว',
        groupShopping: '🛍️ ช้อปปิ้ง',
        groupNature: '🌳 ธรรมชาติ',
        all: 'ทั้งหมด',
        restaurant: 'ร้านอาหาร',
        cafe: 'คาเฟ่',
        hotel: 'โรงแรม/รีสอร์ท',
        tourism: 'ท่องเที่ยว',
        drama: 'สถานที่ถ่ายละคร',
        activity: 'กิจกรรม',
        shop: 'ช้อปปิ้ง',
        nature: 'ธรรมชาติ',
        photo: 'โซนโซน',
        searchPlaceholder: 'ค้นหา...',
        youtube: 'YouTube',
        noResults: 'ไม่พบผลการค้นหา',
        adjustFilters: 'ลองปรับเปลี่ยนตัวกรอง',
        details: 'รายละเอียด',
        addToPlanner: 'เพิ่มลงแผน',
        myTrip: 'คอร์สของฉัน',
        selectProvincePrompt: 'โปรดเลือกจังหวัด',
        selectProvinceTitle: 'โปรดเลือกจังหวัด',
        provinceSummaryHint: 'หน้าแรกจะแสดงเฉพาะจำนวนสถานที่ตามภูมิภาค',
        // 중분류 추가
        btnRestaurant: 'ร้านอาหาร',
        btnCafe: 'คาเฟ่',
        btnHotel: 'โรงแรม/รีสอร์ท',
        btnTourism: 'ท่องเที่ยว',
        btnDrama: 'สถานที่ถ่ายละคร',
        btnActivity: 'กิจกรรม',
        btnShop: 'ช้อปปิ้ง',
        btnNature: 'ธรรมชาติ',
        btnPhoto: 'โซนโซน',

        stampStatus: 'สถานะแสตมป์',
        resultsCount: 'ผลลัพธ์',
        showToDriver: 'แสดงให้คนขับดู',
        audioGuide: 'ไกด์เสียง',
        currencyCalculator: 'เครื่องคำนวณอัตราแลกเปลี่ยน',
        like: 'ถูกใจ',
        comments: 'ความคิดเห็น',
        addComment: 'ส่งความคิดเห็น',
        commentPlaceholder: 'แชร์ทิปหรือประสบการณ์การเดินทาง',
        feedbackLocalNote: 'ความคิดเห็น/ถูกใจจะถูกเก็บไว้ในอุปกรณ์นี้เท่านั้น (LocalStorage).',
        noComments: 'ยังไม่มีความคิดเห็น เป็นคนแรกสิ!',
        commentEmpty: 'กรุณาใส่ความคิดเห็น',
        commentLimit: 'ความคิดเห็นยาวได้สูงสุด 200 ตัวอักษร',
        feedbackCloudNote: 'ความคิดเห็น/ถูกใจจะถูกบันทึกบนเซิร์ฟเวอร์หลังลงชื่อเข้าใช้แบบไม่ระบุตัวตน',
        commenterName: 'ชื่อเล่น',
        commenterPlaceholder: 'ชื่อเล่น (ไม่บังคับ)',
        commenterAnonymous: 'ไม่ระบุตัวตน',
        commentDelete: 'ลบ',
        commentDeleteConfirm: 'ลบความคิดเห็นนี้ไหม?',
        commentDeleteDenied: 'ไม่สามารถลบความคิดเห็นได้',
        commentReport: 'รายงาน',
        commentReportConfirm: 'รายงานความคิดเห็นนี้ไหม?',
        commentReportDone: 'ส่งรายงานแล้ว',
        rankingTitle: 'อันดับยอดนิยม',
        rankingComments: 'ความคิดเห็นมากสุด',
        rankingSearches: 'คำค้นยอดนิยม',
        rankingSearchCount: 'การค้นหา',
        rankingEmpty: 'ยังไม่มีข้อมูล',
        rankingPeriodLabel: 'ช่วงเวลา',
        rankingPeriodAll: 'ทั้งหมด',
        rankingPeriod7d: '7 วัน',
        rankingPeriod30d: '30 วัน',
        googleMapsRoute: 'เส้นทาง Google Maps',
        close: 'ปิด',
        remove: 'ลบ',
        addedToPlanner: 'เพิ่มลงแผนแล้ว',
        removedFromPlanner: 'ลบออกจากแผนแล้ว',
        plannerEmpty: 'ยังไม่มีสถานที่ในแผน',
        needMoreLocations: 'ต้องมีอย่างน้อย 2 สถานที่เพื่อสร้างเส้นทาง',
        audioGuidePlaying: 'กำลังเล่นไกด์เสียง...',
        stampButton: 'แสตมป์',
        regionHint: 'เลือกภูมิภาคแล้วจะแสดงหมวดที่นิยมของพื้นที่นั้นก่อน',
        categoryHintDefault: 'เลือกหมวดแล้วจะแสดงเกณฑ์ของหมวดนั้น',
        categoryHintRestaurant: 'ร้านอาหาร: คัดตามความเป็นตัวแทนพื้นที่และข้อมูลครบถ้วน (ตัดซ้ำ/ข้อมูลไม่ครบ)',
        categoryHintCafe: 'คาเฟ่: คัดตามความเป็นตัวแทนพื้นที่และข้อมูลครบถ้วน (ตัดซ้ำ/ข้อมูลไม่ครบ)',
        categoryHintTourism: 'ท่องเที่ยว: คัดจุดเด่นและเส้นทางให้ค้นหาได้ง่าย',
        categoryHintHotel: 'ที่พัก: จัดเรียงโดยดูจากทำเล/ช่วงราคา/รีวิว',
        categoryHintDrama: 'สถานที่ถ่ายละคร: จัดตามฉากเด่นและเส้นทาง',
        categoryHintActivity: 'กิจกรรม: เน้นสถานที่เชิงประสบการณ์ (ตัดซ้ำ/ข้อมูลไม่ครบ)',
        categoryHintShop: 'ช้อปปิ้ง: รวมตามสินค้าท้องถิ่นและตลาด',
        categoryHintNature: 'ธรรมชาติ: จัดตามเส้นทางเพื่อให้ค้นหาได้ง่าย',
        categoryHintPhoto: 'โซนถ่ายรูป: เน้นจุดถ่ายภาพหลัก',
        footerCurationLine1: 'K-Spotlight ใช้ข้อมูลสาธารณะและคำแนะนำ พร้อมตรวจสอบความซ้ำ/หมวดหมู่/ข้อมูลพื้นฐานก่อนเผยแพร่',
        footerCurationLine2: 'คำขอแก้ไข/ลบ รับทางอีเมลและดำเนินการหลังตรวจสอบ'
    },
    ar: {
        title: 'K-Spotlight',
        subtitle: 'خطّط رحلتك بسهولة—نعرض أبرز الأماكن حسب المنطقة في مكان واحد.',
        heroTitle: 'ترشيحات إقليمية مجمّعة في مكان واحد',
        heroDesc: 'نجمع الطعام والمقاهي والإقامة والمعالم والأنشطة حسب المنطقة لبدء التخطيط بسرعة.',
        heroUpdated: 'آخر تحديث: 2026-02-05',
        heroOperator: 'المشغّل: K-Spotlight',
        highlightQualityTitle: 'معايير الجودة',
        highlightQualityDesc: 'نراجع التكرارات والفئات والمعلومات الأساسية قبل النشر.',
        highlightUpdateTitle: 'التحديثات',
        highlightUpdateDesc: 'تحديث شهري على الأقل، مع التحقق من البلاغات أولاً.',
        highlightSourceTitle: 'مصادر البيانات',
        highlightSourceDesc: 'تنسيق من مصادر عامة وتوصيات محلية.',
        guideTitle: 'طريقة الاستخدام',
        guideStep1: 'اختر المنطقة/المدينة لتضييق النطاق.',
        guideStep2: 'انقر الفئة لتصفية الاهتمامات.',
        guideStep3: 'اضغط على العلامات لعرض التفاصيل.',
        principlesTitle: 'مبادئ المحتوى',
        principlesItem1: 'لا محتوى مبالغ فيه أو للبالغين أو مقامرة أو غير قانوني.',
        principlesItem2: 'تستكمل البنود غير الكاملة قبل النشر.',
        principlesItem3: 'يتم التحقق من البلاغات قبل النشر.',
        featuredRegionsTitle: 'مناطق مميزة',
        statTotalLabel: 'إجمالي الأماكن',
        statCoordsLabel: 'بإحداثيات',
        statTopCategoryLabel: 'أعلى فئة',
        statUpdatedLabel: 'آخر تحديث',
        chartTitle: 'نسبة الفئات',
        chartToggleAll: 'كل البيانات',
        chartToggleFiltered: 'التصفية الحالية',
        extraRequestTitle: 'طلب تصحيح',
        extraRequestDesc: 'أرسل “اسم المكان + المنطقة + التعديل” وسنراجع ونحدّث.',
        extraTrustTitle: 'الثقة والشفافية',
        extraTrustDesc: 'المعلومات من مصادر عامة وبلاغات، ويتم التحقق قبل النشر.',
        groupFood: '🍽️ طعام',
        groupStay: '🏨 إقامة',
        groupTourism: '🏛️ سياحة',
        groupShopping: '🛍️ تسوق',
        groupNature: '🌳 طبيعة',
        all: 'الكل',
        restaurant: 'مطاعم',
        cafe: 'مقهى',
        hotel: 'فندق/منتجع',
        tourism: 'سياحة',
        drama: 'موقع تصوير',
        activity: 'نشاطات',
        shop: 'تسوق',
        nature: 'طبيعة',
        photo: 'منطقة تصوير',
        searchPlaceholder: 'بحث...',
        youtube: 'YouTube',
        noResults: 'لم يتم العثور على نتائج',
        adjustFilters: 'حاول تعديل عوامل التصفية',
        details: 'تفاصيل',
        addToPlanner: 'إضافة إلى المخطط',
        myTrip: 'مساري',
        selectProvincePrompt: 'يرجى اختيار المنطقة.',
        selectProvinceTitle: 'يرجى اختيار المنطقة',
        provinceSummaryHint: 'في الشاشة الأولى، يتم عرض عدد الأماكن حسب المنطقة فقط.',
        // 중분류 추가
        btnRestaurant: 'مطعم',
        btnCafe: 'مقهى',
        btnHotel: 'فندق/منتجع',
        btnTourism: 'سياحة',
        btnDrama: 'موقع تصوير',
        btnActivity: 'نشاطات',
        btnShop: 'تسوق',
        btnNature: 'طبيعة',
        btnPhoto: 'منطقة تصوير',

        stampStatus: 'حالة الأختام',
        resultsCount: 'النتائج',
        showToDriver: 'اعرضه للسائق',
        audioGuide: 'دليل صوتي',
        currencyCalculator: 'حاسبة العملات',
        like: 'إعجاب',
        comments: 'التعليقات',
        addComment: 'إضافة تعليق',
        commentPlaceholder: 'شارك نصيحة أو تجربة سفر',
        feedbackLocalNote: 'التعليقات/الإعجابات محفوظة على هذا الجهاز فقط (LocalStorage).',
        noComments: 'لا توجد تعليقات بعد. كن الأول!',
        commentEmpty: 'يرجى إدخال تعليق.',
        commentLimit: 'الحد الأقصى للتعليق 200 حرف.',
        feedbackCloudNote: 'يتم حفظ التعليقات/الإعجابات على الخادم بعد تسجيل دخول مجهول.',
        commenterName: 'الاسم المستعار',
        commenterPlaceholder: 'اسم مستعار (اختياري)',
        commenterAnonymous: 'مجهول',
        commentDelete: 'حذف',
        commentDeleteConfirm: 'هل تريد حذف هذا التعليق؟',
        commentDeleteDenied: 'لا يمكنك حذف هذا التعليق.',
        commentReport: 'إبلاغ',
        commentReportConfirm: 'هل تريد الإبلاغ عن هذا التعليق؟',
        commentReportDone: 'تم إرسال البلاغ.',
        rankingTitle: 'الترتيب الأعلى',
        rankingComments: 'الأكثر تعليقًا',
        rankingSearches: 'الأكثر بحثًا (كلمات)',
        rankingSearchCount: 'بحث',
        rankingEmpty: 'لا توجد بيانات بعد.',
        rankingPeriodLabel: 'المدة',
        rankingPeriodAll: 'الكل',
        rankingPeriod7d: '7 أيام',
        rankingPeriod30d: '30 يومًا',
        googleMapsRoute: 'مسار Google Maps',
        close: 'إغلاق',
        remove: 'إزالة',
        addedToPlanner: 'تمت الإضافة إلى المخطط',
        removedFromPlanner: 'تمت الإزالة من المخطط',
        plannerEmpty: 'لا توجد أماكن في المخطط.',
        needMoreLocations: 'تحتاج إلى مكانين على الأقل لإنشاء مسار.',
        audioGuidePlaying: 'جارٍ تشغيل الدليل الصوتي...',
        stampButton: 'الأختام',
        regionHint: 'اختر المنطقة لعرض الفئات الأكثر شيوعًا أولاً.',
        categoryHintDefault: 'اختر فئة لعرض معاييرها.',
        categoryHintRestaurant: 'مطاعم: تم اختيارها وفق الملاءمة المحلية واكتمال المعلومات (مع إزالة التكرار أو نقص المعلومات).',
        categoryHintCafe: 'مقاهي: تم اختيارها وفق الملاءمة المحلية واكتمال المعلومات (مع إزالة التكرار أو نقص المعلومات).',
        categoryHintTourism: 'سياحة: منظمة لتسهيل الاستكشاف وفق النقاط الأساسية والمسارات.',
        categoryHintHotel: 'الإقامة: منظّمة وفق الموقع ونطاق السعر والمراجعات.',
        categoryHintDrama: 'مواقع الدراما: منظمة حسب المشاهد البارزة ومسارات الوصول.',
        categoryHintActivity: 'الأنشطة: أولوية لأماكن التجارب (مع إزالة التكرار أو نقص المعلومات).',
        categoryHintShop: 'التسوق: مجمّعة حول المنتجات المحلية والأسواق.',
        categoryHintNature: 'الطبيعة: منظمة لتسهيل الاستكشاف حسب المسارات.',
        categoryHintPhoto: 'مناطق التصوير: منظمة حول نقاط التصوير الأساسية.',
        footerCurationLine1: 'يعتمد K-Spotlight على المعلومات العامة والمساهمات بعد التحقق من التكرار والفئات والأساسيات.',
        footerCurationLine2: 'طلبات التعديل/الحذف عبر البريد الإلكتروني بعد التحقق.'
    },
    fr: {
        title: 'K-Spotlight',
        subtitle: 'Moins d’hésitation pour planifier le voyage — tout est regroupé par région en un seul endroit.',
        heroTitle: 'Des recommandations régionales en un seul endroit',
        heroDesc: 'Nous regroupons restaurants, cafés, hébergements, visites et activités par région.',
        heroUpdated: 'Dernière mise à jour : 2026-02-05',
        heroOperator: 'Opérateur : K-Spotlight',
        highlightQualityTitle: 'Qualité',
        highlightQualityDesc: 'Vérification des doublons, catégories et informations de base.',
        highlightUpdateTitle: 'Mises à jour',
        highlightUpdateDesc: 'Mise à jour au moins mensuelle, contributions vérifiées.',
        highlightSourceTitle: 'Sources',
        highlightSourceDesc: 'Curation à partir de sources publiques et recommandations locales.',
        guideTitle: 'Guide d\'utilisation',
        guideStep1: 'Choisissez une province/ville pour affiner la zone.',
        guideStep2: 'Cliquez une catégorie pour filtrer vos intérêts.',
        guideStep3: 'Touchez les marqueurs pour voir les détails.',
        principlesTitle: 'Principes de contenu',
        principlesItem1: 'Pas de contenu exagéré, adulte, jeu d\'argent ou illégal.',
        principlesItem2: 'Les éléments incomplets sont complétés avant publication.',
        principlesItem3: 'Les contributions sont vérifiées avant publication.',
        featuredRegionsTitle: 'Régions en vedette',
        statTotalLabel: 'Total des lieux',
        statCoordsLabel: 'Avec coordonnées',
        statTopCategoryLabel: 'Catégorie principale',
        statUpdatedLabel: 'Dernière mise à jour',
        chartTitle: 'Répartition par catégorie',
        chartToggleAll: 'Toutes les données',
        chartToggleFiltered: 'Filtres actuels',
        extraRequestTitle: 'Demande de correction',
        extraRequestDesc: 'Envoyez “nom + région + modification” et nous mettrons à jour.',
        extraTrustTitle: 'Confiance & transparence',
        extraTrustDesc: 'Infos issues de sources publiques et contributions, vérifiées avant publication.',
        groupFood: '🍽️ Cuisine',
        groupStay: '🏨 Hébergement',
        groupTourism: '🏛️ Tourisme',
        groupShopping: '🛍️ Shopping',
        groupNature: '🌳 Nature',
        all: 'Tous',
        restaurant: 'Restaurant',
        cafe: 'Café',
        hotel: 'Hôtel/Resort',
        tourism: 'Tourisme',
        drama: 'Lieu de tournage',
        activity: 'Activité',
        shop: 'Shopping',
        nature: 'Nature',
        photo: 'Zone photo',
        searchPlaceholder: 'Rechercher...',
        youtube: 'YouTube',
        noResults: 'Aucun résultat trouvé',
        adjustFilters: 'Essayez d\'ajuster les filtres',
        details: 'Détails',
        addToPlanner: 'Ajouter au plan',
        selectProvincePrompt: 'Veuillez sélectionner une région.',
        selectProvinceTitle: 'Veuillez sélectionner une région',
        provinceSummaryHint: 'Sur l\'écran initial, seul le nombre par région est affiché.',
        // 중분류 추가
        btnRestaurant: 'Restaurant',
        btnCafe: 'Café',
        btnHotel: 'Hôtel/Resort',
        btnTourism: 'Tourisme',
        btnDrama: 'Lieu de tournage',
        btnActivity: 'Activité',
        btnShop: 'Shopping',
        btnNature: 'Nature',
        btnPhoto: 'Zone photo',
        myTrip: 'Mon itinéraire',

        stampStatus: 'Statut des tampons',
        stampButton: 'Tampons',
        resultsCount: 'résultats',
        showToDriver: 'Montrer au chauffeur',
        audioGuide: 'Guide audio',
        currencyCalculator: 'Calculateur de devises',
        like: 'J’aime',
        comments: 'Commentaires',
        addComment: 'Publier un commentaire',
        commentPlaceholder: 'Partagez un conseil ou une expérience',
        feedbackLocalNote: 'Commentaires/likes enregistrés uniquement sur cet appareil (LocalStorage).',
        noComments: 'Pas encore de commentaires. Soyez le premier !',
        commentEmpty: 'Veuillez saisir un commentaire.',
        commentLimit: '200 caractères maximum.',
        feedbackCloudNote: 'Commentaires/likes enregistrés sur le serveur après connexion anonyme.',
        commenterName: 'Pseudo',
        commenterPlaceholder: 'Pseudo (optionnel)',
        commenterAnonymous: 'Anonyme',
        commentDelete: 'Supprimer',
        commentDeleteConfirm: 'Supprimer ce commentaire ?',
        commentDeleteDenied: 'Vous ne pouvez pas supprimer ce commentaire.',
        commentReport: 'Signaler',
        commentReportConfirm: 'Signaler ce commentaire ?',
        commentReportDone: 'Signalement envoyé.',
        rankingTitle: 'Classement',
        rankingComments: 'Les plus commentés',
        rankingSearches: 'Recherches populaires',
        rankingSearchCount: 'recherches',
        rankingEmpty: 'Pas de données pour le moment.',
        rankingPeriodLabel: 'Période',
        rankingPeriodAll: 'Tout',
        rankingPeriod7d: '7 jours',
        rankingPeriod30d: '30 jours',
        googleMapsRoute: 'Itinéraire Google Maps',
        close: 'Fermer',
        remove: 'Retirer',
        addedToPlanner: 'Ajouté au plan',
        removedFromPlanner: 'Retiré du plan',
        plannerEmpty: 'Aucun lieu dans votre plan.',
        needMoreLocations: 'Ajoutez au moins 2 lieux pour créer un itinéraire.',
        audioGuidePlaying: 'Lecture du guide audio...',
        regionHint: 'Choisissez une région pour voir d’abord ses catégories les plus populaires.',
        categoryHintDefault: 'Choisissez une catégorie pour afficher ses critères.',
        categoryHintRestaurant: 'Restaurants : sélection selon la pertinence locale et la complétude des infos (doublons/infos insuffisantes exclus).',
        categoryHintCafe: 'Cafés : sélection selon la pertinence locale et la complétude des infos (doublons/infos insuffisantes exclus).',
        categoryHintTourism: 'Tourisme : organisé pour faciliter l’exploration selon les points clés et itinéraires.',
        categoryHintHotel: 'Hébergement : organisé selon l’emplacement, la gamme de prix et les avis.',
        categoryHintDrama: 'Lieux de tournage : organisés par scènes marquantes et itinéraires.',
        categoryHintActivity: 'Activités : priorité aux expériences (doublons/infos insuffisantes exclus).',
        categoryHintShop: 'Shopping : regroupé autour des spécialités locales et des marchés.',
        categoryHintNature: 'Nature : organisée selon les itinéraires pour explorer facilement.',
        categoryHintPhoto: 'Zones photo : organisées autour des spots principaux.',
        footerCurationLine1: 'K-Spotlight s’appuie sur des infos publiques et des signalements après vérification des doublons, catégories et infos de base.',
        footerCurationLine2: 'Modif/suppression par e-mail, après vérification.'
    },
    ru: {
        title: 'K-Spotlight',
        subtitle: 'Меньше сомнений при планировании поездки — всё собрано по регионам в одном месте.',
        heroTitle: 'Подборки по регионам в одном месте',
        heroDesc: 'Мы группируем еду, кафе, проживание, достопримечательности и активности по регионам.',
        heroUpdated: 'Последнее обновление: 2026-02-05',
        heroOperator: 'Оператор: K-Spotlight',
        highlightQualityTitle: 'Качество',
        highlightQualityDesc: 'Проверяем дубликаты, категории и базовые сведения.',
        highlightUpdateTitle: 'Обновления',
        highlightUpdateDesc: 'Обновление не реже раза в месяц, советы проходят проверку.',
        highlightSourceTitle: 'Источники данных',
        highlightSourceDesc: 'На основе публичных данных и локальных рекомендаций.',
        guideTitle: 'Как пользоваться',
        guideStep1: 'Выберите регион/город, чтобы сузить область.',
        guideStep2: 'Нажмите категорию, чтобы отфильтровать интересы.',
        guideStep3: 'Нажмите маркеры на карте для деталей.',
        principlesTitle: 'Принципы контента',
        principlesItem1: 'Без преувеличений, 18+, азартных и незаконных тем.',
        principlesItem2: 'Недостаточные сведения дополняются перед публикацией.',
        principlesItem3: 'Пользовательские советы публикуются после проверки.',
        featuredRegionsTitle: 'Рекомендуемые регионы',
        statTotalLabel: 'Всего мест',
        statCoordsLabel: 'С координатами',
        statTopCategoryLabel: 'Топ‑категория',
        statUpdatedLabel: 'Последнее обновление',
        chartTitle: 'Доля категорий',
        chartToggleAll: 'Все данные',
        chartToggleFiltered: 'Текущие фильтры',
        extraRequestTitle: 'Запрос на исправление',
        extraRequestDesc: 'Отправьте “название + регион + исправление”, мы проверим и обновим.',
        extraTrustTitle: 'Доверие и прозрачность',
        extraTrustDesc: 'Данные из публичных источников и советов, проверяются перед публикацией.',
        groupFood: '🍽️ Еда',
        groupStay: '🏨 Проживание',
        groupTourism: '🏛️ Туризм',
        groupShopping: '🛍️ Шоппинг',
        groupNature: '🌳 Природа',
        all: 'Все',
        restaurant: 'Рестораны',
        cafe: 'Кафе',
        hotel: 'Отель/Резорт',
        tourism: 'Туризм',
        drama: 'Место съёмок',
        activity: 'Активности',
        shop: 'Шоппинг',
        nature: 'Природа',
        photo: 'Фотозона',
        searchPlaceholder: 'Поиск...',
        youtube: 'YouTube',
        noResults: 'Результаты не найдены',
        adjustFilters: 'Попробуйте изменить фильтры',
        details: 'Детали',
        addToPlanner: 'Добавить в план',
        selectProvincePrompt: 'Пожалуйста, выберите регион.',
        selectProvinceTitle: 'Пожалуйста, выберите регион',
        provinceSummaryHint: 'На первом экране показывается только количество по регионам.',
        provinceAll: 'Все провинции',
        cityAll: 'Все города',
        myTrip: 'Мой маршрут',
        stampStatus: 'Статус штампов',
        resultsCount: 'результатов',
        showToDriver: 'Показать водителю',
        audioGuide: 'Аудиогид',
        currencyCalculator: 'Конвертер валют',
        like: 'Нравится',
        comments: 'Комментарии',
        addComment: 'Оставить комментарий',
        commentPlaceholder: 'Поделитесь советом или опытом',
        feedbackLocalNote: 'Комментарии/лайки сохраняются только на этом устройстве (LocalStorage).',
        noComments: 'Комментариев пока нет. Будьте первым!',
        commentEmpty: 'Пожалуйста, введите комментарий.',
        commentLimit: 'Максимум 200 символов.',
        feedbackCloudNote: 'Комментарии/лайки сохраняются на сервере после анонимного входа.',
        commenterName: 'Никнейм',
        commenterPlaceholder: 'Никнейм (необязательно)',
        commenterAnonymous: 'Аноним',
        commentDelete: 'Удалить',
        commentDeleteConfirm: 'Удалить этот комментарий?',
        commentDeleteDenied: 'Нельзя удалить этот комментарий.',
        commentReport: 'Пожаловаться',
        commentReportConfirm: 'Пожаловаться на этот комментарий?',
        commentReportDone: 'Жалоба отправлена.',
        rankingTitle: 'Топ рейтинга',
        rankingComments: 'Больше комментариев',
        rankingSearches: 'Популярные запросы',
        rankingSearchCount: 'поисков',
        rankingEmpty: 'Данных пока нет.',
        rankingPeriodLabel: 'Период',
        rankingPeriodAll: 'Все',
        rankingPeriod7d: '7 дней',
        rankingPeriod30d: '30 дней',
        googleMapsRoute: 'Маршрут в Google Maps',
        close: 'Закрыть',
        remove: 'Удалить',
        addedToPlanner: 'Добавлено в план',
        removedFromPlanner: 'Удалено из плана',
        plannerEmpty: 'В плане нет мест.',
        needMoreLocations: 'Нужно минимум 2 места для маршрута.',
        audioGuidePlaying: 'Аудиогид воспроизводится...',
        btnRestaurant: 'Рестораны',
        btnCafe: 'Кафе',
        btnHotel: 'Отель/Резорт',
        btnTourism: 'Туризм',
        btnDrama: 'Место съёмок',
        btnActivity: 'Активности',
        btnShop: 'Шоппинг',
        btnNature: 'Природа',
        btnPhoto: 'Фотозона',
        stampButton: 'Штампы',
        regionHint: 'Выберите регион, чтобы сначала увидеть его популярные категории.',
        categoryHintDefault: 'Выберите категорию, чтобы увидеть её критерии.',
        categoryHintRestaurant: 'Рестораны: отбор по локальной релевантности и полноте данных (дубликаты/недостаточные данные исключены).',
        categoryHintCafe: 'Кафе: отбор по локальной релевантности и полноте данных (дубликаты/недостаточные данные исключены).',
        categoryHintTourism: 'Туризм: сгруппировано для удобного просмотра с учётом ключевых точек и маршрутов.',
        categoryHintHotel: 'Проживание: упорядочено по локации, цене и отзывам.',
        categoryHintDrama: 'Места съёмок: организовано по ключевым сценам и маршрутам.',
        categoryHintActivity: 'Активности: приоритет — опыт и впечатления (дубликаты/недостаточные данные исключены).',
        categoryHintShop: 'Шоппинг: сгруппировано вокруг местных специалитетов и рынков.',
        categoryHintNature: 'Природа: организовано по маршрутам для удобного просмотра.',
        categoryHintPhoto: 'Фотозоны: организовано вокруг ключевых фототочок.',
        footerCurationLine1: 'K-Spotlight использует публичные источники и сообщения, проверяя дубли, категории и базовые данные.',
        footerCurationLine2: 'Запросы на исправление/удаление — по email, после проверки.'
    }
};

// City names in multiple languages
const cityNames = {
    '서울': { ko: '서울', en: 'Seoul', ja: 'ソウル', cn: '首尔', th: 'โซล', ar: 'سيول', ru: 'Сеул', fr: 'Séoul' },
    '부산': { ko: '부산', en: 'Busan', ja: 'プサン', cn: '釜山', th: '부산', ar: 'بوسان', ru: 'Пусан', fr: 'Pusan' },
    '대구': { ko: '대구', en: 'Daegu', ja: 'テグ', cn: '大邱', th: 'แดกู', ar: 'ديغو', ru: 'Тэгу', fr: 'Daegu' },
    '인천': { ko: '인천', en: 'Incheon', ja: 'インチョン', cn: '仁川', th: '인천', ar: 'إنشيون', ru: 'Инчхон', fr: 'Incheon' },
    '광주': { ko: '광주', en: 'Gwangju', ja: 'クァンジュ', cn: '光州', th: '광주', ar: 'غوانغجو', ru: 'Кванджу', fr: 'Gwangju' },
    '대전': { ko: '대전', en: 'Daejeon', ja: 'テジョン', cn: '大田', th: 'แดจอน', ar: 'دايجون', ru: 'Тэджон', fr: 'Daejeon' },
    '울산': { ko: '울산', en: 'Ulsan', ja: 'ウルサン', cn: '蔚山', th: '울산', ar: 'ألسان', ru: 'Ульсан', fr: 'Ulsan' },
    '세종': { ko: '세종', en: 'Sejong', ja: 'セジョン', cn: '世宗', th: '세종', ar: '세종', ru: 'Седжон', fr: 'Sejong' },
    '수원': { ko: '수원', en: 'Suwon', ja: 'スウォン', cn: '水原', th: '수원', ar: '수원', ru: 'Сувон', fr: 'Suwon' },
    '강릉': { ko: '강릉', en: 'Gangneung', ja: 'カンヌン', cn: '江陵', th: '강릉', ar: 'كانغنونغ', ru: 'Каннын', fr: 'Gangneung' },
    '원주': { ko: '원주', en: 'Wonju', ja: 'ウォンジュ', cn: '原州', th: '원주', ar: '원주', ru: 'Вонджу', fr: 'Wonju' },
    '춘천': { ko: '춘천', en: 'Chuncheon', ja: 'チュンチョン', cn: '春川', th: '춘천', ar: 'チュンチョン', ru: 'Чунчхон', fr: 'Chuncheon' },
    '전주': { ko: '전주', en: 'Jeonju', ja: 'チョンジュ', cn: '全州', th: '전주', ar: 'チョンジュ', ru: 'Чонджу', fr: 'Jeonju' },
    '제주': { ko: '제주', en: 'Jeju', ja: 'チェジュ', cn: '济州', th: '제주', ar: '제주', ru: 'Чеджудо', fr: 'Jeju' },

    // Major city forms with administrative suffix (used by data_places.js: '...시')
    '강릉시': { ko: '강릉시', en: 'Gangneung-si', ja: '江陵市', cn: '江陵市' },
    '속초시': { ko: '속초시', en: 'Sokcho-si', ja: '束草市', cn: '束草市' },
    '동해시': { ko: '동해시', en: 'Donghae-si', ja: '東海市', cn: '东海市' },
    '원주시': { ko: '원주시', en: 'Wonju-si', ja: '原州市', cn: '原州市' },
    '여수시': { ko: '여수시', en: 'Yeosu-si', ja: '麗水市', cn: '丽水市' },
    '순천시': { ko: '순천시', en: 'Suncheon-si', ja: '順天市', cn: '顺天市' },
    '거제시': { ko: '거제시', en: 'Geoje-si', ja: '巨済市', cn: '巨济市' },
    '포항시': { ko: '포항시', en: 'Pohang-si', ja: '浦項市', cn: '浦项市' },
    '경주시': { ko: '경주시', en: 'Gyeongju-si', ja: '慶州市', cn: '庆州市' }
};

// Province names in multiple languages
const provinceNames = {
    '서울특별시': { ko: '서울특별시', en: 'Seoul', ja: 'ソウル', cn: '首尔', th: 'โซล', ar: 'سيول', ru: 'Сеул', fr: 'Séoul' },
    '부산광역시': { ko: '부산광역시', en: 'Busan', ja: 'プサン', cn: '釜山', th: '부산', ar: 'بوسان', ru: 'Пусан', fr: 'Pusan' },
    '대구광역시': { ko: '대구광역시', en: 'Daegu', ja: 'テグ', cn: '大邱', th: 'แดกู', ar: 'ديغو', ru: 'Тэгу', fr: 'Daegu' },
    '인천광역시': { ko: '인천광역시', en: 'Incheon', ja: 'インチョン', cn: '仁川', th: '인천', ar: 'إنشيون', ru: 'Инчхон', fr: 'Incheon' },
    '광주광역시': { ko: '광주광역시', en: 'Gwangju', ja: 'クァンジュ', cn: '光州', th: '광주', ar: 'غوانغجو', ru: 'Кванджу', fr: 'Gwangju' },
    '대전광역시': { ko: '대전광역시', en: 'Daejeon', ja: 'テジョン', cn: '大田', th: 'แดจอน', ar: 'دايجون', ru: 'Тэджон', fr: 'Daejeon' },
    '울산광역시': { ko: '울산광역시', en: 'Ulsan', ja: 'ウルサン', cn: '蔚山', th: '울산', ar: 'ألسان', ru: 'Ульсан', fr: 'Ulsan' },
    '세종특별자치시': { ko: '세종특별자치시', en: 'Sejong', ja: 'セジョン', cn: '世宗', th: '세종', ar: '세종', ru: 'Седжон', fr: 'Sejong' },
    '경기도': { ko: '경기도', en: 'Gyeonggi', ja: 'キョンギ', cn: '京畿道', th: 'คยองกิ', ar: 'كيونغغي', ru: 'Кёнгидо', fr: 'Gyeonggi' },
    '강원특별자치도': { ko: '강원특별자치도', en: 'Gangwon', ja: 'カンウォン', cn: '江原道', th: 'คังวอน', ar: 'كانغوون', ru: 'Канвондо', fr: 'Gangwon' },
    '충청북도': { ko: '충청북도', en: 'Chungbuk', ja: 'チュンチョンブク', cn: '忠清北道', th: 'ชุงชองบุก', ar: 'تشونغبوك', ru: 'Чхунчхон-Пукто', fr: 'Chungbuk' },
    '충청남도': { ko: '충청남도', en: 'Chungnam', ja: 'チュンチョンナム', cn: '忠清南道', th: 'ชุงชองนัม', ar: 'تشونغنام', ru: 'Чхунчхон-Намдо', fr: 'Chungnam' },
    '전북특별자치도': { ko: '전북특별자치도', en: 'Jeonbuk', ja: 'チョンブク', cn: '全罗北道', th: 'ชอนบุก', ar: 'جونبوك', ru: 'Чолла-Пукто', fr: 'Jeonbuk' },
    '전남특별자치도': { ko: '전남특별자치도', en: 'Jeonnam', ja: 'チョンナム', cn: '全罗南道', th: 'ชอนนัม', ar: 'جوننام', ru: 'Чолла-Намдо', fr: 'Jeonnam' },
    '경상북도': { ko: '경상북도', en: 'Gyeongbuk', ja: 'キョンサンブク', cn: '庆尚北道', th: 'คยองซังบุก', ar: 'كيونغسانغبوك', ru: 'Кёнсан-Пукто', fr: 'Gyeongbuk' },
    '경상남도': { ko: '경상남도', en: 'Gyeongnam', ja: 'キョンサンナム', cn: '庆尚南道', th: 'คยองซังนัม', ar: 'كيونغسانغنام', ru: 'Кёнсан-Намдо', fr: 'Gyeongnam' },
    '제주특별자치도': { ko: '제주특별자치도', en: 'Jeju', ja: 'チェジュ', cn: '济州道', th: 'เชจู', ar: 'جيجو', ru: 'Чеджудо', fr: 'Jeju' }
};

// Backward compatibility: legacy dictionaries used 'ja' but the UI language key is 'jp'
for (const dict of [cityNames, provinceNames]) {
    for (const v of Object.values(dict)) {
        if (v && typeof v === 'object' && v.ja && !v.jp) {
            v.jp = v.ja;
        }
    }
}

// Get category translation
function getCategoryTranslation(category) {
    return translations[currentLang]?.[category] || category;
}

function getCategoryClass(category) {
    const c = String(category || '').trim();
    const allowed = new Set(['restaurant', 'cafe', 'hotel', 'tourism', 'drama', 'activity', 'shop', 'nature', 'photo', 'all', 'other']);
    return allowed.has(c) ? c : 'all';
}

function getCategoryDisplayLabel(category) {
    const c = String(category || '').trim();
    if (c === 'other') {
        return currentLang === 'ko' ? '기타' : 'Other';
    }
    if (c === 'all') {
        return currentLang === 'ko' ? '전체' : 'All';
    }
    return getCategoryTranslation(c);
}

function getCategoryKeyForStats(place) {
    const normalized = normalizeCategory(place);
    if (normalized && normalized !== 'all') return normalized;
    const raw = String(place?.category ?? '').trim();
    const allowed = new Set(['restaurant', 'cafe', 'hotel', 'tourism', 'drama', 'activity', 'shop', 'nature', 'photo', 'all']);
    if (raw && !allowed.has(raw)) return 'other';
    return null;
}

function getTopCategoryFromPlaces(places, preferTabs) {
    const counts = new Map();
    (Array.isArray(places) ? places : []).forEach((p) => {
        const cat = getCategoryKeyForStats(p);
        if (!cat) return;
        counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c);
    if (!preferTabs) return ranked[0] || 'all';
    const tabCats = new Set(['restaurant', 'cafe', 'hotel', 'tourism', 'drama', 'activity', 'shop', 'nature', 'photo']);
    const best = ranked.find((c) => tabCats.has(c));
    return best || 'all';
}

function selectCategoryTab(category) {
    const cat = String(category || 'all');
    const selector = cat === 'all'
        ? '.filter-tab[data-category="all"]'
        : `.sub-tab[data-category="${cat}"], .filter-tab[data-category="${cat}"]`;
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
        el.click();
        return;
    }
    const fallback = document.querySelector('.filter-tab[data-category="all"]');
    if (fallback instanceof HTMLElement) fallback.click();
}

// Get type translation
function getTypeTranslation(type) {
    const typeMap = {
        '현지인': 'localFavorite',
        '외지인': 'touristPopular', 
        '공통': 'commonPopular'
    };
    const key = typeMap[type];
    return translations[currentLang]?.[key] || type;
}

// Get city name in current language
function getCityName(city) {
    if (currentLang === 'jp') {
        return cityNames[city]?.jp || cityNames[city]?.ja || city;
    }
    return cityNames[city]?.[currentLang] || city;
}

function getCityNameLocalizedFallback(city) {
    if (!city) return '';

    const translated = getCityName(city);
    // If we have an explicit translation, use it.
    if (translated !== city) return translated;

    // Fallback: only localize the administrative suffix so the UI changes by language.
    // Examples:
    //  - 포항시 -> 포항市 (jp/cn)
    //  - 포항시 -> Pohang-si style is not possible without romanization, so we use '-si' suffix.
    const suffixRules = {
        jp: { '시': '市', '구': '区', '군': '郡' },
        cn: { '시': '市', '구': '区', '군': '郡' },
        en: { '시': '-si', '구': '-gu', '군': '-gun' }
    };

    const rules = suffixRules[currentLang];
    if (!rules) return city;

    for (const [krSuffix, outSuffix] of Object.entries(rules)) {
        if (city.endsWith(krSuffix)) {
            const stem = city.slice(0, -krSuffix.length);
            return `${stem}${outSuffix}`;
        }
    }

    return city;
}

// Get province name in current language
function getProvinceName(province) {
    if (currentLang === 'jp') {
        return provinceNames[province]?.jp || provinceNames[province]?.ja || province;
    }
    return provinceNames[province]?.[currentLang] || province;
}

// Update address language
function updateAddressLanguage() {
    markers.forEach(item => {
        item.marker.setPopupContent(createPopupContent(item.data));
    });
    updateRestaurantList();
}

// Filter markers based on current filters
function filterMarkers() {
    if (mapMode === 'province') {
        updateResultCount();
        // Province summary mode still needs list filtering (especially when coordinates are missing)
        updateRestaurantList();
        renderCategoryChart();
        renderFilterSummaryCard();
        return;
    }

    if (!useMapMarkers) {
        updateResultCount();
        updateRestaurantList();
        renderCategoryChart();
        renderFilterSummaryCard();
        return;
    }
    const filtered = new Set(getFilteredPlaces());
    markers.forEach((item) => {
        if (!markerClusterGroup) return;
        const show = filtered.has(item.data);
        if (show) {
            if (!markerClusterGroup.hasLayer(item.marker)) markerClusterGroup.addLayer(item.marker);
        } else {
            if (markerClusterGroup.hasLayer(item.marker)) markerClusterGroup.removeLayer(item.marker);
        }
    });
    
    updateResultCount();
    updateRestaurantList();
    renderCategoryChart();
    renderFilterSummaryCard();
}

function updateResultCount() {
    const el = document.getElementById('resultCount');
    if (!el) return;

    const visibleCount = getFilteredPlaces().length;
    const suffix = translations[currentLang]?.resultsCount || '';

    ensureFlaggedReportButton();

    if (currentLang === 'ko') {
        el.textContent = `${suffix} ${visibleCount}개`;
        return;
    }

    if (currentLang === 'ja' || currentLang === 'zh') {
        el.textContent = `${visibleCount}${suffix}`;
        return;
    }

    el.textContent = `${visibleCount} ${suffix}`.trim();
}

// Fly to specific city
function flyToCity(city) {
    if (!map) return;

    const normalized = normalizeCityKey(city);
    const coord = cityCoordinates[city] || cityCoordinates[normalized];
    if (coord) {
        map.flyTo(coord, 12, { duration: 1.5 });
        return;
    }

    // Fallback: fit bounds to markers for the selected city
    const latLngs = markers
        .filter(m => m?.data?.city === city)
        .map(m => m.marker?.getLatLng())
        .filter(Boolean);

    if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds.pad(0.25));
    }
}

function updateLanguage() {
    // Update main title and subtitle
    document.getElementById('main-title').textContent = translations[currentLang]?.title || 'K-Local Vibe';
    document.getElementById('sub-title').textContent = translations[currentLang]?.subtitle || '신사임당과 율곡 이이가 태어난 유서 깊은 곳입니다.';
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translations[currentLang][key];
            } else {
                el.textContent = translations[currentLang][key];
            }
        }
    });

    window.dispatchEvent(new CustomEvent('app:langChange', { detail: { lang: currentLang } }));
    
    // 중분류 버튼 업데이트
    const subIds = [
        'btn-restaurant',
        'btn-cafe',
        'btn-hotel',
        'btn-tourism',
        'btn-drama',
        'btn-activity',
        'btn-shop',
        'btn-nature',
        'btn-photo'
    ];
    subIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        if (!translations[currentLang]?.[key]) return;
        el.textContent = translations[currentLang][key];
    });
    
    // Update result count if needed
    updateResultCount();

    // Update province/city select labels in current language (preserve selections)
    const provinceSelect = document.getElementById('provinceSelect');
    const citySelect = document.getElementById('citySelect');
    if (provinceSelect && citySelect) {
        const prevProv = provinceSelect.value || 'all';
        const prevCity = citySelect.value || 'all';
        hydrateLocationFilters();
        provinceSelect.value = prevProv;
        updateCityOptions(prevProv);
        citySelect.value = prevCity;
    }

    updatePlannerButton();
    ensureStampButton();

    // Re-render open modals so labels that were rendered as raw strings follow the new language.
    const detailsModal = document.getElementById('restaurantDetailsModal');
    if (detailsModal && lastRestaurantDetailId) {
        try {
            detailsModal.remove();
        } catch {
            // ignore
        }
        showRestaurantDetails(lastRestaurantDetailId);
    }

    const taxiModal = document.getElementById('taxiHelperModal');
    if (taxiModal) {
        // Taxi modal content uses translations directly; re-render to update label.
        const addrEl = taxiModal.querySelector('div[style*="font-size: 48px"]');
        const address = addrEl ? String(addrEl.textContent || '').trim() : '';
        if (address) {
            try { taxiModal.remove(); } catch { /* ignore */ }
            showTaxiHelper(address);
        }
    }

    const currencyModal = document.getElementById('restaurantDetailModal');
    if (currencyModal) {
        // simplest: close it on language change to avoid mixed UI
        try { currencyModal.remove(); } catch { /* ignore */ }
    }

    renderFeaturedRegions();
    renderDataSummary();
    renderCategoryChart();
    renderFilterSummaryCard();
}

window.addEventListener('app:langChange', () => {
    document.querySelectorAll('.place-feedback').forEach((el) => {
        const key = el.getAttribute('data-place-key');
        if (!key) return;
        updatePlaceFeedbackUI(key, el.id);
    });
    refreshPlaceRankings();
    refreshCardFeedbackBadges();
});

window.addEventListener('feedback:ready', () => {
    document.querySelectorAll('.place-feedback').forEach((el) => {
        const key = el.getAttribute('data-place-key');
        if (!key) return;
        updatePlaceFeedbackUI(key, el.id);
    });
    refreshPlaceRankings();
    refreshCardFeedbackBadges();
});

// Update restaurant list
function updateRestaurantList() {
    const grid = document.getElementById('contentGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const visiblePlacesAll = getFilteredPlaces();

    // Province summary mode: show guidance by default, but if user typed a search query,
    // render matching places as a list (since there are no per-place markers in this mode).
    if (mapMode === 'province') {
        const q = String(searchQuery ?? '').trim();
        if (!q) {
            const title = translations[currentLang]?.selectProvinceTitle || '도(지역)를 선택해 주세요';
            const hint = translations[currentLang]?.provinceSummaryHint || '초기 화면에서는 지역별 장소 수만 표시합니다.';
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🗺️</div>
                    <h3 style="margin-bottom: 8px;"><span data-i18n="selectProvinceTitle">${title}</span></h3>
                    <p style="font-size: 14px;"><span data-i18n="provinceSummaryHint">${hint}</span></p>
                </div>
            `;
            return;
        }

        const visiblePlaces = visiblePlacesAll.slice(0, listRenderLimit);
        if (visiblePlaces.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🔍</div>
                    <h3 style="margin-bottom: 8px;">${translations[currentLang]?.noResults || '검색 결과가 없습니다'}</h3>
                    <p style="font-size: 14px;">${translations[currentLang]?.adjustFilters || '필터를 조정해보세요'}</p>
                </div>
            `;
            return;
        }

        // (a) distribution summary (Top N)
        grid.insertAdjacentHTML('beforeend', renderTopRegionsSummary(visiblePlacesAll, '이 테마에서 지금 인기 많은 지역 TOP3'));

        // (A) specialties under TOP3 summary
        const specialtiesHtml = renderSpecialtiesCardForTopProvince(visiblePlacesAll);
        if (specialtiesHtml) {
            grid.insertAdjacentHTML('beforeend', specialtiesHtml);
        }

        const frag = document.createDocumentFragment();
        visiblePlaces.forEach((place) => {
            frag.appendChild(createRestaurantCard(place));
        });
        grid.appendChild(frag);
        hydrateCardFeedbackBadges(visiblePlaces);

        if (visiblePlacesAll.length > visiblePlaces.length) {
            const more = document.createElement('div');
            more.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px 0;';
            more.innerHTML = `
                <button class="btn btn-secondary" style="padding: 12px 18px;" onclick="loadMoreResults()">
                    ${translations[currentLang]?.loadMore || '더보기'} (${visiblePlaces.length.toLocaleString()}/${visiblePlacesAll.length.toLocaleString()})
                </button>
            `;
            grid.appendChild(more);
        }
        return;
    }

    if (visiblePlacesAll.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🔍</div>
                <h3 style="margin-bottom: 8px;">${translations[currentLang]?.noResults || '검색 결과가 없습니다'}</h3>
                <p style="font-size: 14px;">${translations[currentLang]?.adjustFilters || '필터를 조정해보세요'}</p>
            </div>
        `;
        return;
    }

    // Theme summary (Top3)
    grid.insertAdjacentHTML('beforeend', renderTopRegionsSummary(visiblePlacesAll, '이 테마에서 지금 인기 많은 지역 TOP3'));

    // Specialties: in detail mode prefer the selected province, otherwise fall back to top1.
    const selectedProv = String(document.getElementById('provinceSelect')?.value || '').trim();
    const spHtml = selectedProv && selectedProv !== 'all'
        ? renderSpecialtiesCardForProvince(selectedProv)
        : renderSpecialtiesCardForTopProvince(visiblePlacesAll);
    if (spHtml) {
        grid.insertAdjacentHTML('beforeend', spHtml);
    }

    const visiblePlaces = visiblePlacesAll.slice(0, listRenderLimit);
    const frag = document.createDocumentFragment();
    visiblePlaces.forEach((place) => {
        frag.appendChild(createRestaurantCard(place));
    });
    grid.appendChild(frag);
    hydrateCardFeedbackBadges(visiblePlaces);

    if (visiblePlacesAll.length > visiblePlaces.length) {
        const more = document.createElement('div');
        more.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px 0;';
        more.innerHTML = `
            <button class="btn btn-secondary" style="padding: 12px 18px;" onclick="loadMoreResults()">
                ${translations[currentLang]?.loadMore || '더보기'} (${visiblePlaces.length.toLocaleString()}/${visiblePlacesAll.length.toLocaleString()})
            </button>
        `;
        grid.appendChild(more);
    }
}

function loadMoreResults() {
    listRenderLimit = Math.min(listRenderLimit + 120, 5000);
    updateRestaurantList();
}

function getCardImageUrl(place) {
    const img = String(place?.image ?? '').trim();
    if (img) return img;

    const category = normalizeCategory(place);
    const title = String(place?.title ?? '').trim();

    const cfg = {
        restaurant: { bg1: '#ffedd5', bg2: '#fb7185', icon: '🍽️' },
        cafe: { bg1: '#e0f2fe', bg2: '#38bdf8', icon: '☕' },
        hotel: { bg1: '#ede9fe', bg2: '#a78bfa', icon: '🏨' },
        tourism: { bg1: '#dcfce7', bg2: '#22c55e', icon: '🏛️' },
        drama: { bg1: '#fee2e2', bg2: '#ef4444', icon: '🎬' },
        activity: { bg1: '#fff7ed', bg2: '#f97316', icon: '🏃' },
        shop: { bg1: '#f1f5f9', bg2: '#64748b', icon: '🛍️' },
        nature: { bg1: '#ecfccb', bg2: '#84cc16', icon: '🌿' },
        photo: { bg1: '#fdf2f8', bg2: '#ec4899', icon: '📸' },
        default: { bg1: '#e5e7eb', bg2: '#9ca3af', icon: '📍' }
    };

    const c = cfg[category] || cfg.default;
    const safeTitle = title.replace(/[&<>"']/g, ' ').slice(0, 24);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c.bg1}"/>
      <stop offset="1" stop-color="${c.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <text x="60" y="140" font-size="120" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${c.icon}</text>
  <text x="60" y="220" font-size="44" font-weight="700" fill="#111827" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">${safeTitle}</text>
  <text x="60" y="280" font-size="24" fill="#111827" opacity="0.75" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">${category || 'place'}</text>
</svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Create restaurant card
function createRestaurantCard(place) {
    const card = document.createElement('div');
    card.className = 'card';

    card.addEventListener('click', (e) => {
        const t = e.target;
        if (t && (t.closest('button') || t.tagName === 'BUTTON')) return;
        showPlaceDetail(place);
    });
    
    const imageUrl = getCardImageUrl(place);
    const normalizedCategory = normalizeCategory(place);
    const heritageBadge = isHeritagePlace(place) ? '🏛️' : '';
    const youtubeBadge = `🎥 ${hasYoutube(place) ? '✅' : '❌'}`;
    const noMapBadge = hasCoords(place) ? '' : `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:900;background:#f2f2f7;border-radius:999px;padding:4px 8px;color:#6b7280;">지도 표시 불가</span>`;
    const tags = generateTags(place);
    const tagsHtml = tags.map((x) => `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:900;background:#f2f2f7;border-radius:999px;padding:4px 8px;color:#111827;">${escapeHtmlAttr(x)}</span>`).join(' ');
    const q = String(searchQuery ?? '').trim();
    const titleHtml = q ? highlightMatch(place.title, q) : escapeHtmlAttr(place.title);
    const addressHtml = q ? highlightMatch(place.address, q) : escapeHtmlAttr(place.address);
    const searchPill = q ? `<span class="search-term-pill" title="${escapeHtmlAttr(q)}">🔎 ${escapeHtmlAttr(q)}</span>` : '';
    card.innerHTML = `
        <div class="card-img" style="background-image: url('${imageUrl}')"></div>
        <div class="card-body">
            <small style="color: var(--apple-blue); font-weight: 600; font-size: 12px;">
                ${normalizedCategory}
            </small>
            <h2 class="card-title">${titleHtml} ${heritageBadge} <span style="font-size:12px;font-weight:900;color:#111827;opacity:.9;">${youtubeBadge}</span></h2>
            <p class="card-desc" style="white-space: pre-line;">${addressHtml}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px 0;">${noMapBadge} ${tagsHtml}</div>
            ${searchPill}
            <div class="card-feedback-badges" id="card-feedback-${hashPlaceKey(getPlaceKey(place))}" data-place-key="${escapeHtmlAttr(getPlaceKey(place))}">
                <span class="card-feedback-pill">❤️ 0</span>
                <span class="card-feedback-pill">💬 0</span>
            </div>
            
            <div class="card-actions">
                <button class="btn btn-secondary" onclick="showRestaurantDetails(${toOnclickArg(place.title)})">
                    📍 ${translations[currentLang]?.details || '상세 정보'}
                </button>
                <button class="btn btn-primary" onclick="addToPlanner(${toOnclickArg(place.title)})">
                    ➕ ${translations[currentLang]?.addToPlanner || '플래너 추가'}
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// DIY Travel Planner (My Trip) functionality
function addToPlanner(restaurantId) {
    const restaurant = findPlaceByKey(restaurantId);
    if (!restaurant) return;
    
    let plannerItems = JSON.parse(localStorage.getItem('k-local-vibe-planner')) || [];
    
    // Check if already in planner
    const key = String(restaurant?.title ?? restaurantId ?? '').trim();
    const existingIndex = plannerItems.findIndex(item => String(item?.key ?? item?.title ?? '').trim() === key);
    
    if (existingIndex !== -1) {
        // Remove from planner
        plannerItems.splice(existingIndex, 1);
        showToast(translations[currentLang]?.removedFromPlanner || '플래너에서 제거되었습니다');
    } else {
        // Add to planner
        plannerItems.push({
            key,
            title: restaurant.title,
            address: restaurant.address,
            lat: restaurant.lat,
            lng: restaurant.lng,
            category: restaurant.category,
            city: restaurant.city,
            province: restaurant.province
        });
        showToast(translations[currentLang]?.addedToPlanner || '플래너에 추가되었습니다');
    }
    
    localStorage.setItem('k-local-vibe-planner', JSON.stringify(plannerItems));
    updatePlannerButton();
    updateRestaurantList(); // Update button states
}

// Show planner modal
function showPlannerModal() {
    const plannerItems = JSON.parse(localStorage.getItem('k-local-vibe-planner')) || [];
    
    if (plannerItems.length === 0) {
        alert(translations[currentLang]?.plannerEmpty || '플래너에 추가된 장소가 없습니다.');
        return;
    }

    let plannerOrigin = String(localStorage.getItem(PLANNER_ORIGIN_STORAGE_KEY) || '').trim();
    const provinceVal = document.getElementById('provinceSelect')?.value || 'all';
    const cityVal = document.getElementById('citySelect')?.value || 'all';
    if (!plannerOrigin) {
        if (cityVal !== 'all') {
            plannerOrigin = getCityName(cityVal);
        } else if (provinceVal !== 'all') {
            plannerOrigin = getProvinceName(provinceVal);
        }
        if (plannerOrigin) {
            localStorage.setItem(PLANNER_ORIGIN_STORAGE_KEY, plannerOrigin);
        }
    }
    const originLabel = currentLang === 'ko' ? '출발 위치' : 'Starting point';
    const originPlaceholder = currentLang === 'ko' ? '예: 서울역, 부산역, 37.5665,126.9780' : 'e.g., Seoul Station or 37.5665,126.9780';
    const originHint = currentLang === 'ko'
        ? '출발 위치를 입력하면 경로 생성 시 시작점으로 사용됩니다.'
        : 'This will be used as the origin when generating the route.';
    const originGeoLabel = currentLang === 'ko' ? '현재 위치' : 'Use my location';
    const originPickLabel = currentLang === 'ko' ? '지도에서 선택' : 'Pick on map';
    const summaryTitle = currentLang === 'ko' ? '이동 요약' : 'Trip Summary';
    const summaryOriginLabel = currentLang === 'ko' ? '출발' : 'Origin';
    const summaryDestinationLabel = currentLang === 'ko' ? '도착' : 'Destination';
    const summaryStopsLabel = currentLang === 'ko' ? '경유' : 'Stops';

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;

    const canOpenCourse = Boolean(window.Course && typeof window.Course.open === 'function');
    const canReloadCourse = Boolean(window.Course && typeof window.Course.reload === 'function');
    const canImportToCourse = canOpenCourse;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; max-width: 500px; max-height: 80vh; overflow-y: auto; margin: 20px;">
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f;">${translations[currentLang]?.myTrip || '나만의 코스 리스트'}</h2>
            <div class="planner-origin">
                <div class="planner-origin-title">${originLabel}</div>
                <div class="planner-origin-row">
                    <input id="plannerOriginInput" class="planner-origin-input" type="text" placeholder="${escapeHtmlAttr(originPlaceholder)}" value="${escapeHtmlAttr(plannerOrigin)}" />
                    <button id="plannerOriginGeo" type="button" class="planner-origin-btn">${originGeoLabel}</button>
                    <button id="plannerOriginPick" type="button" class="planner-origin-btn ghost">${originPickLabel}</button>
                </div>
                <div class="planner-origin-hint">${originHint}</div>
            </div>
            <div class="planner-summary">
                <div class="planner-summary-title">${summaryTitle}</div>
                <div class="planner-summary-row">
                    <div class="planner-summary-item">
                        <strong>${summaryOriginLabel}</strong>
                        <span>${escapeHtmlAttr(plannerOrigin || '-')}</span>
                    </div>
                    <div class="planner-summary-item">
                        <strong>${summaryDestinationLabel}</strong>
                        <span>${escapeHtmlAttr(plannerItems[plannerItems.length - 1]?.title || '-')}</span>
                    </div>
                    <div class="planner-summary-item">
                        <strong>${summaryStopsLabel}</strong>
                        <span>${Math.max(plannerItems.length - 1, 0)}</span>
                    </div>
                </div>
            </div>
            <div id="plannerList"></div>
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button onclick="generateGoogleMapsRoute()" style="
                    background: #0071e3; color: white; border: none; padding: 12px 20px;
                    border-radius: 10px; cursor: pointer; font-weight: 600; flex: 1;
                ">${translations[currentLang]?.googleMapsRoute || '구글 맵 경로 보기'}</button>
                ${canImportToCourse ? `<button id="importToCourseBtn" type="button" style="
                    background: #111827; color: white; border: none; padding: 12px 20px;
                    border-radius: 10px; cursor: pointer; font-weight: 600;
                ">${translations[currentLang]?.myTrip || '나만의 코스'}+ 가져가기</button>` : ''}
                <button onclick="this.closest('div[style*=fixed]').remove()" style="
                    background: #f2f2f7; color: #1d1d1f; border: none; padding: 12px 20px;
                    border-radius: 10px; cursor: pointer; font-weight: 600;
                ">${translations[currentLang]?.close || '닫기'}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate planner list
    const plannerList = modal.querySelector('#plannerList');
    plannerItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            padding: 15px; background: #f9f9f9; border-radius: 10px; margin-bottom: 10px;
        `;
        itemDiv.innerHTML = `
            <div>
                <strong>${index + 1}. ${item.title || ''}</strong><br>
                <small style="color: #666;">${item.city ? getCityName(item.city) : ''}${item.city ? ' • ' : ''}${item.address || ''}</small>
            </div>
            <button onclick="removeFromPlanner(${toOnclickArg(item.key || item.title || '')})" style="
                background: #ff3b30; color: white; border: none; padding: 8px 12px;
                border-radius: 6px; cursor: pointer;
            ">${translations[currentLang]?.remove || '제거'}</button>
        `;
        plannerList.appendChild(itemDiv);
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    const originInput = modal.querySelector('#plannerOriginInput');
    const originBtn = modal.querySelector('#plannerOriginGeo');
    const originPickBtn = modal.querySelector('#plannerOriginPick');
    if (originInput) {
        const save = () => {
            const v = String(originInput.value || '').trim();
            if (v) {
                localStorage.setItem(PLANNER_ORIGIN_STORAGE_KEY, v);
            } else {
                localStorage.removeItem(PLANNER_ORIGIN_STORAGE_KEY);
            }
        };
        originInput.addEventListener('change', save);
        originInput.addEventListener('blur', save);
    }
    if (originBtn) {
        originBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                showToast(currentLang === 'ko' ? '위치 정보를 사용할 수 없습니다.' : 'Geolocation is not available.');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude.toFixed(5);
                    const lng = pos.coords.longitude.toFixed(5);
                    const v = `${lat},${lng}`;
                    if (originInput) originInput.value = v;
                    localStorage.setItem(PLANNER_ORIGIN_STORAGE_KEY, v);
                    showToast(currentLang === 'ko' ? '현재 위치를 출발점으로 저장했습니다.' : 'Saved current location as origin.');
                },
                () => {
                    showToast(currentLang === 'ko' ? '현재 위치를 가져오지 못했습니다.' : 'Unable to get current location.');
                }
            );
        });
    }
    if (originPickBtn) {
        originPickBtn.addEventListener('click', () => {
            if (!map) {
                showToast(currentLang === 'ko' ? '지도를 사용할 수 없습니다.' : 'Map is not available.');
                return;
            }
            modal.remove();
            showToast(currentLang === 'ko' ? '지도에서 출발점을 클릭하세요.' : 'Click the map to set your origin.');

            const onMapClick = (e) => {
                const lat = e?.latlng?.lat;
                const lng = e?.latlng?.lng;
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                const v = `${lat.toFixed(5)},${lng.toFixed(5)}`;
                localStorage.setItem(PLANNER_ORIGIN_STORAGE_KEY, v);
                map.off('click', onMapClick);
                showToast(currentLang === 'ko' ? '출발점을 저장했습니다.' : 'Origin saved.');
                setTimeout(() => showPlannerModal(), 150);
            };
            map.on('click', onMapClick);
        });
    }

    const importBtn = modal.querySelector('#importToCourseBtn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const items = JSON.parse(localStorage.getItem('k-local-vibe-planner')) || [];
            if (!Array.isArray(items) || items.length === 0) {
                alert(translations[currentLang]?.plannerEmpty || '플래너에 추가된 장소가 없습니다.');
                return;
            }

            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const lang = window.currentLang || document.getElementById('langSelect')?.value || 'ko';

            const toId = (it) => String(it?.key ?? it?.id ?? it?.title ?? '').trim();
            const incoming = items
                .map((it) => ({ id: toId(it), time: '', note: '' }))
                .filter((p) => p.id);

            const rawCourse = JSON.parse(localStorage.getItem('k-local-vibe-course')) || null;

            const normalizeCourse = (raw) => {
                if (Array.isArray(raw)) {
                    return {
                        startDate: today,
                        endDate: today,
                        days: [{ dayIndex: 1, date: today, places: raw.map((x) => ({ id: toId(x), time: String(x?.time ?? ''), note: '' })).filter((p) => p.id) }],
                        meta: { lang }
                    };
                }
                if (raw && typeof raw === 'object') {
                    const next = raw;
                    next.days = Array.isArray(next.days) ? next.days : [];
                    next.meta = next.meta && typeof next.meta === 'object' ? next.meta : {};
                    next.meta.lang = next.meta.lang || lang;
                    if (!next.startDate) next.startDate = today;
                    if (!next.endDate) next.endDate = today;
                    return next;
                }
                return {
                    startDate: today,
                    endDate: today,
                    days: [{ dayIndex: 1, date: today, places: [] }],
                    meta: { lang }
                };
            };

            const course = normalizeCourse(rawCourse);

            const allExistingIds = new Set(
                (course.days || [])
                    .flatMap((day) => (Array.isArray(day?.places) ? day.places : []))
                    .map((p) => String(p?.id ?? '').trim())
                    .filter(Boolean)
            );

            let day1 = (course.days || []).find((dd) => (dd?.dayIndex ?? 0) === 1);
            if (!day1) {
                day1 = { dayIndex: 1, date: course.startDate || today, places: [] };
                course.days = Array.isArray(course.days) ? course.days : [];
                course.days.unshift(day1);
            }
            day1.places = Array.isArray(day1.places) ? day1.places : [];

            incoming.forEach((p) => {
                const id = String(p?.id ?? '').trim();
                if (!id) return;
                if (allExistingIds.has(id)) return;
                day1.places.push({ id, time: '', note: '' });
                allExistingIds.add(id);
            });

            localStorage.setItem('k-local-vibe-course', JSON.stringify(course));

            if (window.Course && typeof window.Course.reload === 'function') window.Course.reload();
            window.Course?.open?.();
        });
    }
}

// Remove from planner
function removeFromPlanner(restaurantId) {
    let plannerItems = JSON.parse(localStorage.getItem('k-local-vibe-planner')) || [];
    plannerItems = plannerItems.filter(item => String(item?.key ?? item?.title ?? '').trim() !== String(restaurantId ?? '').trim());
    localStorage.setItem('k-local-vibe-planner', JSON.stringify(plannerItems));
    showPlannerModal(); // Refresh modal
    updatePlannerButton();
    updateRestaurantList();
}

// Generate Google Maps route
function generateGoogleMapsRoute() {
    const plannerItems = JSON.parse(localStorage.getItem('k-local-vibe-planner')) || [];
    
    if (plannerItems.length < 2) {
        alert(translations[currentLang]?.needMoreLocations || '경로를 생성하려면 최소 2개 이상의 장소가 필요합니다.');
        return;
    }
    
    const toRoutePoint = (item) => {
        const lat = parseFloat(item?.lat);
        const lng = parseFloat(item?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat},${lng}`;
        // Fallback: use text query (works even without coordinates)
        const title = String(item?.title ?? '').trim();
        const address = String(item?.address ?? '').trim();
        return [title, address].filter(Boolean).join(' ').trim();
    };

    // Create Google Maps URL with waypoints
    const originOverride = String(localStorage.getItem(PLANNER_ORIGIN_STORAGE_KEY) || '').trim();
    const origin = originOverride || toRoutePoint(plannerItems[0]);
    const destination = toRoutePoint(plannerItems[plannerItems.length - 1]);
    
    let waypoints = '';
    if (plannerItems.length > 2) {
        waypoints = plannerItems.slice(1, -1)
            .map(toRoutePoint)
            .join('|');
    }
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints) {
        url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }
    
    window.open(url, '_blank');
}

// Update planner button
function updatePlannerButton() {
    const courseRaw = JSON.parse(localStorage.getItem('k-local-vibe-course')) || null;
    const plannerItems = JSON.parse(localStorage.getItem('k-local-vibe-planner')) || [];

    const getCourseCount = (course) => {
        if (!course) return 0;
        if (Array.isArray(course)) return course.length;
        if (typeof course === 'object') {
            const days = Array.isArray(course.days) ? course.days : [];
            return days.reduce((acc, d) => acc + (Array.isArray(d?.places) ? d.places.length : 0), 0);
        }
        return 0;
    };

    const courseCount = getCourseCount(courseRaw);
    const plannerCount = Array.isArray(plannerItems) ? plannerItems.length : 0;
    const count = plannerCount > 0 ? plannerCount : courseCount;
    let button = document.getElementById('plannerButton');
    
    if (!button) {
        button = document.createElement('button');
        button.id = 'plannerButton';
        button.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 20000;
            background: #0071e3; color: white; border: none; padding: 15px 20px;
            border-radius: 50px; cursor: pointer; font-weight: 600;
            box-shadow: 0 4px 20px rgba(0,113,227,0.3); display: flex;
            align-items: center; gap: 8px;
        `;
        button.onclick = function() {
            showPlannerModal();
        };
        document.body.appendChild(button);
    }
    
    button.innerHTML = `
        📍 ${translations[currentLang]?.myTrip || '나만의 코스'} (${count})
    `;
}

// Digital Stamp Tour functionality
function updateStampCount(category) {
    let stamps = JSON.parse(localStorage.getItem('k-local-vibe-stamps')) || {};
    
    if (!stamps[category]) {
        stamps[category] = 0;
    }
    
    stamps[category]++;
    localStorage.setItem('k-local-vibe-stamps', JSON.stringify(stamps));
    
    showToast(`${getCategoryTranslation(category)} 스탬프 +1! (${stamps[category]}/${getCategoryTotal(category)})`);
}

function getCategoryTotal(category) {
    return placeData.filter(r => r.category === category).length;
}

function showStampStatus() {
    const stamps = JSON.parse(localStorage.getItem('k-local-vibe-stamps')) || {};
    const categories = ['restaurant', 'cafe'];
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; max-width: 400px; margin: 20px;">
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f;">${translations[currentLang]?.stampStatus || '스탬프 현황'}</h2>
            <div id="stampProgress"></div>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="
                background: #0071e3; color: white; border: none; padding: 12px 20px;
                border-radius: 10px; cursor: pointer; font-weight: 600; width: 100%; margin-top: 20px;
            ">${translations[currentLang]?.close || '닫기'}</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const progressDiv = modal.querySelector('#stampProgress');
    categories.forEach(category => {
        const count = stamps[category] || 0;
        const total = getCategoryTotal(category);
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        
        const categoryDiv = document.createElement('div');
        categoryDiv.style.cssText = 'margin-bottom: 15px;';
        categoryDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${getCategoryTranslation(category)}</span>
                <span>${count}/${total} (${percentage}%)</span>
            </div>
            <div style="background: #f2f2f7; border-radius: 10px; height: 10px; overflow: hidden;">
                <div style="background: #0071e3; height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
            </div>
        `;
        progressDiv.appendChild(categoryDiv);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}
