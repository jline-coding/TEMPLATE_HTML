# Workbench — kết quả khắc phục ngày 20/10/2026

Đã sửa các lỗi được tái hiện trong lần rà soát, bổ sung tests cho các trường hợp mất dữ liệu và giữ các luồng import/export, preview, snippets và build production.

## Thay đổi theo chức năng

| Chức năng | Cách xử lý sau sửa |
|---|---|
| Xóa component dùng chung JS/SCSS | Chỉ gỡ module JS có marker xác định; giữ phần của component khác và code đầu file. Nếu không xác định được quyền sở hữu, giữ file dùng chung và trả cảnh báo. Giữ stylesheet/index còn được component khác tham chiếu. |
| Backup | Tìm file thật theo metadata và quy tắc tên số ít/số nhiều; lưu cả JS dùng chung, stylesheet và index có thể bị thay đổi. Có manifest ánh xạ về đường dẫn gốc, tên snapshot duy nhất và tương thích danh sách backup cũ. |
| Lưu/xóa/export nhiều file | Dùng transaction ghi nhận trạng thái đầu tiên của từng file. Khi gặp lỗi giữa chừng, khôi phục file đã thay đổi/xóa và gỡ file mới. Báo rõ nếu rollback không hoàn tất. |
| Bảo vệ chỉnh sửa của người dùng | Import, save, remove và reimport JS của variant kiểm tra conflict khi nội dung tùy chỉnh có nguy cơ bị thay thế. Force vẫn có thể dùng khi người dùng chủ động chọn ghi đè/gỡ bỏ. Lưu snapshot trước thay đổi. |
| Xóa variant | Kiểm tra revision SHA-256 của EJS từ giao diện; đối chiếu index/class/comment. Dữ liệu cũ hoặc lựa chọn không xác định duy nhất được từ chối thay vì xóa nhầm. Chỉ dọn CSS khi thao tác EJS thành công và không còn component khác dùng nó. |
| Import HTML | Chỉ bỏ showroom wrapper có thẻ đóng cân bằng, giữ nguyên HTML div thông thường và các phần tử lồng nhau. |
| JS round-trip | Cùng một cách tìm/tách module cho import, save và remove, kể cả module trong common.js hoặc JS đích khác. Không nhân đôi JS khi import lặp. Marker được cập nhật phù hợp khi dùng tên khác qua as. |
| Metadata và trạng thái | Registry, installer, backup, variant và manager dùng chung cách phân giải file/category; hỗ trợ layout và tên SCSS tùy chỉnh. Nhận trạng thái component chỉ có JS, so sánh phiên bản theo phần số và prerelease. |
| Dependency | Dependency khai báo bắt buộc bị thiếu gây lỗi và rollback; phát hiện chu trình và không cài lặp dependency đã hoàn tất trong cùng transaction. Dependency tự suy ra nhưng không có được giữ là cảnh báo để không phá các thư viện đã tùy biến. |
| Variant thiếu nguồn | Từ chối component/class/modifier không tồn tại thay vì tạo placeholder rồi báo thành công. Vẫn hỗ trợ component chỉ có JS khi chọn JS đích. |
| API | Body phải là JSON object hợp lệ, tối đa 1 MB; kiểm tra kiểu các trường, cardIndex và batch variant. Trả 400/413 rõ ràng thay vì TypeError. Batch tối đa 2000 item, dùng cache SCSS trong mỗi request. |
| Preview | Bỏ thực thi JS lần hai qua new Function; components.js khởi tạo module sau khi catalog tạo card. Xếp hàng các lần build để tránh ghi output đồng thời. Lỗi SCSS/cleanup chính được truyền lên; nếu lưu nguồn thành công nhưng rebuild preview lỗi, API vẫn phân biệt thành công lưu và cảnh báo preview. |
| Tests export selection | Chuyển sang fixtures trong sandbox, không ghi vào file nguồn hoặc component mà người dùng đang chỉnh sửa. |

## Xác minh

- 149 tests thuộc 13 file; có chạy toàn bộ với thứ tự đảo ngẫu nhiên, seed 42.
- Tests mới bao gồm shared JS/SCSS, EJS tùy chỉnh, revision cũ, metadata layout, dependency thiếu/chu trình, phiên bản, API body, alias và import lặp.
- Chủ động mô phỏng lỗi ghi file và unlink giữa chừng để kiểm tra rollback của save/remove.
- Build production trước và sau sửa trên bản sao: 567 file đầu ra giống nhau về SHA-256.
- Import cả 8 component thật rồi build client trên bản sao: thành công.
- Xóa cả 8 component thật trên bản sao: showroom rỗng tạo thành công, fingerprint src không đổi; tests trên workbench rỗng pass.
- Mở showroom bản sao trên Chrome: 8 module, 35 card, revision của mọi section hợp lệ; không ghi nhận lỗi JavaScript console trong thời gian quan sát.
- Kiểm tra cú pháp exporter và catalog JavaScript; kiểm tra whitespace diff của scripts/tests/workbench.
- Đã đóng tab QA, dừng server tạm và dọn bản sao kiểm thử. Những thay đổi public/VSIX đã có trong workspace trước lượt sửa được giữ nguyên.

## Phạm vi bảo đảm

Rollback xử lý lỗi được bắt trong tiến trình, snapshot trên đĩa hỗ trợ phục hồi khi cần. Đây không phải cam kết transaction nguyên tử khi hệ điều hành bị ngắt hoặc ổ đĩa hỏng. Preview vẫn dành cho code tin cậy của project, không phải sandbox chạy code bên ngoài. Đã kiểm tra trang preview thực tế, chưa chạy ma trận toàn bộ trình duyệt/viewport, tải lớn hoặc mọi tương tác UI.

## Nút xóa toàn bộ thư viện

Đã thêm nút “Xóa tất cả component” ở đầu Workbench, hỗ trợ tiếng Việt/Nhật. Nút vô hiệu hóa khi thư viện trống, hiển thị xác nhận phạm vi toàn thư viện và khóa trong khi xử lý để tránh bấm lặp.

API POST /__api/clear-workbench yêu cầu token, xác nhận rõ ràng và revision thư viện khớp với trang đã mở. Một kế hoạch xóa, một snapshot đầy đủ và một transaction cho toàn bộ thao tác; chỉ rebuild preview một lần. Khi một bước thất bại, các file đã thay đổi/xóa được khôi phục. Không xóa src, cấu trúc Workbench hoặc container nền; JS dùng chung chỉ được gỡ phần có marker xác định. File JS riêng của một nhóm có thể gồm nhiều variant và được sao lưu/xóa cùng nhóm đó.

Đã thử qua HTTP trên bản sao với 8 component thật: xóa hết registry, src không đổi, showroom trống và nút disabled; workbench.scss vẫn biên dịch. Tests bổ sung kiểm tra token/phương thức/xác nhận/revision, rollback khi xóa thất bại, dừng khi backup lỗi, JS/SCSS dùng chung và import SCSS có namespace/forward. Không thực hiện xóa thư viện thật của người dùng trong lượt thêm tính năng.
