// Firebase SDK에서 필요한 함수들을 가져옵니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, setDoc, doc, getDoc, collection, query, where, getDocs, addDoc, onSnapshot, orderBy, deleteDoc
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

// --- 페이지 및 상태 관리 ---
const mainContainers = {
    login: document.getElementById('login-container'),
    customer: document.getElementById('customer-page-container'),
    store: document.getElementById('store-page-container'),
};
let currentUser = null;
let stores = [];
let selectedService = { name: null, duration: 0 };
let selectedStore = { id: null, name: null };
let selectedDate = null;
let selectedTime = null;
let myReservationsUnsubscribe = null;
let isReservationListenerAttached = false; // 예약 취소 리스너 중복 방지 플래그
let currentDisplayDate = new Date(); // 달력 표시용 날짜 상태 추가

const showPage = (pageName) => {
    Object.values(mainContainers).forEach(container => container.classList.add('hidden'));
    mainContainers[pageName].classList.remove('hidden');
};

onAuthStateChanged(auth, async (user) => {
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
            await signOut(auth);
        }
    } else {
        currentUser = null;
        showPage('login');
        if (myReservationsUnsubscribe) myReservationsUnsubscribe();
    }
});

// --- 로그인/회원가입 UI 및 로직 (기존과 거의 동일) ---
const loginIdInput = document.getElementById('login-id');
const loginPasswordInput = document.getElementById('login-password');
const loginStoreBtn = document.getElementById('login-store-btn');
const loginCustomerBtn = document.getElementById('login-customer-btn');
const logoutBtn = document.getElementById('logout-btn');
const storeLogoutBtn = document.getElementById('store-logout-btn');
const signupModal = document.getElementById('signup-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const userTypeRadios = document.querySelectorAll('input[name="user-type"]');
const storeFields = document.getElementById('store-fields');
const customerFields = document.getElementById('customer-fields');
const submitSignupBtn = document.getElementById('submit-signup-btn');
const signupForm = document.getElementById('signup-form');
const signupBtn = document.getElementById('signup-btn');

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
signupModal.addEventListener('click', (e) => {
    if (e.target === signupModal) closeSignupModal();
});

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
            if (!userData.address) return alert('주소를 입력해주세요.');
        }
        await setDoc(doc(db, "users", user.uid), userData);
        alert('회원가입이 완료되었습니다!');
        closeSignupModal();
    } catch (error) {
        console.error("회원가입 오류: ", error);
        if (error.code === 'auth/email-already-in-use') alert('이미 사용 중인 이메일입니다.');
        else if (error.code === 'auth/weak-password') alert('비밀번호는 6자 이상으로 설정해주세요.');
        else alert('회원가입 중 오류가 발생했습니다.');
    }
});

const handleLogin = async (loginType) => {
    const email = loginIdInput.value;
    const password = loginPasswordInput.value;
    if (!email || !password) return alert('아이디와 비밀번호를 입력해주세요.');

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists() || userDocSnap.data().type !== loginType) {
            alert(`이 계정은 '${loginType}' 유형이 아닙니다.`);
            await signOut(auth);
        }
    } catch (error) {
        console.error("로그인 오류: ", error);
        alert('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
};

const handleLogout = () => signOut(auth);

loginStoreBtn.addEventListener('click', () => handleLogin('store'));
loginCustomerBtn.addEventListener('click', () => handleLogin('customer'));
logoutBtn.addEventListener('click', handleLogout);
storeLogoutBtn.addEventListener('click', handleLogout);


// --- 고객 페이지 초기화 및 로직 ---
const storeSearchInput = document.getElementById('store-search-input');
const storeSearchResults = document.getElementById('store-search-results');
const serviceSelection = document.getElementById('service-selection');
const estimatedTime = document.getElementById('estimated-time');
const calendarContainer = document.getElementById('calendar-container');
const timeSlotsContainer = document.getElementById('time-slots-container');
const reserveBtn = document.getElementById('reserve-btn');
const myReservationsList = document.getElementById('my-reservations-list');
const selectedStoreInfo = document.getElementById('selected-store-info');

function initCustomerPage() {
    document.getElementById('user-info').textContent = `${currentUser.name}님, 환영합니다.`;
    currentDisplayDate = new Date(); // 페이지 진입 시 현재 달로 초기화
    fetchStores();
    renderCalendar();
    listenToMyReservations();
    // 예약 취소 버튼에 대한 이벤트 리스너를 한 번만 등록합니다.
    if (!isReservationListenerAttached) {
        myReservationsList.addEventListener('click', handleReservationListClick);
        isReservationListenerAttached = true;
    }
}

async function fetchStores() {
    const q = query(collection(db, "users"), where("type", "==", "store"));
    const querySnapshot = await getDocs(q);
    stores = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

storeSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    storeSearchResults.innerHTML = '';
    if (searchTerm.length > 0) {
        const filteredStores = stores.filter(store => store.name.toLowerCase().includes(searchTerm));
        filteredStores.forEach(store => {
            const div = document.createElement('div');
            div.className = 'p-2 hover:bg-gray-100 cursor-pointer';
            div.textContent = store.name;
            div.onclick = () => selectStore(store);
            storeSearchResults.appendChild(div);
        });
    }
});

function selectStore(store) {
    selectedStore = { id: store.id, name: store.name, address: store.address }; // 주소 정보도 함께 저장
    storeSearchInput.value = store.name;
    storeSearchResults.innerHTML = '';

    const encodedAddress = encodeURIComponent(store.address);
    const naverMapUrl = `https://map.naver.com/v5/search/${encodedAddress}`;
    const kakaoMapUrl = `https://map.kakao.com/link/search/${encodedAddress}`;

    // 선택된 매장 정보 표시 UI 업데이트
    selectedStoreInfo.className = 'p-3 bg-gray-100 rounded-lg flex justify-between items-center';
    selectedStoreInfo.innerHTML = `
        <div>
            <p class="font-bold text-gray-800">선택된 매장: ${store.name}</p>
            <p class="text-sm text-gray-600">${store.address || '주소 정보 없음'}</p>
        </div>
        <div class="flex items-center space-x-2">
            <a href="${naverMapUrl}" target="_blank" title="네이버 지도로 보기" class="hover:opacity-75">
                <img src="https://i.imgur.com/g0mK0cP.png" alt="네이버 지도" class="w-7 h-7">
            </a>
            <a href="${kakaoMapUrl}" target="_blank" title="카카오맵으로 보기" class="hover:opacity-75">
                <img src="https://i.imgur.com/L4S432l.png" alt="카카오맵" class="w-7 h-7">
            </a>
        </div>
    `;

    checkReservationButton();
    // 매장이 변경되면 시간표를 다시 렌더링
    if (selectedDate) {
        renderTimeSlots();
    }
}

serviceSelection.addEventListener('change', (e) => {
    if (e.target.name === 'service') {
        selectedService = {
            name: e.target.value,
            duration: parseInt(e.target.dataset.duration, 10)
        };
        estimatedTime.textContent = `예상 소요시간: ${selectedService.duration / 60}시간`;
        highlightTimeSlots();
        checkReservationButton();
    }
});

function renderCalendar() {
    calendarContainer.innerHTML = '';
    const month = currentDisplayDate.getMonth();
    const year = currentDisplayDate.getFullYear();

    // --- 달력 헤더 (월 이동 버튼 포함) ---
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4';
    header.innerHTML = `
        <button id="prev-month-btn" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">&lt;</button>
        <h3 class="text-xl font-bold">${year}년 ${month + 1}월</h3>
        <button id="next-month-btn" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">&gt;</button>
    `;
    calendarContainer.appendChild(header);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'grid grid-cols-7 gap-2 text-center';
    
    // 요일 헤더 추가
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'font-bold text-sm';
        dayEl.textContent = day;
        calendarGrid.appendChild(dayEl);
    });
    
    // 1일 시작 전 빈 칸 추가
    for (let i = 0; i < firstDay.getDay(); i++) {
        calendarGrid.appendChild(document.createElement('div'));
    }

    // 날짜 채우기
    for (let date = 1; date <= lastDay.getDate(); date++) {
        const dateEl = document.createElement('div');
        const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        dateEl.className = 'p-2 cursor-pointer rounded-full hover:bg-blue-100 data-date';
        dateEl.dataset.date = fullDate;
        dateEl.textContent = date;

        if (fullDate === selectedDate) {
            dateEl.classList.add('bg-blue-500', 'text-white');
        }
        calendarGrid.appendChild(dateEl);
    }
    
    calendarContainer.appendChild(calendarGrid);

    // --- 이벤트 리스너 연결 ---
    document.getElementById('prev-month-btn').addEventListener('click', () => {
        currentDisplayDate.setMonth(currentDisplayDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month-btn').addEventListener('click', () => {
        currentDisplayDate.setMonth(currentDisplayDate.getMonth() + 1);
        renderCalendar();
    });

    document.querySelectorAll('.data-date').forEach(el => {
        el.addEventListener('click', (e) => {
            const previouslySelected = document.querySelector('.data-date.bg-blue-500');
            if(previouslySelected) {
                 previouslySelected.classList.remove('bg-blue-500', 'text-white');
            }
            e.target.classList.add('bg-blue-500', 'text-white');
            selectDate(e.target.dataset.date);
        });
    });
}

async function selectDate(date) {
    selectedDate = date;
    await renderTimeSlots(); // 시간표를 비동기로 렌더링
    checkReservationButton();
}

async function renderTimeSlots() {
    // --- 조건 확인 로직 개선 ---
    if (!selectedStore.id) {
        timeSlotsContainer.innerHTML = '<p class="text-gray-400">매장을 먼저 선택해주세요.</p>';
        return;
    }
    if (!selectedDate) {
        timeSlotsContainer.innerHTML = '<p class="text-gray-400">날짜를 선택해주세요.</p>';
        return;
    }

    timeSlotsContainer.innerHTML = '<p class="text-gray-400">예약 정보를 불러오는 중...</p>';

    // --- 해당 날짜의 예약 정보 가져오기 ---
    const bookedSlots = new Set();
    const q = query(collection(db, "reservations"), where("storeId", "==", selectedStore.id), where("date", "==", selectedDate));
    
    try {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => {
            const res = doc.data();
            const slotsToBook = res.duration / 15;
            let h = parseInt(res.time.split(':')[0]);
            let m = parseInt(res.time.split(':')[1]);

            for (let i = 0; i < slotsToBook; i++) {
                const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                bookedSlots.add(timeString);

                m += 15;
                if (m >= 60) {
                    m = 0;
                    h++;
                }
            }
        });
    } catch(error) {
        console.error("예약 정보 로딩 오류:", error);
        timeSlotsContainer.innerHTML = '<p class="text-red-500">예약 정보를 불러오는 데 실패했습니다.</p>';
        return;
    }

    timeSlotsContainer.innerHTML = ''; // 로딩 메시지 지우기
    
    // 오전 9시 ~ 오후 9시, 15분 간격
    for (let h = 9; h < 21; h++) {
        for (let m = 0; m < 60; m += 15) {
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const slot = document.createElement('div');
            
            if (bookedSlots.has(time)) {
                // 예약된 슬롯 (진한 회색, 두 줄 표시)
                slot.className = 'p-2 border rounded-lg text-center bg-gray-500 text-white cursor-not-allowed flex flex-col justify-center items-center h-16';
                slot.innerHTML = `
                    <div class="text-sm">${time}</div>
                    <div class="text-xs font-bold">예약완료</div>
                `;
            } else {
                // 예약 가능한 슬롯 (더 옅은 회색)
                slot.className = 'p-2 border rounded-lg text-center cursor-pointer bg-gray-50 hover:bg-gray-200 flex justify-center items-center h-16';
                slot.textContent = time;
                slot.dataset.time = time;
                slot.onclick = () => selectTime(time);
            }
            timeSlotsContainer.appendChild(slot);
        }
    }
    // 이전에 선택했던 시간 정보가 있다면 다시 하이라이트
    highlightTimeSlots();
}


function selectTime(time) {
    selectedTime = time;
    highlightTimeSlots();
    checkReservationButton();
}

function highlightTimeSlots() {
    // 먼저 모든 슬롯의 하이라이트를 제거 (예약된 슬롯 제외)
    document.querySelectorAll('#time-slots-container > div').forEach(slot => {
        if (!slot.classList.contains('cursor-not-allowed')) {
            slot.classList.remove('bg-green-300');
            slot.classList.add('bg-gray-50');
        }
    });

    if (!selectedTime || !selectedService.duration) return;

    const slotsToSelect = selectedService.duration / 15;
    const startTime = selectedTime;
    let currentHour = parseInt(startTime.split(':')[0]);
    let currentMinute = parseInt(startTime.split(':')[1]);

    for (let i = 0; i < slotsToSelect; i++) {
        const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        const slotToHighlight = document.querySelector(`[data-time="${timeString}"]`);
        if (slotToHighlight) {
            slotToHighlight.classList.remove('bg-gray-50');
            slotToHighlight.classList.add('bg-green-300');
        }
        currentMinute += 15;
        if (currentMinute >= 60) {
            currentMinute = 0;
            currentHour++;
        }
    }
}

function checkReservationButton() {
    reserveBtn.disabled = !(selectedStore.id && selectedService.name && selectedDate && selectedTime);
}

reserveBtn.addEventListener('click', async () => {
    if (!currentUser) return alert("로그인이 필요합니다.");
    
    const reservationData = {
        customerId: currentUser.uid,
        customerName: currentUser.name,
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        service: selectedService.name,
        duration: selectedService.duration,
        date: selectedDate,
        time: selectedTime,
        createdAt: new Date()
    };

    try {
        await addDoc(collection(db, "reservations"), reservationData);
        alert("예약이 완료되었습니다!");
        resetReservationForm();
    } catch (error) {
        console.error("예약 저장 오류:", error);
        alert("예약 중 오류가 발생했습니다.");
    }
});

function resetReservationForm() {
    selectedStore = { id: null, name: null, address: null };
    selectedService = { name: null, duration: 0 };
    selectedDate = null;
    selectedTime = null;
    
    storeSearchInput.value = '';
    selectedStoreInfo.innerHTML = '';
    selectedStoreInfo.className = ''; // 클래스도 초기화
    const checkedRadio = serviceSelection.querySelector('input[name="service"]:checked');
    if (checkedRadio) checkedRadio.checked = false;
    
    estimatedTime.textContent = '';
    
    // 달력 선택 초기화
    const previouslySelected = document.querySelector('.data-date.bg-blue-500');
    if(previouslySelected) {
         previouslySelected.classList.remove('bg-blue-500', 'text-white');
    }
    
    timeSlotsContainer.innerHTML = '<p class="text-gray-400">날짜를 선택해주세요.</p>';
    reserveBtn.disabled = true;
}

function listenToMyReservations() {
    if (myReservationsUnsubscribe) myReservationsUnsubscribe();

    const q = query(collection(db, "reservations"), where("customerId", "==", currentUser.uid));
    
    myReservationsUnsubscribe = onSnapshot(q, (querySnapshot) => {
        myReservationsList.innerHTML = '';
        if(querySnapshot.empty) {
            myReservationsList.innerHTML = '<p class="text-gray-500">예약 내역이 없습니다.</p>';
            return;
        }

        const reservations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reservations.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

        reservations.forEach((res) => {
            const li = document.createElement('div');
            li.className = 'p-3 bg-blue-50 rounded-lg flex justify-between items-center';
            li.innerHTML = `
                <div>
                    <p class="font-bold">${res.storeName} - ${res.service}</p>
                    <p class="text-sm text-gray-600">${res.date} ${res.time}</p>
                </div>
                <button data-id="${res.id}" data-date="${res.date}" class="cancel-btn bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm hover:bg-red-200">취소</button>
            `;
            myReservationsList.appendChild(li);
        });
    });
}

// 예약 목록에서 버튼 클릭을 처리하는 함수 (이벤트 위임)
function handleReservationListClick(e) {
    if (e.target.classList.contains('cancel-btn')) {
        const reservationId = e.target.dataset.id;
        const reservationDate = e.target.dataset.date;
        promptCancelReservation(reservationId, reservationDate);
    }
}

// 예약 취소를 묻고 실행하는 함수
async function promptCancelReservation(id, reservationDateStr) {
    const today = new Date();
    const reservationDate = new Date(reservationDateStr);
    
    // 시간은 제외하고 날짜만 비교하기 위해 자정으로 설정
    today.setHours(0, 0, 0, 0);

    if (today >= reservationDate) {
        alert("당일 예약취소는 불가합니다.");
        return;
    }

    const isConfirmed = confirm("예약을 취소하시겠습니까?\n예약 전날까지만 취소가 가능합니다.");
    
    if (isConfirmed) {
        try {
            await deleteDoc(doc(db, "reservations", id));
            alert("예약이 성공적으로 취소되었습니다.");
            // onSnapshot이 자동으로 목록을 갱신합니다.
        } catch (error) {
            console.error("예약 취소 오류:", error);
            alert("예약 취소 중 오류가 발생했습니다.");
        }
    }
}


function initStorePage() {
    const storeUserInfo = document.getElementById('store-user-info');
    if (currentUser) {
        storeUserInfo.textContent = `[${currentUser.name}]으로 로그인하셨습니다.`;
    }
}

