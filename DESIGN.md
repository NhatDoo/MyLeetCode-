# ĐANG XÂY DỰNG

# DESIGN

File này mô tả các quyết định thiết kế chính của dự án `MyLeetCode`, tập trung vào kiến trúc backend, actor, luồng chạy, security, trade-off và các điểm mở rộng trong tương lai.

## 1. Bối cảnh bài toán

Online judge là một dạng hệ thống có rủi ro cao hơn nhiều so với CRUD backend thông thường vì nó phải:

- nhận code do người dùng tự nhập,
- chạy code đó một cách an toàn,
- bảo vệ dữ liệu đề bài và hidden test case,
- chống việc người dùng làm treo hệ thống hoặc vượt sandbox.

Vì vậy thiết kế của dự án ưu tiên:

- tách biệt API và execution,
- cô lập code người dùng,
- giới hạn tài nguyên,
- tránh rò rỉ dữ liệu nội bộ,
- dễ quan sát và mở rộng về sau.

## 2. Actor

### Người dùng

- đăng ký tài khoản,
- đăng nhập,
- xem danh sách bài toán,
- xem chi tiết bài toán,
- nộp lời giải,
- xem kết quả chấm.

### Admin hoặc Problem Setter

- tạo bài toán,
- cập nhật bài toán,
- cấu hình test case,
- đánh dấu test case hidden hoặc public.

### API Server

- xử lý HTTP request,
- xác thực,
- validate payload,
- lưu metadata vào DB,
- đẩy job sang queue,
- cung cấp endpoint để polling kết quả.

### Submission Worker

- nhận job từ queue,
- lấy test case đầy đủ,
- gọi executor,
- judge kết quả,
- lưu verdict và execution log.

### Docker Runner

- chạy code người dùng trong container riêng,
- tắt network,
- giới hạn CPU, memory, process, file size, output.

### PostgreSQL

- lưu dữ liệu nghiệp vụ và kết quả chấm.

### RabbitMQ

- làm buffer giữa API và worker,
- giảm coupling giữa request path và execution path.

## 3. Dữ liệu chính

### User

- thông tin người dùng,
- quan hệ với submission,
- quan hệ với session.

### Session

- refresh token dạng hash,
- user agent,
- IP address,
- expiry time.

### Problem

- tiêu đề,
- mô tả,
- độ khó,
- danh sách test case.

### TestCase

- input,
- expected output,
- cờ `isHidden`.

### Submission

- code,
- language,
- status,
- score,
- result JSON,
- tham chiếu tới user và problem.

### ExecutionLog

- lưu trạng thái từng testcase,
- runtime,
- memory placeholder.

## 4. Kiến trúc tổng thể

```text
            +----------------------+
            |        Client        |
            +----------+-----------+
                       |
                       v
            +----------------------+
            |      Express API     |
            +----------+-----------+
                       |
        +--------------+--------------+
        |                             |
        v                             v
+---------------+             +---------------+
|  PostgreSQL   |             |   RabbitMQ    |
+---------------+             +-------+-------+
                                        |
                                        v
                              +-------------------+
                              | Submission Worker |
                              +---------+---------+
                                        |
                                        v
                              +-------------------+
                              |   Docker Runner   |
                              +---------+---------+
                                        |
                                        v
                              +-------------------+
                              |       Judge       |
                              +-------------------+
```

## 5. Luồng chạy chi tiết

### 5.1. Authentication flow

1. User đăng ký hoặc đăng nhập qua API auth.
2. Backend validate email và password.
3. Password được hash trước khi lưu.
4. Backend phát hành access token và refresh token.
5. Refresh token được hash trong DB, còn token gốc gửi về client qua cookie HTTP-only.

### 5.2. Problem browsing flow

1. Client gọi API lấy danh sách bài toán.
2. API chỉ trả thông tin cần thiết cho list view.
3. Khi lấy chi tiết bài toán, API chỉ trả public test case.
4. Hidden test case chỉ worker mới được truy cập.

### 5.3. Submission flow

1. Client POST lên `/api/submissions`.
2. `submissionSecurityMiddleware` kiểm tra:
   - content type,
   - body size,
   - rate limit,
   - language,
   - code length,
   - threat signatures như `child_process`, `subprocess`, `socket`, truy cập `/proc`, `process.env`, `os.environ`.
3. Submission service tạo record `PENDING`.
4. API publish job vào `submission_queue`.
5. Client nhận `submissionId`.

### 5.4. Worker flow

1. Worker consume job từ RabbitMQ.
2. Worker đổi trạng thái sang `RUNNING`.
3. Worker lấy test cases từ DB.
4. Executor chạy lần lượt từng test case.
5. Judge xác định verdict cuối cùng.
6. Submission và execution logs được lưu trong transaction.

### 5.5. Result flow

1. Client gọi `GET /api/submissions/:id`.
2. API trả trạng thái và result đã lưu.
3. Hidden test case vẫn được mask khi trả cho user.

## 6. Security design

### 6.1. Tại sao phải phòng thủ nhiều lớp

Regex hoặc validation ở HTTP layer không đủ để bảo vệ một online judge. Người dùng có thể né rule, obfuscate code hoặc tận dụng lỗ hổng runtime. Vì vậy dự án áp dụng defense-in-depth:

- chặn sớm ở API,
- cô lập khi chạy thực tế,
- giảm data leak nếu xảy ra lỗi,
- giới hạn tài nguyên để chống lạm dụng.

### 6.2. Các mối đe dọa chính

#### RCE

Nguy cơ:

- gọi shell command,
- spawn process con,
- thực hiện network callback,
- dùng syscall nguy hiểm.

Biện pháp:

- block các signature nguy hiểm ngay từ middleware,
- không chạy code trực tiếp trong API server,
- bắt buộc chạy trong Docker sandbox,
- drop capability và bật `no-new-privileges`.

#### DoS

Nguy cơ:

- gửi request body rất lớn,
- spam submission liên tục,
- infinite loop,
- fork bomb,
- spam output khổng lồ.

Biện pháp:

- giới hạn JSON body,
- rate limit theo IP và userId,
- queue để giảm áp lực lên API,
- `prefetch=1` ở worker,
- timeout theo ngôn ngữ,
- memory limit,
- `pids-limit`,
- `ulimit`,
- cắt output stdout và stderr.

#### Sandbox escape

Nguy cơ:

- đọc `/proc`, `/sys`,
- dò docker socket,
- dùng primitive như `ptrace`, `mount`, `unshare`,
- tận dụng quyền root hoặc capability dư thừa.

Biện pháp:

- `--read-only`,
- `--network none`,
- `--user 1001:1001`,
- `--cap-drop ALL`,
- `--security-opt no-new-privileges`,
- tmpfs nhỏ và giới hạn,
- block signature truy cập host path.

#### Data leak

Nguy cơ:

- lộ hidden test case,
- lộ env var,
- lộ đường dẫn host,
- lộ lỗi hạ tầng như Docker daemon.

Biện pháp:

- hidden test case không trả ra API problem detail,
- judge mask stdout, stderr, expected của hidden case,
- sanitize lỗi hạ tầng trước khi lưu và trả cho user,
- chặn truy cập pattern kiểu `process.env`, `os.environ`, file hệ thống.

## 7. Tại sao dùng queue

Nếu API vừa nhận request vừa chấm code đồng bộ:

- response time sẽ rất dài,
- API process dễ bị chiếm tài nguyên,
- scale khó hơn,
- khó tách lỗi execution khỏi lớp web.

Với queue:

- API phản hồi nhanh hơn,
- worker có thể scale độc lập,
- dễ quan sát backlog,
- giảm blast radius.

Trade-off:

- hệ thống phức tạp hơn,
- cần thêm RabbitMQ,
- client phải polling hoặc dùng cơ chế async khác.

## 8. Tại sao worker đang chạy tuần tự

Thiết kế hiện tại dùng `prefetch=1` để mỗi worker xử lý 1 submission tại một thời điểm.

Lợi ích:

- tránh overcommit tài nguyên Docker host,
- dễ dự đoán hơn,
- giảm xác suất DoS nội bộ do worker tự tranh CPU/RAM.

Bất lợi:

- throughput thấp hơn,
- độ trễ tăng khi backlog cao.

Đây là trade-off hợp lý ở giai đoạn đầu khi ưu tiên an toàn và tính ổn định hơn khả năng scale lớn.

## 9. Một số kỹ thuật đã áp dụng

- `TypeScript` để kiểm soát type tốt hơn.
- `Express` cho web layer.
- `Prisma` cho truy vấn DB và transaction.
- `PostgreSQL` cho dữ liệu quan hệ.
- `RabbitMQ` cho hàng đợi.
- `Docker` để cô lập môi trường chạy code.
- `JWT` cho access token.
- `HTTP-only refresh cookie`.
- `Vitest` cho unit test.
- `Swagger` cho API docs.

## 10. Các trade-off tổng thể

### Ưu tiên safety hơn raw performance

Điều này phù hợp với bài toán online judge ở giai đoạn đầu. Một submission độc hại có thể gây hậu quả nặng hơn việc kết quả trả chậm thêm vài giây.

### Ưu tiên thiết kế dễ hiểu

Luồng hiện tại là:

- nhận request,
- tạo submission,
- đẩy queue,
- worker chấm,
- lưu kết quả.

Thiết kế này giúp việc debug, test và onboarding dễ hơn so với mô hình quá tối ưu sớm.

### Chấp nhận một phần false positive ở lớp API

Threat detection bằng pattern có thể chặn nhầm một số case đặc biệt. Đổi lại, nó cho một lớp bảo vệ sớm và rẻ trước khi vào tầng execution.

## 11. Hạn chế hiện tại

- Frontend gần như chưa triển khai.
- Chưa có realtime update, client hiện phù hợp hơn với polling.
- Chưa có metrics và observability đầy đủ.
- Chưa có seccomp profile custom.
- Chưa có autoscaling cho worker.
- Chưa có dead-letter queue riêng.
- Chưa đo memory thật trên từng test case.
- Chưa có phân quyền admin rõ ràng ở các endpoint problem.

## 12. Hướng mở rộng tiếp theo

- Thêm `WebSocket` hoặc `SSE` để push trạng thái submission.
- Thêm `DLQ` cho job lỗi.
- Thêm `seccomp/apparmor` profile tùy chỉnh.
- Chạy runner trên node riêng hoặc VM riêng.
- Thêm monitoring như Prometheus, Grafana, structured logging.
- Thêm quota theo user hoặc theo plan.
- Tách auth/worker/api thành service rõ ràng hơn nếu hệ thống lớn lên.
- Bổ sung frontend, trang problem detail, submission history, leaderboard.

## 13. Tóm tắt triết lý thiết kế

Hệ thống này được xây theo nguyên tắc:

- không tin code người dùng,
- không chạy code ở web server,
- không để hidden test case lộ ra ngoài,
- không để lỗi hạ tầng rò rỉ quá nhiều,
- và luôn ưu tiên một lớp sandbox thực sự bên dưới lớp validate ở API.
