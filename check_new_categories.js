const fs = require('fs');

const content = fs.readFileSync('data_places_new.js', 'utf8');
const match = content.match(/const placeData = (\[[\s\S]*?\]);/);
const data = JSON.parse(match[1]);

const categories = {};
data.forEach(item => {
  categories[item.category] = (categories[item.category] || 0) + 1;
});

console.log('=== 세분화된 카테고리별 데이터 개수 ===');
Object.entries(categories).forEach(([cat, count]) => {
  console.log(`${cat}: ${count}개`);
});
console.log(`\n총합: ${data.length}개`);

// 드라마 촬영지 샘플 확인
const dramaPlaces = data.filter(item => item.category === 'drama');
console.log(`\n=== 드라마 촬영지 샘플 ===`);
dramaPlaces.slice(0, 5).forEach((place, i) => {
  console.log(`${i+1}. ${place.name} (${place.address})`);
});

// 호텔 샘플 확인
const hotelPlaces = data.filter(item => item.category === 'hotel');
console.log(`\n=== 호텔 샘플 ===`);
hotelPlaces.slice(0, 5).forEach((place, i) => {
  console.log(`${i+1}. ${place.name} (${place.address})`);
});
