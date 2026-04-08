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
    })
    .catch(err => {
      console.error('Navbar 載入失敗：', err);
      // 可以在這這裡放一個備用的內容，避免完全空白
      container.innerHTML = '<p style="color:red;">導覽列載入失敗</p>';
    });
});