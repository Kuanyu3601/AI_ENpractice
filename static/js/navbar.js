// 確保 HTML 結構都讀取完了才執行
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('navbar-container');

  if (!container) {
    console.error('找不到 #navbar-container 元素，請檢查 HTML！');
    return;
  }



  fetch('/navbar')
    .then(res => {
      console.log('連線狀態：', res.status);
      if (!res.ok) throw new Error('找不到 navbar.html 檔案');
      return res.text();
    })
    .then(html => {
      container.innerHTML = html;
      console.log('Navbar 載入成功！');

      if (!document.getElementById('sidebar')) {
          container.querySelector('.nav-history-btn')?.remove();
      }

      if (window.location.pathname.endsWith('main.html')) {
        const userBtn    = document.querySelector('.user-btn');
        const sidePanel  = document.getElementById('sidePanel');
        const sideOverlay = document.getElementById('sideOverlay');
        const sideClose  = document.getElementById('sideClose');

        function openPanel()  { sidePanel.classList.add('active'); sideOverlay.classList.add('active'); }
        function closePanel() { sidePanel.classList.remove('active'); sideOverlay.classList.remove('active'); }

        userBtn.addEventListener('click', openPanel);
        sideClose.addEventListener('click', closePanel);
        sideOverlay.addEventListener('click', closePanel);
    }
    })
    .catch(err => {
      console.error('Navbar 載入失敗：', err);
      // 可以在這這裡放一個備用的內容，避免完全空白
      container.innerHTML = '<p style="color:red;">導覽列載入失敗</p>';
    });
});

// ========================================================
//  💡 PWA 的 Service Worker 註冊、安裝提示處理，
//     已經統一放在 main.js 裡處理了（避免兩邊各註冊一次、
//     也避免這裡原本 beforeinstallprompt 攔截邏輯在沒有對應
//     #installBtn 按鈕的情況下，把瀏覽器原生的安裝提示攔截掉、
//     卻沒有任何東西可以手動觸發，導致安裝按鈕永遠不會出現）。
//     這裡不再重複處理，如果之後想加自訂安裝按鈕，直接在 main.js
//     那份 PWA 註冊邏輯旁邊加，不要在這裡另外寫一份。
// ========================================================