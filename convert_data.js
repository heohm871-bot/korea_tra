import fs from 'node:fs';
import path from 'node:path';

// 20260201 폴더 기준 경로
const TARGET_DIR = path.resolve('c:/Users/herhm/Desktop/웹페이지 만들기/20260201');
const SOURCE_DIR = path.resolve('c:/Users/herhm/Desktop/웹페이지 만들기/홈페이지 크롤링/data');

// 파일 읽기
const targetDataPath = path.join(TARGET_DIR, 'data_places.js');
const sourceDataPath = path.join(SOURCE_DIR, 'area_contents.js');

console.log('Reading files...');
console.log('Target:', targetDataPath);
console.log('Source:', sourceDataPath);

// Target 구조 분석 (data_places.js)
const targetContent = fs.readFileSync(targetDataPath, 'utf8');
// placeData 배열 추출
const targetMatch = targetContent.match(/const placeData = (\[[\s\S]*?\]);/);
if (!targetMatch) {
  throw new Error('Could not find placeData in target file');
}
const targetSample = JSON.parse(targetMatch[1]);
console.log('Target sample structure:', Object.keys(targetSample[0] || {}));

// Source 구조 분석 (area_contents.js)
const sourceContent = fs.readFileSync(sourceDataPath, 'utf8');
// areaContents 객체 추출
const sourceMatch = sourceContent.match(/export const areaContents = ({[\s\S]*});/);
if (!sourceMatch) {
  throw new Error('Could not find areaContents in source file');
}
const areaContents = JSON.parse(sourceMatch[1]);

// Source 샘플 확인
let sourceSample = null;
for (const area of Object.values(areaContents)) {
  for (const sigungu of Object.values(area.sigungu || {})) {
    for (const list of Object.values(sigungu.contents || {})) {
      if (list && list.length > 0) {
        sourceSample = list[0];
        break;
      }
    }
    if (sourceSample) break;
  }
  if (sourceSample) break;
}
console.log('Source sample structure:', Object.keys(sourceSample || {}));

// 변환 로직
const newPlaces = [];
let idCounter = 1;

// 1. 지역(Area) 순회
Object.values(areaContents).forEach(area => {
  // 2. 시군구(Sigungu) 순회
  Object.values(area.sigungu || {}).forEach(sigungu => {
    // 3. 콘텐츠 타입(Contents) 순회
    Object.values(sigungu.contents || {}).forEach(typeList => { // Tour, Recom 등
      if (!Array.isArray(typeList)) return;
      
      typeList.forEach(item => {
        // 좌표 처리 - 원본 데이터에 좌표가 없으므로 지역별 대표 좌표 사용
        const lat = parseFloat(item.mapy);
        const lng = parseFloat(item.mapx);
        
        // 지역별 대표 좌표 매핑
        const regionCoords = {
          '서울': [37.5665, 126.9780],
          '인천': [37.4563, 126.7052],
          '대전': [36.3504, 127.3845],
          '대구': [35.8714, 128.6014],
          '광주': [35.1601, 126.8514],
          '부산': [35.1796, 129.0756],
          '울산': [35.5394, 129.3114],
          '세종': [36.4801, 127.2888],
          '경기도': [37.2742, 127.0095],
          '강원특별자치도': [37.5558, 128.2093],
          '충청북도': [36.6284, 127.9287],
          '충청남도': [36.6588, 126.6728],
          '경상북도': [36.2489, 128.6647],
          '경상남도': [35.4606, 128.2132],
          '전북특별자치도': [35.8191, 127.1137],
          '전라남도': [34.8160, 126.9216],
          '제주도': [33.4996, 126.5312]
        };
        
        let finalLat = lat;
        let finalLng = lng;
        
        // 좌표가 없으면 지역별 대표 좌표 사용
        if (isNaN(lat) || isNaN(lng)) {
          const coords = regionCoords[area.areaName] || [37.5665, 126.9780];
          finalLat = coords[0];
          finalLng = coords[1];
        }
        
        // 카테고리 변환 (세분화된 index.html 탭 기준)
        let category = 'restaurant'; // 기본값
        
        if (item.contentType) {
          // VisitKorea contentType → 세분화된 카테고리 매핑
          const contentTypeMap = {
            39: 'restaurant', // 음식점 → 맛집
            38: 'shop',       // 쇼핑몰/상점 → 쇼핑
            32: 'tourism',    // 관광지 → 관광지
            28: 'nature',     // 자연 → 자연
            25: 'photo',      // 포토존 → 포토존
            12: 'restaurant', // 음식점 (상세분류)
            14: 'cafe',       // 카페
            15: 'hotel',      // 숙박
          };
          category = contentTypeMap[item.contentType] || 'restaurant';
        }
        
        // cat1/cat2로 더 세분화
        if (item.cat1 === 'A05' && item.cat2) {
          // A05(음식) 세분류
          const foodTypeMap = {
            'A0501': 'restaurant', // 한식
            'A0502': 'restaurant', // 양식
            'A0503': 'restaurant', // 일식
            'A0504': 'restaurant', // 중식
            'A0505': 'cafe',       // 카페
            'A0506': 'restaurant', // 패스트푸드
          };
          category = foodTypeMap[item.cat2] || category;
        } else if (item.cat1 === 'A03' && item.cat2) {
          // A03(쇼핑) 세분류
          const shopTypeMap = {
            'A0301': 'shop', // 특산물
            'A0302': 'shop', // 소품샵
            'A0303': 'shop', // 백화점
          };
          category = shopTypeMap[item.cat2] || category;
        } else if (item.cat1 === 'A02' && item.cat2) {
          // A02(관광) 세분류
          const tourismTypeMap = {
            'A0201': 'tourism', // 역사문화
            'A0202': 'tourism', // 문화시설
            'A0203': 'drama',   // 드라마촬영지
            'A0204': 'tourism', // 테마파크
          };
          category = tourismTypeMap[item.cat2] || category;
        } else if (item.cat1 === 'B02' && item.cat2) {
          // B02(숙박) 세분류
          const hotelTypeMap = {
            'B0201': 'hotel', // 호텔
            'B0202': 'hotel', // 모텔
            'B0203': 'hotel', // 펜션
            'B0204': 'hotel', // 게스트하우스
          };
          category = hotelTypeMap[item.cat2] || category;
        }
        
        // 키워드 기반 분류 (title, tagName 분석)
        const title = (item.title || '').toLowerCase();
        const tags = (item.tagName || '').toLowerCase();
        
        // 액티비티 키워드 (우선순위 높음)
        const activityKeywords = [
          '액티비티', '체험', '체험학습', '레포츠', '스포츠',
          '전통체험', '문화체험', '역사체험', '농체험', '어촌체험',
          '수상레저', '수상스포츠', '해양레저', '해양스포츠', '낚시',
          '등산', '트레킹', '하이킹', '캠핑', '글램핑',
          '자전거', '자전거', 'MTB', '패러글라이딩', '스카이다이빙',
          '번지점프', '패러세일링', '래프팅', '클라이밍',
          '스키', '스노보드', '스키장', '리조트',
          '워터파크', '놀이공원', '테마파크',
          '박물관', '미술관', '전시관', '과학관',
          '수목장', '테마파크', '동물원', '수족원',
          '공방', '공방체험', '전통시장체험',
          '요리체험', '만들기체험', '공예체험',
          '와인체험', '맥주체험', '전통주체험'
        ];
        
        const hasActivityKeyword = activityKeywords.some(keyword => 
          title.includes(keyword) || tags.includes(keyword)
        );
        
        if (hasActivityKeyword) {
          category = 'activity';
        }
        
        // 드라마 촬영지 키워드
        if (title.includes('드라마') || title.includes('촬영지') || title.includes('로케') || 
            tags.includes('드라마') || tags.includes('촬영지') || tags.includes('로케')) {
          category = 'drama';
        }
        
        // 숙박 키워드
        if (title.includes('호텔') || title.includes('모텔') || title.includes('펜션') || 
            title.includes('게스트하우스') || title.includes('리조트') ||
            tags.includes('호텔') || tags.includes('숙박')) {
          category = 'hotel';
        }
        
        // 4. 매핑 및 푸시 (경량화된 필드만)
        newPlaces.push({
          id: `place_${idCounter++}`,
          name: item.title || '',
          category: category,
          address: item.addr1 || '',
          lat: parseFloat(finalLat).toFixed(6), // 소수점 6자리로 제한
          lng: parseFloat(finalLng).toFixed(6), // 소수점 6자리로 제한
          image: item.firstimage || '', // 필수 이미지만
          // 최소한의 분류용 필드만 유지
          city: sigungu.sigunguName || '',
          province: area.areaName || ''
        });
      });
    });
  });
});

console.log(`Converted ${newPlaces.length} items`);

// 결과물 저장 (data_places_new.js)
const outputPath = path.join(TARGET_DIR, 'data_places_new.js');
const outputContent = `// Converted data from area_contents.js
// Total places: ${newPlaces.length}

const placeData = ${JSON.stringify(newPlaces, null, 2)};
`;

fs.writeFileSync(outputPath, outputContent, 'utf8');
console.log(`Saved to: ${outputPath}`);

// 변환된 데이터 샘플 출력
console.log('\n=== Sample converted data ===');
console.log(JSON.stringify(newPlaces[0], null, 2));
