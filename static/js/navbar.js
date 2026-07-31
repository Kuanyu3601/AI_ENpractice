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
//  PWA：註冊 Service Worker + 安裝提示
//  👉 把這整段接到 static/js/navbar.js 的「最後面」
// ========================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('✅ SW 註冊成功，範圍：', reg.scope))
      .catch((err) => console.error('❌ SW 註冊失敗：', err));
  });
} else {
  console.warn('⚠️ 這個瀏覽器不支援 Service Worker');
}

// ── 自訂安裝按鈕（選配）──
// 若 HTML 裡有 <button id="installBtn"> 就會用它；沒有也不會報錯。
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'block';
});

window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('installBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.style.display = 'none';
  });
});

window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA 已安裝');
});