# THÁM TỬ ĐƯỜNG TRÒN — TRÒ CHƠI CẢ LỚP

## Game có những gì?

- **Cô giáo:** tạo phòng có **mã 6 ký tự**, tên lớp, thời gian mỗi câu 15/20/30 giây; lấy **QR và link học sinh**; bấm **Bắt đầu**; theo dõi tiến độ, số câu đúng/sai, học sinh nào sai từng câu, và bảng xếp hạng cập nhật khoảng 1,5 giây/lần.
- **Học sinh:** quét QR hoặc nhập mã phòng, nhập họ tên, chờ cô bắt đầu; làm 12 câu (6 câu nhận diện bằng ABCD, 6 câu chạm trên hình), có âm thanh đúng/sai, tính điểm theo thời gian.
- **Điểm:** câu đúng được 100 điểm và tối đa 50 điểm thưởng nếu trả lời nhanh. Câu sai hoặc hết giờ = 0. Tổng tối đa 1800 điểm. Thứ hạng: điểm cao hơn, rồi số câu đúng, rồi thời gian ngắn hơn.
- **Dây cung DE đã vẽ chéo**, đường kính BC nằm ngang.
- **Thống kê:** bảng 12 câu ghi rõ đã trả lời, đúng, sai, hết giờ và danh sách học sinh cần hỗ trợ. Cô có thể **Xuất Excel CSV** từ bảng điều khiển.

## Cách 1 — Dùng nhanh trong cùng mạng Wi-Fi của lớp

Cần có Python 3.10+ trên máy giáo viên và các thiết bị cùng một mạng nội bộ (học sinh truy cập được máy cô; một số Wi-Fi trường chặn liên lạc giữa các thiết bị).

1. Giải nén gói ZIP. Mở thư mục chứa `server.py`.
2. Trên Windows: chạy file `START_WINDOWS.bat`; hoặc mở Terminal và gõ:
   ```
   python -m pip install -r requirements.txt
   python server.py
   ```
3. Mở `http://localhost:8080` trên máy giáo viên, chọn **Tạo phòng**.
4. Trên bảng điều khiển, ứng dụng tự tìm IP trong mạng Wi-Fi để tạo **QR dẫn thẳng vào phòng**. Nếu link vẫn là `localhost`, cô thay phần địa chỉ bằng IP nội bộ của máy cô, ví dụ `http://192.168.1.25:8080/join?room=ABC123` (đây chỉ là ví dụ, không phải một link đang hoạt động).
5. Chiếu QR lên màn hình; học sinh dùng camera quét, nhập họ tên, chờ cô bấm **Bắt đầu cho lớp**; sau đó các con bấm **BẮT ĐẦU LÀM BÀI**.
6. Quan sát 3 tab: **Tiến độ học sinh** / **Thống kê câu sai** / **Bảng xếp hạng**. Cuối buổi bấm **Xuất Excel CSV**.

**Nếu học sinh quét QR mà không vào được:** bảo đảm cùng Wi-Fi, kiểm tra tường lửa Windows (cho phép Python trên mạng riêng), và xem Wi-Fi trường có chặn các máy kết nối với nhau không. Trong trường hợp bị chặn, dùng Cách 2.

**Để mở được bằng QR:** máy chủ `server.py` phải tiếp tục chạy. Không gửi riêng file HTML cho học sinh; nó không tự đồng bộ nhiều máy.

## Cách 2 — Đăng lên Internet để HS vào bằng điện thoại ở bất kỳ mạng nào

Đây là một ứng dụng Python có máy chủ, **không thể chạy trực tuyến nhiều máy chỉ bằng cách thả file HTML lên Netlify Drop**. Cần dịch vụ chạy backend, ví dụ Render.

1. Tạo repository riêng trong GitHub và đưa các file `server.py`, `requirements.txt`, `render.yaml` và thư mục `public` lên repository (không đưa `data/*.json` vào).
2. Trên Render, chọn **New > Blueprint** (hoặc một Web Service chạy Python), kết nối repository, rồi triển khai theo cấu hình có sẵn `render.yaml`.
3. Khi dịch vụ có địa chỉ công khai dạng `https://...`, mở địa chỉ đó, tạo phòng mới và chiếu **QR tự sinh trên bảng điều khiển**. QR sẽ trỏ đúng vào URL của phòng học sinh.
4. Học sinh quét QR, nhập tên, thực hành trên điện thoại hoặc máy tính; cô xem điểm ngay trên web.

**Lưu ý dữ liệu:** bản này lưu phòng và kết quả vào file JSON trên máy chủ. Trên một số dịch vụ hosting (nhất là máy chủ tạm thời hoặc gói miễn phí), file có thể **mất khi máy chủ bị thay mới/khởi động lại**. Vì vậy, **cô phải tải CSV cuối giờ**. Nếu muốn lưu trữ lâu dài qua nhiều buổi học, cần dùng ổ đĩa bền vững hoặc cơ sở dữ liệu ngoài.

## Các đường dẫn

- `/` — màn hình tạo phòng hoặc nhập mã.
- `/teacher?room=ABC123#key=...` — dashboard chỉ dành cho cô; **không chia sẻ URL này**.
- `/join?room=ABC123` — link dành cho học sinh (QR trỏ tới đây).
- `/api/health` — kiểm tra trạng thái máy chủ.

## Lưu ý bảo mật khi dùng trong lớp

- Cô chỉ chia sẻ QR hoặc link **học sinh**, không chia sẻ URL giáo viên có khóa `#key=`.
- Đặt tên lớp ở mức cần thiết; tránh nhập dữ liệu cá nhân nhạy cảm vào tên phòng/họ tên học sinh.
- Mỗi học sinh nên nhập **đầy đủ họ tên** để tránh trùng; trong cùng phòng một tên chỉ tham gia một lần.
- Nếu cần phòng mới cho tiết học khác, mở trang chủ và tạo một phòng mới.
- Thời gian làm bài và điểm được tính phía máy chủ để hạn chế tính điểm sai do thay đổi đồng hồ trên thiết bị học sinh.

## Vận hành

- `PORT`: cổng ứng dụng (mặc định 8080), dịch vụ hosting thường gán tự động.
- `QUIZ_DATA_FILE`: nơi lưu JSON (mặc định `data/rooms.json`).
- `requirements.txt` sử dụng thư viện QR nhỏ gọn; không cần các gói JavaScript.
