# 1. 使用官方的 Python 3.10 輕量版作為基礎
FROM python:3.10-slim

# 2. 設定容器內的工作目錄為 /app
WORKDIR /app

# 3. 安裝系統層級的工具 (這步非常重要！Whisper 需要 ffmpeg 才能讀取音檔)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# 4. 把剛剛寫好的 requirements.txt 複製進容器
COPY requirements.txt .

# 5. 根據清單安裝所有 Python 套件
RUN pip install --no-cache-dir -r requirements.txt

# 6. 把你寫的 main.py 等所有檔案複製進容器裡
COPY . .

# 7. 宣告容器會使用 8000 Port
EXPOSE 8000

# 8. 當容器啟動時，自動執行 Uvicorn 來跑你的 FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]