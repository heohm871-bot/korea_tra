const fs = require('fs');
const path = require('path');

// ✅ 사용자 API 키
const KAKAO_API_KEY = "b424163538e51105e53bd6e2ee85f723";

// 좌표 없이 운영(네이버맵만) 모드: 지오코딩 호출하지 않음
const USE_GEOCODE = false;

// 실행 모드
// - 'full': partial.json에서 전체 재생성
// - 'merge_jeju': 기존 output에 CSV에서 제주만 추가
const MODE = 'full';

const FILTER_AREA_NAME = '제주';
const CSV_INPUT_FILE = path.resolve(__dirname, '../홈페이지 크롤링/data/area_contents.csv');

// Input: homepage crawling original
// (제주만 CSV에서 뽑아 합치는 모드에서는 사용하지 않음)
const INPUT_FILE = path.resolve(__dirname, '../홈페이지 크롤링/data/area_contents.partial.json');
const OUTPUT_FILE = path.resolve(__dirname, 'data_places_final.js');
const CACHE_FILE = path.resolve(__dirname, 'geocode_cache.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 대량 호출 시 차단을 피하기 위해 권장: 100~200ms
const GEOCODE_DELAY_MS = 120;
const GEOCODE_RETRIES = 2;
const GEOCODE_TIMEOUT_MS = 10000;

function computeBackoffMs(attempt, status) {
  const base = GEOCODE_DELAY_MS * (attempt + 1);
  if (status === 429) return Math.min(15000, 2000 + attempt * 3000);
  if (status >= 500 && status <= 599) return Math.min(5000, 500 + attempt * 800);
  return base;
}

function safeStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function parseProvinceCity(address1) {
  const parts = safeStr(address1).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { province: '', city: '' };
  const rawProv = parts[0];
  const rawCity = parts[1];

  // province short label (서울/경기/충북...)
  const provMap = {
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
  const province = provMap[rawProv] || rawProv
    .replace(/(특별자치시|특별시|광역시)$/g, '')
    .replace(/특별자치도$/g, '')
    .replace(/도$/g, '');

  // city keep suffix (강남구/중구/서구/수원시...)
  const city = rawCity;
  return { province, city };
}

function makeId(title, address1) {
  // stable-ish key for UI/planner
  const base = `${safeStr(title)}|${safeStr(address1)}`;
  return base.replace(/\s+/g, ' ').slice(0, 120);
}

function makeYoutubeSearchUrl(title) {
  const q = encodeURIComponent(`${title} 한국 여행`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

function parsePlaceDataJs(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const txt = fs.readFileSync(filePath, 'utf-8');
    const m = txt.match(/const\s+placeData\s*=\s*(\[\s*[\s\S]*\s*\])\s*;\s*$/);
    if (!m) return [];
    const arr = JSON.parse(m[1]);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function loadJejuFromCsv() {
  if (!fs.existsSync(CSV_INPUT_FILE)) return [];
  const raw = fs.readFileSync(CSV_INPUT_FILE, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map(h => safeStr(h));
  const idx = (name) => header.indexOf(name);

  const iAreaName = idx('areaName');
  const iTitle = idx('title');
  const iAddr1 = idx('addr1');
  const iAddr2 = idx('addr2');
  const iTag = idx('tagName');
  const iContentType = idx('contentType');
  const iCat1 = idx('cat1');
  const iCat2 = idx('cat2');

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const areaName = safeStr(cols[iAreaName]);
    const title = safeStr(cols[iTitle]);
    const addr1 = safeStr(cols[iAddr1]);
    const addr2 = iAddr2 >= 0 ? safeStr(cols[iAddr2]) : '';
    if (!title || !addr1) continue;
    if (FILTER_AREA_NAME && areaName !== FILTER_AREA_NAME && !/^제주(특별자치도|도)?\s*/.test(addr1)) continue;

    const it = {
      title,
      TITLE: title,
      addr1,
      addr2,
      tagName: iTag >= 0 ? safeStr(cols[iTag]) : '',
      contentType: iContentType >= 0 ? safeStr(cols[iContentType]) : '',
      cat1: iCat1 >= 0 ? safeStr(cols[iCat1]) : '',
      cat2: iCat2 >= 0 ? safeStr(cols[iCat2]) : '',
      catchPhrase: ''
    };
    out.push(it);
  }
  return out;
}

function mapCategory(item) {
  const cat2 = safeStr(item?.cat2);
  const contentType = String(item?.contentType ?? '');
  const tag = safeStr(item?.tagName);
  const title = safeStr(item?.title ?? item?.TITLE);

  // Cafe
  if (cat2 === 'A0502' || /카페|커피|디저트|베이커리/i.test(tag) || /카페/i.test(title)) return 'cafe';
  // Hotel
  if (contentType === '32' || /호텔|리조트|숙박|펜션|게스트하우스/i.test(tag + title)) return 'hotel';
  // Shopping
  if (contentType === '38' || /쇼핑|시장|백화점|아울렛|소품샵|플리마켓/i.test(tag)) return 'shop';
  // Activity
  if (contentType === '28' || /액티비티|체험|레저|루지|서핑|스키|등산|트래킹|카약|패러글라이딩/i.test(tag)) return 'activity';
  // Drama
  if (/드라마|촬영|촬영지|로케/i.test(tag + title)) return 'drama';
  // Photo zone
  if (/포토|사진|뷰맛집|인생샷|전망대|야경/i.test(tag + title)) return 'photo';
  // Nature
  if (/자연|공원|산|바다|해변|계곡|숲|수목원|호수|폭포/i.test(tag + title)) return 'nature';
  // Restaurant
  if (contentType === '39' || cat2.startsWith('A05') || /맛집|음식|식당|레스토랑/i.test(tag + title)) return 'restaurant';

  // Default
  return 'tourism';
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

async function getCoords(address, cache) {
  const key = safeStr(address);
  if (!key) return null;
  if (cache[key]) return cache[key];

  for (let attempt = 0; attempt <= GEOCODE_RETRIES; attempt++) {
    let timeout = null;
    try {
      const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(key)}`;
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Kakao API auth error (${response.status}). Check API key & enabled "Local" API permissions.`);
      }
      if (!response.ok) {
        await sleep(computeBackoffMs(attempt, response.status));
        continue;
      }
      const json = await response.json();
      if (json.documents && json.documents.length > 0) {
        const coords = { lat: parseFloat(json.documents[0].y), lng: parseFloat(json.documents[0].x) };
        if (Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
          cache[key] = coords;
          return coords;
        }
      }
    } catch {
      if (timeout) clearTimeout(timeout);
      await sleep(computeBackoffMs(attempt, 0));
    }
  }
  return null;
}

function flattenAreaContents(data) {
  const out = [];
  for (const [areaCode, area] of Object.entries(data || {})) {
    const areaName = safeStr(area?.areaName);
    const sigunguObj = area?.sigungu || {};
    for (const [sigunguCode, sigungu] of Object.entries(sigunguObj)) {
      const sigunguName = safeStr(sigungu?.sigunguName);
      const contents = sigungu?.contents || {};
      for (const [type, items] of Object.entries(contents)) {
        for (const it of Array.isArray(items) ? items : []) {
          out.push({
            areaCode,
            areaName,
            sigunguCode,
            sigunguName,
            type,
            ...it,
          });
        }
      }
    }
  }
  return out;
}

function forEachAreaContentItem(source, onItem) {
  for (const [areaCode, area] of Object.entries(source || {})) {
    const areaName = safeStr(area?.areaName);
    const sigunguObj = area?.sigungu || {};
    for (const [sigunguCode, sigungu] of Object.entries(sigunguObj)) {
      const sigunguName = safeStr(sigungu?.sigunguName);
      const contents = sigungu?.contents || {};
      for (const [type, items] of Object.entries(contents)) {
        for (const it of Array.isArray(items) ? items : []) {
          onItem({
            areaCode,
            areaName,
            sigunguCode,
            sigunguName,
            type,
            ...it,
          });
        }
      }
    }
  }
}

function* iterateAreaContentItems(source) {
  for (const [areaCode, area] of Object.entries(source || {})) {
    const areaName = safeStr(area?.areaName);
    const sigunguObj = area?.sigungu || {};
    for (const [sigunguCode, sigungu] of Object.entries(sigunguObj)) {
      const sigunguName = safeStr(sigungu?.sigunguName);
      const contents = sigungu?.contents || {};
      for (const [type, items] of Object.entries(contents)) {
        for (const it of Array.isArray(items) ? items : []) {
          yield {
            areaCode,
            areaName,
            sigunguCode,
            sigunguName,
            type,
            ...it,
          };
        }
      }
    }
  }
}

async function main() {
  console.log('🔄 Crawling 원본 로딩 중...');
  if (MODE === 'full') {
    const t0 = Date.now();
    const raw = fs.readFileSync(INPUT_FILE, 'utf-8');
    console.log(`✅ 파일 읽기 완료 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    const t1 = Date.now();
    const source = JSON.parse(raw);
    console.log(`✅ JSON 파싱 완료 (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
    console.log('� 원본 순회 시작...');

    const cache = USE_GEOCODE ? loadCache() : {};
    let geocoded = 0;
    let geocodeFailed = 0;
    let skippedNoAddr = 0;
    let kept = 0;
    let processed = 0;
    let loggedSampleAddrs = 0;
    let seoulCount = 0;

    const provCounts = new Map();
    const seen = new Set();

    const outStream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf-8' });
    outStream.write('const placeData = [\n');
    let wroteAny = false;

    const flushProgress = () => {
      process.stdout.write(
        `\r✅ 저장 ${kept.toLocaleString()} / 지오코딩 ${geocoded.toLocaleString()} / 실패 ${geocodeFailed.toLocaleString()} / 주소없음 skip ${skippedNoAddr.toLocaleString()}`
      );
    };

    for (const it of iterateAreaContentItems(source)) {
      processed++;
      const title = safeStr(it?.title ?? it?.TITLE);
      const address1 = safeStr(it?.addr1);
      const address2 = safeStr(it?.addr2);
      const address = [address1, address2].filter(Boolean).join(' ');

      if (!title) continue;
      if (!address1) {
        skippedNoAddr++;
        continue;
      }

      if (loggedSampleAddrs < 3) {
        console.log(`\n🔎 샘플 주소(${loggedSampleAddrs + 1}): ${address1}`);
        loggedSampleAddrs++;
      }

      const idKey = makeId(title, address1);
      if (seen.has(idKey)) continue;
      seen.add(idKey);

      const category = mapCategory(it);
      const { province, city } = parseProvinceCity(address1);

      const koDesc = safeStr(it?.catchPhrase);
      const description = {
        ko: koDesc,
        en: '',
        ja: '',
        zh: '',
        th: '',
        ar: '',
        ru: '',
        fr: ''
      };

      const tag = safeStr(it?.tagName);
      const youtubeUrl = /유튜브/i.test(tag) ? makeYoutubeSearchUrl(title) : '';

      let coords = null;
      if (USE_GEOCODE) {
        await sleep(GEOCODE_DELAY_MS);
        coords = await getCoords(address1, cache);
        if (!coords) {
          geocodeFailed++;
          continue;
        }
        geocoded++;
      }

      const place = {
        id: makeId(title, address1),
        title,
        lat: coords ? Number(coords.lat.toFixed(6)) : null,
        lng: coords ? Number(coords.lng.toFixed(6)) : null,
        address: address1,
        province,
        city,
        category,
        image: '',
        description,
        youtubeUrl
      };

      outStream.write(`${wroteAny ? ',\n' : ''}${JSON.stringify(place)}`);
      wroteAny = true;
      kept++;

      if (province) {
        provCounts.set(province, (provCounts.get(province) || 0) + 1);
        if (province === '서울') seoulCount++;
      }

      const earlyVerbose = kept <= 200 ? 10 : 100;
      if (kept % earlyVerbose === 0) {
        flushProgress();
      }
    }

    if (USE_GEOCODE) saveCache(cache);

    outStream.write('\n];');
    outStream.end();

    console.log(`\n🎉 완료: ${kept.toLocaleString()}개 저장됨`);
    console.log(`- output: ${OUTPUT_FILE}`);
    const top = Array.from(provCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log(`- 서울(주소기반) 개수: ${seoulCount.toLocaleString()}`);
    console.log(`- province top:`, top);
    return;
  } else {
    console.log('✅ (merge mode) 기존 출력 + CSV(제주)만 사용');
  }

  const existing = parsePlaceDataJs(OUTPUT_FILE);
  console.log(`📎 기존 데이터 로드: ${existing.length.toLocaleString()}개`);
  if (existing.length === 0) {
    console.log('⚠️ 기존 데이터가 0개입니다. 먼저 MODE를 \"full\"로 두고 전체 재생성 후, 다시 merge_jeju로 실행하세요.');
    return;
  }

  const inputCsvItems = loadJejuFromCsv();
  console.log(`📦 CSV 필터(${FILTER_AREA_NAME}) 로드: ${inputCsvItems.length.toLocaleString()}개`);

  let kept = 0;
  let processed = 0;
  let loggedSampleAddrs = 0;
  let seoulCount = 0;
  const provCounts = new Map();

  const outStream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf-8' });
  outStream.write('const placeData = [\n');
  let wroteAny = false;
  const seen = new Set();

  for (const p of existing) {
    const id = safeStr(p?.id);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    outStream.write(`${wroteAny ? ',\n' : ''}${JSON.stringify(p)}`);
    wroteAny = true;
    kept++;

    const prov = safeStr(p?.province);
    if (prov) {
      provCounts.set(prov, (provCounts.get(prov) || 0) + 1);
      if (prov === '서울') seoulCount++;
    }
  }

  const flushProgress = () => {
    process.stdout.write(`\r✅ 저장 ${kept.toLocaleString()} (기존+제주합) / scanned ${processed.toLocaleString()}`);
  };

  console.log('📦 제주 합치기 시작...');
  for (const it of inputCsvItems) {
    processed++;
    if (processed % 200 === 0) flushProgress();
    const title = safeStr(it?.title ?? it?.TITLE);
    const address1 = safeStr(it?.addr1);
    const address2 = safeStr(it?.addr2);
    const address = [address1, address2].filter(Boolean).join(' ');

    if (!title) continue;
    if (!address1) continue;

    if (loggedSampleAddrs < 3) {
      console.log(`\n🔎 샘플 주소(${loggedSampleAddrs + 1}): ${address1}`);
      loggedSampleAddrs++;
    }

    const idKey = makeId(title, address1);
    if (seen.has(idKey)) continue;
    seen.add(idKey);

    const category = mapCategory(it);

    const { province, city } = parseProvinceCity(address1);

    // Description
    const koDesc = safeStr(it?.catchPhrase);
    const description = {
      ko: koDesc,
      en: '',
      ja: '',
      zh: '',
      th: '',
      ar: '',
      ru: '',
      fr: ''
    };

    // YouTube
    const tag = safeStr(it?.tagName);
    const youtubeUrl = /유튜브/i.test(tag) ? makeYoutubeSearchUrl(title) : '';

    // Coordinates (optional)
    const coords = null;

    // Image: raw imgPath only (the actual CDN base URL is unknown here)
    const image = '';

    const place = {
      id: makeId(title, address1),
      title,
      lat: coords ? Number(coords.lat.toFixed(6)) : null,
      lng: coords ? Number(coords.lng.toFixed(6)) : null,
      address: address1,
      province,
      city,
      category,
      image,
      description,
      youtubeUrl
    };

    outStream.write(`${wroteAny ? ',\n' : ''}${JSON.stringify(place)}`);
    wroteAny = true;
    kept++;

    if (province) {
      provCounts.set(province, (provCounts.get(province) || 0) + 1);
      if (province === '서울') seoulCount++;
    }

    if (kept % 500 === 0) flushProgress();
  }

  flushProgress();

  outStream.write('\n];');
  outStream.end();

  console.log(`\n🎉 완료: ${kept.toLocaleString()}개 저장됨`);
  console.log(`- output: ${OUTPUT_FILE}`);
  const top = Array.from(provCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`- 서울(주소기반) 개수: ${seoulCount.toLocaleString()}`);
  console.log(`- province top:`, top);
}

main();
