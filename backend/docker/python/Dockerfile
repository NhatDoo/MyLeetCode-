FROM python:3.11-slim

RUN adduser --disabled-password --gecos "" sandbox

WORKDIR /app
COPY wrapper.py /usr/local/bin/wrapper.py
RUN chmod +x /usr/local/bin/wrapper.py

RUN mkdir /sandbox && chown sandbox:sandbox /sandbox
USER sandbox

# Chạy wrapper qua runCmd từ executor
CMD ["python3"]
