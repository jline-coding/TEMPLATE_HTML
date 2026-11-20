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

SOURCE_FOLDER=$(jq -r '.source_folder | select(. != null and . != "") // "public"' deploy-config.json)
PROJECT_DIR=$(jq -r --arg env "$DEPLOY_ENV" '.[$env].project_dir // .project_dir // ""' deploy-config.json)

# Đọc basic_auth (nếu có)
BASIC_AUTH_USER=$(jq -r --arg env "$DEPLOY_ENV" '.[$env].basic_auth.username // ""' deploy-config.json)
BASIC_AUTH_PASS=$(jq -r --arg env "$DEPLOY_ENV" '.[$env].basic_auth.password // ""' deploy-config.json)

# Đọc chế độ xử lý .htaccess (mặc định: merge)
HTACCESS_CONFIG=$(jq -r --arg env "$DEPLOY_ENV" '.[$env].htaccess // .htaccess // "merge"' deploy-config.json)
HTACCESS_CONFIG="${HTACCESS_CONFIG:-merge}"

echo "   Project Dir: $PROJECT_DIR"
echo "   Source:      $SOURCE_FOLDER/"
echo "   Htaccess:    $HTACCESS_CONFIG"
echo ""

# ─────────────────────────────────────────────
# 2. Kiểm tra an toàn (Security Validations)
# ─────────────────────────────────────────────

# 2a. Kiểm tra source folder tồn tại
if [ ! -d "$SOURCE_FOLDER" ]; then
    echo "[ERROR] Source folder \"$SOURCE_FOLDER\" does not exist!"
    echo "   Vui long chac chan ban da build source hoac kiem tra lai ten source_folder."
    exit 1
fi

# 2a-1. PATH TRAVERSAL & CONFINEMENT PROTECTION: source_folder
if [[ ! "$SOURCE_FOLDER" =~ ^[a-zA-Z0-9_-]+$ ]] || [[ "$SOURCE_FOLDER" =~ ^(src|scripts|\.git|node_modules|workbench)$ ]]; then
    echo "[ERROR] CRITICAL: [SECURITY P0] source_folder \"$SOURCE_FOLDER\" chua ky tu hoac thu muc NGUY HIEM!"
    echo "   Chi cho phep ten thu muc hop le (vd: public, dist) va khong duoc tro vao src, scripts, .git."
    echo "   Server protection: auto-terminated."
    exit 1
fi

# 2b. PATH TRAVERSAL PROTECTION: project_dir chỉ được chứa ký tự an toàn
if [[ ! "$PROJECT_DIR" =~ ^[a-zA-Z0-9_.-]+$ ]] || [[ "$PROJECT_DIR" == "." || "$PROJECT_DIR" == ".." ]]; then
    echo "[ERROR] CRITICAL: project_dir \"$PROJECT_DIR\" chua ky tu NGUY HIEM!"
    echo "   Chi cho phep: a-z, A-Z, 0-9, dot (.), dash (-), underscore (_)."
    echo "   Server protection: auto-terminated."
    exit 1
fi

# 2c. VALIDATION & PATH CONFINEMENT: htaccess mode / custom file path
HTACCESS_MODE=""
HTACCESS_SOURCE_FILE=""
case "$HTACCESS_CONFIG" in
    merge)
        HTACCESS_MODE="merge"
        HTACCESS_SOURCE_FILE="${SOURCE_FOLDER}/.htaccess"
        ;;
    basic_auth_only)
        HTACCESS_MODE="basic_auth_only"
        HTACCESS_SOURCE_FILE=""
        ;;
    preserve)
        HTACCESS_MODE="preserve"
        HTACCESS_SOURCE_FILE=""
        ;;
    *)
        if [[ ! "$HTACCESS_CONFIG" =~ ^[a-zA-Z0-9_./-]+$ ]] \
            || [[ "$HTACCESS_CONFIG" == /* ]] \
            || [[ "$HTACCESS_CONFIG" =~ (^|/)\.\.(/|$) ]] \
            || [[ "$HTACCESS_CONFIG" =~ ^(\.git(/|$)|\.env($|\.)|node_modules(/|$)|\.htpasswd$) ]]; then
            echo "[ERROR] CRITICAL: [SECURITY P0] htaccess \"$HTACCESS_CONFIG\" khong hop le hoac chua path traversal!"
            echo "   Chi cho phep: \"merge\", \"basic_auth_only\", \"preserve\", hoac duong dan file tuong doi an toan trong repo."
            exit 1
        fi
        if [ ! -f "$HTACCESS_CONFIG" ]; then
            echo "[ERROR] Khong tim thay file htaccess tuy chinh: \"$HTACCESS_CONFIG\"!"
            exit 1
        fi
        REPO_ROOT_REAL=$(pwd -P)
        HT_DIR_REAL=$(cd "$(dirname "$HTACCESS_CONFIG")" 2>/dev/null && pwd -P || true)
        if [ -z "$HT_DIR_REAL" ] || { [ "$HT_DIR_REAL" != "$REPO_ROOT_REAL" ] && [[ "$HT_DIR_REAL" != "$REPO_ROOT_REAL/"* ]]; }; then
            echo "[ERROR] CRITICAL: [SECURITY P0] htaccess \"$HTACCESS_CONFIG\" vuot ra ngoai thu muc du an!"
            exit 1
        fi
        if [ -L "$HTACCESS_CONFIG" ]; then
            HT_TARGET_REAL=$(realpath "$HTACCESS_CONFIG" 2>/dev/null || true)
            if [ -z "$HT_TARGET_REAL" ] || [[ "$HT_TARGET_REAL" != "$REPO_ROOT_REAL/"* ]]; then
                echo "[ERROR] CRITICAL: [SECURITY P0] htaccess symlink \"$HTACCESS_CONFIG\" tro ra ngoai thu muc du an!"
                exit 1
            fi
        fi
        HTACCESS_MODE="file"
        HTACCESS_SOURCE_FILE="$HTACCESS_CONFIG"
        ;;
esac

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

# SSH options dùng chung (với ControlMaster multiplexing để reuse kết nối)
SSH_CONTROL_PATH="/tmp/ssh-deploy-%r@%h:%p"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p ${SSH_PORT} -o ControlMaster=auto -o ControlPath=${SSH_CONTROL_PATH} -o ControlPersist=60"

# Helper function: chạy lệnh SSH trên server
ssh_exec() {
    ssh $SSH_OPTS "${SSH_USER}@${SSH_HOST}" "$@"
}

# Cleanup SSH multiplexing & temp files on exit
cleanup_ssh() {
    ssh -O exit -o ControlPath="${SSH_CONTROL_PATH}" "${SSH_USER}@${SSH_HOST}" 2>/dev/null || true
    if [ -n "${LOCAL_META_DIR:-}" ] && [ -d "${LOCAL_META_DIR}" ]; then
        rm -rf "${LOCAL_META_DIR}" 2>/dev/null || true
    fi
}
trap cleanup_ssh EXIT

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
    if [ "$REMOTE_META_DIR" != "${TARGET_DIR}/.deploy" ]; then
        ssh_exec "
            [ -f '${TARGET_DIR}/.deploy/.repo_lock' ] && mv '${TARGET_DIR}/.deploy/.repo_lock' '${REMOTE_META_DIR}/.repo_lock'
            [ -f '${TARGET_DIR}/.deploy/.deploy_sha' ] && mv '${TARGET_DIR}/.deploy/.deploy_sha' '${REMOTE_META_DIR}/.deploy_sha'
            [ -f '${TARGET_DIR}/.deploy/.deploy_manifest.json' ] && mv '${TARGET_DIR}/.deploy/.deploy_manifest.json' '${REMOTE_META_DIR}/.deploy_manifest.json'
            rm -rf '${TARGET_DIR}/.deploy' 2>/dev/null
        " 2>/dev/null || true
    fi
    ssh_exec "
        [ -f '${TARGET_DIR}/.repo_lock' ] && mv '${TARGET_DIR}/.repo_lock' '${REMOTE_META_DIR}/.repo_lock'
        [ -f '${TARGET_DIR}/.deploy_sha' ] && mv '${TARGET_DIR}/.deploy_sha' '${REMOTE_META_DIR}/.deploy_sha'
        [ -f '${TARGET_DIR}/.deploy_manifest.json' ] && mv '${TARGET_DIR}/.deploy_manifest.json' '${REMOTE_META_DIR}/.deploy_manifest.json'
        rm -f '${TARGET_DIR}/.repo_lock' '${TARGET_DIR}/.deploy_sha' '${TARGET_DIR}/.deploy_manifest.json' 2>/dev/null
    " 2>/dev/null || true

else
    IS_FIRST_DEPLOY=true
    echo "[INFO] Thu muc chua ton tai - lan deploy dau tien."
fi

# ─────────────────────────────────────────────
# 5. Chuẩn bị thư mục metadata trung gian ở Local (mktemp)
# ─────────────────────────────────────────────

# Thay vì tạo trong Source Folder (dễ bị rsync kéo nhầm), ta tạo riêng trong thư mục tạm độc lập
LOCAL_META_DIR=$(mktemp -d)

# 5a. Tạo .repo_lock
echo "$LOCK_ID" > "${LOCAL_META_DIR}/.repo_lock"
echo "[OK] .repo_lock: ${LOCK_ID}"

# 5b. Lưu SHA hiện tại
CURRENT_SHA=$(git rev-parse HEAD)
echo "$CURRENT_SHA" > "${LOCAL_META_DIR}/.deploy_sha"
echo "[OK] SHA: ${CURRENT_SHA:0:8}"

# ─────────────────────────────────────────────
# 6. Helper & chuẩn bị .htpasswd / block Basic Auth
# ─────────────────────────────────────────────

strip_auto_basic_auth() {
    tr -d '\r' | awk '
        BEGIN { skip = 0; started = 0; blanks = "" }
        /^# BEGIN AUTO BASIC AUTH[[:space:]]*$/ { skip = 1; next }
        /^# END AUTO BASIC AUTH[[:space:]]*$/ { skip = 0; next }
        skip { next }
        /^[[:space:]]*$/ {
            if (started) blanks = blanks "\n"
            next
        }
        {
            if (started) printf "%s", blanks
            blanks = ""
            started = 1
            print
        }
    '
}

compose_htaccess() {
    local auth_file="$1"
    local body_file="$2"
    local out_file="$3"
    : > "$out_file"
    if [ -n "$auth_file" ] && [ -s "$auth_file" ] && [ -n "$body_file" ] && [ -s "$body_file" ]; then
        cat "$auth_file" > "$out_file"
        printf '\n' >> "$out_file"
        cat "$body_file" >> "$out_file"
    elif [ -n "$auth_file" ] && [ -s "$auth_file" ]; then
        cat "$auth_file" > "$out_file"
    elif [ -n "$body_file" ] && [ -s "$body_file" ]; then
        cat "$body_file" > "$out_file"
    fi
}

HTACCESS_AUTH_FILE="${LOCAL_META_DIR}/.htaccess.auth"
HTACCESS_BODY_FILE="${LOCAL_META_DIR}/.htaccess.body"
HTACCESS_FINAL_FILE="${LOCAL_META_DIR}/.htaccess.final"
: > "$HTACCESS_AUTH_FILE"

if [ -n "$BASIC_AUTH_USER" ] && [ -n "$BASIC_AUTH_PASS" ]; then
    echo ""
    echo "--- Chuan bi .htpasswd & block Basic Auth ---"

    # Tạo .htpasswd bằng openssl (có sẵn trên Ubuntu runner)
    HASHED_PASS=$(openssl passwd -apr1 "$BASIC_AUTH_PASS")
    printf '%s:%s\n' "$BASIC_AUTH_USER" "$HASHED_PASS" > "${LOCAL_META_DIR}/.htpasswd"

    # Tạo block Basic Auth có marker để merge/update an toàn
    cat > "$HTACCESS_AUTH_FILE" << HTEOF
# BEGIN AUTO BASIC AUTH
<Files ~ "^\.">
Deny from all
</Files>
AuthType Basic
AuthName "Restricted Area"
AuthUserFile ${TARGET_DIR}/.htpasswd
Require valid-user
# END AUTO BASIC AUTH
HTEOF

    echo "[OK] .htpasswd & block Basic Auth da san sang."
else
    echo "[INFO] basic_auth khong co - khong tao block Basic Auth."
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

# Khởi tạo danh sách loại trừ bảo mật mặc định (chỉ neo ở thư mục gốc bằng "/" để không chặn .htaccess trong thư mục con)
EXCLUDE_FILE="${LOCAL_META_DIR}/rsync-exclude.txt"
cat > "$EXCLUDE_FILE" << 'EOF'
/.htaccess
/.htpasswd
/.deploy
/.deploy_sha
/.deploy_manifest.json
/.repo_lock
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
DRY_RUN_OUTPUT=$(rsync -avz --dry-run --delete \
    --exclude-from="$EXCLUDE_FILE" \
    -e "ssh ${SSH_OPTS}" \
    "$RSYNC_SRC" "$RSYNC_DEST" 2>&1)
DRY_RUN_COUNT=$(echo "$DRY_RUN_OUTPUT" | grep -c '^[^.]\|^\.' || true)
echo "$DRY_RUN_OUTPUT" | tail -30
echo ""
echo "[INFO] Total changes detected: ~${DRY_RUN_COUNT} items"

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
# 9.5 Cấu hình phân quyền cho Mailform Pro (CGI)
# ─────────────────────────────────────────────
echo ""
echo "--- Set permissions for Mailform Pro (CGI) ---"
ssh_exec "
    find '${TARGET_DIR}' -type d -name 'mailformpro' 2>/dev/null | while read mfp_dir; do
        chmod -f 755 \"\$mfp_dir\" || true
        chmod -f 777 \"\$mfp_dir/data\" || true
        chmod -f 755 \"\$mfp_dir/mailformpro.cgi\" || true
        
        parent_dir=\$(dirname \"\$mfp_dir\")
        if [ -d \"\$parent_dir/iplogs\" ]; then
            chmod -f 755 \"\$parent_dir/iplogs\" || true
            chmod -f 755 \"\$parent_dir/iplogs/iplogs.cgi\" || true
            chmod -f 777 \"\$parent_dir/iplogs/iplogs.dat.cgi\" || true
        fi
    done
" 2>/dev/null || true
echo "[OK] Permissions checked and applied."

# ─────────────────────────────────────────────
# 10. Đồng bộ .htpasswd & .htaccess (linh hoạt theo cấu hình htaccess)
# ─────────────────────────────────────────────

echo ""
echo "--- Dong bo .htpasswd & .htaccess (mode: ${HTACCESS_MODE}) ---"

if [ -n "$BASIC_AUTH_USER" ] && [ -n "$BASIC_AUTH_PASS" ]; then
    cat "${LOCAL_META_DIR}/.htpasswd" | ssh_exec "cat > '${TARGET_DIR}/.htpasswd'"
    ssh_exec "chmod 644 '${TARGET_DIR}/.htpasswd'"
    echo "[OK] .htpasswd da dong bo."
else
    ssh_exec "rm -f '${TARGET_DIR}/.htpasswd' 2>/dev/null" || true
fi

if [ "$HTACCESS_MODE" = "preserve" ]; then
    REMOTE_RAW="${LOCAL_META_DIR}/.htaccess.remote_raw"
    REMOTE_CLEAN="${LOCAL_META_DIR}/.htaccess.remote_clean"
    REMOTE_EXISTS=$(ssh_exec "[ -f '${TARGET_DIR}/.htaccess' ] && echo 'yes' || echo 'no'")
    HAS_AUTO_MARKER="no"
    : > "$HTACCESS_BODY_FILE"

    if [ "$REMOTE_EXISTS" = "yes" ]; then
        ssh_exec "cat '${TARGET_DIR}/.htaccess'" > "$REMOTE_RAW"
        tr -d '\r' < "$REMOTE_RAW" > "$REMOTE_CLEAN"
        if grep -qE '^# BEGIN AUTO BASIC AUTH[[:space:]]*$' "$REMOTE_CLEAN"; then
            HAS_AUTO_MARKER="yes"
        fi
        strip_auto_basic_auth < "$REMOTE_CLEAN" > "$HTACCESS_BODY_FILE"
    fi

    if [ -s "$HTACCESS_AUTH_FILE" ]; then
        compose_htaccess "$HTACCESS_AUTH_FILE" "$HTACCESS_BODY_FILE" "$HTACCESS_FINAL_FILE"
        cat "$HTACCESS_FINAL_FILE" | ssh_exec "cat > '${TARGET_DIR}/.htaccess'"
        ssh_exec "chmod 644 '${TARGET_DIR}/.htaccess'"
        echo "[OK] .htaccess da cap nhat block Basic Auth va giu nguyen rule tren server (mode: preserve)."
    elif [ "$HAS_AUTO_MARKER" = "yes" ]; then
        if [ -s "$HTACCESS_BODY_FILE" ]; then
            cat "$HTACCESS_BODY_FILE" | ssh_exec "cat > '${TARGET_DIR}/.htaccess'"
            ssh_exec "chmod 644 '${TARGET_DIR}/.htaccess'"
            echo "[OK] Da go bo block Basic Auth tu dong va giu nguyen rule tren server (mode: preserve)."
        else
            ssh_exec "rm -f '${TARGET_DIR}/.htaccess' 2>/dev/null" || true
            echo "[OK] Da go bo .htaccess (chi chua block Basic Auth tu dong)."
        fi
    else
        echo "[INFO] htaccess=preserve -> giu nguyen .htaccess hien co tren server."
    fi
else
    : > "$HTACCESS_BODY_FILE"
    if [ -n "$HTACCESS_SOURCE_FILE" ] && [ -f "$HTACCESS_SOURCE_FILE" ]; then
        strip_auto_basic_auth < "$HTACCESS_SOURCE_FILE" > "$HTACCESS_BODY_FILE"
    fi

    compose_htaccess "$HTACCESS_AUTH_FILE" "$HTACCESS_BODY_FILE" "$HTACCESS_FINAL_FILE"

    if [ -s "$HTACCESS_FINAL_FILE" ]; then
        cat "$HTACCESS_FINAL_FILE" | ssh_exec "cat > '${TARGET_DIR}/.htaccess'"
        # Đặt quyền chặt cho file bảo mật (644 thay vì 640 để Apache www-data có thể đọc)
        ssh_exec "chmod 644 '${TARGET_DIR}/.htaccess'"
        echo "[OK] .htaccess da dong bo (mode: ${HTACCESS_MODE})."
    else
        ssh_exec "rm -f '${TARGET_DIR}/.htaccess' 2>/dev/null" || true
        echo "[OK] Da go bo .htaccess (khong co basic_auth va khong co rule .htaccess nguon)."
    fi
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
