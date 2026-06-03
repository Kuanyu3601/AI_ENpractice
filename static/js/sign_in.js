//alert('sign_in.js 開始執行！');

// 載入共用 navbar
// fetch('navbar.html')
//   .then(res => res.text())
//   .then(html => {
//     document.getElementById('navbar-container').innerHTML = html;
//   });



// fetch('navbar.html')
//   .then(res => {
//     alert('navbar fetch 狀態：' + res.status); // 確認有沒有抓到
//     return res.text();
//   })
//   .then(html => {
//     alert('navbar 內容：' + html.substring(0, 50)); // 印出前50字
//     document.getElementById('navbar-container').innerHTML = html;
//   })
//   .catch(err => {
//     alert('fetch 失敗：' + err); // 確認錯誤原因
//   });

function switchTab(tab) {
  const tabRegister = document.getElementById('tabRegister');
  const tabLogin    = document.getElementById('tabLogin');
  const formRegister = document.getElementById('formRegister');
  const formLogin    = document.getElementById('formLogin');
  const arrow = document.getElementById('arrowIndicator');

  if (tab === 'register') {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.style.display = 'block';
    formLogin.style.display    = 'none';
    arrow.classList.remove('move-right');
    animateForms(formRegister);
  } else {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display    = 'block';
    formRegister.style.display = 'none';
    arrow.classList.add('move-right');
    animateForms(formLogin);
  }
}

function animateForms(container) {
  const groups = container.querySelectorAll('.form-group');
  groups.forEach((g, i) => {
    g.style.animation = 'none';
    void g.offsetWidth;
    g.style.animation = `fieldIn 0.3s ease ${i * 0.05 + 0.03}s both`;
  });
}
function openForgotModal() {
  document.getElementById('forgotModal').style.display = 'flex';
}

function closeForgotModal() {
  document.getElementById('forgotModal').style.display = 'none';
}

// 點擊遮罩背景也可以關閉
window.onclick = function(event) {
  const modal = document.getElementById('forgotModal');
  if (event.target == modal) {
    closeForgotModal();
  }
}

// 保留原本的密碼驗證
document.addEventListener('DOMContentLoaded', () => {
  const resetForm = document.getElementById('resetForm');
  if (resetForm) {
    resetForm.onsubmit = function() {
      const p1 = document.getElementById('new_password').value;
      const p2 = document.getElementById('confirm_password').value;
      if (p1 !== p2) {
        alert("兩次輸入的密碼不一致！");
        return false;
      }
      return true;
    };
  }
});

