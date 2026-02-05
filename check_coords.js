const fs = require('fs');

const content = fs.readFileSync('data_places_new.js', 'utf8');
const match = content.match(/const placeData = (\[[\s\S]*?\]);/);
const data = JSON.parse(match[1]);

// 좌표 확인
const validCoords = data.filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng));
const invalidCoords = data.filter(p => !p.lat || !p.lng || isNaN(p.lat) || isNaN(p.lng));

console.log('=== 좌표 데이터 분석 ===');
console.log('총 데이터:', data.length);
console.log('유효한 좌표:', validCoords.length);
console.log('무효한 좌표:', invalidCoords.length);

// 샘플 좌표 확인
console.log('\n=== 샘플 좌표 ===');
validCoords.slice(0, 5).forEach((p, i) => {
  console.log(`${i+1}. ${p.name}: (${p.lat}, ${p.lng})`);
});

// 서울 중심 좌표만 있는지 확인
const seoulCenter = validCoords.filter(p => Math.abs(p.lat - 37.5665) < 0.001 && Math.abs(p.lng - 126.9780) < 0.001);
console.log(`\n서울 중심 좌표만 있는 데이터: ${seoulCenter.length}개`);

// 지역별 좌표 분포 확인
const regions = {};
validCoords.forEach(p => {
  const region = p.province || 'Unknown';
  if (!regions[region]) regions[region] = [];
  regions[region].push(p);
});

console.log('\n=== 지역별 좌표 분포 ===');
Object.entries(regions).forEach(([region, places]) => {
  console.log(`${region}: ${places.length}개`);
});
