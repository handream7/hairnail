// Firebase SDK에서 필요한 함수들을 가져옵니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, setDoc, doc, getDoc, collection, query, where, getDocs, addDoc, onSnapshot, deleteDoc, updateDoc, arrayUnion, arrayRemove, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBL5jshbqUj1jlWtPuBwhmMqMr_zBJ1_pc",
  authDomain: "hairnail-e3b94.firebaseapp.com",
  projectId: "hairnail-e3b94",
  storageBucket: "hairnail-e3b94.firebasestorage.app",
  messagingSenderId: "363779868048",
  appId: "1:363779868048:web:38aa0111d3f8a893739f15",
  measurementId: "G-L1FKMM3L60"
};

// --- Firebase 초기화 ---
let app, db, auth, analytics;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  analytics = getAnalytics(app);
  console.log("Firebase가 성공적으로 연결되었습니다!");
} catch (e) {
  console.error("Firebase 초기화 중 심각한 오류 발생:", e);
}

// --- 전역 상태 / 구독 핸들 ---
let currentUser = null;
let myReservationsUnsubscribe = null;
let storeReservationsUnsubscribe = null;
let storeCategoriesUnsubscribe = null;
let storeTimeSlotsUnsubscribe = null;

// --- 페이지 컨테이너 ---
const mainContainers = {
  login: document.getElementById('login-container'),
  customer: document.getElementById('customer-page-container'),
  store: document.getElementById('store-page-container'),
};
const showPage = (pageName) => {
  Object.values(mainContainers).forEach(c => c.classList.add('hidden'));
  mainContainers[pageName]?.classList.remove('hidden');
};

// --- 인증 상태 변경 (간이 라우터) ---
onAuthStateChanged(auth, async (user) => {
  if (myReservationsUnsubscribe) myReservationsUnsubscribe();
  if (storeReservationsUnsubscribe) storeReservationsUnsubscribe();
  if (storeCategoriesUnsubscribe) storeCategoriesUnsubscribe();
  if (storeTimeSlotsUnsubscribe) storeTimeSlotsUnsubscribe();

  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      currentUser = { uid: user.uid, ...userDocSnap.data() };
      if (currentUser.type === 'customer') {
        showPage('customer');
        initCustomerPage();
      } else if (currentUser.type === 'store') {
        showPage('store');
        initStorePage();
      }
    } else {
      console.warn("인증 OK, DB 사용자 없음 → 강제 로그아웃");
      await signOut(auth);
    }
  } else {
    currentUser = null;
    showPage('login');
  }
});

// --- 로그인/회원가입 요소 ---
const loginIdInput = document.getElementById('login-id');
const loginPasswordInput = document.getElementById('login-password');
const loginStoreBtn = document.getElementById('login-store-btn');
const loginCustomerBtn = document.getElementById('login-customer-btn');
const signupBtn = document.getElementById('signup-btn');
const signupModal = document.getElementById('signup-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const userTypeRadios = document.querySelectorAll('input[name="user-type"]');
const storeFields = document.getElementById('store-fields');
const customerFields = document.getElementById('customer-fields');
const submitSignupBtn = document.getElementById('submit-signup-btn');
const signupForm = document.getElementById('signup-form');

// --- 페이지별 공통 버튼 ---
const logoutBtn = document.getElementById('logout-btn');
const storeLogoutBtn = document.getElementById('store-logout-btn');

// --- 회원가입 모달 열/닫기 ---
const openSignupModal = () => signupModal.classList.remove('hidden');
const closeSignupModal = () => {
  signupModal.classList.add('hidden');
  signupForm.reset();
  storeFields.classList.add('hidden');
  customerFields.classList.add('hidden');
  submitSignupBtn.disabled = true;
};
signupBtn.addEventListener('click', openSignupModal);
closeModalBtn.addEventListener('click', closeSignupModal);
signupModal.addEventListener('click', (e) => e.target === signupModal && closeSignupModal());

// 회원 유형 라디오에 따라 필드 토글
userTypeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const t = e.target.value;
    storeFields.classList.toggle('hidden', t !== 'store');
    customerFields.classList.toggle('hidden', t !== 'customer');
    submitSignupBtn.disabled = false;
  });
});

// 회원가입
submitSignupBtn.addEventListener('click', async () => {
  const userTypeRadio = document.querySelector('input[name="user-type"]:checked');
  if (!userTypeRadio) return alert('회원 유형을 선택해주세요.');
  const type = userTypeRadio.value;

  const email = document.getElementById(`${type}-email`).value;
  const password = document.getElementById(`${type}-password`).value;
  const passwordConfirm = document.getElementById(`${type}-password-confirm`).value;
  const name = document.getElementById(`${type}-name`).value;
  const phone = document.getElementById(`${type}-phone`).value;
  if (!email || !password || !name || !phone) return alert('필수 정보를 모두 입력해주세요.');
  if (password.length < 6) return alert('비밀번호는 6자 이상으로 설정해주세요.');
  if (password !== passwordConfirm) return alert('비밀번호가 일치하지 않습니다.');

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const userData = { email: user.email, name, phone, type };
    if (type === 'store') userData.address = document.getElementById('store-address').value;

    await setDoc(doc(db, "users", user.uid), userData);
    alert('회원가입이 완료되었습니다!');
    closeSignupModal();
  } catch (err) {
    console.error('회원가입 오류:', err);
    if (err.code === 'auth/email-already-in-use') alert('이미 사용 중인 이메일입니다.');
    else alert('회원가입 중 오류가 발생했습니다.');
  }
});

// 로그인/로그아웃
const handleLogin = async (loginType) => {
  const email = loginIdInput.value;
  const password = loginPasswordInput.value;
  if (!email || !password) return alert('아이디와 비밀번호를 입력해주세요.');
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDocRef = doc(db, "users", cred.user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists() || userDocSnap.data().type !== loginType) {
      await signOut(auth);
      alert(`이 계정은 '${loginType}' 유형이 아니거나 사용자 정보가 없습니다.`);
    }
  } catch (err) {
    console.error('로그인 오류:', err);
    alert('아이디 또는 비밀번호가 올바르지 않습니다.');
  }
};
const handleLogout = () => signOut(auth);

loginStoreBtn.addEventListener('click', () => handleLogin('store'));
loginCustomerBtn.addEventListener('click', () => handleLogin('customer'));

// ===================================================================================
// 고객 페이지 로직
// ===================================================================================
const customerElements = {
  userInfo: document.getElementById('user-info'),
  storeSearchInput: document.getElementById('store-search-input'),
  storeSearchResults: document.getElementById('store-search-results'),
  selectedStoreInfo: document.getElementById('selected-store-info'),
  serviceSelection: document.getElementById('service-selection'),
  estimatedTime: document.getElementById('estimated-time'),
  calendarContainer: document.getElementById('calendar-container'),
  timeSlotsContainer: document.getElementById('time-slots-container'),
  reserveBtn: document.getElementById('reserve-btn'),
  myReservationsList: document.getElementById('my-reservations-list'),
};

let customerState = {};
function resetCustomerState() {
  customerState = {
    stores: [],
    selectedStore: null,
    selectedService: null,
    currentDisplayDate: new Date(),
    selectedDate: null,
    selectedTime: null,
  };
}

async function initCustomerPage() {
  resetCustomerForm();
  customerElements.userInfo.textContent = `${currentUser.name}님, 환영합니다.`;

  const qStores = query(collection(db, "users"), where("type", "==", "store"));
  const qs = await getDocs(qStores);
  customerState.stores = qs.docs.map(d => ({ id: d.id, ...d.data() }));

  renderCustomerCalendar();
  listenToMyReservations();

  customerElements.myReservationsList.addEventListener('click', handleReservationListClick);
  customerElements.storeSearchInput.addEventListener('input', handleStoreSearchInput);
  customerElements.serviceSelection.addEventListener('change', handleServiceSelection);
  customerElements.reserveBtn.addEventListener('click', handleReservation);
  logoutBtn.addEventListener('click', handleLogout);
}

function handleStoreSearchInput(e) {
  const term = e.target.value.toLowerCase();
  customerElements.storeSearchResults.innerHTML = '';
  if (term.length > 0) {
    const filtered = customerState.stores.filter(s => s.name.toLowerCase().includes(term));
    filtered.forEach(store => {
      const div = document.createElement('div');
      div.className = 'p-2 hover:bg-gray-100 cursor-pointer';
      div.textContent = store.name;
      div.onclick = () => selectStoreForCustomer(store);
      customerElements.storeSearchResults.appendChild(div);
    });
  }
}

async function selectStoreForCustomer(store) {
  customerState.selectedStore = store;
  customerElements.storeSearchInput.value = store.name;
  customerElements.storeSearchResults.innerHTML = '';

  const encoded = encodeURIComponent(store.address || '');
  const naverMapUrl = `https://map.naver.com/v5/search/${encoded}`;
  const kakaoMapUrl = `https://map.kakao.com/link/search/${encoded}`;

  customerElements.selectedStoreInfo.className = 'p-3 bg-gray-100 rounded-lg flex justify-between items-center';
  customerElements.selectedStoreInfo.innerHTML = `
    <div>
      <p class="font-bold text-gray-800">선택된 매장: ${store.name}</p>
      <p class="text-sm text-gray-600">${store.address || '주소 정보 없음'}</p>
    </div>
    <div class="flex items-center space-x-2">
      <a href="${naverMapUrl}" target="_blank" title="네이버 지도로 보기" class="hover:opacity-75"><img src="https://i.imgur.com/g0mK0cP.png" alt="네이버 지도" class="w-7 h-7"></a>
      <a href="${kakaoMapUrl}" target="_blank" title="카카오맵으로 보기" class="hover:opacity-75"><img src="https://i.imgur.com/L4S432l.png" alt="카카오맵" class="w-7 h-7"></a>
    </div>`;

  // 카테고리/시술 불러오기
  customerElements.serviceSelection.innerHTML = '<p class="text-gray-500 text-sm">시술 목록을 불러오는 중...</p>';
  const catCol = collection(db, "users", store.id, "serviceCategories");
  const catSnap = await getDocs(catCol);

  customerElements.serviceSelection.innerHTML = '';
  if (catSnap.empty) {
    customerElements.serviceSelection.innerHTML = '<p class="text-gray-500 text-sm">등록된 시술이 없습니다.</p>';
    return;
  }

  for (const categoryDoc of catSnap.docs) {
    const category = categoryDoc.data();
    const categoryDiv = document.createElement('div');
    categoryDiv.innerHTML = `<h4 class="font-bold text-md text-indigo-600 mt-3 mb-1">${category.name}</h4>`;

    const servicesCol = collection(db, "users", store.id, "serviceCategories", categoryDoc.id, "services");
    const servicesSnap = await getDocs(servicesCol);

    if (!servicesSnap.empty) {
      servicesSnap.forEach(serviceDoc => {
        const service = { id: serviceDoc.id, ...serviceDoc.data() };
        const label = document.createElement('label');
        label.className = 'flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 cursor-pointer';
        const priceString = service.price ? `${service.price.toLocaleString()}원` : '가격 정보 없음';
        label.innerHTML = `
          <input type="radio" name="service" value="${service.name}" data-duration="${service.duration}" data-price="${service.price || 0}" class="h-4 w-4">
          <span>${service.name} (${service.duration}분) - ${priceString}</span>`;
        categoryDiv.appendChild(label);
      });
      customerElements.serviceSelection.appendChild(categoryDiv);
    }
  }

  if (customerState.selectedDate) await renderCustomerTimeSlots();
}

function handleServiceSelection(e) {
  if (e.target.name === 'service') {
    customerState.selectedService = {
      name: e.target.value,
      duration: parseInt(e.target.dataset.duration, 10),
      price: parseInt(e.target.dataset.price, 10)
    };
    const priceString = customerState.selectedService.price ? `${customerState.selectedService.price.toLocaleString()}원` : '';
    customerElements.estimatedTime.textContent = `예상: ${customerState.selectedService.duration}분 / ${priceString}`;
    highlightCustomerTimeSlots();
    checkCustomerReservationButton();
  }
}

function renderCustomerCalendar() {
  const container = customerElements.calendarContainer;
  container.innerHTML = '';
  const { currentDisplayDate, selectedDate } = customerState;
  const month = currentDisplayDate.getMonth();
  const year = currentDisplayDate.getFullYear();

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-4';
  header.innerHTML = `
    <button id="customer-prev-month-btn" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">&lt;</button>
    <h3 class="text-xl font-bold">${year}년 ${month + 1}월</h3>
    <button id="customer-next-month-btn" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">&gt;</button>`;
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-7 gap-2 text-center';
  ['일','월','화','수','목','금','토'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'font-bold text-sm';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(year, month, 1).getDay();
  for (let i=0;i<firstDay;i++) grid.appendChild(document.createElement('div'));
  const lastDate = new Date(year, month+1, 0).getDate();
  for (let date=1; date<=lastDate; date++) {
    const el = document.createElement('div');
    const full = `${year}-${String(month+1).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
    el.className = 'p-2 cursor-pointer rounded-full hover:bg-blue-100 data-date';
    el.dataset.date = full;
    el.textContent = date;
    if (full === selectedDate) el.classList.add('bg-blue-500','text-white');
    grid.appendChild(el);
  }
  container.appendChild(grid);

  document.getElementById('customer-prev-month-btn').addEventListener('click', () => {
    customerState.currentDisplayDate.setMonth(customerState.currentDisplayDate.getMonth() - 1);
    renderCustomerCalendar();
  });
  document.getElementById('customer-next-month-btn').addEventListener('click', () => {
    customerState.currentDisplayDate.setMonth(customerState.currentDisplayDate.getMonth() + 1);
    renderCustomerCalendar();
  });
  container.querySelectorAll('.data-date').forEach(el => el.addEventListener('click', (e) => selectCustomerDate(e.target.dataset.date)));
}

async function selectCustomerDate(date) {
  customerState.selectedDate = date;
  renderCustomerCalendar();
  await renderCustomerTimeSlots();
  checkCustomerReservationButton();
}

async function renderCustomerTimeSlots() {
  const { selectedStore, selectedDate } = customerState;
  const container = customerElements.timeSlotsContainer;

  if (!selectedStore) { container.innerHTML = '<p class="text-gray-400 col-span-full">매장을 먼저 선택해주세요.</p>'; return; }
  if (!selectedDate) { container.innerHTML = '<p class="text-gray-400 col-span-full">날짜를 선택해주세요.</p>'; return; }

  container.innerHTML = '<p class="text-gray-400 col-span-full">예약 정보를 불러오는 중...</p>';

  const timeDoc = doc(db, "users", selectedStore.id, "timeManagement", selectedDate);
  const timeSnap = await getDoc(timeDoc);
  const timeData = timeSnap.exists() ? timeSnap.data() : { closed: [], duplicated: [] };

  const reservationsByTime = {};
  const q = query(collection(db, "reservations"), where("storeId","==", selectedStore.id), where("date","==", selectedDate));
  const snap = await getDocs(q);
  snap.forEach(d => {
    const r = d.data();
    const slots = r.duration / 15;
    let [h,m] = r.time.split(':').map(Number);
    for (let i=0;i<slots;i++) {
      const key = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      reservationsByTime[key] = (reservationsByTime[key]||0) + 1;
      m += 15; if (m>=60) { m=0; h++; }
    }
  });

  container.innerHTML = '';
  for (let h=9; h<21; h++) {
    for (let m=0; m<60; m+=15) {
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const slot = document.createElement('div');
      const count = reservationsByTime[time] || 0;
      const isClosed = timeData.closed.includes(time);
      const isDuplicated = timeData.duplicated.includes(time);

      if (isClosed) {
        slot.className = 'p-2 border rounded-lg text-center bg-black text-white cursor-not-allowed flex flex-col justify-center items-center h-16';
        slot.innerHTML = `<div class="text-sm">${time}</div><div class="text-xs font-bold">닫힘</div>`;
      } else if (count > 0 && !(isDuplicated && count < 2)) {
        slot.className = 'p-2 border rounded-lg text-center bg-gray-500 text-white cursor-not-allowed flex flex-col justify-center items-center h-16';
        slot.innerHTML = `<div class="text-sm">${time}</div><div class="text-xs font-bold">예약완료</div>`;
      } else {
        slot.className = 'p-2 border rounded-lg text-center cursor-pointer bg-gray-50 hover:bg-gray-200 flex justify-center items-center h-16';
        slot.textContent = time;
        slot.dataset.time = time;
        slot.onclick = () => selectCustomerTime(time);
      }
      container.appendChild(slot);
    }
  }
  highlightCustomerTimeSlots();
}

function selectCustomerTime(time) {
  customerState.selectedTime = time;
  highlightCustomerTimeSlots();
  checkCustomerReservationButton();
}

function highlightCustomerTimeSlots() {
  document.querySelectorAll('#time-slots-container > div').forEach(slot => {
    if (!slot.classList.contains('cursor-not-allowed')) {
      slot.classList.remove('bg-green-300');
      slot.classList.add('bg-gray-50');
    }
  });
  const { selectedTime, selectedService } = customerState;
  if (!selectedTime || !selectedService) return;

  const slots = selectedService.duration / 15;
  let [h,m] = selectedTime.split(':').map(Number);
  for (let i=0;i<slots;i++) {
    const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const el = document.querySelector(`[data-time="${t}"]`);
    if (el) {
      el.classList.remove('bg-gray-50');
      el.classList.add('bg-green-300');
    }
    m += 15; if (m>=60) { m=0; h++; }
  }
}

function checkCustomerReservationButton() {
  const { selectedStore, selectedService, selectedDate, selectedTime } = customerState;
  customerElements.reserveBtn.disabled = !(selectedStore && selectedService && selectedDate && selectedTime);
}

async function handleReservation() {
  const { selectedStore, selectedService, selectedDate, selectedTime } = customerState;
  const reservationData = {
    customerId: currentUser.uid,
    customerName: currentUser.name,
    storeId: selectedStore.id,
    storeName: selectedStore.name,
    service: selectedService.name,
    duration: selectedService.duration,
    price: selectedService.price,
    date: selectedDate,
    time: selectedTime,
    createdAt: new Date()
  };
  try {
    await addDoc(collection(db, "reservations"), reservationData);
    alert("예약이 완료되었습니다!");
    resetCustomerForm();
  } catch (err) {
    console.error("예약 저장 오류:", err);
    alert("예약 중 오류가 발생했습니다.");
  }
}

function resetCustomerForm() {
  customerElements.storeSearchInput.value = '';
  customerElements.selectedStoreInfo.innerHTML = '';
  customerElements.selectedStoreInfo.classList.add('hidden');
  customerElements.serviceSelection.innerHTML = '<p class="text-gray-500 text-sm">매장을 먼저 선택해주세요.</p>';
  customerElements.estimatedTime.textContent = '';
  customerElements.timeSlotsContainer.innerHTML = '<p class="text-gray-400 col-span-full">날짜를 선택해주세요.</p>';
  customerElements.reserveBtn.disabled = true;
  resetCustomerState();
  renderCustomerCalendar();
}

function listenToMyReservations() {
  if (myReservationsUnsubscribe) myReservationsUnsubscribe();
  const q = query(collection(db, "reservations"), where("customerId","==", currentUser.uid));
  myReservationsUnsubscribe = onSnapshot(q, (snapshot) => {
    customerElements.myReservationsList.innerHTML = '';
    if (snapshot.empty) {
      customerElements.myReservationsList.innerHTML = '<p class="text-gray-500">예약 내역이 없습니다.</p>';
      return;
    }
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a,b) => b.createdAt.toDate() - a.createdAt.toDate());

    list.forEach(res => {
      const li = document.createElement('div');
      li.className = 'p-3 bg-blue-50 rounded-lg flex justify-between items-center';
      const priceString = res.price ? `${res.price.toLocaleString()}원` : '가격 정보 없음';
      li.innerHTML = `
        <div>
          <p class="font-bold">${res.storeName} - ${res.service}</p>
          <p class="text-sm text-gray-600">${res.date} ${res.time}</p>
          <p class="text-sm text-gray-500 mt-1">소요시간: ${res.duration}분 / ${priceString}</p>
        </div>
        <button data-id="${res.id}" data-date="${res.date}" class="cancel-btn bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm hover:bg-red-200 self-start">취소</button>`;
      customerElements.myReservationsList.appendChild(li);
    });
  });
}

function handleReservationListClick(e) {
  if (e.target.classList.contains('cancel-btn')) {
    promptCancelReservation(e.target.dataset.id, e.target.dataset.date);
  }
}

// (KST 등 로컬 기준 비교 안전화) 취소 가능일 체크 개선
function parseLocalYmd(dateStr) {
  const [Y,M,D] = dateStr.split('-').map(Number);
  return new Date(Y, M-1, D); // 로컬 자정
}
async function promptCancelReservation(id, dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = parseLocalYmd(dateStr);
  if (today >= target) return alert("당일 예약취소는 불가합니다.");
  if (confirm("예약을 취소하시겠습니까?\n예약 전날까지만 취소가 가능합니다.")) {
    try {
      await deleteDoc(doc(db, "reservations", id));
      alert("예약이 성공적으로 취소되었습니다.");
    } catch (err) {
      console.error("예약 취소 오류:", err);
      alert("예약 취소 중 오류가 발생했습니다.");
    }
  }
}

// ===================================================================================
// 매장 관리자 페이지 로직
// ===================================================================================
const storeElements = {
  userInfo: document.getElementById('store-user-info'),
  serviceSettingBtn: document.getElementById('service-setting-btn'),
  reservationList: document.getElementById('store-reservation-list'),
  calendarContainer: document.getElementById('store-calendar-container'),
  timeSlotsContainer: document.getElementById('store-time-slots-container'),
  slotActions: document.getElementById('store-slot-actions'),
  closeTimeBtn: document.getElementById('close-time-btn'),
  openDuplicateBtn: document.getElementById('open-duplicate-btn'),
  openTimeBtn: document.getElementById('open-time-btn'),
};

const serviceModalElements = {
  modal: document.getElementById('service-settings-modal'),
  closeBtn: document.getElementById('close-service-modal-btn'),
  list: document.getElementById('service-categories-list'),
  categoryNameInput: document.getElementById('new-category-name'),
  addCategoryBtn: document.getElementById('add-category-btn'),
};

let storeState = {};
function resetStoreState() {
  storeState = {
    currentDisplayDate: new Date(),
    selectedDate: null,
    selectedSlots: new Set(),
    reservations: [],
  };
}

function initStorePage() {
  resetStoreState();
  storeElements.userInfo.textContent = `[${currentUser.name}]으로 로그인하셨습니다.`;
  renderStoreCalendar();

  storeElements.serviceSettingBtn.addEventListener('click', openServiceSettingsModal);
  serviceModalElements.closeBtn.addEventListener('click', closeServiceSettingsModal);
  serviceModalElements.modal.addEventListener('click', (e) => e.target === serviceModalElements.modal && closeServiceSettingsModal());
  serviceModalElements.addCategoryBtn.addEventListener('click', addCategory);
  serviceModalElements.list.addEventListener('click', handleServiceListClick);

  storeElements.timeSlotsContainer.addEventListener('click', handleStoreSlotClick);
  storeElements.closeTimeBtn.addEventListener('click', () => handleTimeManagement('closed'));
  storeElements.openDuplicateBtn.addEventListener('click', () => handleTimeManagement('duplicated'));
  storeElements.openTimeBtn.addEventListener('click', () => handleTimeManagement('open'));
  storeLogoutBtn.addEventListener('click', handleLogout);
}

function openServiceSettingsModal() {
  serviceModalElements.modal.classList.remove('hidden');
  listenToStoreCategories();
}
function closeServiceSettingsModal() {
  serviceModalElements.modal.classList.add('hidden');
  if (storeCategoriesUnsubscribe) storeCategoriesUnsubscribe();
}

function listenToStoreCategories() {
  const col = collection(db, "users", currentUser.uid, "serviceCategories");
  storeCategoriesUnsubscribe = onSnapshot(col, (snapshot) => {
    serviceModalElements.list.innerHTML = '';
    if (snapshot.empty) {
      serviceModalElements.list.innerHTML = '<p class="text-gray-500">등록된 카테고리가 없습니다. 먼저 카테고리를 추가해주세요.</p>';
      return;
    }
    snapshot.docs.forEach(async (categoryDoc) => {
      const category = { id: categoryDoc.id, ...categoryDoc.data() };
      const wrap = document.createElement('div');
      wrap.className = 'p-4 border rounded-lg';
      wrap.dataset.categoryId = category.id;
      wrap.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <h4 class="text-lg font-bold text-indigo-700">${category.name}</h4>
          <button data-action="delete-category" class="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200">카테고리 삭제</button>
        </div>
        <div class="services-list space-y-2 mb-4"></div>
        <div class="add-service-form flex flex-wrap gap-2 p-3 bg-gray-50 rounded">
          <input type="text" placeholder="시술명" class="flex-grow p-2 border rounded text-sm w-full sm:w-auto">
          <input type="number" placeholder="가격(원)" class="p-2 border rounded text-sm w-full sm:w-auto" style="max-width: 100px;">
          <select class="p-2 border rounded text-sm w-full sm:w-auto" style="max-width: 120px;">
            <option value="">소요 시간</option>
            ${[15,30,45,60,75,90,105,120,135,150,165,180].map(t => `<option value="${t}">${t}분</option>`).join('')}
          </select>
          <button data-action="add-service" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm w-full sm:w-auto">시술 추가</button>
        </div>`;

      serviceModalElements.list.appendChild(wrap);

      const servicesListDiv = wrap.querySelector('.services-list');
      const servicesCol = collection(db, "users", currentUser.uid, "serviceCategories", category.id, "services");
      onSnapshot(servicesCol, (servicesSnap) => {
        servicesListDiv.innerHTML = '';
        if (servicesSnap.empty) {
          servicesListDiv.innerHTML = '<p class="text-xs text-gray-500">등록된 시술이 없습니다.</p>';
        } else {
          servicesSnap.forEach(serviceDoc => {
            const service = { id: serviceDoc.id, ...serviceDoc.data() };
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 bg-gray-100 rounded text-sm';
            row.dataset.serviceId = service.id;
            row.innerHTML = `
              <span>${service.name} (${service.duration}분) - ${service.price.toLocaleString()}원</span>
              <button data-action="delete-service" class="text-red-500 hover:text-red-700 font-bold text-xl">&times;</button>`;
            servicesListDiv.appendChild(row);
          });
        }
      });
    });
  });
}

async function addCategory() {
  const name = serviceModalElements.categoryNameInput.value.trim();
  if (!name) return alert('카테고리명을 입력해주세요.');
  try {
    await addDoc(collection(db, "users", currentUser.uid, "serviceCategories"), { name });
    serviceModalElements.categoryNameInput.value = '';
  } catch (err) {
    console.error('카테고리 추가 오류:', err);
    alert('카테고리 추가 중 오류가 발생했습니다.');
  }
}

async function handleServiceListClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const categoryWrap = btn.closest('[data-category-id]');
  const categoryId = categoryWrap?.dataset.categoryId;

  if (action === 'add-service') {
    if (!categoryId) return;
    const form = btn.closest('.add-service-form');
    const name = form.querySelector('input[type="text"]').value.trim();
    const price = parseInt(form.querySelector('input[type="number"]').value, 10);
    const duration = parseInt(form.querySelector('select').value, 10);
    if (!name || !price || !duration) return alert('시술명, 가격, 소요 시간을 모두 입력해주세요.');

    try {
      await addDoc(collection(db, "users", currentUser.uid, "serviceCategories", categoryId, "services"), { name, price, duration });
      form.querySelector('input[type="text"]').value = '';
      form.querySelector('input[type="number"]').value = '';
      form.querySelector('select').value = '';
    } catch (err) {
      console.error("시술 추가 오류:", err);
      alert('시술 추가 중 오류가 발생했습니다.');
    }
  } else if (action === 'delete-service') {
    const row = btn.closest('[data-service-id]');
    const serviceId = row?.dataset.serviceId;
    if (!categoryId || !serviceId) return;

    if (confirm('이 시술을 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "serviceCategories", categoryId, "services", serviceId));
      } catch (err) {
        console.error("시술 삭제 오류:", err);
        alert('시술 삭제 중 오류가 발생했습니다.');
      }
    }
  } else if (action === 'delete-category') {
    if (!categoryId) return;
    if (confirm('이 카테고리를 삭제하시겠습니까?\n카테고리에 포함된 모든 시술 정보가 함께 삭제되며, 복구할 수 없습니다.')) {
      try {
        const servicesCol = collection(db, "users", currentUser.uid, "serviceCategories", categoryId, "services");
        const servicesSnap = await getDocs(servicesCol);
        const batch = writeBatch(db);
        servicesSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        await deleteDoc(doc(db, "users", currentUser.uid, "serviceCategories", categoryId));
      } catch (err) {
        console.error("카테고리 삭제 오류:", err);
        alert('카테고리 삭제 중 오류가 발생했습니다.');
      }
    }
  }
}

function renderStoreCalendar() {
  const container = storeElements.calendarContainer;
  container.innerHTML = '';
  const { currentDisplayDate, selectedDate } = storeState;
  const m = currentDisplayDate.getMonth();
  const y = currentDisplayDate.getFullYear();

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-4';
  header.innerHTML = `
    <button id="store-prev-month-btn" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">&lt;</button>
    <h3 class="text-xl font-bold">${y}년 ${m+1}월</h3>
    <button id="store-next-month-btn" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">&gt;</button>`;
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-7 gap-2 text-center';
  ['일','월','화','수','목','금','토'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'font-bold text-sm';
    el.textContent = d;
    grid.appendChild(el);
  });

  const first = new Date(y, m, 1).getDay();
  for (let i=0;i<first;i++) grid.appendChild(document.createElement('div'));
  const last = new Date(y, m+1, 0).getDate();
  for (let date=1; date<=last; date++) {
    const el = document.createElement('div');
    const full = `${y}-${String(m+1).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
    el.className = 'p-2 cursor-pointer rounded-full hover:bg-indigo-100 data-date';
    el.dataset.date = full;
    el.textContent = date;
    if (full === selectedDate) el.classList.add('bg-indigo-500','text-white');
    grid.appendChild(el);
  }
  container.appendChild(grid);

  document.getElementById('store-prev-month-btn').addEventListener('click', () => {
    storeState.currentDisplayDate.setMonth(storeState.currentDisplayDate.getMonth() - 1);
    renderStoreCalendar();
  });
  document.getElementById('store-next-month-btn').addEventListener('click', () => {
    storeState.currentDisplayDate.setMonth(storeState.currentDisplayDate.getMonth() + 1);
    renderStoreCalendar();
  });
  container.querySelectorAll('.data-date').forEach(el => el.addEventListener('click', (e) => selectStoreDate(e.target.dataset.date)));
}

async function selectStoreDate(date) {
  storeState.selectedDate = date;
  storeState.selectedSlots.clear();
  updateSlotActionButtons();
  renderStoreCalendar();
  listenToReservationsForDate(date);
}

function listenToReservationsForDate(date) {
  storeElements.reservationList.innerHTML = '<p class="text-gray-500">예약 내역을 불러오는 중...</p>';
  if (storeReservationsUnsubscribe) storeReservationsUnsubscribe();
  const q = query(collection(db, "reservations"), where("storeId","==", currentUser.uid), where("date","==", date));
  storeReservationsUnsubscribe = onSnapshot(q, (snapshot) => {
    const reservations = snapshot.docs.map(d => d.data());
    storeState.reservations = reservations;

    storeElements.reservationList.innerHTML = '';
    if (reservations.length === 0) {
      storeElements.reservationList.innerHTML = '<p class="text-gray-500">해당 날짜에 예약이 없습니다.</p>';
    } else {
      reservations.sort((a,b) => a.time.localeCompare(b.time));
      reservations.forEach(res => {
        const div = document.createElement('div');
        div.className = 'p-3 bg-blue-50 rounded-lg';
        const priceString = res.price ? `${res.price.toLocaleString()}원` : '';
        div.innerHTML = `<p class="font-bold">${res.time} - ${res.customerName}님</p><p class="text-sm text-gray-600">${res.service} (${res.duration}분) / ${priceString}</p>`;
        storeElements.reservationList.appendChild(div);
      });
    }
    renderStoreTimeSlots(date);
  });
}

async function renderStoreTimeSlots(date) {
  if (!date) {
    storeElements.timeSlotsContainer.innerHTML = '<p class="text-gray-400 col-span-full">달력에서 날짜를 선택해주세요.</p>';
    return;
  }
  const timeDoc = doc(db, "users", currentUser.uid, "timeManagement", date);
  const timeSnap = await getDoc(timeDoc);
  const timeData = timeSnap.exists() ? timeSnap.data() : { closed: [], duplicated: [] };

  const cont = storeElements.timeSlotsContainer;
  cont.innerHTML = '';

  const byTime = {};
  storeState.reservations.forEach(r => {
    const slots = r.duration / 15;
    let [h,m] = r.time.split(':').map(Number);
    for (let i=0;i<slots;i++) {
      const key = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      byTime[key] = (byTime[key]||0) + 1;
      m += 15; if (m>=60) { m=0; h++; }
    }
  });

  for (let h=9; h<21; h++) {
    for (let m=0; m<60; m+=15) {
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const slot = document.createElement('div');
      slot.dataset.time = time;

      const count = byTime[time] || 0;
      const isClosed = timeData.closed?.includes(time);
      const isDuplicated = timeData.duplicated?.includes(time);

      let cls = 'p-2 border rounded-lg text-center cursor-pointer flex flex-col justify-center items-center h-16';
      let html = `<div class="text-sm">${time}</div>`;

      if (isClosed) {
        cls += ' bg-black text-white';
        html += `<div class="text-xs font-bold">닫힘</div>`;
      } else if (isDuplicated) {
        cls += (count >= 2) ? ' bg-purple-500 text-white' : ' bg-green-200';
        html += `<div class="text-xs font-bold">중복(${count}/2)</div>`;
      } else if (count > 0) {
        cls += ' bg-blue-500 text-white';
        html += `<div class="text-xs font-bold">예약완료</div>`;
      } else {
        cls += ' bg-gray-50 hover:bg-gray-200';
      }

      slot.className = cls;
      slot.innerHTML = html;
      if (storeState.selectedSlots.has(time)) slot.classList.add('selected-slot');
      cont.appendChild(slot);
    }
  }
}

function handleStoreSlotClick(e) {
  const slot = e.target.closest('[data-time]');
  if (!slot) return;
  const time = slot.dataset.time;

  if (storeState.selectedSlots.has(time)) {
    storeState.selectedSlots.delete(time);
    slot.classList.remove('selected-slot');
  } else {
    storeState.selectedSlots.add(time);
    slot.classList.add('selected-slot');
  }
  updateSlotActionButtons();
}

function updateSlotActionButtons() {
  storeElements.slotActions.classList.toggle('hidden', storeState.selectedSlots.size === 0);
}

async function handleTimeManagement(type) {
  if (storeState.selectedSlots.size === 0) return alert("시간을 먼저 선택해주세요.");
  const date = storeState.selectedDate;
  if (!date) return;

  const timeDoc = doc(db, "users", currentUser.uid, "timeManagement", date);
  const selected = Array.from(storeState.selectedSlots);

  try {
    const payload = {};
    if (type === 'closed') {
      if (!confirm("선택된 시간을 '닫힘' 처리하시겠습니까?")) return;
      payload.closed = arrayUnion(...selected);
      payload.duplicated = arrayRemove(...selected);
    } else if (type === 'duplicated') {
      if (!confirm("선택된 시간에 중복 예약을 허용하시겠습니까?")) return;
      payload.duplicated = arrayUnion(...selected);
      payload.closed = arrayRemove(...selected);
    } else if (type === 'open') {
      if (!confirm("선택된 시간을 기본 상태로 되돌리시겠습니까?")) return;
      payload.closed = arrayRemove(...selected);
      payload.duplicated = arrayRemove(...selected);
    }

    await setDoc(timeDoc, payload, { merge: true });
    storeState.selectedSlots.clear();
    updateSlotActionButtons();
    await renderStoreTimeSlots(date);
  } catch (err) {
    console.error("시간 관리 오류:", err);
    alert("시간을 변경하는 중 오류가 발생했습니다.");
  }
}
