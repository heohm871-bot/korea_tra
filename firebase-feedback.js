import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    serverTimestamp,
    increment,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const fallbackConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

const firebaseConfig = window.firebaseConfig || fallbackConfig;
const isConfigReady = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

const backend = {
    ready: false,
    uid: null,
    async getSummary() { return { likes: 0, comments: 0 }; },
    async getFeedback() {
        return { likes: 0, comments: [], liked: false };
    },
    async toggleLike() {},
    async addComment() {},
    async deleteComment() { return false; },
    async reportComment() {},
    async trackSearch() {},
    async getRankings() { return { topCommented: [], topSearched: [] }; },
    async getLocalizedCardContent() { return null; }
};

window.feedbackBackend = backend;

if (!isConfigReady) {
    console.warn("[feedback] Firebase config missing. Using local-only mode.");
} else {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const functions = getFunctions(app, "asia-northeast3");

    const getSafeKey = (placeKey) => encodeURIComponent(String(placeKey || '').trim());
    const getTodayKey = (ts = Date.now()) => {
        try {
            return new Date(ts).toISOString().slice(0, 10);
        } catch {
            return '';
        }
    };
    const getRecentDayKeys = (days) => {
        const count = Number(days || 0);
        if (count <= 0) return [];
        const keys = [];
        for (let i = 0; i < count; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            keys.push(getTodayKey(d.getTime()));
        }
        return keys;
    };
    const sumByDayMap = (byDay, days) => {
        const map = byDay && typeof byDay === 'object' ? byDay : {};
        if (!days || days <= 0) {
            return Object.values(map).reduce((acc, v) => acc + (Number(v) || 0), 0);
        }
        return getRecentDayKeys(days).reduce((acc, key) => acc + (Number(map[key]) || 0), 0);
    };

    const ensurePlaceDoc = async (placeKey) => {
        const safeKey = getSafeKey(placeKey);
        const ref = doc(db, "places", safeKey);
        await setDoc(ref, { placeKey: String(placeKey || ''), updatedAt: serverTimestamp() }, { merge: true });
        return ref;
    };

    const getLikeDocRef = (placeKey, uid) => {
        const safeKey = getSafeKey(placeKey);
        const likeId = `${safeKey}__${uid}`;
        return doc(db, "placeLikes", likeId);
    };

    const getCommentsRef = (placeKey) => {
        const safeKey = getSafeKey(placeKey);
        return collection(db, "places", safeKey, "comments");
    };

    const getPlaceRef = (placeKey) => {
        const safeKey = getSafeKey(placeKey);
        return doc(db, "places", safeKey);
    };

    const normalizeTargetLanguage = (lang) => {
        const raw = String(lang || '').trim().toLowerCase();
        if (!raw) return 'ko';
        if (raw === 'jp') return 'ja';
        if (raw === 'cn') return 'zh-CN';
        return raw;
    };

    const fetchComments = async (placeKey, uid) => {
        const q = query(getCommentsRef(placeKey), orderBy("createdAt", "desc"), limit(20));
        const snap = await getDocs(q);
        return snap.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            return {
                id: docSnap.id,
                text: data.text || "",
                ts: data.createdAt?.toMillis?.() || Date.now(),
                name: data.name || "",
                uid: data.uid || null,
                canDelete: uid && data.uid === uid
            };
        });
    };

    backend.getFeedback = async (placeKey) => {
        if (!backend.uid) return { likes: 0, comments: [], liked: false };
        const placeRef = getPlaceRef(placeKey);
        const placeSnap = await getDoc(placeRef);
        const placeData = placeSnap.exists() ? placeSnap.data() : {};
        const likes = Number(placeData?.likesCount || 0);
        const comments = await fetchComments(placeKey, backend.uid);
        const likeRef = getLikeDocRef(placeKey, backend.uid);
        const likeSnap = await getDoc(likeRef);
        return { likes, comments, liked: likeSnap.exists() };
    };

    backend.getSummary = async (placeKey) => {
        const placeRef = getPlaceRef(placeKey);
        const placeSnap = await getDoc(placeRef);
        const placeData = placeSnap.exists() ? placeSnap.data() : {};
        return {
            likes: Number(placeData?.likesCount || 0),
            comments: Number(placeData?.commentsCount || 0)
        };
    };

    backend.toggleLike = async (placeKey) => {
        if (!backend.uid) return;
        const likeRef = getLikeDocRef(placeKey, backend.uid);
        const placeRef = await ensurePlaceDoc(placeKey);
        await runTransaction(db, async (tx) => {
            const likeSnap = await tx.get(likeRef);
            if (likeSnap.exists()) {
                tx.delete(likeRef);
                tx.update(placeRef, { likesCount: increment(-1), updatedAt: serverTimestamp() });
            } else {
                tx.set(likeRef, { placeKey, uid: backend.uid, createdAt: serverTimestamp() });
                tx.update(placeRef, { likesCount: increment(1), updatedAt: serverTimestamp() });
            }
        });
    };

    backend.addComment = async (placeKey, payload) => {
        if (!backend.uid) return;
        const text = String(payload?.text || '').trim();
        if (!text) return;
        const name = String(payload?.name || '').trim();
        const commentsRef = getCommentsRef(placeKey);
        const dayKey = getTodayKey();
        await ensurePlaceDoc(placeKey);
        await addDoc(commentsRef, {
            text,
            name,
            uid: backend.uid,
            createdAt: serverTimestamp()
        });
        const updates = { commentsCount: increment(1), updatedAt: serverTimestamp() };
        if (dayKey) {
            updates[`commentsByDay.${dayKey}`] = increment(1);
        }
        await updateDoc(getPlaceRef(placeKey), updates);
    };

    backend.deleteComment = async (placeKey, commentId) => {
        if (!backend.uid) return false;
        const commentRef = doc(getCommentsRef(placeKey), commentId);
        const snap = await getDoc(commentRef);
        if (!snap.exists()) return false;
        const data = snap.data() || {};
        if (data.uid !== backend.uid) return false;
        const createdAt = data.createdAt?.toDate?.() || null;
        const dayKey = createdAt ? getTodayKey(createdAt.getTime()) : '';
        await deleteDoc(commentRef);
        const updates = { commentsCount: increment(-1), updatedAt: serverTimestamp() };
        if (dayKey) {
            updates[`commentsByDay.${dayKey}`] = increment(-1);
        }
        await updateDoc(getPlaceRef(placeKey), updates);
        return true;
    };

    backend.reportComment = async (placeKey, commentId) => {
        if (!backend.uid) return;
        await addDoc(collection(db, "commentReports"), {
            placeKey,
            commentId,
            uid: backend.uid,
            createdAt: serverTimestamp()
        });
    };

    backend.trackSearch = async (term) => {
        const safeTerm = String(term || '').trim().toLowerCase();
        if (!safeTerm) return;
        const dayKey = getTodayKey();
        const termRef = doc(db, "searchTerms", encodeURIComponent(safeTerm));
        await setDoc(termRef, { term: safeTerm, updatedAt: serverTimestamp() }, { merge: true });
        const updates = { count: increment(1), updatedAt: serverTimestamp() };
        if (dayKey) {
            updates[`countsByDay.${dayKey}`] = increment(1);
        }
        await updateDoc(termRef, updates);
    };

    backend.getRankings = async (days = 0) => {
        const placesRef = collection(db, "places");
        const topCommentedSnap = await getDocs(query(placesRef, orderBy("commentsCount", "desc"), limit(5)));
        const searchTermsRef = collection(db, "searchTerms");
        const topSearchedSnap = await getDocs(query(searchTermsRef, orderBy("count", "desc"), limit(50)));

        let commentDocs = topCommentedSnap.docs;
        if (days && days > 0) {
            const expanded = await getDocs(query(placesRef, orderBy("commentsCount", "desc"), limit(80)));
            commentDocs = expanded.docs;
        }

        const topCommented = commentDocs
            .map((docSnap) => {
                const data = docSnap.data() || {};
                const byDay = data.commentsByDay || {};
                const count = days && days > 0 ? sumByDayMap(byDay, days) : Number(data.commentsCount || 0);
                return { placeKey: data.placeKey || "", count };
            })
            .filter((item) => item.placeKey && item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const topSearched = topSearchedSnap.docs
            .map((docSnap) => {
                const data = docSnap.data() || {};
                const byDay = data.countsByDay || {};
                const count = days && days > 0 ? sumByDayMap(byDay, days) : Number(data.count || 0);
                return { term: data.term || "", count };
            })
            .filter((item) => item.term && item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        return {
            topCommented,
            topSearched
        };
    };

    backend.getLocalizedCardContent = async (placeKey, targetLanguage, options = {}) => {
        const safeKey = getSafeKey(placeKey);
        const placeRef = doc(db, "places", safeKey);
        const normalizedTarget = normalizeTargetLanguage(targetLanguage || 'ko');
        const sourceLanguage = normalizeTargetLanguage(options?.sourceLanguage || 'ko');
        const force = Boolean(options?.force);

        const snap = await getDoc(placeRef);
        const data = snap.exists() ? snap.data() : {};
        const fromDoc = data?.cardContent?.[normalizedTarget] || null;
        if (fromDoc && !force) return fromDoc;

        const localizeCardContent = httpsCallable(functions, "localizeCardContent");
        const result = await localizeCardContent({
            placeId: safeKey,
            targetLanguage: normalizedTarget,
            sourceLanguage,
            force
        });

        const localized = result?.data?.cardContent || null;
        if (localized) return localized;

        const refetch = await getDoc(placeRef);
        const refetchData = refetch.exists() ? refetch.data() : {};
        return refetchData?.cardContent?.[normalizedTarget] || refetchData?.cardContent?.ko || null;
    };

    signInAnonymously(auth).catch((error) => {
        console.warn("[feedback] Anonymous auth failed:", error);
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            backend.uid = user.uid;
            backend.ready = true;
            window.dispatchEvent(new CustomEvent("feedback:ready"));
        }
    });
}
