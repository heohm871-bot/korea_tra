// Firebase SDK 라이브러리 가져오기 (CDN 방식 - 별도 설치 불필요)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase 콘솔에서 복사한 설정값 (본인의 것으로 교체 필요)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// [핵심 1] 익명 로그인: 유저가 로그인 창 없이도 바로 서비스 이용 가능
export const initUser = () => {
  signInAnonymously(auth)
    .then(() => {
      console.log("익명 로그인 성공!");
    })
    .catch((error) => console.error("로그인 실패:", error));

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("유저 ID:", user.uid);
      // 로컬 스토리지 대신 Firebase UID를 활용해 데이터 관리 시작
    }
  });
};

// [핵심 2] 샘플 데이터 업로드 함수 (최초 1회 실행용)
export const uploadSampleData = async () => {
  const samplePlaces = [
    {
      id: "seosan-001",
      name: "서산 해미식당",
      category: "Food",
      tags: ["Local", "Old-school"],
      address: "충청남도 서산시 해미면",
      coords: { lat: 36.713, lng: 126.484 },
      desc: "30년 전통의 찐 로컬 어죽 맛집. 에디터 추천: 소면 추가 필수!"
    },
    {
      id: "seosan-002",
      name: "동부시장",
      category: "Shop",
      tags: ["Traditional", "Gift"],
      address: "충청남도 서산시 시장길",
      coords: { lat: 36.784, lng: 126.455 },
      desc: "감태와 뱅어포가 유명한 곳. 외국인 친구 선물 사기 좋음."
    }
  ];

  for (const place of samplePlaces) {
    await setDoc(doc(db, "places", place.id), place);
  }
  alert("샘플 데이터 업로드 완료!");
};

export { db, auth };