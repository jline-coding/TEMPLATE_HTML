#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# 🚀 DEPLOY VIA SSH + RSYNC
# ──────────────────────────────────────────────────────────
# An toàn tuyệt đối:
#   - Repo Lock: ngăn deploy nhầm thư mục / chéo dự án
#   - Path Traversal Protection: chặn project_dir nguy hiểm
#   - Dry-run trước khi thực thi rsync --delete
#   - Tương thích 3 phương thức: ftp / zip / rsync
#
# Yêu cầu:
#   - SSH Key đã được cài đặt (qua webfactory/ssh-agent)
#   - Biến môi trường: SERVER_SECRET_JSON, DEPLOY_ENV, DEPLOY_BRANCH
#   - File: deploy-config.json
# ──────────────────────────────────────────────────────────

set -euo pipefail

echo ""
echo "================================================"
echo "   HE THONG DEPLOY AN TOAN - SSH/RSYNC"
echo "================================================"
echo ""

# ─────────────────────────────────────────────
# 1. Đọc cấu hình
# ─────────────────────────────────────────────

DEPLOY_ENV="${DEPLOY_ENV:-production}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-}"
GITHUB_REPO="${GITHUB_REPO:-}"

echo "Branch: ${DEPLOY_BRANCH:-'(unknown)'} -> Environment: $(echo "$DEPLOY_ENV" | tr 'a-z' 'A-Z')"

# Đọc deploy-config.json
if [ ! -f "deploy-config.json" ]; then
    echo "[ERROR] Khong tim thay file deploy-config.json!"
    exit 1
fi

SOURCE_FOLDER=$(jq -r '.source_folder // "public"' deploy-config.json)
PROJECT_DIR=$(jq -r --arg env "$DEPLOY_ENV" '.[$env].project_dir // ""' deploy-config.json)

# Đọc basic_auth (nếu có)
BASIC_AUTH_USER=$(jq -r --arg env "$DEPLOY_ENV" '.[$env].basic_auth.username // ""' deploy-config.json)
BASIC_AUTH_PASS=$(jq -r --arg env "$DEPLOY_ENV" '.[$env].basic_auth.password // ""' deploy-config.json)

echo "   Project Dir: $PROJECT_DIR"
echo "   Source: $SOURCE_FOLDER/"
echo ""

# ─────────────────────────────────────────────
# 2. Kiểm tra an toàn (Security Validations)
# ─────────────────────────────────────────────

# 2a. Kiểm tra source folder tồn tại
if [ ! -d "$SOURCE_FOLDER" ]; then
    echo "[ERROR] Source folder \"$SOURCE_FOLDER\" does not exist!"
    echo "   Kiem tra has_build_step: true trong deploy-config.json."
    exit 1
fi

# 2b. PATH TRAVERSAL PROTECTION: project_dir chỉ được chứa ký tự an toàn
if [[ ! "$PROJECT_DIR" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
    echo "[ERROR] CRITICAL: project_dir \"$PROJECT_DIR\" chua ky tu NGUY HIEM!"
    echo "   Chi cho phep: a-z, A-Z, 0-9, dot (.), dash (-), underscore (_)."
    echo "   Server protection: auto-terminated."
    exit 1
fi

# ─────────────────────────────────────────────
# 3. Parse Server Config từ Secret JSON (Đã chạy ở github actions)
# ─────────────────────────────────────────────

# Các biến SSH_HOST, SSH_USER, SSH_PORT, ROOT_PATH, FTP_GIT đã được ném từ deploy.yml
SSH_PORT="${SSH_PORT:-22}"

if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ] || [ -z "$ROOT_PATH" ]; then
    echo "[ERROR] Server Secret thieu thong tin bat buoc!"
    echo "   Can co: host, user, root_path"
    echo "   Tuy chon: ssh_port (mac dinh: 22)"
    exit 1
fi

TARGET_DIR="${ROOT_PATH}/${PROJECT_DIR}"

if [ -n "$FTP_GIT" ]; then
    REMOTE_META_DIR="${FTP_GIT}/.deploy/${PROJECT_DIR}"
else
    REMOTE_META_DIR="${TARGET_DIR}/.deploy"
fi

echo "Config:"
echo "   Server: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
echo "   Target: ${TARGET_DIR}"
echo "   Meta:   ${REMOTE_META_DIR}"
echo ""

# SSH options dùng chung
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p ${SSH_PORT}"

# Helper function: chạy lệnh SSH trên server
ssh_exec() {
    ssh $SSH_OPTS "${SSH_USER}@${SSH_HOST}" "$@"
}

# ─────────────────────────────────────────────
# 4. SECURITY: Repo Lock (chống deploy nhầm thư mục)
# ─────────────────────────────────────────────

LOCK_ID="${GITHUB_REPO}:${DEPLOY_ENV}"
IS_FIRST_DEPLOY=false

# Kiểm tra thư mục đích có tồn tại không
DIR_EXISTS=$(ssh_exec "[ -d '${TARGET_DIR}' ] && echo 'yes' || echo 'no'")

if [ "$DIR_EXISTS" = "yes" ]; then
    echo "[INFO] Thu muc da ton tai, kiem tra repo lock..."

    # Đọc .repo_lock từ server
    LOCK_CONTENT=$(ssh_exec "cat '${REMOTE_META_DIR}/.repo_lock' 2>/dev/null || cat '${TARGET_DIR}/.deploy/.repo_lock' 2>/dev/null || cat '${TARGET_DIR}/.repo_lock' 2>/dev/null || echo ''")

    if [ -z "$LOCK_CONTENT" ]; then
        echo "========================================"
        echo "   [ERROR] THU MUC DA TON TAI NHUNG"
        echo "   KHONG CO FILE .repo_lock"
        echo "========================================"
        echo "Thu muc [${PROJECT_DIR}] da ton tai tren server nhung khong co .repo_lock."
        echo "Co the thu muc nay duoc tao thu cong hoac boi he thong khac."
        echo ""
        echo "Cach xu ly:"
        echo "  1. Xoa thu muc tren server thu cong, roi deploy lai."
        echo "  2. Tao file .repo_lock thu cong tai: ${REMOTE_META_DIR}/.repo_lock voi noi dung: ${LOCK_ID}"
        echo ""
        echo "DEPLOY BI HUY de bao ve du lieu."
        exit 1
    fi

    # So sánh lock (tương thích ngược với format cũ không có :env)
    if [ "$LOCK_CONTENT" != "$LOCK_ID" ] && [ "$LOCK_CONTENT" != "$GITHUB_REPO" ]; then
        echo "[SECURITY] Thu muc [${PROJECT_DIR}] thuoc ve [${LOCK_CONTENT}]."
        echo "   Hien tai: [${LOCK_ID}]. DEPLOY BI HUY!"
        exit 1
    fi

    echo "[OK] Repo lock khop [${LOCK_CONTENT}] - an toan de tiep tuc."

    # MIGRATION: Nâng cấp cấu trúc metadata cũ lên hệ thống mới NGAY LẬP TỨC
    ssh_exec "mkdir -p '${REMOTE_META_DIR}'"
    ssh_exec "
        [ -f '${TARGET_DIR}/.deploy/.repo_lock' ] && mv '${TARGET_DIR}/.deploy/.repo_lock' '${REMOTE_META_DIR}/.repo_lock'
        [ -f '${TARGET_DIR}/.deploy/.deploy_sha' ] && mv '${TARGET_DIR}/.deploy/.deploy_sha' '${REMOTE_META_DIR}/.deploy_sha'
        [ -f '${TARGET_DIR}/.deploy/.deploy_manifest.json' ] && mv '${TARGET_DIR}/.deploy/.deploy_manifest.json' '${REMOTE_META_DIR}/.deploy_manifest.json'
        
        [ -f '${TARGET_DIR}/.repo_lock' ] && mv '${TARGET_DIR}/.repo_lock' '${REMOTE_META_DIR}/.repo_lock'
        [ -f '${TARGET_DIR}/.deploy_sha' ] && mv '${TARGET_DIR}/.deploy_sha' '${REMOTE_META_DIR}/.deploy_sha'
        [ -f '${TARGET_DIR}/.deploy_manifest.json' ] && mv '${TARGET_DIR}/.deploy_manifest.json' '${REMOTE_META_DIR}/.deploy_manifest.json'

        rm -f '${TARGET_DIR}/.repo_lock' 2>/dev/null
        rm -f '${TARGET_DIR}/.deploy_sha' 2>/dev/null
        rm -f '${TARGET_DIR}/.deploy_manifest.json' 2>/dev/null
        rm -rf '${TARGET_DIR}/.deploy' 2>/dev/null
    " 2>/dev/null || true

else
    IS_FIRST_DEPLOY=true
    echo "[INFO] Thu muc chua ton tai - lan deploy dau tien."
fi

# ─────────────────────────────────────────────
# 5. Chuẩn bị thư mục metadata trung gian ở Local (/tmp)
# ─────────────────────────────────────────────

# Thay vì tạo trong Source Folder (dễ bị rsync kéo nhầm), ta tạo riêng ở /tmp
LOCAL_META_DIR="/tmp/.deploy_meta"
rm -rf "$LOCAL_META_DIR"
mkdir -p "$LOCAL_META_DIR"

# 5a. Tạo .repo_lock
echo "$LOCK_ID" > "${LOCAL_META_DIR}/.repo_lock"
echo "[OK] .repo_lock: ${LOCK_ID}"

# 5b. Lưu SHA hiện tại
CURRENT_SHA=$(git rev-parse HEAD)
echo "$CURRENT_SHA" > "${LOCAL_META_DIR}/.deploy_sha"
echo "[OK] SHA: ${CURRENT_SHA:0:8}"

# ─────────────────────────────────────────────
# 6. Tạo .htpasswd & .htaccess (nếu có basic_auth)
# ─────────────────────────────────────────────

if [ -n "$BASIC_AUTH_USER" ] && [ -n "$BASIC_AUTH_PASS" ]; then
    echo ""
    echo "--- Tao .htpasswd & .htaccess ---"

    # Tạo .htpasswd bằng htpasswd hoặc openssl
    if command -v htpasswd &>/dev/null; then
        htpasswd -cb "/tmp/.htpasswd" "$BASIC_AUTH_USER" "$BASIC_AUTH_PASS"
    else
        # Fallback: dùng openssl (có sẵn trên Ubuntu runner)
        HASHED_PASS=$(openssl passwd -apr1 "$BASIC_AUTH_PASS")
        echo "${BASIC_AUTH_USER}:${HASHED_PASS}" > "/tmp/.htpasswd"
    fi

    # Tạo .htaccess
    cat > "/tmp/.htaccess" << HTEOF
<Files ~ "^\.">
Deny from all
</Files>
AuthType Basic
AuthName "Restricted Area"
AuthUserFile ${TARGET_DIR}/.htpasswd
Require valid-user
HTEOF

    echo "[OK] .htpasswd & .htaccess da tao."
else
    echo "[INFO] basic_auth khong co - bo qua .htpasswd/.htaccess."
fi

# ─────────────────────────────────────────────
# 7. Tạo thư mục đích trên server (lần đầu)
# ─────────────────────────────────────────────

if [ "$IS_FIRST_DEPLOY" = true ]; then
    echo ""
    echo "--- FIRST DEPLOY: Tao cau truc thu muc ---"
    ssh_exec "mkdir -p '${TARGET_DIR}' && mkdir -p '${REMOTE_META_DIR}'"
    echo "[OK] Thu muc da tao: ${TARGET_DIR} va ${REMOTE_META_DIR}"
fi

# ─────────────────────────────────────────────
# 8. CHECK SHA - Bỏ qua nếu không thay đổi
# ─────────────────────────────────────────────

if [ "$IS_FIRST_DEPLOY" = false ]; then
    LAST_SHA=$(ssh_exec "cat '${REMOTE_META_DIR}/.deploy_sha' 2>/dev/null || echo ''")
    if [ -n "$LAST_SHA" ]; then
        echo "Previous SHA: ${LAST_SHA:0:8}"
        echo "Current SHA:  ${CURRENT_SHA:0:8}"
        if [ "$LAST_SHA" = "$CURRENT_SHA" ]; then
            echo "[INFO] SHA giong nhau - khong can update."
            echo ""
            echo "[OK] Deploy hoan tat (khong co thay doi)."
            exit 0
        fi
    fi
fi

# ─────────────────────────────────────────────
# 9. RSYNC: Đồng bộ source → server
# ─────────────────────────────────────────────

echo ""
echo "--- RSYNC: Dong bo files ---"

# Khởi tạo danh sách loại trừ bảo mật mặc định
EXCLUDE_FILE="/tmp/rsync-exclude.txt"
cat > "$EXCLUDE_FILE" << 'EOF'
.htaccess
.htpasswd
.deploy
.deploy_sha
.deploy_manifest.json
.repo_lock
EOF

# Đọc thêm ngoại lệ (ignore_paths) từ deploy-config.json để bảo tồn các thư mục của user upload
IGNORE_PATHS=$(jq -r --arg env "$DEPLOY_ENV" '.[$env].ignore_paths[]? // empty' deploy-config.json)
if [ -n "$IGNORE_PATHS" ]; then
    echo "--- Paths exclude tu config ---"
    echo "$IGNORE_PATHS"
    echo "$IGNORE_PATHS" >> "$EXCLUDE_FILE"
fi

# Quan trọng: source_folder phải kết thúc bằng "/" để rsync copy nội dung (không copy tên thư mục)
RSYNC_SRC="${SOURCE_FOLDER}/"
RSYNC_DEST="${SSH_USER}@${SSH_HOST}:${TARGET_DIR}/"

echo "Source:  ${RSYNC_SRC}"
echo "Dest:    ${RSYNC_DEST}"
echo ""

# DRY-RUN trước → hiển thị những gì sẽ thay đổi (an toàn tuyệt đối)
echo "--- Dry-run (preview thay doi) ---"
rsync -avz --dry-run --delete \
    --exclude-from="$EXCLUDE_FILE" \
    -e "ssh ${SSH_OPTS}" \
    "$RSYNC_SRC" "$RSYNC_DEST" 2>&1 | tail -20

echo ""
echo "--- Thuc thi rsync ---"

# RSYNC thật - đồng bộ hoàn toàn thay đổi (thêm sửa xóa) TRONG phạm vi project_dir
rsync -avz --delete \
    --exclude-from="$EXCLUDE_FILE" \
    --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
    -e "ssh ${SSH_OPTS}" \
    "$RSYNC_SRC" "$RSYNC_DEST"

RSYNC_EXIT=$?

if [ $RSYNC_EXIT -ne 0 ]; then
    echo "[ERROR] Rsync that bai voi exit code: ${RSYNC_EXIT}"
    exit $RSYNC_EXIT
fi

echo ""
echo "[OK] Rsync hoan tat thanh cong!"

# ─────────────────────────────────────────────
# 10. Upload .htpasswd & .htaccess (nếu có)
# ─────────────────────────────────────────────

if [ -n "$BASIC_AUTH_USER" ] && [ -n "$BASIC_AUTH_PASS" ]; then
    echo ""
    echo "--- Dong bo .htpasswd & .htaccess ---"

    cat "/tmp/.htpasswd" | ssh_exec "cat > '${TARGET_DIR}/.htpasswd'"
    cat "/tmp/.htaccess" | ssh_exec "cat > '${TARGET_DIR}/.htaccess'"

    # Đặt quyền chặt cho file bảo mật (644 thay vì 640 để Apache www-data có thể đọc)
    ssh_exec "chmod 644 '${TARGET_DIR}/.htaccess' && chmod 644 '${TARGET_DIR}/.htpasswd'"

    echo "[OK] .htpasswd & .htaccess da dong bo."

    echo "[OK] .htpasswd & .htaccess da dong bo."
    rm -f /tmp/.htpasswd /tmp/.htaccess
fi

# ─────────────────────────────────────────────
# 10.5 Cập nhật cục bộ Metadata (.repo_lock, .deploy_sha)
# ─────────────────────────────────────────────
echo "--- Cap nhat Metadata Tracking ---"
cat "${LOCAL_META_DIR}/.repo_lock" | ssh_exec "cat > '${REMOTE_META_DIR}/.repo_lock'"
cat "${LOCAL_META_DIR}/.deploy_sha" | ssh_exec "cat > '${REMOTE_META_DIR}/.deploy_sha'"
echo "[OK] Nhat ky Deploy ghi nhan thanh cong."

# ─────────────────────────────────────────────
# 11. Cleanup local
# ─────────────────────────────────────────────

rm -f "$EXCLUDE_FILE"
rm -rf "$LOCAL_META_DIR"

echo "================================================"
echo "   DEPLOY HOAN TAT THANH CONG!"
echo "================================================"
echo ""
echo "  Environment: $(echo "$DEPLOY_ENV" | tr 'a-z' 'A-Z')"
echo "  Server:      ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
echo "  Target:      ${TARGET_DIR}"
echo "  SHA:         ${CURRENT_SHA:0:8}"
echo ""
