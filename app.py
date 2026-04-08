from flask import Flask, render_template, request, redirect, url_for
import mysql.connector

app = Flask(__name__)

# 資料庫設定：使用 host.docker.internal 穿透 VPN 連回主機
db_config = {
    'host': 'mysql.poyu39.tw',
    'user': 'project115',
    'password': 'project115',
    'database': 'project115',
    'charset': 'utf8mb4'
}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except Exception as e:
        print(f"連線失敗: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    name = request.form.get('name')
    username = request.form.get('username')
    password = request.form.get('password')

    conn = get_db_connection()
    if conn is None:
        return "<h3>資料庫連線失敗</h3><p>請確認 VPN 已開啟。</p>"

    try:
        cursor = conn.cursor()
        # 嘗試插入資料
        query = "INSERT INTO users (name, username, password) VALUES (%s, %s, %s)"
        cursor.execute(query, (name, username, password))
        conn.commit()
        cursor.close()
        conn.close()
        return '<script>alert("註冊成功！"); window.location.href="/";</script>'

    except mysql.connector.Error as err:
        # 檢查是否為帳號重複錯誤 (MySQL Error 1062)
        if err.errno == 1062:
            return '<script>alert("您的帳號已存在，請重新輸入或直接登入"); window.history.back();</script>'
        else:
            # 其他 SQL 錯誤
            return f"<h3>SQL 錯誤</h3><p>{err}</p>"
    finally:
        if conn and conn.is_connected():
            conn.close()

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username=%s AND password=%s", (username, password))
        user = cursor.fetchone()
        conn.close()
        if user:
            return redirect(url_for('main_page'))
    return '<script>alert("登入失敗"); window.history.back();</script>'

@app.route('/navbar')
def navbar():
    return render_template('navbar.html')

@app.route('/main')
def main_page():
    return render_template('main.html')

if __name__ == '__main__':
    # 確保這一行是乾淨的，後面沒有接任何東西
    app.run(host='0.0.0.0', port=5000, debug=True)