/**
 * K-Local Vibe - Interactive Restaurant Map with Leaflet.js
 * Phase 2: Leaflet.js Map Implementation
 */

let currentLang = 'ko';
let map = null;
let markers = [];
let currentFilter = 'all';

// City coordinates for flyTo functionality
const cityCoordinates = {
    '서울': [37.5665, 126.9780],
    '부산': [35.1796, 129.0756],
    '대구': [35.8714, 128.6014],
    '인천': [37.4563, 126.7052],
    '광주': [35.1601, 126.8514],
    '대전': [36.3504, 127.3845],
    '울산': [35.5394, 129.3114],
    '세종': [36.4801, 127.2888],
    '수원': [37.2634, 127.0286],
    '성남': [37.4371, 127.1274],
    '의정부': [37.7357, 127.0465],
    '안양': [37.3943, 126.9568],
    '부천': [37.5039, 126.7660],
    '광명': [37.4780, 126.8655],
    '평택': [36.9921, 127.1129],
    '남양주': [37.6362, 127.2153],
    '강릉': [37.7519, 128.8761],
    '원주': [37.3422, 127.9202],
    '춘천': [37.8813, 127.7299],
    '동해': [37.5224, 129.1143],
    '속초': [38.2070, 128.5925],
    '태백': [37.0539, 128.9105],
    '전주': [35.8242, 127.1480],
    '군산': [35.9677, 126.7367],
    '익산': [35.9488, 126.9545],
    '정읍': [35.5764, 126.8573],
    '남원': [35.4161, 127.3930],
    '김제': [35.8021, 126.8873],
    '목포': [34.8110, 126.3920],
    '여수': [34.7604, 127.6622],
    '순천': [34.9441, 127.4848],
    '광양': [34.9406, 127.6984],
    '나주': [35.0417, 126.7129],
    '진주': [35.1856, 128.1079],
    '창원': [35.2279, 128.6811],
    '진해': [35.1333, 128.6653],
    '마산': [35.2054, 128.5619],
    '통영': [34.8461, 128.4330],
    '사천': [34.9978, 128.0724],
    '김해': [35.2334, 128.8803],
    '거제': [34.8808, 128.6233],
    '제주': [33.4996, 126.5312],
    '서귀포': [33.2541, 126.5601]
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadRestaurantData();
});

// Initialize Leaflet map
function initializeMap() {
    // Create map centered on South Korea
    map = L.map('map').setView([36.5, 128.0], 7);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
    }).addTo(map);
}

// Setup event listeners
function setupEventListeners() {
    // Language selector
    document.getElementById('langSelect').addEventListener('change', function(e) {
        currentLang = e.target.value;
        updateLanguage();
    });
    
    // City selector
    document.getElementById('citySelect').addEventListener('change', function(e) {
        const selectedCity = e.target.value;
        if (selectedCity !== 'all') {
            flyToCity(selectedCity);
        }
        filterMarkers();
    });
    
    // Province selector
    document.getElementById('provinceSelect').addEventListener('change', function(e) {
        updateCityOptions(e.target.value);
        filterMarkers();
    });
    
    // Category tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function(e) {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.category;
            filterMarkers();
        });
    });
}

// Load restaurant data and create markers
function loadRestaurantData() {
    if (typeof placeData === 'undefined') {
        console.error('placeData is not available');
        return;
    }
    
    // Clear existing markers
    clearMarkers();
    
    // Create markers for each restaurant
    placeData.forEach(restaurant => {
        if (restaurant.lat && restaurant.lng) {
            const marker = L.marker([restaurant.lat, restaurant.lng])
                .addTo(map)
                .bindPopup(createPopupContent(restaurant));
            
            markers.push({
                marker: marker,
                data: restaurant
            });
        }
    });
    
    console.log(`Loaded ${markers.length} restaurants on the map`);
}

// Create popup content for markers
function createPopupContent(restaurant) {
    const categoryText = getCategoryTranslation(restaurant.category);
    const typeText = getTypeTranslation(restaurant.type);
    
    return `
        <div style="padding: 10px; min-width: 250px;">
            <h4 style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold;">${restaurant.name}</h4>
            <p style="font-size: 12px; color: #666; margin: 2px 0;">${categoryText} ${typeText ? '• ' + typeText : ''}</p>
            <p style="font-size: 13px; margin: 5px 0; line-height: 1.4;">${restaurant.address}</p>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                <button onclick="showRestaurantDetails('${restaurant.id}')" style="
                    background: #0071e3; color: white; border: none; padding: 6px 12px; 
                    border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 5px;
                ">상세 정보</button>
                <button onclick="addToPlanner('${restaurant.id}')" style="
                    background: #34c759; color: white; border: none; padding: 6px 12px; 
                    border-radius: 6px; cursor: pointer; font-size: 12px;
                ">플래너에 추가</button>
            </div>
        </div>
    `;
}

// Get category translation
function getCategoryTranslation(category) {
    const translations = {
        'ko': {
            'restaurant': '맛집',
            'cafe': '카페'
        },
        'en': {
            'restaurant': 'Restaurant',
            'cafe': 'Cafe'
        }
    };
    
    return translations[currentLang]?.[category] || category;
}

// Get type translation
function getTypeTranslation(type) {
    const translations = {
        'ko': {
            '현지인': '현지인 맛집',
            '외지인': '외지인 맛집',
            '공통': '공통 맛집'
        },
        'en': {
            '현지인': 'Local Favorite',
            '외지인': 'Tourist Popular',
            '공통': 'Popular'
        }
    };
    
    return translations[currentLang]?.[type] || type;
}

// Clear all markers
function clearMarkers() {
    markers.forEach(item => {
        map.removeLayer(item.marker);
    });
    markers = [];
}

// Filter markers based on current filters
function filterMarkers() {
    const province = document.getElementById('provinceSelect').value;
    const city = document.getElementById('citySelect').value;
    
    markers.forEach(item => {
        const restaurant = item.data;
        let show = true;
        
        // Filter by category
        if (currentFilter !== 'all') {
            if (currentFilter === 'food_local' && restaurant.category !== 'restaurant') {
                show = false;
            } else if (currentFilter === 'cafe' && restaurant.category !== 'cafe') {
                show = false;
            }
        }
        
        // Filter by province
        if (province !== 'all' && restaurant.province !== province) {
            show = false;
        }
        
        // Filter by city
        if (city !== 'all' && restaurant.city !== city) {
            show = false;
        }
        
        if (show) {
            item.marker.addTo(map);
        } else {
            map.removeLayer(item.marker);
        }
    });
    
    updateRestaurantList();
}

// Fly to specific city
function flyToCity(city) {
    if (cityCoordinates[city]) {
        map.flyTo(cityCoordinates[city], 12, {
            duration: 1.5
        });
    }
}

// Update city options based on selected province
function updateCityOptions(province) {
    const citySelect = document.getElementById('citySelect');
    citySelect.innerHTML = '<option value="all">시/군 전체</option>';
    
    // Get cities in the selected province
    const cities = [...new Set(placeData
        .filter(r => r.province === province)
        .map(r => r.city)
        .filter(city => city !== 'Unknown')
    )];
    
    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });
}

// Update language
function updateLanguage() {
    // Update UI text based on current language
    const translations = {
        'ko': {
            'title': 'K-Local Vibe',
            'subtitle': '신사임당과 율곡 이이가 태어난 유서 깊은 곳입니다.',
            'all': '전체',
            'restaurant': '맛집',
            'cafe': '카페'
        },
        'en': {
            'title': 'K-Local Vibe',
            'subtitle': 'Historic birthplace of Shin Saimdang and Yulgok Yi I.',
            'all': 'All',
            'restaurant': 'Restaurant',
            'cafe': 'Cafe'
        }
    };
    
    const lang = translations[currentLang];
    if (lang) {
        document.getElementById('main-title').textContent = lang.title;
        document.getElementById('sub-title').textContent = lang.subtitle;
        
        // Update category tabs
        document.querySelector('[data-category="all"]').textContent = lang.all;
        document.querySelector('[data-category="food_local"]').textContent = lang.restaurant;
        document.querySelector('[data-category="cafe"]').textContent = lang.cafe;
    }
    
    // Update all popups
    markers.forEach(item => {
        item.marker.setPopupContent(createPopupContent(item.data));
    });
}

// Update restaurant list
function updateRestaurantList() {
    const grid = document.getElementById('contentGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const visibleMarkers = markers.filter(item => map.hasLayer(item.marker));
    
    if (visibleMarkers.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🔍</div>
                <h3 style="margin-bottom: 8px;">검색 결과가 없습니다</h3>
                <p style="font-size: 14px;">필터를 조정해보세요</p>
            </div>
        `;
        return;
    }
    
    visibleMarkers.forEach(item => {
        const restaurant = item.data;
        const card = createRestaurantCard(restaurant);
        grid.appendChild(card);
    });
}

// Create restaurant card
function createRestaurantCard(restaurant) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const categoryText = getCategoryTranslation(restaurant.category);
    const typeText = getTypeTranslation(restaurant.type);
    
    card.innerHTML = `
        <div class="card-img" style="background-image: url('https://source.unsplash.com/featured/?${restaurant.category === 'cafe' ? 'cafe,coffee' : 'restaurant,food'}&korea')"></div>
        <div class="card-body">
            <small style="color: var(--apple-blue); font-weight: 600; font-size: 12px;">
                ${restaurant.city} • ${categoryText}
            </small>
            <h2 class="card-title">${restaurant.name}</h2>
            <p class="card-desc">${typeText ? typeText + ' • ' : ''}${restaurant.address}</p>
            
            <div class="card-actions">
                <button class="btn btn-secondary" onclick="showRestaurantDetails('${restaurant.id}')">
                    📍 상세 정보
                </button>
                <button class="btn btn-primary" onclick="addToPlanner('${restaurant.id}')">
                    ➕ 플래너 추가
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Placeholder functions for Phase 3 and 4
function showRestaurantDetails(restaurantId) {
    const restaurant = placeData.find(r => r.id === restaurantId);
    if (restaurant) {
        alert(`상세 정보: ${restaurant.name}\n주소: ${restaurant.address}\n분류: ${restaurant.original_category}`);
    }
}

function addToPlanner(restaurantId) {
    const restaurant = placeData.find(r => r.id === restaurantId);
    if (restaurant) {
        // This will be implemented in Phase 4
        alert(`플래너에 추가: ${restaurant.name}`);
    }
}
