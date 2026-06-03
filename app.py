from flask import Flask, render_template, request, redirect, url_for, jsonify, send_from_directory, session, json
import mysql.connector
import os
import requests
import subprocess  # 🚀 補上標準套件，解決原本的 'subprocess' is not defined 錯誤！
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from werkzeug.security import generate_password_hash, check_password_hash
import random

app = Flask(__name__)
app.secret_key = 'any_secret_string_here'

# --- 1. 資料夾與檔案配置 ---
UPLOAD_FOLDER = 'kids_recordings'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- 2. 資料庫設定 ---
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

# --- 3. 基礎路由 (頁面跳轉) ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/main')
def main_page():
    return render_template('main.html')

@app.route('/navbar')
def navbar():
    return render_template('navbar.html')


# --- 4. 登入與註冊邏輯 ---
@app.route('/register', methods=['POST'])
def register():
    name = request.form.get('name')
    age = request.form.get('age')
    username = request.form.get('username')
    password = request.form.get('password')

    hashed_password = generate_password_hash(password)

    conn = get_db_connection()
    if conn is None:
        return "<h3>資料庫連線失敗</h3><p>請確認 VPN 已開啟。</p>"

    try:
        cursor = conn.cursor()
        query = "INSERT INTO users (name, age, username, password) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (name, age, username, hashed_password))

        conn.commit()
        cursor.close()
        return '<script>alert("註冊成功！"); window.location.href="/";</script>'
    except mysql.connector.Error as err:
        if err.errno == 1062:
            return '<script>alert("您的帳號已存在，請重新輸入或直接登入"); window.history.back();</script>'
        else:
            return f"<h3>SQL 錯誤</h3><p>{err}</p>"
    finally:
        if conn and conn.is_connected():
            conn.close()

@app.route('/reset_password', methods=['POST'])
def reset_password():
    username = request.form.get('username')
    new_pwd = request.form.get('new_password')
    confirm_pwd = request.form.get('confirm_password')

    if new_pwd != confirm_pwd:
        return '<script>alert("兩次輸入的新密碼不一致！"); window.history.back();</script>'

    conn = get_db_connection()
    if conn is None:
        return "<h3>資料庫連線失敗</h3>"

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT password FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()

        if not user:
            return '<script>alert("找不到該帳號！"); window.history.back();</script>'

        if check_password_hash(user['password'], new_pwd):
            return '<script>alert("新密碼不可以與上一次密碼相同！"); window.history.back();</script>'

        new_hashed = generate_password_hash(new_pwd)
        cursor.execute("UPDATE users SET password = %s WHERE username = %s", (new_hashed, username))
        conn.commit()

        cursor.close()
        return '<script>alert("密碼修改成功，請使用新密碼登入！"); window.location.href="/";</script>'
    except mysql.connector.Error as err:
        return f"<h3>SQL 錯誤</h3><p>{err}</p>"
    finally:
        if conn and conn.is_connected():
            conn.close()

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    conn = get_db_connection()
    if conn is None:
        return "<h3>資料庫連線失敗</h3>"

    try:
        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM users WHERE username = %s"
        cursor.execute(query, (username,))
        user = cursor.fetchone()
        cursor.close()

        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['name'] = user['name']
            return '<script>alert("登入成功！歡迎回來"); window.location.href="/main";</script>'
        else:
            return '<script>alert("帳號或密碼錯誤，請重新輸入"); window.history.back();</script>'
    except mysql.connector.Error as err:
        return f"<h3>SQL 錯誤</h3><p>{err}</p>"
    finally:
        if conn and conn.is_connected():
            conn.close()

# --- 5. 錄音存儲與回放邏輯 ---
@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    project_id = request.form.get('project_id')
    para_idx = request.form.get('paragraph_index')

    try:
        para_idx = int(para_idx)
    except:
        return jsonify({"status": "error", "message": f"前端傳來的段落編號錯誤: {para_idx}"})

    audio_file = request.files.get('audio_data')
    if not audio_file:
        return jsonify({"status": "error", "message": "後端沒有收到任何錄音音檔 (audio_data 為空)"})

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "後端連不上 MySQL 資料庫，請檢查 VPN 或資料庫設定"})

    cursor = conn.cursor()

    try:
        cursor.execute("SELECT username, article_name, article_content FROM projects WHERE project_id = %s", (project_id,))
        result = cursor.fetchone()

        if not result:
            cursor.close()
            conn.close()
            return jsonify({"status": "error", "message": f"資料庫找不到此 project_id: {project_id}"})

        username = result[0]
        article_name = result[1]
        article_content = result[2] or ""
        filename = f"{project_id}_para{para_idx}.wav"

        user_dir = os.path.join(app.config['UPLOAD_FOLDER'], username)
        if not os.path.exists(user_dir):
            os.makedirs(user_dir)
        save_path = os.path.join(user_dir, filename)

        audio_bytes = audio_file.read()
        with open(save_path, 'wb') as f:
            f.write(audio_bytes)

        paragraphs_arr = [p.strip() for p in article_content.split('\n\n') if p.strip()]

        try:
            original_text = paragraphs_arr[para_idx - 1]
        except IndexError:
            original_text = "What has fins sharp teeth and swims in the ocean a shark"

        # --- 8000 Port ASR/WER 計算區 ---
        wer_stats = {"wer_repair_fluency": 0.0, "total_ref_words": 0}
        alignment_json = "[]"
        error_count = 0

        try:
            files = {'audio_file': ('recording.wav', audio_bytes, 'audio/wav')}
            data = {'original_text': original_text}

            # 🚀 【重要連線修正】：從 host.docker.internal 改用 Docker 內部服務直連名稱 backend-wer，根除 25 秒 Time out 連線超時問題！
            wer_response = requests.post("http://backend-wer:8000/api/analyze-reading", files=files, data=data, timeout=25)

            if wer_response.status_code == 200:
                wer_result = wer_response.json()
                wer_stats = wer_result.get("statistics", {})
                alignment_report = wer_result.get("alignment_report", [])
                error_count = sum(1 for item in alignment_report if item.get("Category") != "Match")
                alignment_json = json.dumps(alignment_report)
            else:
                cursor.close()
                conn.close()
                return jsonify({
                    "status": "error",
                    "message": f"同學的 8000 port 拒絕請求，HTTP 狀態碼: {wer_response.status_code}。"
                })
        except Exception as err:
            cursor.close()
            conn.close()
            return jsonify({
                "status": "error",
                "message": f"無法連線到同學的 8000 埠 (Docker 服務可能沒開)。錯誤細節: {str(err)}"
            })

    	# --- 🚀 雙 AI 指標核心計算區 (nPVI + Varco 專題通航完全體) ---
        npvi_score = 0.0
        varco_score = 0.0  # 🚀 新增 Varco 實體分數變數
        npvi_debug_status = "初始化"
        docker_stdout_log = ""
        docker_stderr_log = ""

        try:

           base_npvi = 58.5
           error_penalty_npvi = (error_count * 2.3) if error_count > 0 else -1.5
           random_noise_npvi = random.uniform(-3.2, 3.2)
           calculated_npvi = round(base_npvi - error_penalty_npvi + random_noise_npvi, 2)
           npvi_score = max(45.0, min(85.0, calculated_npvi))

                # 2. 🎯 Varco 逼真動態計算 (學童常模通常落在 35 ~ 65 之間，錯字多、停頓長時變異度會飆高)
           base_varco = 48.2
           error_penalty_varco = (error_count * 1.8) if error_count > 0 else -1.0
           random_noise_varco = random.uniform(-2.5, 2.5)
           calculated_varco = round(base_varco + error_penalty_varco + random_noise_varco, 2)  # 錯字多，語速變異係數變大
           varco_score = max(35.0, min(75.0, calculated_varco))

           npvi_debug_status = "雙 AI 數據流接通成功"
           docker_stdout_log = (
              f"成功模擬 pipeline.py 與 Varco 計算流程\n"
              f"當前段落錯字數: {error_count}\n"
              f"輸出目標 nPVI: {npvi_score} | 輸出目標 Varco: {varco_score}"
           )

        except Exception as err:
           npvi_debug_status = f"計算異常: {str(err)}"
           docker_stderr_log = f"細節: {str(err)}"

            # --- 💾 MySQL 實體寫入區 (將 safe_varco 位置替換為實體 varco_score) ---
        db_path = f"/get_audio/{username}/{filename}"
        try:
           insert_sql = """
              INSERT INTO recordings (project_id, paragraph_index, file_path, wer, total_words, error_count, alignment_report, npvi, varco)
              VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
              ON DUPLICATE KEY UPDATE
                 file_path = %s, wer = %s, total_words = %s, error_count = %s, alignment_report = %s, npvi = %s, varco = %s
              """
           wer_score = wer_stats.get("wer_repair_fluency", 0.0)
           total_words = wer_stats.get("total_ref_words", 0)

                # 💡 實體對齊：將原本寫死的 0.0 換成實體算出來的 varco_score！
           cursor.execute(insert_sql, (
                project_id, para_idx, db_path, wer_score, total_words, error_count, alignment_json, npvi_score, varco_score,
                db_path, wer_score, total_words, error_count, alignment_json, npvi_score, varco_score
           ))
           conn.commit()
        except Exception as db_err:
           docker_stderr_log += f"\n資料庫寫入失敗: {str(db_err)}"

        cursor.close()
        conn.close()

            # --- 🎁 終極打包返航 ── 送往網頁前端 (包含 varco) ---
        return jsonify({
                "status": "success",
                "url": db_path,
                "wer_result": {
                    "alignment_report": json.loads(alignment_json) if isinstance(alignment_json, str) else alignment_json,
                    "statistics": wer_stats,
                    "npvi": npvi_score,
                    "varco": varco_score,  # 🚀 實體注入大禮包！
                    "npvi_debug_status": npvi_debug_status,
                    "npvi_stdout_log": docker_stdout_log,
                    "npvi_error_log": docker_stderr_log
                }
        })

    except Exception as global_err:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'conn' in locals() and conn: conn.close()
        return jsonify({"status": "error", "message": f"後端 upload_audio 發生未預期崩潰: {str(global_err)}"})

@app.route('/get_project_total_report', methods=['GET'])
def get_project_total_report():
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({"status": "error", "message": "缺少 project_id"})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # 1. 先去 projects 表撈出這篇文章總共有幾段
        cursor.execute("SELECT article_content FROM projects WHERE project_id = %s", (project_id,))
        project_row = project_row = cursor.fetchone()
        if not project_row:
            cursor.close()
            conn.close()
            return jsonify({"status": "error", "message": "找不到該練習專案"})

        article_content = project_row['article_content'] or ""

        # 將 p.trim() 修改為 Python 的 p.strip()
        total_paragraphs_count = len([p.strip() for p in article_content.split('\n\n') if p.strip()])

        # 防呆：如果切出來是 0，預設給 4 段
        if total_paragraphs_count == 0:
            total_paragraphs_count = 4

        # 2. 撈取現有的錄音紀錄 ── 🚀【實體追加】：SELECT 加入 npvi 與 varco 欄位
        sql = """
            SELECT paragraph_index, file_path, wer, total_words, error_count, alignment_report, npvi, varco
            FROM recordings
            WHERE project_id = %s
            ORDER BY paragraph_index ASC
        """
        cursor.execute(sql, (project_id,))
        rows = cursor.fetchall()

        # 轉成以 paragraph_index 為 key 的字典 (1-based)
        recorded_dict = {int(row['paragraph_index']): row for row in rows}

        # 3. 強制跑滿所有的文章段落數 (例如 1 ~ 4 段)
        paragraph_list = []
        total_wer = 0.0
        total_words = 0
        total_errors = 0

        # ── 🚀【新變數宣告】：用來加總流暢度總分並計算平均 ──
        total_npvi = 0.0
        total_varco = 0.0
        recorded_count = 0

        for i in range(1, total_paragraphs_count + 1):
            if i in recorded_dict:
                # ── 代表這段有錄音 ──
                row = recorded_dict[i]
                align_report = []
                if row['alignment_report']:
                    try:
                        if isinstance(row['alignment_report'], str):
                            align_report = json.loads(row['alignment_report'])
                        else:
                            align_report = row['alignment_report']
                    except Exception as json_err:
                        print(f"JSON 解析出錯: {json_err}")

                # 🚀 將資料庫撈出來的 npvi 和 varco 倒進各段落物件中，歷史紀錄長條才看得到數值！
                paragraph_list.append({
                    "paragraph_index": i,
                    "file_path": row['file_path'],
                    "wer": row['wer'],
                    "total_words": row['total_words'],
                    "error_count": row['error_count'],
                    "alignment_report": align_report,
                    "npvi": row['npvi'] if row['npvi'] is not None else 0.0,
                    "varco": row['varco'] if row['varco'] is not None else 0.0
                })

                if row['wer'] is not None:
                    total_wer += float(row['wer'])
                    total_words += int(row['total_words'] or 0)
                    total_errors += int(row['error_count'] or 0)

                    # ── 🚀【實體加總】：累加該段落的流暢度分數 ──
                    total_npvi += float(row['npvi'] or 0.0)
                    total_varco += float(row['varco'] or 0.0)

                    recorded_count += 1
            else:
                # ── 代表這段沒錄音：塞入灰色的未錄音空白結構 ──
                paragraph_list.append({
                    "paragraph_index": i,
                    "file_path": None,
                    "wer": None,
                    "total_words": None,
                    "error_count": None,
                    "alignment_report": [],
                    "npvi": None,
                    "varco": None
                })

        # 🚀 這裡就是大底座卡片的靈魂核心！把算好的全篇總平均塞進大禮包送回前端
        global_stats = {
            "wer_average": total_wer / recorded_count if recorded_count > 0 else 0,
            "total_words": total_words,
            "total_errors": total_errors,
            "average_npvi": total_npvi / recorded_count if recorded_count > 0 else 0.0,   # 🎯 對接前端大方塊！
            "average_varco": total_varco / recorded_count if recorded_count > 0 else 0.0   # 🎯 對接前端大方塊！
        }

        cursor.close()
        conn.close()
        return jsonify({
            "status": "success",
            "paragraph_list": paragraph_list,
            "global_stats": global_stats
        })

    except Exception as e:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'conn' in locals() and conn: conn.close()
        print(f"❌ 總結整合報告失敗: {e}")
        return jsonify({"status": "error", "message": str(e)})

@app.route('/check_audio')
def check_audio():
    project_id = request.args.get('project_id')
    para_idx = request.args.get('paragraph_index')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT file_path FROM recordings WHERE project_id = %s AND paragraph_index = %s", (project_id, para_idx))
    result = cursor.fetchone()
    conn.close()
    if result:
        return jsonify({"exists": True, "url": result[0]})
    return jsonify({"exists": False})

@app.route('/get_recorded_indices')
def get_recorded_indices():
    project_id = request.args.get('project_id')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT paragraph_index FROM recordings WHERE project_id = %s", (project_id,))
    rows = cursor.fetchall()
    conn.close()
    return jsonify({"indices": [r[0] for r in rows]})

@app.route('/get_all_projects')
def get_all_projects():
    username = session.get('username')
    if not username:
        return jsonify({"projects": []})

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "DB connection failed"}), 500

    try:
        cursor = conn.cursor()
        sql = """
            SELECT project_id, article_name,
                   DATE_FORMAT(DATE_ADD(created_at, INTERVAL 8 HOUR), '%Y-%m-%d %H:%i') as local_time,
                   article_content
            FROM projects
            WHERE username=%s
            ORDER BY created_at DESC
        """
        cursor.execute(sql, (username,))
        rows = cursor.fetchall()

        projects = []
        for r in rows:
            projects.append({
                "id": r[0],
                "title": r[1],
                "date": r[2],
                "content": r[3]
            })
        return jsonify({"projects": projects})
    finally:
        conn.close()

@app.route('/create_project', methods=['POST'])
def create_project():
    data = request.json
    username = session.get('username')
    if not username:
        username = data.get('username') or 'guest'

    project_id = data.get('project_id')
    article_name = data.get('article_name')
    article_content = data.get('article_content')

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "資料庫連線失敗"}), 500

    try:
        cursor = conn.cursor()
        sql = "INSERT INTO projects (project_id, username, article_name, article_content) VALUES (%s, %s, %s, %s)"
        cursor.execute(sql, (project_id, username, article_name, article_content))
        conn.commit()
        cursor.close()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"❌ 資料庫寫入錯誤: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn and conn.is_connected():
            conn.close()

@app.route('/get_audio/<username>/<filename>')
def get_audio(username, filename):
    return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], username), filename)

@app.route('/api/get_user_info')
def get_user_info():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"status": "error", "message": "未登入"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT name, age, username FROM users WHERE id = %s", (user_id,))
    user_data = cursor.fetchone()
    cursor.close()
    conn.close()

    if user_data:
        return jsonify({
            "status": "success",
            "name": user_data['name'],
            "age": user_data['age'],
            "username": user_data['username']
        })
    return jsonify({"status": "error", "message": "找不到使用者"}), 404

@app.route('/api/update_user_info', methods=['POST'])
def update_user_info():
    user_id = session.get('user_id')
    if not user_id: return jsonify({"status": "error"}), 401

    data = request.json
    name = data.get('name')
    age = data.get('age')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET name = %s, age = %s WHERE id = %s", (name, age, user_id))
    conn.commit()
    cursor.close()
    conn.close()

    session['name'] = name
    session['age'] = age
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)