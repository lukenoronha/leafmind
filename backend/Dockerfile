FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt is checked into the repo as UTF-16 (Windows editor artifact);
# re-encode to UTF-8 so pip can parse it.
COPY requirements.txt ./requirements.raw.txt
RUN python -c "import codecs; \
    data = codecs.open('requirements.raw.txt', encoding='utf-16').read(); \
    codecs.open('requirements.txt', 'w', encoding='utf-8').write(data)"

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
