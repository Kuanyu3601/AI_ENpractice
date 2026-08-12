// ══════════════════════════════════════════════════
//  個人資料
// ══════════════════════════════════════════════════
// 原檔案內容：checkFirstTime、confirmAge、openProfile、closeProfile、saveProfile(647–731)

// ══════════════════════════════════════════════════
//  FIRST-TIME & PROFILE
// ══════════════════════════════════════════════════
function checkFirstTime() {
    const age = localStorage.getItem('userAge');
    const modal = document.getElementById('firstTimeModal');
    // 💡 防禦性修正：加上元素存在檢查，避免這裡出錯連帶讓 DOMContentLoaded
    //    裡「這行之後」的 bindEvents()、initUserHistory() 等初始化整批失效
    if (!age && modal) {
        modal.classList.add('active');
    }
}

function confirmAge() {
    const input = document.getElementById('modalAge');
    const age = parseInt(input.value);
    if (!age || age < 1 || age > 120) {
        input.style.borderColor = '#e74c3c';
        input.focus();
        return;
    }
    localStorage.setItem('userAge', age);
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    profile.age = age;
    localStorage.setItem('userProfile', JSON.stringify(profile));
    document.getElementById('firstTimeModal').classList.remove('active');
    showToast('歡迎！資料已儲存');
}

async function openProfile() {
    // 1. 打開 UI 面板
    document.getElementById('profilePanel').classList.add('open');
    document.getElementById('profileOverlay').classList.add('active');

    try {
        // 2. 向後端要目前 Session 使用者的最新資料
        const res = await fetch('/api/get_user_info');
        const data = await res.json();

        if (data.status === 'success') {
            // 3. 將資料庫的資料填入網頁欄位中
            document.getElementById('profileName').value = data.name || '';
            document.getElementById('profileAge').value = data.age || '';
            document.getElementById('profileUsername').value = data.username || '';
        } else {
            showToast('無法載入使用者資料，請重新登入');
        }
    } catch (err) {
        console.error('載入個人資料失敗:', err);
    }
}

function closeProfile() {
    document.getElementById('profilePanel').classList.remove('open');
    document.getElementById('profileOverlay').classList.remove('active');
}

async function saveProfile() {
    const nameInput = document.getElementById('profileName').value.trim();
    const ageInput = parseInt(document.getElementById('profileAge').value);

    if (!nameInput) { showToast('姓名不能為空喔！'); return; }
    if (!ageInput || ageInput < 1 || ageInput > 120) { showToast('請輸入有效的年齡'); return; }

    try {
        // 將更新後的姓名與年齡傳回後端寫入 users 資料表
        const res = await fetch('/api/update_user_info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameInput,
                age: ageInput
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast('個人資料已成功同步至資料庫 ✓');
            closeProfile();
        } else {
            showToast('儲存失敗，請稍後再試');
        }
    } catch (err) {
        console.error('儲存個人資料失敗:', err);
        showToast('網路錯誤，無法儲存');
    }
}