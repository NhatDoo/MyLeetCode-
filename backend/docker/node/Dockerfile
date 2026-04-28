# Rule 4: Chạy với user không phải root
FROM node:20-alpine

# Tạo user sandbox
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

# Tạo thư mục làm việc
WORKDIR /app

# Copy wrapper vào image
COPY wrapper.js /usr/local/bin/wrapper.js
RUN chmod +x /usr/local/bin/wrapper.js

# Tạo thư mục /sandbox cho mount tmpfs
RUN mkdir /sandbox && chown sandbox:sandbox /sandbox

# Chuyển sang user sandbox (Rule 4)
USER sandbox

# File này sẽ được executor gọi qua runCmd
# Không dùng ENTRYPOINT ở đây để tránh bị lặp lệnh khi executor gọi
CMD ["node"]
