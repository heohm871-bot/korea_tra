const fs = require('fs');

const content = fs.readFileSync('data_places_new.js', 'utf8');
const match = content.match(/const placeData = (\[[\s\S]*?\]);/);
const data = JSON.parse(match[1]);

// 지역별 데이터 확인
const regions = {};
data.forEach(p => {
  const region = p.province || 'Unknown';
  if (!regions[region]) regions[region] = [];
  regions[region].push(p);
});

console.log('=== 지역별 데이터 개수 ===');
Object.entries(regions).forEach(([region, places]) => {
  console.log(`${region}: ${places.length}개`);
});

// 서울 외 다른 지역 샘플
const nonSeoul = data.filter(p => p.province !== '서울');
console.log(`\n서울 외 데이터: ${nonSeoul.length}개`);
console.log('서울 외 샘플:');
nonSeoul.slice(0, 5).forEach((p, i) => {
  console.log(`${i+1}. ${p.name} (${p.province} - ${p.address})`);
});

// 좌표 확인
const seoulCoords = data.filter(p => p.province === '서울');
const busanCoords = data.filter(p => p.province === '부산');
const jejuCoords = data.filter(p => p.province === '제주도');

console.log('\n=== 좌표 샘플 확인 ===');
console.log('서울:', seoulCoords[0]?.lat, seoulCoords[0]?.lng);
console.log('부산:', busanCoords[0]?.lat, busanCoords[0]?.lng);
console.log('제주:', jejuCoords[0]?.lat, jejuCoords[0]?.lng);
