const fs = require('fs');

const content = fs.readFileSync('data_places_new.js', 'utf8');
const match = content.match(/const placeData = (\[[\s\S]*?\]);/);
const data = JSON.parse(match[1]);

// 액티비티 관련 키워드 탐색
const activityKeywords = [
  '액티비티', '체험', '체험학습', '액티비티', '레포츠', '스포츠',
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

const activityPlaces = [];
const potentialActivities = [];

data.forEach(place => {
  const title = (place.name || '').toLowerCase();
  const tags = (place.original_category || '').toLowerCase();
  const address = (place.address || '').toLowerCase();
  
  // 키워드 매칭
  const hasActivityKeyword = activityKeywords.some(keyword => 
    title.includes(keyword) || tags.includes(keyword) || address.includes(keyword)
  );
  
  if (hasActivityKeyword) {
    activityPlaces.push(place);
  }
  
  // 잠재적 액티비티 (contentType 기반)
  if (place.contentType === 28 || place.contentType === 32) {
    if (!hasActivityKeyword) {
      potentialActivities.push(place);
    }
  }
});

console.log('=== 액티비티 관련 데이터 분석 ===');
console.log(`명확한 액티비티 키워드: ${activityPlaces.length}개`);
console.log(`잠재적 액티비티 (contentType 28/32): ${potentialActivities.length}개`);

// 명확한 액티비티 샘플
console.log('\n=== 명확한 액티비티 샘플 ===');
activityPlaces.slice(0, 10).forEach((place, i) => {
  console.log(`${i+1}. ${place.name} (${place.address})`);
});

// 잠재적 액티비티 샘플
console.log('\n=== 잠재적 액티비티 샘플 ===');
potentialActivities.slice(0, 10).forEach((place, i) => {
  console.log(`${i+1}. ${place.name} (contentType: ${place.contentType})`);
});

// 카테고리별 분포
const categoryDistribution = {};
activityPlaces.forEach(place => {
  categoryDistribution[place.category] = (categoryDistribution[place.category] || 0) + 1;
});

console.log('\n=== 액티비티 카테고리별 분포 ===');
Object.entries(categoryDistribution).forEach(([cat, count]) => {
  console.log(`${cat}: ${count}개`);
});
