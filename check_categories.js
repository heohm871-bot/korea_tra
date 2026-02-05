const fs = require('fs');

const content = fs.readFileSync('data_places_new.js', 'utf8');
const match = content.match(/const placeData = (\[[\s\S]*?\]);/);
const data = JSON.parse(match[1]);

const categories = {};
data.forEach(item => {
  categories[item.category] = (categories[item.category] || 0) + 1;
});

console.log('=== 카테고리별 데이터 개수 ===');
Object.entries(categories).forEach(([cat, count]) => {
  console.log(`${cat}: ${count}개`);
});
console.log(`\n총합: ${data.length}개`);

// 샘플 데이터 출력
console.log('\n=== 샘플 데이터 (카테고리별) ===');
const samples = {};
data.forEach(item => {
  if (!samples[item.category]) {
    samples[item.category] = item;
  }
});

Object.entries(samples).forEach(([cat, item]) => {
  console.log(`\n[${cat}]`);
  console.log(`이름: ${item.name}`);
  console.log(`주소: ${item.address}`);
  console.log(`좌표: ${item.lat}, ${item.lng}`);
});
