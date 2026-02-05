// 8개 국어 번역 객체
const translations = {
    ko: { 
        title: "K-Local Vibe", 
        subtitle: "신사임당과 율곡 이이가 태어난 유서 깊은 곳입니다.",
        address: "주소", 
        category: "분류", 
        type: "구분",
        all: "전체",
        restaurant: "맛집",
        cafe: "카페",
        showToDriver: "기사님께 보여주기",
        audioGuide: "오디오 가이드",
        couple: "연인",
        family: "가족"
    },
    en: { 
        title: "K-Local Vibe", 
        subtitle: "Historic birthplace of Shin Saimdang and Yulgok Yi I.",
        address: "Address", 
        category: "Category", 
        type: "Type",
        all: "All",
        restaurant: "Restaurant",
        cafe: "Cafe",
        showToDriver: "Show to Driver",
        audioGuide: "Audio Guide",
        couple: "Couple",
        family: "Family"
    },
    jp: { 
        title: "K-Local Vibe", 
        subtitle: "申師任堂と栗谷李珥の生家で、歴史深い場所です。",
        address: "住所", 
        category: "カテゴリー", 
        type: "区分",
        all: "すべて",
        restaurant: "レストラン",
        cafe: "カフェ",
        showToDriver: "運転手さんに見せる",
        audioGuide: "オーディオガイド",
        couple: "カップル",
        family: "家族"
    },
    cn: { 
        title: "K-Local Vibe", 
        subtitle: "申师任堂和栗谷李珥的出生地，是历史悠久的场所。",
        address: "地址", 
        category: "类别", 
        type: "区分",
        all: "全部",
        restaurant: "餐厅",
        cafe: "咖啡厅",
        showToDriver: "给司机看",
        audioGuide: "语音导览",
        couple: "情侣",
        family: "家庭"
    },
    th: { 
        title: "K-Local Vibe", 
        subtitle: "สถานที่ประวัติศาสตร์ที่เกิดของชินซาอิมดังและยุลกกออี",
        address: "ที่อยู่", 
        category: "หมวดหมู่", 
        type: "ประเภท",
        all: "ทั้งหมด",
        restaurant: "ร้านอาหาร",
        cafe: "คาเฟ่",
        showToDriver: "แสดงให้คนขับรถดู",
        audioGuide: "คำแนะนำเสียง",
        couple: "คู่รัก",
        family: "ครอบครัว"
    },
    ar: { 
        title: "K-Local Vibe", 
        subtitle: "مكان تاريخي ولدت فيه شين سايمدانغ ويولغوك يي إي",
        address: "عنوان", 
        category: "فئة", 
        type: "نوع",
        all: "الكل",
        restaurant: "مطعم",
        cafe: "مقهى",
        showToDriver: "أظهر للسائق",
        audioGuide: "دليل صوتي",
        couple: "زوجين",
        family: "عائلة"
    },
    ru: { 
        title: "K-Local Vibe", 
        subtitle: "Историческое место рождения Шин Саимдан и Юльгок Ли И",
        address: "Адрес", 
        category: "Категория", 
        type: "Тип",
        all: "Все",
        restaurant: "Ресторан",
        cafe: "Кафе",
        showToDriver: "Показать водителю",
        audioGuide: "Аудиогид",
        couple: "Пара",
        family: "Семья"
    },
    fr: { 
        title: "K-Local Vibe", 
        subtitle: "Lieu historique de naissance de Shin Saimdang et Yulgok Yi I",
        address: "Adresse", 
        category: "Catégorie", 
        type: "Type",
        all: "Tous",
        restaurant: "Restaurant",
        cafe: "Café",
        showToDriver: "Montrer au chauffeur",
        audioGuide: "Guide audio",
        couple: "Couple",
        family: "Famille"
    }
};

// 전역 변수
let currentLang = 'ko';
let map = null;
let currentFilter = 'all';
let markers = [];
let activeCompanionFilter = null;

// 언어 변경 함수
function changeLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });
    
    // 업데이트 제목과 부제
    document.getElementById('main-title').textContent = translations[lang].title;
    document.getElementById('sub-title').textContent = translations[lang].subtitle;
    
    // 업데이트 카테고리 탭
    document.querySelector('[data-category="all"]').textContent = translations[lang].all;
    document.querySelector('[data-category="food_local"]').textContent = translations[lang].restaurant;
    document.querySelector('[data-category="cafe"]').textContent = translations[lang].cafe;
    
    // 업데이트 동반자 필터
    document.querySelector('[data-companion="couple"]').textContent = '💕' + translations[lang].couple;
    document.querySelector('[data-companion="family"]').textContent = '👨‍👩‍👧‍👦' + translations[lang].family;
}

// 택시 헬퍼 기능
function showTaxiHelper(address) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="text-align: center; color: white; padding: 40px;">
            <div style="font-size: 24px; margin-bottom: 20px;">🚕 ${translations[currentLang].showToDriver}</div>
            <div style="font-size: 36px; font-weight: bold; margin: 30px 0; line-height: 1.2;">${address}</div>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="
                background: #0071e3; color: white; border: none; padding: 16px 32px;
                border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 18px;
            ">닫기</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 오디오 가이드 기능
function playAudioGuide(place) {
    // 현재 재생 중인 음성 취소
    window.speechSynthesis.cancel();
    
    const text = `${place.name}. ${place.category === 'cafe' ? '카페' : '레스토랑'}. ${place.address}`;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 언어 설정
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
    alert(translations[currentLang].audioGuide + ' 재생 중...');
}

// 맞춤 필터 기능
function toggleCompanionFilter(companion) {
    const button = document.querySelector(`[data-companion="${companion}"]`);
    
    if (activeCompanionFilter === companion) {
        activeCompanionFilter = null;
        button.style.background = '#f2f2f7';
        button.style.color = '#1d1d1f';
    } else {
        // 이전 필터 해제
        if (activeCompanionFilter) {
            const prevButton = document.querySelector(`[data-companion="${activeCompanionFilter}"]`);
            prevButton.style.background = '#f2f2f7';
            prevButton.style.color = '#1d1d1f';
        }
        
        activeCompanionFilter = companion;
        button.style.background = '#0071e3';
        button.style.color = 'white';
    }
    
    filterMarkers();
}

// 마커 필터링
function filterMarkers() {
    markers.forEach(marker => {
        let show = true;
        
        // 카테고리 필터
        if (currentFilter !== 'all') {
            if (currentFilter === 'food_local' && marker.place.category !== 'restaurant') {
                show = false;
            } else if (currentFilter === 'cafe' && marker.place.category !== 'cafe') {
                show = false;
            }
        }
        
        // 동반자 필터
        if (activeCompanionFilter && show) {
            // 랜덤 태그 할당 (데모용)
            if (!marker.place.companionTag) {
                const tags = ['couple', 'family'];
                marker.place.companionTag = tags[Math.floor(Math.random() * tags.length)];
            }
            
            if (marker.place.companionTag !== activeCompanionFilter) {
                show = false;
            }
        }
        
        if (show) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });
}

// 상세 정보 모달
function showDetails(place) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; max-width: 500px; margin: 20px;">
            <h2 style="margin: 0 0 15px 0;">${place.name}</h2>
            <p style="color: #666; margin: 5px 0;">${place.category === 'cafe' ? '카페' : '레스토랑'} • ${place.type}</p>
            <p style="margin: 15px 0;"><strong>${translations[currentLang].address}:</strong><br>${place.address}</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
                <button onclick="showTaxiHelper('${place.address}')" style="
                    background: #0071e3; color: white; border: none; padding: 12px;
                    border-radius: 10px; cursor: pointer; font-weight: 600;
                ">🚕 ${translations[currentLang].showToDriver}</button>
                <button onclick="playAudioGuide(${JSON.stringify(place).replace(/"/g, '&quot;')})" style="
                    background: #34c759; color: white; border: none; padding: 12px;
                    border-radius: 10px; cursor: pointer; font-weight: 600;
                ">🎧 ${translations[currentLang].audioGuide}</button>
            </div>
            
            <button onclick="this.closest('div[style*=fixed]').remove()" style="
                background: #f2f2f7; color: #1d1d1f; border: none; padding: 12px 20px;
                border-radius: 10px; cursor: pointer; font-weight: 600; width: 100%; margin-top: 20px;
            ">닫기</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 메인 초기화 함수
window.onload = function() {
    // 1. 지도 초기화 (한국 중심)
    map = L.map('map').setView([36.5, 127.5], 7);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // 2. 마커 생성
    placeData.forEach(place => {
        const markerColor = place.category === 'cafe' ? '#ff3b30' : '#0071e3';
        
        const marker = L.marker([place.lat, place.lng]).addTo(map);
        marker.place = place; // place 데이터 저장
        
        marker.bindPopup(`
            <div style="padding: 10px;">
                <h4 style="margin: 0 0 5px 0;">${place.name}</h4>
                <p style="margin: 2px 0; color: #666; font-size: 12px;">${place.type}</p>
                <p style="margin: 5px 0; font-size: 13px;">${place.address}</p>
                <button onclick="showDetails(${JSON.stringify(place).replace(/"/g, '&quot;')})" style="
                    background: #0071e3; color: white; border: none; padding: 6px 12px;
                    border-radius: 6px; cursor: pointer; font-size: 12px; margin-top: 8px;
                ">상세 정보</button>
            </div>
        `);
        
        markers.push(marker);
    });

    // 3. 이벤트 리스너 설정
    setupEventListeners();
};

// 이벤트 리스너 설정
function setupEventListeners() {
    // 언어 선택
    document.getElementById('langSelect').addEventListener('change', (e) => {
        changeLanguage(e.target.value);
    });
    
    // 카테고리 필터
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.category;
            filterMarkers();
        });
    });
    
    // 동반자 필터
    document.querySelectorAll('[data-companion]').forEach(button => {
        button.addEventListener('click', (e) => {
            toggleCompanionFilter(e.target.dataset.companion);
        });
    });
}

// HTML에 동반자 필터 버튼 추가
document.addEventListener('DOMContentLoaded', function() {
    const topFilters = document.querySelector('.top-filters');
    const companionDiv = document.createElement('div');
    companionDiv.style.cssText = 'display: flex; gap: 8px; margin-top: 10px;';
    
    companionDiv.innerHTML = `
        <button data-companion="couple" style="
            background: #f2f2f7; color: #1d1d1f; border: none; padding: 8px 16px;
            border-radius: 20px; cursor: pointer; font-weight: 500; font-size: 14px;
        ">💕${translations[currentLang].couple}</button>
        <button data-companion="family" style="
            background: #f2f2f7; color: #1d1d1f; border: none; padding: 8px 16px;
            border-radius: 20px; cursor: pointer; font-weight: 500; font-size: 14px;
        ">👨‍👩‍👧‍👦${translations[currentLang].family}</button>
    `;
    
    topFilters.appendChild(companionDiv);
});
