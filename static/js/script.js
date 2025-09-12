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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);
console.log("Firebase가 성공적으로 연결되었습니다!");

// --- 전역 상태 변수 ---
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
    Object.values(mainContainers).forEach(container => container.classList.add('hidden'));
    mainContainers[pageName]?.classList.remove('hidden');
};

// --- 인증 상태 변경 리스너 (앱의 라우터 역할) ---
onAuthStateChanged(auth, async (user) => {
    // 모든 실시간 리스너 정리
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
            console.log("사용자 DB정보가 없어 로그아웃합니다.");
            await signOut(auth);
        }
    } else {
        currentUser = null;
        showPage('login');
    }
});


// --- 로그인 / 회원가입 로직 ---
const loginIdInput = document.getElementById('login-id');
const loginPasswordInput = document.getElementById('login-password');
const loginStoreBtn = document.getElementById('login-store-btn');
const loginCustomerBtn = document.getElementById('login-customer-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const storeLogoutBtn = document.getElementById('store-logout-btn');
const signupModal = document.getElementById('signup-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const userTypeRadios = document.querySelectorAll('input[name="user-type"]');
const storeFields = document.getElementById('store-fields');
const customerFields = document.getElementById('customer-fields');
const submitSignupBtn = document.getElementById('submit-signup-btn');
const signupForm = document.getElementById('signup-form');

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

userTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const userType = e.target.value;
        storeFields.classList.toggle('hidden', userType !== 'store');
        customerFields.classList.toggle('hidden', userType !== 'customer');
        submitSignupBtn.disabled = false;
    });
});

submitSignupBtn.addEventListener('click', async () => {
    const userTypeRadio = document.querySelector('input[name="user-type"]:checked');
    if (!userTypeRadio) return alert('회원 유형을 선택해주세요.');
    const userType = userTypeRadio.value;
    const email = document.getElementById(`${userType}-email`).value;
    const password = document.getElementById(`${userType}-password`).value;
    const passwordConfirm = document.getElementById(`${userType}-password-confirm`).value;
    const name = document.getElementById(`${userType}-name`).value;
    const phone = document.getElementById(`${userType}-phone`).value;
    if (!email || !password || !name || !phone) return alert('필수 정보를 모두 입력해주세요.');
    if (password.length < 6) return alert('비밀번호는 6자 이상으로 설정해주세요.');
    if (password !== passwordConfirm) return alert('비밀번호가 일치하지 않습니다.');
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        let userData = { email: user.email, name, phone, type: userType };
        if (userType === 'store') {
            userData.address = document.getElementById('store-address').value;
        }
        await setDoc(doc(db, "users", user.uid), userData);
        alert('회원가입이 완료되었습니다!');
        closeSignupModal();
    } catch (error) {
        console.error("회원가입 오류: ", error);
        if (error.code === 'auth/email-already-in-use') alert('이미 사용 중인 이메일입니다.');
        else alert('회원가입 중 오류가 발생했습니다.');
    }
});

const handleLogin = async (loginType) => {
    const email = loginIdInput.value;
    const password = loginPasswordInput.value;
    if (!email || !password) return alert('아이디와 비밀번호를 입력해주세요.');
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDocRef = doc(db, "users", userCredential.user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists() || userDocSnap.data().type !== loginType) {
            await signOut(auth);
            alert(`이 계정은 '${loginType}' 유형이 아니거나 사용자 정보가 없습니다.`);
        }
    } catch (error) {
        console.error("로그인 오류: ", error);
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
    const q = query(collection(db, "users"), where("type", "==", "store"));
    const querySnapshot = await getDocs(q);
    customerState.stores = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderCustomerCalendar();
    listenToMyReservations();
    customerElements.myReservationsList.addEventListener('click', handleReservationListClick);
    customerElements.storeSearchInput.addEventListener('input', handleStoreSearchInput);
    customerElements.serviceSelection.addEventListener('change', handleServiceSelection);
    customerElements.reserveBtn.addEventListener('click', handleReservation);
    logoutBtn.addEventListener('click', handleLogout); // 이 줄 추가
}

function handleStoreSearchInput(e) {
    const searchTerm = e.target.value.toLowerCase();
    customerElements.storeSearchResults.innerHTML = '';
    if (searchTerm.length > 0) {
        const filteredStores = customerState.stores.filter(store => store.name.toLowerCase().includes(searchTerm));
        filteredStores.forEach(store => {
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

    const encodedAddress = encodeURIComponent(store.address);
    const naverMapUrl = `https://map.naver.com/v5/search/${encodedAddress}`;
    const kakaoMapUrl = `https://map.kakao.com/link/search/${encodedAddress}`;

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

    customerElements.serviceSelection.innerHTML = '<p class="text-gray-500 text-sm">시술 목록을 불러오는 중...</p>';
    const categoriesColRef = collection(db, "users", store.id, "serviceCategories");
    const categoriesSnapshot = await getDocs(categoriesColRef);
    
    customerElements.serviceSelection.innerHTML = '';
    if (categoriesSnapshot.empty) {
        customerElements.serviceSelection.innerHTML = '<p class="text-gray-500 text-sm">등록된 시술이 없습니다.</p>';
        return;
    }

    for (const categoryDoc of categoriesSnapshot.docs) {
        const category = categoryDoc.data();
        const categoryDiv = document.createElement('div');
        categoryDiv.innerHTML = `<h4 class="font-bold text-md text-indigo-600 mt-3 mb-1">${category.name}</h4>`;
        
        const servicesColRef = collection(db, "users", store.id, "serviceCategories", categoryDoc.id, "services");
        const servicesSnapshot = await getDocs(servicesColRef);

        if (!servicesSnapshot.empty) {
            servicesSnapshot.forEach(serviceDoc => {
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

    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'grid grid-cols-7 gap-2 text-center';
    ['일', '월', '화', '수', '목', '금', '토'].forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'font-bold text-sm';
        dayEl.textContent = day;
        calendarGrid.appendChild(dayEl);
    });

    const firstDay = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) calendarGrid.appendChild(document.createElement('div'));

    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let date = 1; date <= lastDate; date++) {
        const dateEl = document.createElement('div');
        const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        dateEl.className = 'p-2 cursor-pointer rounded-full hover:bg-blue-100 data-date';
        dateEl.dataset.date = fullDate;
        dateEl.textContent = date;
        if (fullDate === selectedDate) dateEl.classList.add('bg-blue-500', 'text-white');
        calendarGrid.appendChild(dateEl);
    }
    container.appendChild(calendarGrid);

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

    if (!selectedStore) return container.innerHTML = '<p class="text-gray-400 col-span-full">매장을 먼저 선택해주세요.</p>';
    if (!selectedDate) return container.innerHTML = '<p class="text-gray-400 col-span-full">날짜를 선택해주세요.</p>';
    
    container.innerHTML = '<p class="text-gray-400 col-span-full">예약 정보를 불러오는 중...</p>';
    
    const timeManagementDocRef = doc(db, "users", selectedStore.id, "timeManagement", selectedDate);
    const timeManagementSnap = await getDoc(timeManagementDocRef);
    const timeManagementData = timeManagementSnap.exists() ? timeManagementSnap.data() : { closed: [], duplicated: [] };

    const reservationsByTime = {};
    const q = query(collection(db, "reservations"), where("storeId", "==", selectedStore.id), where("date", "==", selectedDate));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(doc => {
        const res = doc.data();
        const slotsToBook = res.duration / 15;
        let [h, m] = res.time.split(':').map(Number);
        for (let i = 0; i < slotsToBook; i++) {
            const timeKey = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            if (!reservationsByTime[timeKey]) {
                reservationsByTime[timeKey] = 0;
            }
            reservationsByTime[timeKey]++;
            m += 15;
            if (m >= 60) { m = 0; h++; }
        }
    });

    container.innerHTML = '';
    for (let h = 9; h < 21; h++) {
        for (let m = 0; m < 60; m += 15) {
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const slot = document.createElement('div');
            const reservationCount = reservationsByTime[time] || 0;
            const isClosed = timeManagementData.closed.includes(time);
            const isDuplicated = timeManagementData.duplicated.includes(time);

            if (isClosed) {
                 slot.className = 'p-2 border rounded-lg text-center bg-black text-white cursor-not-allowed flex flex-col justify-center items-center h-16';
                 slot.innerHTML = `<div class="text-sm">${time}</div><div class="text-xs font-bold">닫힘</div>`;
            } else if (reservationCount > 0 && !(isDuplicated && reservationCount < 2)) {
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

    const slotsToSelect = selectedService.duration / 15;
    let [h, m] = selectedTime.split(':').map(Number);
    for (let i = 0; i < slotsToSelect; i++) {
        const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const slotToHighlight = document.querySelector(`[data-time="${timeString}"]`);
        if (slotToHighlight) {
            slotToHighlight.classList.remove('bg-gray-50');
            slotToHighlight.classList.add('bg-green-300');
        }
        m += 15;
        if (m >= 60) { m = 0; h++; }
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
    } catch (error) {
        console.error("예약 저장 오류:", error);
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
    const q = query(collection(db, "reservations"), where("customerId", "==", currentUser.uid));
    myReservationsUnsubscribe = onSnapshot(q, (snapshot) => {
        customerElements.myReservationsList.innerHTML = '';
        if (snapshot.empty) {
            customerElements.myReservationsList.innerHTML = '<p class="text-gray-500">예약 내역이 없습니다.</p>';
            return;
        }
        
        const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reservations.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
        
        reservations.forEach(res => {
            const li = document.createElement('div');
            li.className = 'p-3 bg-blue-50 rounded-lg flex justify-between items-center';

            // 가격 정보가 있을 경우 포맷팅, 없으면 '정보 없음' 표시
            const priceString = res.price ? `${res.price.toLocaleString()}원` : '가격 정보 없음';
            
            // ★★★★★★★★★★★★★ 소요 시간, 가격 정보 표시 추가 ★★★★★★★★★★★★★
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

async function promptCancelReservation(id, dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today >= new Date(dateStr)) return alert("당일 예약취소는 불가합니다.");
    if (confirm("예약을 취소하시겠습니까?\n예약 전날까지만 취소가 가능합니다.")) {
        try {
            await deleteDoc(doc(db, "reservations", id));
            alert("예약이 성공적으로 취소되었습니다.");
        } catch (error) {
            console.error("예약 취소 오류:", error);
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
    storeLogoutBtn.addEventListener('click', handleLogout); // 이 줄 추가
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
    const categoriesColRef = collection(db, "users", currentUser.uid, "serviceCategories");
    storeCategoriesUnsubscribe = onSnapshot(categoriesColRef, (snapshot) => {
        serviceModalElements.list.innerHTML = '';
        if (snapshot.empty) {
            serviceModalElements.list.innerHTML = '<p class="text-gray-500">등록된 카테고리가 없습니다. 먼저 카테고리를 추가해주세요.</p>';
            return;
        }
        snapshot.docs.forEach(async (categoryDoc) => {
            const category = { id: categoryDoc.id, ...categoryDoc.data() };
            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'p-4 border rounded-lg';
            categoryContainer.dataset.categoryId = category.id;
            categoryContainer.innerHTML = `
                <div class="flex justify-between items-center mb-3">
                    <h4 class="text-lg font-bold text-indigo-700">${category.name}</h4>
                    <button data-action="delete-category" class="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200">카테고리 삭제</button>
                </div>
                <div class="services-list space-y-2 mb-4">
                    </div>
                <div class="add-service-form flex flex-wrap gap-2 p-3 bg-gray-50 rounded">
                    <input type="text" placeholder="시술명" class="flex-grow p-2 border rounded text-sm w-full sm:w-auto">
                    <input type="number" placeholder="가격(원)" class="p-2 border rounded text-sm w-full sm:w-auto" style="max-width: 100px;">
                    <select class="p-2 border rounded text-sm w-full sm:w-auto" style="max-width: 120px;">
                        <option value="">소요 시간</option>
                        ${[15,30,45,60,75,90,105,120,135,150,165,180].map(t => `<option value="${t}">${t}분</option>`).join('')}
                    </select>
                    <button data-action="add-service" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm w-full sm:w-auto">시술 추가</button>
                </div>
            `;
            serviceModalElements.list.appendChild(categoryContainer);
            
            const servicesListDiv = categoryContainer.querySelector('.services-list');
            const servicesColRef = collection(db, "users", currentUser.uid, "serviceCategories", category.id, "services");
            onSnapshot(servicesColRef, (servicesSnapshot) => {
                servicesListDiv.innerHTML = '';
                if(servicesSnapshot.empty) {
                    servicesListDiv.innerHTML = '<p class="text-xs text-gray-500">등록된 시술이 없습니다.</p>';
                } else {
                    servicesSnapshot.forEach(serviceDoc => {
                        const service = { id: serviceDoc.id, ...serviceDoc.data() };
                        const serviceDiv = document.createElement('div');
                        serviceDiv.className = 'flex justify-between items-center p-2 bg-gray-100 rounded text-sm';
                        serviceDiv.dataset.serviceId = service.id;
                        serviceDiv.innerHTML = `
                            <span>${service.name} (${service.duration}분) - ${service.price.toLocaleString()}원</span>
                            <button data-action="delete-service" class="text-red-500 hover:text-red-700 font-bold text-xl">&times;</button>
                        `;
                        servicesListDiv.appendChild(serviceDiv);
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
    } catch (error) {
        console.error("카테고리 추가 오류: ", error);
        alert('카테고리 추가 중 오류가 발생했습니다.');
    }
}

async function handleServiceListClick(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    const categoryContainer = button.closest('[data-category-id]');
    const categoryId = categoryContainer?.dataset.categoryId;

    if (action === 'add-service') {
        if (!categoryId) return;
        const form = button.closest('.add-service-form');
        const name = form.querySelector('input[type="text"]').value.trim();
        const price = parseInt(form.querySelector('input[type="number"]').value, 10);
        const duration = parseInt(form.querySelector('select').value, 10);

        if (!name || !price || !duration) return alert('시술명, 가격, 소요 시간을 모두 입력해주세요.');

        try {
            await addDoc(collection(db, "users", currentUser.uid, "serviceCategories", categoryId, "services"), { name, price, duration });
            form.querySelector('input[type="text"]').value = '';
            form.querySelector('input[type="number"]').value = '';
            form.querySelector('select').value = '';
        } catch (error) {
            console.error("시술 추가 오류: ", error);
            alert('시술 추가 중 오류가 발생했습니다.');
        }
    } else if (action === 'delete-service') {
        const serviceDiv = button.closest('[data-service-id]');
        const serviceId = serviceDiv.dataset.serviceId;
        if (!categoryId || !serviceId) return;

        if (confirm('이 시술을 삭제하시겠습니까?')) {
            try {
                await deleteDoc(doc(db, "users", currentUser.uid, "serviceCategories", categoryId, "services", serviceId));
            } catch (error) {
                console.error("시술 삭제 오류: ", error);
                alert('시술 삭제 중 오류가 발생했습니다.');
            }
        }
    } else if (action === 'delete-category') {
        if (!categoryId) return;
        if (confirm('이 카테고리를 삭제하시겠습니까?\n카테고리에 포함된 모든 시술 정보가 함께 삭제되며, 복구할 수 없습니다.')) {
            try {
                const servicesColRef = collection(db, "users", currentUser.uid, "serviceCategories", categoryId, "services");
                const servicesSnapshot = await getDocs(servicesColRef);
                const batch = writeBatch(db);
                servicesSnapshot.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                await deleteDoc(doc(db, "users", currentUser.uid, "serviceCategories", categoryId));
            } catch (error) {
                console.error("카테고리 삭제 오류: ", error);
                alert('카테고리 삭제 중 오류가 발생했습니다.');
            }
        }
    }
}

function renderStoreCalendar() {
    const container = storeElements.calendarContainer;
    container.innerHTML = '';
    const { currentDisplayDate, selectedDate } = storeState;
    const month = currentDisplayDate.getMonth();
    const year = currentDisplayDate.getFullYear();
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4';
    header.innerHTML = `
        <button id="store-prev-month-btn" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">&lt;</button>
        <h3 class="text-xl font-bold">${year}년 ${month + 1}월</h3>
        <button id="store-next-month-btn" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">&gt;</button>`;
    container.appendChild(header);
    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'grid grid-cols-7 gap-2 text-center';
    ['일', '월', '화', '수', '목', '금', '토'].forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'font-bold text-sm';
        dayEl.textContent = day;
        calendarGrid.appendChild(dayEl);
    });
    const firstDay = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) calendarGrid.appendChild(document.createElement('div'));
    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let date = 1; date <= lastDate; date++) {
        const dateEl = document.createElement('div');
        const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        dateEl.className = 'p-2 cursor-pointer rounded-full hover:bg-indigo-100 data-date';
        dateEl.dataset.date = fullDate;
        dateEl.textContent = date;
        if (fullDate === selectedDate) dateEl.classList.add('bg-indigo-500', 'text-white');
        calendarGrid.appendChild(dateEl);
    }
    container.appendChild(calendarGrid);
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
    const q = query(collection(db, "reservations"), where("storeId", "==", currentUser.uid), where("date", "==", date));
    storeReservationsUnsubscribe = onSnapshot(q, (snapshot) => {
        const reservations = snapshot.docs.map(doc => doc.data());
        storeState.reservations = reservations;
        
        storeElements.reservationList.innerHTML = '';
        if (reservations.length === 0) {
            storeElements.reservationList.innerHTML = '<p class="text-gray-500">해당 날짜에 예약이 없습니다.</p>';
        } else {
            reservations.sort((a, b) => a.time.localeCompare(b.time));
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
    if (!date) return storeElements.timeSlotsContainer.innerHTML = '<p class="text-gray-400 col-span-full">달력에서 날짜를 선택해주세요.</p>';
    
    const timeManagementDocRef = doc(db, "users", currentUser.uid, "timeManagement", date);
    const timeManagementSnap = await getDoc(timeManagementDocRef);
    const timeManagementData = timeManagementSnap.exists() ? timeManagementSnap.data() : { closed: [], duplicated: [] };
    
    const container = storeElements.timeSlotsContainer;
    container.innerHTML = '';

    const reservationsByTime = {};
    storeState.reservations.forEach(r => {
        const slotsToBook = r.duration / 15;
        let [h, m] = r.time.split(':').map(Number);
        for (let i = 0; i < slotsToBook; i++) {
            const timeKey = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            if (!reservationsByTime[timeKey]) {
                reservationsByTime[timeKey] = 0;
            }
            reservationsByTime[timeKey]++;
            m += 15;
            if (m >= 60) { m = 0; h++; }
        }
    });

    for (let h = 9; h < 21; h++) {
        for (let m = 0; m < 60; m += 15) {
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const slot = document.createElement('div');
            slot.dataset.time = time;
            
            const reservationCount = reservationsByTime[time] || 0;
            const isClosed = timeManagementData.closed?.includes(time);
            const isDuplicated = timeManagementData.duplicated?.includes(time);
            
            let slotClass = 'p-2 border rounded-lg text-center cursor-pointer flex flex-col justify-center items-center h-16';
            let slotHTML = `<div class="text-sm">${time}</div>`;
            
            if (isClosed) {
                slotClass += ' bg-black text-white';
                slotHTML += `<div class="text-xs font-bold">닫힘</div>`;
            } else if (isDuplicated) {
                slotClass += reservationCount >= 2 ? ' bg-purple-500 text-white' : ' bg-green-200';
                slotHTML += `<div class="text-xs font-bold">중복(${reservationCount}/2)</div>`;
            } else if (reservationCount > 0) {
                slotClass += ' bg-blue-500 text-white';
                slotHTML += `<div class="text-xs font-bold">예약완료</div>`;
            } else {
                slotClass += ' bg-gray-50 hover:bg-gray-200';
            }
            
            slot.className = slotClass;
            slot.innerHTML = slotHTML;

            if (storeState.selectedSlots.has(time)) {
                 slot.classList.add('selected-slot');
            }
            container.appendChild(slot);
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

    const timeManagementDocRef = doc(db, "users", currentUser.uid, "timeManagement", date);
    const selectedTimes = Array.from(storeState.selectedSlots);

    try {
        const payload = {};
        if (type === 'closed') {
            if (!confirm("선택된 시간을 '닫힘' 처리하시겠습니까?")) return;
            payload.closed = arrayUnion(...selectedTimes);
            payload.duplicated = arrayRemove(...selectedTimes);
        } else if (type === 'duplicated') {
            if (!confirm("선택된 시간에 중복 예약을 허용하시겠습니까?")) return;
            payload.duplicated = arrayUnion(...selectedTimes);
            payload.closed = arrayRemove(...selectedTimes);
        } else if (type === 'open') {
            if (!confirm("선택된 시간을 기본 상태로 되돌리시겠습니까?")) return;
            payload.closed = arrayRemove(...selectedTimes);
            payload.duplicated = arrayRemove(...selectedTimes);
        }

        await setDoc(timeManagementDocRef, payload, { merge: true });
        
        storeState.selectedSlots.clear();
        updateSlotActionButtons();
        await renderStoreTimeSlots(date);
    } catch (error) {
        console.error("시간 관리 오류:", error);
        alert("시간을 변경하는 중 오류가 발생했습니다.");
    }
}