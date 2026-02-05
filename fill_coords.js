const fs = require('fs');

// ✅ 사용자님이 제공하신 카카오 API 키입니다.
const KAKAO_API_KEY = "b424163538e51105e53bd6e2ee85f723";

const INPUT_FILE = 'data_places_new.js';
const OUTPUT_FILE = 'data_places_final.js';

// API 과부하 방지를 위한 대기 함수
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 카카오 API로 주소 -> 좌표 변환 함수
async function getCoords(address) {
  if (!address) return null;

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
    });

    if (!response.ok) return null;

    const json = await response.json();
    if (json.documents && json.documents.length > 0) {
      return {
        lat: parseFloat(json.documents[0].y), // 위도
        lng: parseFloat(json.documents[0].x), // 경도
      };
    }
  } catch (error) {
    // 네트워크 에러 등은 무시하고 넘어감
  }
  return null;
}

async function main() {
  console.log(`📂 ${INPUT_FILE} 파일을 읽는 중...`);

  let rawContent;
  try {
    rawContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  } catch (e) {
    console.error(`❌ 오류: ${INPUT_FILE} 파일이 있는지 확인해주세요.`);
    return;
  }

  // JS 파일(const placeData = ...)을 JSON 형식으로 변환
  console.log('🔄 데이터 파싱 중...');
  let jsonStr = rawContent.replace(/\/\/.*$/gm, ''); // 주석 제거
  jsonStr = jsonStr.replace(/const\s+placeData\s*=\s*/, '');
  jsonStr = jsonStr.trim();
  // 끝에 세미콜론이 있으면 제거
  if (jsonStr.endsWith(';')) {
    jsonStr = jsonStr.slice(0, -1);
  }

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.error('❌ JSON 파싱 실패: 파일 형식이 올바르지 않습니다.');
    return;
  }

  const finalPlaces = [];
  let totalCount = 0;
  let successCount = 0;
  let apiCallCount = 0;

  console.log('🚀 좌표 변환 및 데이터 경량화 시작...');

  // 데이터 구조 순회: placeData 배열
  for (const item of data) {
    totalCount++;
    
    const title = item.name || item.title || '무제';
    const address = item.address || '';
    const image = item.image || ''; // 이미지가 없으면 빈 문자열
    const category = item.category || '';

    // 1. 기존 데이터에 좌표가 있는지 확인
    let lat = parseFloat(item.lat);
    let lng = parseFloat(item.lng);

    // 2. 좌표가 없거나 0이면 카카오 API로 요청
    if (!lat || !lng || lat === 37.5665 || lng === 126.9780) {
      if (address) {
        // 너무 빠르게 요청하면 차단될 수 있으니 0.05초 대기
        await sleep(50); 
        
        const coords = await getCoords(address);
        apiCallCount++;
        
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }
    }

    // 3. 좌표가 확보된 데이터만 저장 (데이터 다이어트)
    if (lat && lng && lat !== 37.5665 && lng !== 126.9780) {
      successCount++;
      finalPlaces.push({
        title: title,
        lat: Number(lat.toFixed(6)), // 소수점 6자리로 제한 (용량 절약)
        lng: Number(lng.toFixed(6)),
        address: address,
        category: category,
        image: image,
      });
    }

    // 진행 상황 표시 (100개 단위)
    if (totalCount % 100 === 0) {
      process.stdout.write(`\r⏳ 처리 중: ${totalCount}개 확인 / ${successCount}개 변환 성공`);
    }
  }

  // 결과 파일 저장
  const fileContent = `const placeData = ${JSON.stringify(finalPlaces, null, 2)};`;
  fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf-8');

  console.log(`\n\n✅ 작업 완료!`);
  console.log(`📄 결과 파일: ${OUTPUT_FILE}`);
  console.log(`총 데이터: ${totalCount}개`);
  console.log(`API 호출 횟수: ${apiCallCount}회`);
  console.log(`최종 저장된 장소: ${successCount}개 (좌표가 있는 곳만 저장됨)`);
}

main();
