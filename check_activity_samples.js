const fs = require('fs');

const content = fs.readFileSync('data_places_new.js', 'utf8');
const match = content.match(/const placeData = (\[[\s\S]*?\]);/);
const data = JSON.parse(match[1]);

// 액티비티 데이터 확인
const activities = data.filter(item => item.category === 'activity');

console.log('=== 액티비티 카테고리 분석 ===');
console.log(`총 액티비티: ${activities.length}개`);

// 액티비티 유형별 분류
const activityTypes = {
  '체험': [],
  '레포츠': [],
  '박물관': [],
  '테마파크': [],
  '수상레저': [],
  '기타': []
};

activities.forEach(place => {
  const title = place.name.toLowerCase();
  
  if (title.includes('체험') || title.includes('전통')) {
    activityTypes['체험'].push(place);
  } else if (title.includes('스키') || title.includes('레포츠') || title.includes('스포츠')) {
    activityTypes['레포츠'].push(place);
  } else if (title.includes('박물관') || title.includes('미술관') || title.includes('전시관')) {
    activityTypes['박물관'].push(place);
  } else if (title.includes('테마파크') || title.includes('놀이공원')) {
    activityTypes['테마파크'].push(place);
  } else if (title.includes('수상') || title.includes('워터파크')) {
    activityTypes['수상레저'].push(place);
  } else {
    activityTypes['기타'].push(place);
  }
});

console.log('\n=== 액티비티 유형별 분포 ===');
Object.entries(activityTypes).forEach(([type, places]) => {
  console.log(`${type}: ${places.length}개`);
});

// 액티비티 샘플
console.log('\n=== 액티비티 샘플 ===');
activities.slice(0, 15).forEach((place, i) => {
  console.log(`${i+1}. ${place.name} (${place.address})`);
});
