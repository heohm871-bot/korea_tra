(function () {
    'use strict';

    const STORAGE_KEY = 'k-local-vibe-course';
    const SHARE_PARAM = 'course';

    const HERITAGE_KEYWORDS = [
        '남대문',
        '숭례문',
        '불국사',
        '석굴암'
    ];

    const i18n = {
        ko: {
            courseTitle: '나만의 코스',
            tripDates: '여행 기간 설정',
            startDate: '시작일',
            endDate: '종료일',
            cannotShortenDates: '기간을 줄이기 전에 잘려나가는 Day의 장소를 먼저 다른 Day로 옮겨주세요.',
            day: 'Day',
            emptyDay: '장소를 추가하세요.',
            moveToDay: 'Day 이동',
            empty: '코스에 담긴 장소가 없습니다.',
            time: '시간',
            remove: '삭제',
            close: '닫기',
            open: '열기',
            route: '경로 보기',
            share: '공유',
            copied: '공유 링크가 복사되었습니다.',
            copyFailed: '복사에 실패했습니다. 아래 링크를 복사해 주세요.',
            sharedMode: '공유된 코스 (읽기 전용)',
            editThisCourse: '이 코스를 편집하기',
            needMore: '경로를 생성하려면 최소 2개 이상의 장소가 필요합니다.',
            dragHint: '드래그해서 순서를 바꿀 수 있어요.',
            youtube: 'YouTube 보기'
        },
        en: {
            courseTitle: 'My Course',
            tripDates: 'Trip dates',
            startDate: 'Start',
            endDate: 'End',
            cannotShortenDates: 'Move places from the days that would be removed before shortening the date range.',
            day: 'Day',
            emptyDay: 'Add places to this day.',
            moveToDay: 'Move',
            empty: 'No places in your course yet.',
            time: 'Time',
            remove: 'Remove',
            close: 'Close',
            open: 'Open',
            route: 'View route',
            share: 'Share',
            copied: 'Share link copied.',
            copyFailed: 'Copy failed. Please copy the link below.',
            sharedMode: 'Shared course (read-only)',
            editThisCourse: 'Edit this course',
            needMore: 'You need at least 2 places to create a route.',
            dragHint: 'Drag to reorder.',
            youtube: 'Watch on YouTube'
        },
        jp: {
            courseTitle: 'マイコース',
            tripDates: '旅行期間',
            startDate: '開始日',
            endDate: '終了日',
            cannotShortenDates: '期間を短くする前に、削除される日の場所を別の日へ移動してください。',
            day: 'Day',
            emptyDay: '場所を追加してください。',
            moveToDay: '移動',
            empty: 'コースに追加された場所がありません。',
            time: '時間',
            remove: '削除',
            close: '閉じる',
            open: '開く',
            route: 'ルートを見る',
            share: '共有',
            copied: '共有リンクをコピーしました。',
            copyFailed: 'コピーに失敗しました。以下のリンクをコピーしてください。',
            sharedMode: '共有されたコース（読み取り専用）',
            editThisCourse: 'このコースを編集する',
            needMore: 'ルート作成には2か所以上必要です。',
            dragHint: 'ドラッグで並び替えできます。',
            youtube: 'YouTubeを見る'
        },
        cn: {
            courseTitle: '我的行程',
            tripDates: '旅行日期',
            startDate: '开始',
            endDate: '结束',
            cannotShortenDates: '缩短日期范围前，请先把将被删除日期的地点移动到其他天。',
            day: 'Day',
            emptyDay: '请添加地点。',
            moveToDay: '移动',
            empty: '行程中暂无地点。',
            time: '时间',
            remove: '删除',
            close: '关闭',
            open: '打开',
            route: '查看路线',
            share: '分享',
            copied: '分享链接已复制。',
            copyFailed: '复制失败，请复制下面的链接。',
            sharedMode: '已分享的行程（只读）',
            editThisCourse: '编辑此行程',
            needMore: '生成路线至少需要2个地点。',
            dragHint: '可拖拽调整顺序。',
            youtube: '观看 YouTube'
        },
        th: {
            courseTitle: 'คอร์สของฉัน',
            tripDates: 'ช่วงวันเดินทาง',
            startDate: 'เริ่ม',
            endDate: 'สิ้นสุด',
            cannotShortenDates: 'โปรดย้ายสถานที่จากวันที่จะถูกตัดออกก่อนลดช่วงวันเดินทาง',
            day: 'Day',
            emptyDay: 'เพิ่มสถานที่ในวันนี้',
            moveToDay: 'ย้าย',
            empty: 'ยังไม่มีสถานที่ในคอร์ส',
            time: 'เวลา',
            remove: 'ลบ',
            close: 'ปิด',
            open: 'เปิด',
            route: 'ดูเส้นทาง',
            share: 'แชร์',
            copied: 'คัดลอกลิงก์แชร์แล้ว',
            copyFailed: 'คัดลอกไม่สำเร็จ โปรดคัดลอกลิงก์ด้านล่าง',
            sharedMode: 'คอร์สที่แชร์ (อ่านอย่างเดียว)',
            editThisCourse: 'แก้ไขคอร์สนี้',
            needMore: 'ต้องมีอย่างน้อย 2 สถานที่เพื่อสร้างเส้นทาง',
            dragHint: 'ลากเพื่อจัดลำดับใหม่',
            youtube: 'ดูบน YouTube'
        },
        ar: {
            courseTitle: 'مساري',
            tripDates: 'تواريخ الرحلة',
            startDate: 'البداية',
            endDate: 'النهاية',
            cannotShortenDates: 'انقل الأماكن من الأيام التي سيتم حذفها قبل تقصير نطاق التواريخ.',
            day: 'Day',
            emptyDay: 'أضف أماكن لهذا اليوم.',
            moveToDay: 'نقل',
            empty: 'لا توجد أماكن في المسار بعد.',
            time: 'الوقت',
            remove: 'إزالة',
            close: 'إغلاق',
            open: 'فتح',
            route: 'عرض المسار',
            share: 'مشاركة',
            copied: 'تم نسخ رابط المشاركة.',
            copyFailed: 'فشل النسخ. الرجاء نسخ الرابط أدناه.',
            sharedMode: 'مسار مشترك (للقراءة فقط)',
            editThisCourse: 'تحرير هذا المسار',
            needMore: 'تحتاج إلى مكانين على الأقل لإنشاء مسار.',
            dragHint: 'اسحب لإعادة الترتيب.',
            youtube: 'شاهد على YouTube'
        },
        ru: {
            courseTitle: 'Мой маршрут',
            tripDates: 'Даты поездки',
            startDate: 'Начало',
            endDate: 'Конец',
            cannotShortenDates: 'Перед сокращением диапазона дат переместите места из удаляемых дней на другие дни.',
            day: 'Day',
            emptyDay: 'Добавьте места на этот день.',
            moveToDay: 'Переместить',
            empty: 'В маршруте пока нет мест.',
            time: 'Время',
            remove: 'Удалить',
            close: 'Закрыть',
            open: 'Открыть',
            route: 'Показать маршрут',
            share: 'Поделиться',
            copied: 'Ссылка для поделиться скопирована.',
            copyFailed: 'Не удалось скопировать. Пожалуйста, скопируйте ссылку ниже.',
            sharedMode: 'Общий маршрут (только чтение)',
            editThisCourse: 'Редактировать этот маршрут',
            needMore: 'Нужно минимум 2 места для построения маршрута.',
            dragHint: 'Перетащите для изменения порядка.',
            youtube: 'Смотреть на YouTube'
        },
        fr: {
            courseTitle: 'Mon itinéraire',
            tripDates: 'Dates du voyage',
            startDate: 'Début',
            endDate: 'Fin',
            cannotShortenDates: 'Avant de raccourcir la période, déplacez les lieux des jours qui seraient supprimés.',
            day: 'Day',
            emptyDay: 'Ajoutez des lieux à cette journée.',
            moveToDay: 'Déplacer',
            empty: 'Aucun lieu dans votre itinéraire.',
            time: 'Heure',
            remove: 'Supprimer',
            close: 'Fermer',
            open: 'Ouvrir',
            route: 'Voir l\'itinéraire',
            share: 'Partager',
            copied: 'Lien de partage copié.',
            copyFailed: 'Échec de la copie. Veuillez copier le lien ci-dessous.',
            sharedMode: 'Itinéraire partagé (lecture seule)',
            editThisCourse: 'Modifier cet itinéraire',
            needMore: 'Ajoutez au moins 2 lieux pour créer un itinéraire.',
            dragHint: 'Glissez pour réordonner.',
            youtube: 'Voir sur YouTube'
        }
    };

    const state = {
        lang: 'ko',
        isOpen: false,
        isShared: false,
        isReadOnly: false,
        course: null,
        selectedDayIndex: 1
    };

    function todayYmd() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function addDaysYmd(ymd, deltaDays) {
        const d = new Date(`${ymd}T00:00:00`);
        d.setDate(d.getDate() + deltaDays);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function diffDaysInclusive(startYmd, endYmd) {
        const s = new Date(`${startYmd}T00:00:00`);
        const e = new Date(`${endYmd}T00:00:00`);
        const ms = e.getTime() - s.getTime();
        const days = Math.floor(ms / (24 * 60 * 60 * 1000));
        return Math.max(1, days + 1);
    }

    function isYmd(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
    }

    function ensureCourse() {
        if (state.course) return;
        const d = todayYmd();
        state.course = {
            startDate: d,
            endDate: d,
            days: [{ dayIndex: 1, date: d, places: [] }],
            meta: { lang: state.lang }
        };
    }

    function totalPlaces() {
        ensureCourse();
        return state.course.days.reduce((acc, day) => acc + (Array.isArray(day.places) ? day.places.length : 0), 0);
    }

    function t(key) {
        return i18n[state.lang]?.[key] ?? i18n.ko[key] ?? key;
    }

    function normalizeLang(lang) {
        const l = String(lang ?? '').toLowerCase();
        const allowed = new Set(['ko', 'en', 'jp', 'cn', 'th', 'ar', 'ru', 'fr']);
        return allowed.has(l) ? l : 'ko';
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;

            // Migration:
            // - old format: array of {id,title,...,time}
            // - new format: {startDate,endDate,days[],meta}
            if (Array.isArray(parsed)) {
                const d = todayYmd();
                state.course = {
                    startDate: d,
                    endDate: d,
                    days: [{
                        dayIndex: 1,
                        date: d,
                        places: parsed.map((it) => ({
                            id: String(it?.id ?? '').trim(),
                            time: String(it?.time ?? ''),
                            note: ''
                        })).filter((p) => p.id)
                    }],
                    meta: { lang: state.lang }
                };
                state.selectedDayIndex = 1;
            } else if (parsed && typeof parsed === 'object') {
                state.course = parsed;
            } else {
                state.course = null;
            }
        } catch {
            state.course = null;
        }
        ensureCourse();
    }

    function reload() {
        load();
        render();
    }

    function save() {
        if (state.isShared && state.isReadOnly) return;
        ensureCourse();
        state.course.meta = state.course.meta || {};
        state.course.meta.lang = state.lang;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.course));
    }

    function base64UrlEncodeUtf8(str) {
        const bytes = encodeURIComponent(String(str)).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
        const b64 = btoa(bytes);
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function base64UrlDecodeUtf8(b64url) {
        const s = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/');
        const padded = s + '==='.slice((s.length + 3) % 4);
        const bytes = atob(padded);
        const percent = Array.from(bytes).map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
        return decodeURIComponent(percent);
    }

    function buildSharePayload() {
        ensureCourse();
        return {
            v: 2,
            course: state.course
        };
    }

    function createShareUrl() {
        const payload = buildSharePayload();
        const json = JSON.stringify(payload);
        const encoded = base64UrlEncodeUtf8(json);

        const url = new URL(window.location.href);
        url.searchParams.set(SHARE_PARAM, encoded);
        return url.toString();
    }

    async function copyText(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            return;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('copy_failed');
    }

    function findPlaceById(id) {
        const key = String(id ?? '').trim();
        if (!key) return null;
        const list = window.placeData;
        if (!Array.isArray(list)) return null;
        return list.find((p) => String(p?.key ?? p?.id ?? p?.title ?? '').trim() === key) ||
            list.find((p) => String(p?.title ?? '').trim() === key) ||
            null;
    }

    function hydrateItemFromPlace(id, time) {
        const place = findPlaceById(id);
        if (!place) {
            return {
                id: String(id ?? '').trim(),
                title: String(id ?? '').trim(),
                description: '',
                address: '',
                lat: null,
                lng: null,
                time: String(time ?? ''),
                youtubeUrl: ''
            };
        }
        return {
            id: String(place?.key ?? place?.id ?? place?.title ?? id).trim(),
            title: getPlaceTitle(place),
            description: getPlaceDescription(place),
            address: String(place?.address ?? '').trim(),
            lat: place?.lat,
            lng: place?.lng,
            time: String(time ?? ''),
            youtubeUrl: getYoutubeUrl(place)
        };
    }

    function tryRestoreFromUrl() {
        const url = new URL(window.location.href);
        const encoded = url.searchParams.get(SHARE_PARAM);
        if (!encoded) return false;

        try {
            const json = base64UrlDecodeUtf8(encoded);
            const payload = JSON.parse(json);
            // v1 support
            if (payload?.v === 1) {
                const lang = normalizeLang(payload?.lang);
                const items = Array.isArray(payload?.items) ? payload.items : [];

                state.lang = lang;

                const d = todayYmd();
                state.course = {
                    startDate: d,
                    endDate: d,
                    days: [{
                        dayIndex: 1,
                        date: d,
                        places: items
                            .filter((x) => x && String(x.id ?? '').trim())
                            .map((x) => ({ id: String(x.id).trim(), time: String(x.time ?? ''), note: '' }))
                    }],
                    meta: { lang }
                };
                state.selectedDayIndex = 1;
            } else {
                const course = payload?.course;
                if (course && typeof course === 'object') {
                    state.course = course;
                }
                const lang = normalizeLang(state.course?.meta?.lang || state.course?.lang || payload?.lang);
                state.lang = lang;
                if (isYmd(state.course?.startDate) && isYmd(state.course?.endDate)) {
                    // ok
                } else {
                    const d = todayYmd();
                    state.course.startDate = d;
                    state.course.endDate = d;
                }
            }

            ensureCourse();

            // Normalize days to match date range
            const count = diffDaysInclusive(state.course.startDate, state.course.endDate);
            const nextDays = [];
            for (let i = 0; i < count; i++) {
                const dayIndex = i + 1;
                const date = addDaysYmd(state.course.startDate, i);
                const existing = (Array.isArray(state.course.days) ? state.course.days : []).find((d) => d.dayIndex === dayIndex);
                nextDays.push({
                    dayIndex,
                    date,
                    places: Array.isArray(existing?.places) ? existing.places : []
                });
            }
            state.course.days = nextDays;

            // Sync app-wide language selector so the whole UI matches the shared course language
            const langSelect = document.getElementById('langSelect');
            if (langSelect && String(langSelect.value || '').toLowerCase() !== lang) {
                langSelect.value = lang;
                langSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            state.isShared = true;
            state.isReadOnly = true;
            state.isOpen = true;

            state.selectedDayIndex = 1;

            return true;
        } catch {
            return false;
        }
    }

    function clearShareParamFromUrl() {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(SHARE_PARAM)) return;
        url.searchParams.delete(SHARE_PARAM);
        window.history.replaceState({}, '', url.toString());
    }

    function getPlaceTitle(place) {
        const name = place?.name && typeof place.name === 'object' ? place.name[state.lang] : '';
        return String(name || place?.title || '').trim();
    }

    function getPlaceDescription(place) {
        const desc = place?.description && typeof place.description === 'object' ? place.description[state.lang] : '';
        return String(desc || place?.description?.ko || place?.description || '').trim();
    }

    function toRoutePoint(item) {
        const lat = parseFloat(item?.lat);
        const lng = parseFloat(item?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat},${lng}`;
        const title = String(item?.title ?? '').trim();
        const address = String(item?.address ?? '').trim();
        return [title, address].filter(Boolean).join(' ').trim();
    }

    function openRoute() {
        if (totalPlaces() < 2) {
            alert(t('needMore'));
            return;
        }
        ensureCourse();
        const flat = [];
        state.course.days.forEach((d) => {
            (d.places || []).forEach((p) => {
                flat.push(hydrateItemFromPlace(p.id, p.time));
            });
        });

        const origin = toRoutePoint(flat[0]);
        const destination = toRoutePoint(flat[flat.length - 1]);
        const waypoints = flat.length > 2 ? flat.slice(1, -1).map(toRoutePoint).join('|') : '';

        let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
        if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
        window.open(url, '_blank');
    }

    function injectCssOnce() {
        if (document.getElementById('coursePanelStyles')) return;
        const style = document.createElement('style');
        style.id = 'coursePanelStyles';
        style.textContent = `
#coursePanel{position:fixed;top:0;right:0;height:100%;width:380px;max-width:92vw;background:#fff;z-index:30000;box-shadow:-10px 0 30px rgba(0,0,0,.12);transform:translateX(102%);transition:transform .25s ease;display:flex;flex-direction:column;border-left:1px solid #e5e7eb;}
#coursePanel.open{transform:translateX(0);} 
#coursePanel .cp-header{padding:16px 16px 10px;border-bottom:1px solid #f2f2f7;display:flex;align-items:center;justify-content:space-between;gap:10px;}
#coursePanel .cp-title{font-size:16px;font-weight:800;color:#111827;}
#coursePanel .cp-actions{display:flex;gap:8px;align-items:center;}
#coursePanel .cp-badge{background:#111827;color:#fff;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;}
#coursePanel .cp-btn{border:none;border-radius:10px;padding:10px 12px;cursor:pointer;font-weight:700;font-size:13px;}
#coursePanel .cp-btn.primary{background:#0071e3;color:#fff;}
#coursePanel .cp-btn.danger{background:#111827;color:#fff;}
#coursePanel .cp-btn.ghost{background:#f2f2f7;color:#111827;}
#coursePanel .cp-dates{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 16px;border-bottom:1px solid #f2f2f7;}
#coursePanel .cp-dates label{font-size:11px;color:#6b7280;font-weight:800;display:flex;flex-direction:column;gap:6px;}
#coursePanel .cp-dates input[type=date]{border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font-size:13px;}
#coursePanel .cp-day{border:1px solid #e5e7eb;border-radius:14px;margin:10px 0;overflow:hidden;background:#fff;}
#coursePanel .cp-day > summary{list-style:none;cursor:pointer;padding:12px 12px;font-weight:900;color:#111827;display:flex;justify-content:space-between;align-items:center;}
#coursePanel .cp-day > summary::-webkit-details-marker{display:none;}
#coursePanel .cp-day-body{padding:10px 12px;border-top:1px solid #f2f2f7;}
#coursePanel .cp-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:900;color:#111827;background:#f2f2f7;border-radius:999px;padding:6px 10px;}
#coursePanel .cp-youtube{background:#ff0000;color:#fff;border:none;border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:900;font-size:12px;}
#coursePanel .cp-daymove{margin-left:auto;display:flex;align-items:center;gap:6px;}
#coursePanel .cp-daymove select{border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font-size:13px;}
#coursePanel .cp-body{padding:14px 16px;overflow:auto;flex:1;}
#coursePanel .cp-hint{font-size:12px;color:#6b7280;margin:0 0 10px 0;}
#coursePanel .cp-empty{padding:18px 12px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;background:#fafafa;font-size:13px;}
#coursePanel .cp-item{border:1px solid #e5e7eb;border-radius:14px;padding:12px 12px;margin-bottom:10px;background:#fff;display:flex;gap:10px;align-items:flex-start;}
#coursePanel .cp-drag{width:22px;flex:0 0 22px;color:#9ca3af;cursor:grab;user-select:none;line-height:1.1;padding-top:2px;}
#coursePanel .cp-main{flex:1;min-width:0;}
#coursePanel .cp-name{font-weight:800;color:#111827;font-size:14px;margin:0 0 4px 0;}
#coursePanel .cp-desc{color:#374151;font-size:12px;margin:0 0 6px 0;white-space:pre-line;}
#coursePanel .cp-sub{color:#6b7280;font-size:12px;margin:0 0 10px 0;}
#coursePanel .cp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
#coursePanel .cp-label{font-size:12px;color:#6b7280;font-weight:700;}
#coursePanel input[type=time]{border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font-size:13px;}
#coursePanel .cp-remove{margin-left:auto;background:#ff3b30;color:#fff;border:none;border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:800;font-size:12px;}
@media (max-width: 768px){
  #coursePanel{top:auto;right:auto;left:0;bottom:0;width:100%;height:70vh;border-left:none;border-top:1px solid #e5e7eb;transform:translateY(102%);} 
  #coursePanel.open{transform:translateY(0);} 
}
`; 
        document.head.appendChild(style);
    }

    function ensurePanelEl() {
        const el = document.getElementById('coursePanel');
        return el || null;
    }

    function render() {
        const panel = ensurePanelEl();
        if (!panel) return;
        panel.classList.toggle('open', state.isOpen);
        panel.setAttribute('aria-hidden', state.isOpen ? 'false' : 'true');

        const readonly = Boolean(state.isShared && state.isReadOnly);

        ensureCourse();

        const dayCount = diffDaysInclusive(state.course.startDate, state.course.endDate);
        const dayOptions = Array.from({ length: dayCount }).map((_, i) => {
            const idx = i + 1;
            return `<option value="${idx}">${escapeHtml(t('day'))} ${idx}</option>`;
        }).join('');

        const daysHtml = (state.course.days || []).map((day) => {
            const places = Array.isArray(day.places) ? day.places : [];
            const summaryRight = `<span style="font-size:12px;color:#6b7280;font-weight:800;">${escapeHtml(day.date)} • ${places.length}</span>`;

            if (places.length === 0) {
                return `
<details class="cp-day" open>
  <summary data-action="selectDay" data-day="${day.dayIndex}">${escapeHtml(t('day'))} ${day.dayIndex} ${summaryRight}</summary>
  <div class="cp-day-body">
    <div class="cp-empty">${escapeHtml(t('emptyDay'))}</div>
  </div>
</details>`;
            }

            // sort by time (stable): empty times at end
            const decorated = places.map((p, i) => ({ p, i }));
            decorated.sort((a, b) => {
                const ta = String(a.p?.time ?? '');
                const tb = String(b.p?.time ?? '');
                if (!ta && !tb) return a.i - b.i;
                if (!ta) return 1;
                if (!tb) return -1;
                return ta.localeCompare(tb) || (a.i - b.i);
            });

            const itemsHtml = decorated.map(({ p }, idx) => {
                const it = hydrateItemFromPlace(p.id, p.time);
                const name = String(it?.title ?? '').trim();
                const desc = String(it?.description ?? '').trim();
                const address = String(it?.address ?? '').trim();
                const time = String(p?.time ?? '');
                const place = findPlaceById(p.id);
                const yt = it.youtubeUrl;
                const heritage = place ? isHeritage(place) : false;

                const tags = [
                    heritage ? `<span class="cp-tag">🏛️</span>` : '',
                    yt ? `<span class="cp-tag">🎥</span>` : ''
                ].filter(Boolean).join('');

                const youtubeBtn = yt ? `<button class="cp-youtube" data-action="youtube" data-url="${escapeHtml(yt)}">▶ ${escapeHtml(t('youtube'))}</button>` : '';

                const moveCtl = readonly ? '' : `
<div class="cp-daymove">
  <span class="cp-label">${escapeHtml(t('moveToDay'))}</span>
  <select data-action="move" data-from-day="${day.dayIndex}">
    ${dayOptions}
  </select>
</div>`;

                return `
<div class="cp-item" draggable="${readonly ? 'false' : 'true'}" data-id="${escapeHtml(it.id)}" data-day="${day.dayIndex}" data-index="${idx}">
  <div class="cp-drag" title="drag">⋮⋮</div>
  <div class="cp-main">
    <div style="display:flex;align-items:center;gap:8px;">
      <p class="cp-name" style="margin:0;">${escapeHtml(name)}</p>
      ${tags}
    </div>
    ${desc ? `<p class="cp-desc">${escapeHtml(desc)}</p>` : ''}
    ${address ? `<p class="cp-sub">${escapeHtml(address)}</p>` : ''}
    <div class="cp-row">
      <span class="cp-label">${escapeHtml(t('time'))}</span>
      <input type="time" value="${escapeHtml(time)}" data-action="time" ${readonly ? 'disabled' : ''} />
      ${youtubeBtn}
      ${moveCtl}
      ${readonly ? '' : `<button class="cp-remove" data-action="remove">${escapeHtml(t('remove'))}</button>`}
    </div>
  </div>
</div>`;
            }).join('');

            return `
<details class="cp-day" open>
  <summary data-action="selectDay" data-day="${day.dayIndex}">${escapeHtml(t('day'))} ${day.dayIndex} ${summaryRight}</summary>
  <div class="cp-day-body">
    ${itemsHtml}
  </div>
</details>`;
        }).join('');

        const badgeHtml = readonly ? `<span class="cp-badge">${escapeHtml(t('sharedMode'))}</span>` : '';
        const editBtnHtml = readonly ? `<button class="cp-btn danger" data-action="edit">${escapeHtml(t('editThisCourse'))}</button>` : '';

        panel.innerHTML = `
<div class="cp-header">
  <div class="cp-title">${escapeHtml(t('courseTitle'))} (${totalPlaces()})</div>
  <div class="cp-actions">
    ${badgeHtml}
    ${editBtnHtml}
    <button class="cp-btn ghost" data-action="share">${escapeHtml(t('share'))}</button>
    <button class="cp-btn primary" data-action="route">${escapeHtml(t('route'))}</button>
    <button class="cp-btn ghost" data-action="close">${escapeHtml(t('close'))}</button>
  </div>
</div>
<div class="cp-dates">
  <label>
    <span>${escapeHtml(t('startDate'))}</span>
    <input type="date" data-action="startDate" value="${escapeHtml(state.course.startDate)}" ${readonly ? 'disabled' : ''} />
  </label>
  <label>
    <span>${escapeHtml(t('endDate'))}</span>
    <input type="date" data-action="endDate" value="${escapeHtml(state.course.endDate)}" ${readonly ? 'disabled' : ''} />
  </label>
</div>
<div class="cp-body">
  <p class="cp-hint">${escapeHtml(t('dragHint'))}</p>
  ${daysHtml}
</div>`;

        bindPanelEvents(panel);

        // Sync floating button label if app.js created it
        const btn = document.getElementById('plannerButton');
        if (btn) {
            btn.innerHTML = `📍 ${escapeHtml(t('courseTitle'))} (${totalPlaces()})`;
        }
    }

    function bindPanelEvents(panel) {
        // actions
        panel.querySelectorAll('[data-action]')?.forEach((el) => {
            el.addEventListener('click', (e) => {
                const action = e.currentTarget.getAttribute('data-action');
                if (action === 'selectDay') {
                    const day = parseInt(e.currentTarget.getAttribute('data-day') || '1', 10) || 1;
                    state.selectedDayIndex = day;
                    return;
                }
                if (action === 'close') close();
                if (action === 'route') openRoute();
                if (action === 'share') {
                    const url = createShareUrl();
                    copyText(url)
                        .then(() => alert(t('copied')))
                        .catch(() => {
                            // fallback prompt
                            // eslint-disable-next-line no-alert
                            prompt(t('copyFailed'), url);
                        });
                }
                if (action === 'edit') {
                    state.isReadOnly = false;
                    state.isShared = false;
                    clearShareParamFromUrl();
                    save();
                    render();
                }
            });
        });

        // item events (remove/time)
        panel.querySelectorAll('.cp-item')?.forEach((itemEl) => {
            const id = itemEl.getAttribute('data-id');
            const dayIndex = parseInt(itemEl.getAttribute('data-day') || '1', 10) || 1;

            itemEl.addEventListener('click', (e) => {
                const target = e.target;
                if (!(target instanceof HTMLElement)) return;

                if (target.getAttribute('data-action') === 'remove') {
                    remove(dayIndex, id);
                    return;
                }

                if (target.getAttribute('data-action') === 'time') {
                    return;
                }
            });

            const timeInput = itemEl.querySelector('input[type=time][data-action="time"]');
            if (timeInput) {
                timeInput.addEventListener('change', (e) => {
                    const v = String(e.target.value ?? '');
                    setTime(dayIndex, id, v);
                });
            }

            const ytBtn = itemEl.querySelector('button[data-action="youtube"]');
            if (ytBtn) {
                ytBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const url = String(ytBtn.getAttribute('data-url') || '').trim();
                    if (!url) return;
                    window.open(url, '_blank', 'noopener,noreferrer');
                });
            }

            const moveSelect = itemEl.querySelector('select[data-action="move"]');
            if (moveSelect) {
                moveSelect.value = String(dayIndex);
                moveSelect.addEventListener('change', (e) => {
                    const toDay = parseInt(e.target.value || '1', 10) || 1;
                    if (toDay !== dayIndex) {
                        movePlace(dayIndex, toDay, id);
                    }
                });
            }

            if (!(state.isShared && state.isReadOnly)) {
                // drag reorder
                itemEl.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', id);
                    itemEl.style.opacity = '0.6';
                });
                itemEl.addEventListener('dragend', () => {
                    itemEl.style.opacity = '1';
                });
                itemEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                });
                itemEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const srcId = e.dataTransfer.getData('text/plain');
                    if (!srcId || srcId === id) return;
                    reorder(dayIndex, srcId, id);
                });
            }
        });

        const startInput = panel.querySelector('input[type=date][data-action="startDate"]');
        const endInput = panel.querySelector('input[type=date][data-action="endDate"]');
        if (startInput) {
            startInput.addEventListener('change', (e) => {
                setTripDates(String(e.target.value || ''), state.course.endDate);
            });
        }
        if (endInput) {
            endInput.addEventListener('change', (e) => {
                setTripDates(state.course.startDate, String(e.target.value || ''));
            });
        }
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function setLang(lang) {
        state.lang = normalizeLang(lang);
        ensureCourse();
        state.course.meta = state.course.meta || {};
        state.course.meta.lang = state.lang;
        render();
    }

    function open() {
        state.isOpen = true;
        render();
    }

    function close() {
        state.isOpen = false;
        render();
    }

    function toggle() {
        state.isOpen = !state.isOpen;
        render();
    }

    function upsertPlace(place) {
        if (state.isShared && state.isReadOnly) return;
        ensureCourse();
        const id = String(place?.key ?? place?.id ?? place?.title ?? '').trim();
        if (!id) return;

        const dayIndex = state.selectedDayIndex || 1;
        const day = state.course.days.find((d) => d.dayIndex === dayIndex) || state.course.days[0];
        day.places = Array.isArray(day.places) ? day.places : [];

        const exists = state.course.days.some((d) => (d.places || []).some((p) => String(p?.id ?? '').trim() === id));
        if (exists) {
            // remove from any day
            state.course.days.forEach((d) => {
                d.places = (d.places || []).filter((p) => String(p?.id ?? '').trim() !== id);
            });
        } else {
            day.places.push({ id, time: '', note: '' });
        }
        save();
        render();
    }

    function remove(dayIndex, id) {
        if (state.isShared && state.isReadOnly) return;
        const key = String(id ?? '').trim();
        if (!key) return;
        ensureCourse();
        const day = state.course.days.find((d) => d.dayIndex === dayIndex);
        if (day) {
            day.places = (day.places || []).filter((p) => String(p?.id ?? '').trim() !== key);
        }
        save();
        render();
    }

    function setTime(dayIndex, id, time) {
        if (state.isShared && state.isReadOnly) return;
        const key = String(id ?? '').trim();
        const v = String(time ?? '');
        ensureCourse();
        const day = state.course.days.find((d) => d.dayIndex === dayIndex);
        const it = (day?.places || []).find((p) => String(p?.id ?? '').trim() === key);
        if (!it) return;
        it.time = v;
        save();
        render();
    }

    function reorder(dayIndex, srcId, dstId) {
        if (state.isShared && state.isReadOnly) return;
        const src = String(srcId ?? '').trim();
        const dst = String(dstId ?? '').trim();
        ensureCourse();
        const day = state.course.days.find((d) => d.dayIndex === dayIndex);
        if (!day) return;
        const places = Array.isArray(day.places) ? day.places : [];
        const srcIndex = places.findIndex((x) => String(x?.id ?? '').trim() === src);
        const dstIndex = places.findIndex((x) => String(x?.id ?? '').trim() === dst);
        if (srcIndex === -1 || dstIndex === -1) return;
        const [moved] = places.splice(srcIndex, 1);
        places.splice(dstIndex, 0, moved);
        day.places = places;
        save();
        render();
    }

    function movePlace(fromDay, toDay, id) {
        if (state.isShared && state.isReadOnly) return;
        ensureCourse();
        const key = String(id ?? '').trim();
        if (!key) return;
        const from = state.course.days.find((d) => d.dayIndex === fromDay);
        const to = state.course.days.find((d) => d.dayIndex === toDay);
        if (!from || !to) return;
        const idx = (from.places || []).findIndex((p) => String(p?.id ?? '').trim() === key);
        if (idx === -1) return;
        const [moved] = (from.places || []).splice(idx, 1);
        to.places = Array.isArray(to.places) ? to.places : [];
        to.places.push(moved);
        save();
        render();
    }

    function setTripDates(startDate, endDate) {
        if (state.isShared && state.isReadOnly) return;
        ensureCourse();

        const prevStart = state.course.startDate;
        const prevEnd = state.course.endDate;
        const prevDays = Array.isArray(state.course.days) ? state.course.days : [];

        const s = isYmd(startDate) ? startDate : state.course.startDate;
        const e = isYmd(endDate) ? endDate : state.course.endDate;

        // normalize order
        const sDate = new Date(`${s}T00:00:00`);
        const eDate = new Date(`${e}T00:00:00`);
        const start = sDate <= eDate ? s : e;
        const end = sDate <= eDate ? e : s;

        const count = diffDaysInclusive(start, end);

        // Policy B: block shortening if truncated days still have places
        if (count < prevDays.length) {
            const truncatedHasPlaces = prevDays
                .filter((d) => (d?.dayIndex || 0) > count)
                .some((d) => Array.isArray(d?.places) && d.places.length > 0);
            if (truncatedHasPlaces) {
                alert(t('cannotShortenDates'));
                state.course.startDate = prevStart;
                state.course.endDate = prevEnd;
                state.course.days = prevDays;
                render();
                return;
            }
        }

        state.course.startDate = start;
        state.course.endDate = end;

        const nextDays = [];
        for (let i = 0; i < count; i++) {
            const dayIndex = i + 1;
            const date = addDaysYmd(start, i);
            const existing = prevDays.find((d) => d.dayIndex === dayIndex);
            nextDays.push({ dayIndex, date, places: Array.isArray(existing?.places) ? existing.places : [] });
        }
        state.course.days = nextDays;
        state.selectedDayIndex = Math.min(state.selectedDayIndex, count);

        save();
        render();
    }

    function init() {
        injectCssOnce();
        load();

        // If a share payload exists in URL, restore it in read-only mode
        const restoredFromShare = tryRestoreFromUrl();

        // initial lang
        // - If opened from a shared link: start with payload lang
        // - Otherwise: follow app langSelect/currentLang
        const initialLang = restoredFromShare
            ? state.lang
            : (window.currentLang || document.getElementById('langSelect')?.value || 'ko');
        setLang(initialLang);

        // panel click outside is not used (panel is anchored)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.isOpen) close();
        });

        // react to language changes
        window.addEventListener('app:langChange', (e) => {
            setLang(e?.detail?.lang);
        });

        // expose minimal API
        window.Course = {
            init,
            open,
            close,
            toggle,
            setLang,
            upsertPlace,
            reload
        };

        render();
    }

    // init after DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
