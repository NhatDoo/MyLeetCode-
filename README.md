# ĐANG XÂY DỰNG

# MyLeetCode

MyLeetCode là một dự án mô phỏng nền tảng luyện thuật toán và chấm bài tự động theo mô hình tương tự online judge. Mục tiêu của dự án là cho phép người dùng đăng ký tài khoản, xem bài toán, nộp lời giải, đưa bài nộp vào hàng đợi và chấm trong môi trường cô lập bằng Docker.

Hiện tại phần backend là phần phát triển rõ nhất trong repo. Frontend đang ở giai đoạn chuẩn bị và chưa có nhiều nội dung.

## Mục tiêu dự án

- Xây dựng một hệ thống nộp bài và chấm code tách biệt giữa API và execution worker.
- Hỗ trợ nhiều ngôn ngữ lập trình như `javascript`, `python`, `cpp`.
- Bảo vệ hệ thống trước các nguy cơ phổ biến của online judge như `RCE`, `DoS`, `sandbox escape`, `data leak`.
- Tạo nền tảng để mở rộng thêm bảng xếp hạng, contest, history, analytics và giám sát vận hành.

## Trạng thái hiện tại

- Backend dùng `Node.js + TypeScript + Express`.
- Dữ liệu dùng `PostgreSQL` thông qua `Prisma`.
- Hàng đợi dùng `RabbitMQ`.
- Worker thực thi code trong `Docker`.
- Có `Swagger` để thử API.
- Có test unit bằng `Vitest`.

## Actor trong hệ thống

- `Người dùng`: đăng ký, đăng nhập, xem bài toán, nộp lời giải, xem kết quả.
- `Admin/Problem Setter`: tạo bài toán, cập nhật đề, cấu hình test case public và hidden.
- `API Server`: nhận request, validate dữ liệu, ghi DB, đẩy job vào queue.
- `Submission Worker`: lấy job từ queue, lấy test case, chạy code, judge và lưu kết quả.
- `Docker Runner`: chạy code trong sandbox cô lập.
- `PostgreSQL`: lưu user, session, problem, testcase, submission, execution log.
- `RabbitMQ`: đệm tải giữa API và worker, giúp API không phải chấm code đồng bộ.

## Luồng chạy chính

### 1. Đăng nhập và xác thực

- Người dùng đăng ký hoặc đăng nhập.
- Backend tạo `access token` và `refresh token`.
- Refresh token được lưu dạng hash trong DB và gửi bằng cookie HTTP-only.

### 2. Xem bài toán

- Client gọi API lấy danh sách bài toán.
- Client có thể xem chi tiết một bài toán.
- Chỉ public test case được trả ra cho người dùng, hidden test case không bị lộ.

### 3. Nộp bài

- Client gửi `userId`, `problemId`, `language`, `code` đến `/api/submissions`.
- Middleware security kiểm tra body size, rate limit, content type và các pattern nguy hiểm.
- Service tạo một `Submission` với trạng thái `PENDING`.
- API publish job sang `RabbitMQ`.
- API trả về `submissionId` để client polling kết quả.

### 4. Worker chấm bài

- Worker consume job với `prefetch=1`.
- Worker đổi trạng thái submission sang `RUNNING`.
- Worker lấy test cases của bài toán từ DB.
- Worker gọi executor để chạy code trên từng test case trong Docker sandbox.
- Judge sinh verdict như `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `RUNTIME_ERROR`.
- Kết quả được lưu vào DB để client lấy lại qua API.

## Kiến trúc tổng quát

```text
Client
  |
  v
Express API
  |-- Auth module
  |-- Problem module
  |-- Submission module
  |
  +--> PostgreSQL
  |
  +--> RabbitMQ ---> Submission Worker ---> Docker Sandbox ---> Judge ---> PostgreSQL
```

## Một số kỹ thuật đang áp dụng

- `Express middleware` để kiểm tra request và gắn security headers.
- `JWT access token + refresh token rotation`.
- `Prisma` cho ORM và transaction khi lưu kết quả chấm.
- `RabbitMQ` để tách API path và execution path.
- `Docker isolation` cho code người dùng.
- `Rate limit` và payload inspection cho submission.
- `Hidden testcase masking` để không rò rỉ dữ liệu chấm.
- `Vitest` cho unit test.
- `Swagger` cho tài liệu API và thử nghiệm nhanh.

## Các quyết định kỹ thuật đáng chú ý

- API không thực thi code trực tiếp.
  Điều này giảm nguy cơ treo API process và hạn chế blast radius khi submission độc hại.

- Submission được đưa vào queue trước khi chấm.
  Điều này giúp hệ thống chịu tải tốt hơn nhưng đổi lại kết quả không trả về ngay lập tức.

- Worker xử lý tuần tự với `prefetch=1`.
  Cách này an toàn và dễ kiểm soát tài nguyên hơn, nhưng throughput hiện chưa tối ưu cho tải lớn.

- Docker sandbox có giới hạn CPU, memory, process và output.
  Mục tiêu là chống fork bomb, infinite loop, spam output và giảm khả năng thoát sandbox.

## Trade-off hiện tại

- Ưu tiên an toàn và tính đơn giản hơn hiệu năng cực đại.
- Dùng regex/policy để chặn một số pattern nguy hiểm ở lớp API.
  Cách này chặn sớm tốt nhưng không thể thay thế sandbox thực thi thật sự.

- Worker tuần tự giúp giảm rủi ro quá tải host.
  Đổi lại nếu số lượng submission tăng nhanh thì độ trễ chấm sẽ tăng.

- Kết quả lỗi hạ tầng được làm mờ để tránh data leak.
  Đổi lại developer sẽ phải dựa nhiều hơn vào server logs khi debug.

## Cấu trúc thư mục chính

```text
backend/
  src/
    modules/
      auth/
      problem/
      submission/
      execution/
    shared/
  prisma/
  docker/
  tests/

frontend/
```

## Chạy backend cục bộ

### Yêu cầu

- `Node.js`
- `pnpm`
- `Docker`
- `PostgreSQL`
- `RabbitMQ`

### Hạ tầng phụ trợ

Repo hiện có `docker-compose.yml` trong thư mục `backend` để dựng:

- `PostgreSQL`
- `RabbitMQ`

### Các bước cơ bản

```bash
cd backend
pnpm install
pnpm dev
```

Nếu cần chạy test:

```bash
cd backend
pnpm test
```

## Tài liệu thiết kế

Nếu muốn xem sâu hơn về actor, sequence, decision, trade-off và security design, đọc thêm file [DESIGN.md](./DESIGN.md).
