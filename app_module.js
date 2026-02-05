import { placeData, addressTranslations } from './js/data.js';

let currentLang = 'ko';
let map = null;
let markers = [];
let currentCategory = 'all';

const translations = {
    ko: { title: 'K-Local Vibe', subtitle: '신사임당과 율곡 이이가 태어난 유서 깊은 곳입니다.', all: '전체', restaurant: '맛집', cafe: '카페', noResults: '검색 결과가 없습니다.' },
    en: { title: 'K-Local Vibe', subtitle: 'Historic birthplace of Shin Saimdang and Yulgok Yi I.', all: 'All', restaurant: 'Restaurant', cafe: 'Cafe', noResults: 'No results found.' },
    jp: { title: 'K-Local Vibe', subtitle: '申師任堂と栗谷李珥の生家で、歴史深い場所です。', all: 'すべて', restaurant: 'レストラン', cafe: 'カフェ', noResults: '結果が見つかりません。' },
    cn: { title: 'K-Local Vibe', subtitle: '申师任堂和栗谷李珥的故居，历史悠久。', all: '全部', restaurant: '餐厅', cafe: '咖啡厅', noResults: '未找到结果。' },
    th: { title: 'K-Local Vibe', subtitle: 'บ้านเกิดทางประวัติศาสตร์ของชินซาอิมดังและยุลกุกอีอี', all: 'ทั้งหมด', restaurant: 'ร้านอาหาร', cafe: 'คาเฟ่', noResults: 'ไม่พบผลลัพธ์' },
    ar: { title: 'K-Local Vibe', subtitle: 'المكان التاريخي لميلاد شين سايمدانغ ويولغوك يي إي', all: 'الكل', restaurant: 'مطعم', cafe: 'مقهى', noResults: 'لا توجد نتائج' },
    ru: { title: 'K-Local Vibe', subtitle: 'Историческое место рождения Син Саимдан и Юльгок Ли И.', all: 'Все', restaurant: 'Ресторан', cafe: 'Кафе', noResults: 'Результаты не найдены.' },
    fr: { title: 'K-Local Vibe', subtitle: 'Lieu de naissance historique de Shin Saimdang et Yulgok Yi I.', all: 'Tout', restaurant: 'Restaurant', cafe: 'Café', noResults: 'Aucun résultat.' }
};

function t(key) {
    return translations[currentLang]?.[key] || translations.ko[key] || key;
}

function translateRegionName(regionName, lang) {
    if (!regionName) return '';
    if (lang === 'ko') return regionName;
    return addressTranslations[regionName]?.[lang] || regionName;
}

function getTranslatedAddress(place, lang) {
    if (lang === 'ko') return place.address;

    const provTrans = translateRegionName(place.province, lang);
    const cityTrans = translateRegionName(place.city, lang);

    if (['en', 'fr', 'es'].includes(lang)) {
        return `${cityTrans}, ${provTrans}`.trim();
    }
    return `${provTrans} ${cityTrans}`.trim();
}

function setActiveTab(category) {
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
}

function updateLanguageUI() {
    const titleEl = document.getElementById('main-title');
    const subEl = document.getElementById('sub-title');
    if (titleEl) titleEl.textContent = t('title');
    if (subEl) subEl.textContent = t('subtitle');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const value = translations[currentLang]?.[key];
        if (value) el.textContent = value;
    });
}

function getFilteredPlaces(category) {
    if (category === 'all') return placeData;
    if (category === 'restaurant' || category === 'cafe') {
        return placeData.filter(p => p.category === category);
    }
    return [];
}

function updateMarkers(places) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    places.forEach(p => {
        const marker = L.marker([p.lat, p.lng]).addTo(map);
        marker.bindPopup(`<b>${p.name}</b><br>${getTranslatedAddress(p, currentLang)}`);
        markers.push(marker);
    });
}

function renderList(places) {
    const grid = document.getElementById('contentGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (places.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #666;">${t('noResults')}</div>`;
        return;
    }

    places.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-body">
                <small style="color: var(--apple-blue); font-weight: 600; font-size: 12px;">
                    ${translateRegionName(p.city, currentLang)} • ${t(p.category)}
                </small>
                <h2 class="card-title">${p.name}</h2>
                <p class="card-desc">${p.type} • ${getTranslatedAddress(p, currentLang)}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateView(category) {
    currentCategory = category;
    setActiveTab(category);

    const filtered = getFilteredPlaces(category);
    renderList(filtered);
    updateMarkers(filtered);
}

function initMap() {
    map = L.map('map').setView([36.5, 127.5], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

function setupEvents() {
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        currentLang = langSelect.value || 'ko';
        updateLanguageUI();
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            updateLanguageUI();
            updateView(currentCategory);
        });
    }

    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            updateView(category);
        });
    });
}

window.addEventListener('load', () => {
    initMap();
    setupEvents();

    // IMPORTANT: initial render
    updateView('all');
});
