/* ==========================================================================
   DYNAMIC CARD PARSER, INTERACTIVE WEB IMPORT & WORKBENCH ENGINE
   ========================================================================== */
(function() {
    let WORKBENCH_TOKEN = document.querySelector('meta[name="workbench-token"]')?.getAttribute('content') || '';

    /**
     * Bilingual System (Vietnamese Default & Japanese)
     */
    function getLang() {
        return (document.documentElement.getAttribute('data-lang') === 'ja') ? 'ja' : 'vi';
    }

    function t(vi, ja) {
        return getLang() === 'ja' ? ja : vi;
    }

    function setLanguage(lang) {
        const safeLang = lang === 'ja' ? 'ja' : 'vi';
        document.documentElement.setAttribute('data-lang', safeLang);
        document.documentElement.setAttribute('lang', safeLang);
        try {
            localStorage.setItem('wb_lang', safeLang);
        } catch (_) {}

        document.querySelectorAll('[data-lang-btn]').forEach(btn => {
            if (btn.getAttribute('data-lang-btn') === safeLang) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });

        const filterInput = document.getElementById('cs-filter-input');
        if (filterInput) {
            filterInput.placeholder = safeLang === 'ja' ? 'コンポーネントを検索...' : 'Lọc component...';
        }

        if (typeof refreshInstalledCounter === 'function') {
            refreshInstalledCounter();
        }
    }

    // Initialize preferred language early
    try {
        const savedLang = localStorage.getItem('wb_lang') || 'vi';
        document.documentElement.setAttribute('data-lang', savedLang);
        document.documentElement.setAttribute('lang', savedLang);
    } catch (_) {}

    async function apiFetch(url, options = {}, isRetry = false) {
        const opts = Object.assign({}, options);
        opts.headers = Object.assign({}, opts.headers);
        if (WORKBENCH_TOKEN) {
            opts.headers['X-Workbench-Token'] = WORKBENCH_TOKEN;
        }
        const res = await fetch(url, opts);
        if (res.status === 401 && !isRetry) {
            try {
                const tokenRes = await fetch('/__api/token');
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    if (tokenData && tokenData.token) {
                        WORKBENCH_TOKEN = tokenData.token;
                        const meta = document.querySelector('meta[name="workbench-token"]');
                        if (meta) meta.setAttribute('content', WORKBENCH_TOKEN);
                        return apiFetch(url, options, true);
                    }
                }
            } catch (e) {}
        }
        return res;
    }

    let toastTimeout = null;

    window.showToast = function(msg, icon = '✅') {
        const toast = document.getElementById('cs-toast');
        const toastMsg = document.getElementById('cs-toast-msg');
        const toastIcon = document.getElementById('cs-toast-icon');
        if (!toast || !toastMsg) return;
        toastMsg.textContent = msg;
        if (toastIcon) toastIcon.textContent = icon;
        toast.classList.add('is-show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('is-show');
        }, 2600);
    };

    function fallbackCopy(text, toastMsg) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            if (toastMsg) showToast(toastMsg);
        } catch (e) {
            console.error('Copy failed', e);
        }
        document.body.removeChild(ta);
    }

    window.copyRaw = function(text, customMsg) {
        if (!text) return;
        const toCopy = text.trim();
        const msg = customMsg || t('Đã sao chép vào bộ nhớ tạm!', 'クリップボードにコピーしました！');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(toCopy).then(() => {
                showToast(msg);
            }).catch(() => {
                fallbackCopy(toCopy, msg);
            });
        } else {
            fallbackCopy(toCopy, msg);
        }
    };

    // Category Filter
    window.filterCategory = function(cat, btn) {
        document.querySelectorAll('.cs-cat-tab').forEach(b => b.classList.remove('is-active'));
        if (btn) btn.classList.add('is-active');

        const sections = document.querySelectorAll('.cs-section');
        const navGroups = document.querySelectorAll('.cs-nav__group');

        sections.forEach(sec => {
            const secCat = sec.getAttribute('data-cat');
            if (cat === 'all' || secCat === cat) {
                sec.style.display = '';
            } else {
                sec.style.display = 'none';
            }
        });

        navGroups.forEach(grp => {
            const grpCat = grp.getAttribute('data-nav-group');
            if (cat === 'all' || grpCat === cat) {
                grp.style.display = '';
            } else {
                grp.style.display = 'none';
            }
        });
    };

    // ─────────────────────────────────────────────────────────────
    // 1-CLICK WEB IMPORT & REMOVE ENGINE (Connected to Dev API)
    // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────
    // JAVASCRIPT TARGET FILE MODAL ENGINE
    // ─────────────────────────────────────────────────────────────
    let currentJsConfirmCallback = null;

    window.openJsModal = async function(compName, compTitle, onConfirm) {
        currentJsConfirmCallback = onConfirm;
        const modal = document.getElementById('cs-js-modal');
        const compLabel = document.getElementById('cs-js-modal-comp-name');
        const listContainer = document.getElementById('cs-js-file-list');
        const customInput = document.getElementById('cs-custom-js-input');
        if (!modal || !listContainer) {
            return onConfirm(null);
        }

        if (compLabel) compLabel.textContent = `Component: ${compTitle || compName}`;
        listContainer.innerHTML = `<div style="padding:10px;text-align:center;color:var(--base, #3E3E3E);font-size:13px;">⏳ ${t('Đang tải danh sách file JS trong assets/js/...', 'assets/js/ 内のJSファイル一覧を読み込み中...')}</div>`;
        modal.style.display = 'flex';

        try {
            const res = await apiFetch('/__api/js-files');
            const data = await res.json();
            const files = (data.success && Array.isArray(data.files)) ? data.files : [];

            if (files.length === 0) {
                listContainer.innerHTML = `<div style="padding:10px;color:var(--base, #3E3E3E);font-size:13px;">${t('Không tìm thấy file JS nào trong assets/js/. Bạn có thể chọn tạo file mới bên dưới.', 'assets/js/ 内にJSファイルが見つかりません。下部で新規ファイル作成を選択できます。')}</div>`;
            } else {
                listContainer.innerHTML = files.map((f, idx) => {
                    const isSelected = f.name === 'common.js' || idx === 0;
                    return `
                        <label class="cs-js-option ${isSelected ? 'is-selected' : ''}" onclick="selectJsOption(this, '${f.name}')">
                            <input type="radio" name="cs-target-js" value="${f.name}" ${isSelected ? 'checked' : ''}>
                            <span class="cs-js-option__radio"></span>
                            <span class="cs-js-option__icon">${f.isCommon ? '🌐' : '📄'}</span>
                            <div class="cs-js-option__info">
                                <span class="cs-js-option__name">assets/js/${f.name}</span>
                                <span class="cs-js-option__desc">${f.isCommon ? '<span class="lang-vi">Dùng chung toàn site (Khuyên dùng)</span><span class="lang-ja">サイト全体共通（推奨）</span>' : '<span class="lang-vi">Script trang riêng</span><span class="lang-ja">個別ページ専用</span>'}</span>
                            </div>
                            ${f.isCommon ? '<span class="cs-js-option__tag"><span class="lang-vi">Khuyên Dùng</span><span class="lang-ja">推奨</span></span>' : ''}
                        </label>
                    `;
                }).join('');
            }
        } catch (e) {
            listContainer.innerHTML = `
                <label class="cs-js-option is-selected" onclick="selectJsOption(this, 'common.js')">
                    <input type="radio" name="cs-target-js" value="common.js" checked>
                    <span class="cs-js-option__radio"></span>
                    <span class="cs-js-option__icon">🌐</span>
                    <div class="cs-js-option__info">
                        <span class="cs-js-option__name">assets/js/common.js</span>
                        <span class="cs-js-option__desc"><span class="lang-vi">Dùng chung toàn site (Khuyên dùng)</span><span class="lang-ja">サイト全体共通（推奨）</span></span>
                    </div>
                    <span class="cs-js-option__tag"><span class="lang-vi">Khuyên Dùng</span><span class="lang-ja">推奨</span></span>
                </label>
            `;
        }

        if (customInput) {
            customInput.value = '';
            customInput.disabled = true;
        }
    };

    window.closeJsModal = function() {
        const modal = document.getElementById('cs-js-modal');
        if (modal) modal.style.display = 'none';
        currentJsConfirmCallback = null;
    };

    window.selectJsOption = function(el, val) {
        document.querySelectorAll('.cs-js-option').forEach(opt => opt.classList.remove('is-selected'));
        if (el) el.classList.add('is-selected');
        const radio = el ? el.querySelector('input[type="radio"]') : null;
        if (radio) radio.checked = true;

        const customInput = document.getElementById('cs-custom-js-input');
        if (customInput) {
            if (val === '__custom__') {
                customInput.disabled = false;
                customInput.focus();
            } else {
                customInput.disabled = true;
            }
        }
    };

    window.confirmJsImport = function() {
        const checked = document.querySelector('input[name="cs-target-js"]:checked');
        let chosenVal = checked ? checked.value : 'common.js';

        if (chosenVal === '__custom__') {
            const customInput = document.getElementById('cs-custom-js-input');
            const customVal = customInput ? customInput.value.trim() : '';
            if (!customVal) {
                alert(t('Vui lòng nhập tên file JS mới (ví dụ: my-script.js)!', '新しいJSファイル名を入力してください（例: my-script.js）！'));
                customInput.focus();
                return;
            }
            chosenVal = customVal;
        }

        const cb = currentJsConfirmCallback;
        closeJsModal();
        if (typeof cb === 'function') {
            cb(chosenVal);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // 1-CLICK WEB IMPORT & REMOVE ENGINE (Connected to Dev API)
    // ─────────────────────────────────────────────────────────────
    window.importComponent = async function(compName, btn) {
        if (!compName) return;
        const sec = document.getElementById(`sec-${compName}`);
        const secTitle = sec?.getAttribute('data-title') || compName;
        const hasJs = sec?.getAttribute('data-has-js') === 'true' || !!sec?.querySelector('.cs-raw-js');

        if (hasJs) {
            openJsModal(compName, secTitle, function(targetJsFile) {
                executeSectionImport(compName, btn, targetJsFile);
            });
        } else {
            executeSectionImport(compName, btn, null);
        }
    };

    async function executeSectionImport(compName, btn, targetJsFile) {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="lang-vi">⏳ Đang import...</span><span class="lang-ja">⏳ インポート中...</span>`;

        try {
            const res = await apiFetch(`/__api/import?component=${encodeURIComponent(compName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component: compName,
                    targetJsFile: targetJsFile
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🎉 ${data.message || t('Đã import thành công vào site chính!', 'メインサイトへのインポートが完了しました！')}`, '🚀');
                updateComponentStateInDom(compName, true);
                if (Array.isArray(data.installedDependencies)) {
                    data.installedDependencies.forEach(dep => updateComponentStateInDom(dep, true));
                }
            } else if (data.conflict) {
                if (confirm(t(`⚠️ Component "${compName}" đã có file SCSS/JS tùy chỉnh trong site.\nBạn có chắc muốn GHI ĐÈ để lấy bản gốc từ Workbench không?`, `⚠️ コンポーネント "${compName}" のカスタムSCSS/JSファイルがサイトに既に存在します。\nWorkbenchのオリジナルで上書きしますか？`))) {
                    const forceRes = await apiFetch(`/__api/import?component=${encodeURIComponent(compName)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            component: compName,
                            force: true,
                            targetJsFile: targetJsFile
                        })
                    });
                    const forceData = await forceRes.json();
                    if (forceData.success) {
                        showToast(`🎉 ${forceData.message}`, '🚀');
                        updateComponentStateInDom(compName, true);
                        if (Array.isArray(forceData.installedDependencies)) {
                            forceData.installedDependencies.forEach(dep => updateComponentStateInDom(dep, true));
                        }
                        return;
                    }
                }
                btn.innerHTML = originalText;
                btn.disabled = false;
            } else {
                showToast(`❌ ${t('Lỗi', 'エラー')}: ${data.message || t('Không thể import', 'インポートできませんでした')}`, '⚠️');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            showToast(`❌ ${t('Không thể kết nối tới Dev API Server', 'Dev APIサーバーに接続できません')}: ${err.message}`, '⚠️');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    window.removeComponent = async function(compName, btn) {
        if (!compName) return;
        if (!confirm(t(`Bạn có chắc muốn gỡ component "${compName}" khỏi site chính?`, `コンポーネント "${compName}" をメインサイトから削除してもよろしいですか？`))) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="lang-vi">⏳ Đang gỡ...</span><span class="lang-ja">⏳ 削除中...</span>`;

        try {
            const res = await apiFetch(`/__api/remove?component=${encodeURIComponent(compName)}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🗑 ${data.message || t('Đã gỡ bỏ khỏi site chính!', 'メインサイトから削除しました！')}`, '✔');
                updateComponentStateInDom(compName, false);
            } else if (data.conflict) {
                if (confirm(t(`⚠️ CẢNH BÁO MẤT CODE:\nFile của "${compName}" trong site đã được chỉnh sửa khác với bản mẫu.\nNếu gỡ bỏ, các đoạn code bạn đã viết thêm sẽ BỊ XÓA!\n\nBạn có chắc chắn muốn gỡ bỏ hoàn toàn không?`, `⚠️ コード消失の警告:\nサイト内の "${compName}" はオリジナルから編集されています。\n削除すると、追加したコードも完全に削除されます！\n\n本当に削除しますか？`))) {
                    const forceRes = await apiFetch(`/__api/remove?component=${encodeURIComponent(compName)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ force: true })
                    });
                    const forceData = await forceRes.json();
                    if (forceData.success) {
                        showToast(`🗑 ${forceData.message}`, '✔');
                        updateComponentStateInDom(compName, false);
                        return;
                    }
                }
                btn.innerHTML = originalText;
                btn.disabled = false;
            } else {
                showToast(`❌ ${t('Lỗi', 'エラー')}: ${data.message || t('Không thể gỡ bỏ', '削除できませんでした')}`, '⚠️');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            showToast(`❌ ${t('Lỗi kết nối', '通信エラー')}: ${err.message}`, '⚠️');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    function updateComponentStateInDom(compName, isInstalled) {
        // Update section attribute
        const sec = document.getElementById(`sec-${compName}`);
        if (sec) {
            sec.setAttribute('data-installed', isInstalled ? 'true' : 'false');
        }

        // Update dot in sidebar
        const dot = document.getElementById(`dot-${compName}`);
        if (dot) {
            dot.classList.remove('is-installed');
            if (isInstalled) {
                dot.classList.add('is-installed');
                dot.title = `Đã cài đặt / 導入済み`;
            } else {
                dot.title = `Chưa cài đặt / 未導入`;
            }
        }

        refreshInstalledCounter();
    }

    function refreshInstalledCounter() {
        const total = document.querySelectorAll('.cs-section').length;
        const installed = document.querySelectorAll('.cs-section[data-installed="true"]').length;
        const pill = document.getElementById('cs-installed-stat');
        if (pill) {
            const numColor = installed > 0 ? 'var(--primary, #e60012)' : 'var(--base, #3E3E3E)';
            pill.innerHTML = `
                <span class="lang-vi">Đã cài vào site: <strong style="color:${numColor}">${installed}/${total}</strong></span>
                <span class="lang-ja">サイト導入済み: <strong style="color:${numColor}">${installed}/${total}</strong></span>
            `;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 1-CLICK PERMANENT DELETE FROM WORKBENCH (HTML, SCSS, JS)
    // ─────────────────────────────────────────────────────────────
    window.deleteComponentFromWorkbench = async function(compName, title) {
        if (!compName) return;
        const displayName = title || compName;
        const confirmed = window.confirm(
            t(
                `⚠️ CẢNH BÁO XÓA KHỎI WORKBENCH:\n\n` +
                `Bạn có chắc chắn muốn xóa vĩnh viễn component "${displayName}" khỏi Workbench không?\n\n` +
                `Thao tác này sẽ xóa toàn bộ file liên quan:\n` +
                `• HTML/EJS: workbench/components/_${compName}.ejs\n` +
                `• SCSS: workbench/scss/.../_${compName}.scss\n` +
                `• JS: workbench/js/${compName}.js (nếu có)\n\n` +
                `(Hệ thống sẽ tự động lưu 1 bản snapshot an toàn vào workbench/.backup/ trước khi xóa).`,

                `⚠️ WORKBENCHからの完全削除の確認:\n\n` +
                `コンポーネント "${displayName}" をWorkbenchから完全に削除してもよろしいですか？\n\n` +
                `関連するすべてのファイルが削除されます:\n` +
                `• HTML/EJS: workbench/components/_${compName}.ejs\n` +
                `• SCSS: workbench/scss/.../_${compName}.scss\n` +
                `• JS: workbench/js/${compName}.js (存在する場合)\n\n` +
                `（削除前に安全のため workbench/.backup/ へ自動スナップショットが保存されます）。`
            )
        );

        if (!confirmed) return;

        showToast(`⏳ ${t(`Đang xóa component "${displayName}" khỏi Workbench...`, `コンポーネント "${displayName}" を削除中...`)}`, '🗑');

        try {
            const res = await apiFetch(`/__api/delete-workbench?component=${encodeURIComponent(compName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ component: compName })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${t(`Đã xóa thành công component "${displayName}" khỏi Workbench!`, `コンポーネント "${displayName}" を正常に削除しました！`)}`, '🗑');
                setTimeout(() => {
                    window.location.reload();
                }, 700);
            } else {
                showToast(`❌ ${t('Lỗi', 'エラー')}: ${data.message || t('Không thể xóa component', '削除できませんでした')}`, '⚠️');
            }
        } catch (err) {
            showToast(`❌ ${t('Lỗi kết nối', '通信エラー')}: ${err.message}`, '⚠️');
        }
    };

    // ─────────────────────────────────────────────────────────────
    // 1-CLICK CARD-LEVEL DELETE FROM WORKBENCH (INDIVIDUAL VARIANT)
    // ─────────────────────────────────────────────────────────────
    window.deleteCardVariant = async function(btn) {
        if (!btn) return;
        const compName = btn.getAttribute('data-comp');
        const title = btn.getAttribute('data-title') || t('component này', 'このコンポーネント');
        const classStr = btn.getAttribute('data-class') || '';
        const cardIndexStr = btn.getAttribute('data-card-index');
        const cardIndex = (cardIndexStr !== '' && cardIndexStr !== null && cardIndexStr !== undefined) ? parseInt(cardIndexStr, 10) : undefined;
        const commentTitle = btn.getAttribute('data-comment') || '';

        const confirmed = window.confirm(
            t(
                `⚠️ XÁC NHẬN XÓA RIÊNG COMPONENT NÀY:\n\n` +
                `Bạn có chắc chắn muốn xóa component "${title}" khỏi Workbench không?\n\n` +
                `• Thao tác này CHỈ gỡ bỏ component này (trong workbench/components/_${compName}.ejs)\n` +
                `• Các component khác trong nhóm "${compName}" vẫn được bảo toàn nguyên vẹn 100%!\n` +
                `• Các modifier CSS riêng không còn ai dùng sẽ được tự động dọn dẹp sạch sẽ.\n\n` +
                `(Hệ thống sẽ tự động sao lưu snapshot an toàn vào workbench/.backup/ trước khi xóa).`,

                `⚠️ この個別コンポーネント削除の確認:\n\n` +
                `コンポーネント "${title}" をWorkbenchから削除してもよろしいですか？\n\n` +
                `• この操作では workbench/components/_${compName}.ejs 内のこのパーツのみ削除されます。\n` +
                `• "${compName}" グループの他のパーツは100%保持されます。\n` +
                `• 未使用となった専用modifier CSSも自動クリーンアップされます。\n\n` +
                `（削除前に安全のため workbench/.backup/ へ自動スナップショットが保存されます）。`
            )
        );

        if (!confirmed) return;

        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="lang-vi">⏳ Đang xóa...</span><span class="lang-ja">⏳ 削除中...</span>`;
        btn.disabled = true;
        showToast(`⏳ ${t(`Đang xóa component "${title}"...`, `コンポーネント "${title}" を削除中...`)}`, '🗑');

        try {
            const res = await apiFetch('/__api/delete-variant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component: compName,
                    classStr: classStr,
                    title: title,
                    cardIndex: cardIndex,
                    commentTitle: commentTitle
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${t(`Đã xóa thành công component "${title}"!`, `コンポーネント "${title}" を正常に削除しました！`)}`, '🗑');
                const card = btn.closest('.cs-card');
                if (card) {
                    card.style.transition = 'all 0.4s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.92)';
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } else {
                    setTimeout(() => window.location.reload(), 500);
                }
            } else {
                showToast(`❌ ${t('Lỗi', 'エラー')}: ${data.message || t('Không thể xóa component', '削除できませんでした')}`, '⚠️');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            showToast(`❌ ${t('Lỗi kết nối', '通信エラー')}: ${err.message}`, '⚠️');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    // ─────────────────────────────────────────────────────────────
    // INDIVIDUAL CARD VARIANT IMPORT & LIVE STATUS
    // ─────────────────────────────────────────────────────────────
    window.importCardVariant = async function(btn) {
        const compName = btn.getAttribute('data-comp');
        const classStr = btn.getAttribute('data-class');
        const title = btn.getAttribute('data-title');
        if (!compName) return;

        const card = btn.closest('.cs-card');
        const scssCode = card?.querySelector('.cs-code-panel--scss code')?.textContent?.trim() || '';
        const sec = btn.closest('.cs-section');
        const hasJs = !!card?.querySelector('.cs-code-panel--js');

        if (hasJs) {
            openJsModal(compName, title, function(targetJsFile) {
                executeCardVariantImport(btn, compName, classStr, title, scssCode, targetJsFile);
            });
        } else {
            executeCardVariantImport(btn, compName, classStr, title, scssCode, null);
        }
    };

    async function executeCardVariantImport(btn, compName, classStr, title, scssCode, targetJsFile) {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="lang-vi">⏳ Đang import...</span><span class="lang-ja">⏳ インポート中...</span>`;

        try {
            const res = await apiFetch('/__api/import-variant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component: compName,
                    classStr: classStr,
                    variantTitle: title,
                    scssCode: scssCode,
                    targetJsFile: targetJsFile
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🎉 ${data.message || t(`Đã import riêng component "${title}" vào site!`, `コンポーネント "${title}" をサイトへ導入しました！`)}`, '🚀');
                btn.classList.add('is-installed');
                btn.innerHTML = `<span class="lang-vi">✓ Đã cài vào Site</span><span class="lang-ja">✓ サイト導入済み</span>`;
                btn.disabled = true;
                if (typeof syncVariantCardsStatus === 'function') {
                    syncVariantCardsStatus();
                }
                syncRegistryState();
            } else {
                showToast(`❌ ${t('Lỗi', 'エラー')}: ${data.message || t('Không thể import', 'インポートできませんでした')}`, '⚠️');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            showToast(`❌ ${t('Lỗi kết nối', '通信エラー')}: ${err.message}`, '⚠️');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async function syncVariantCardsStatus() {
        const buttons = document.querySelectorAll('.cs-btn-action--import');
        if (buttons.length === 0) return;

        const items = Array.from(buttons).map(b => ({
            component: b.getAttribute('data-comp'),
            classStr: b.getAttribute('data-class')
        }));

        try {
            const res = await apiFetch('/__api/check-variants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success && Array.isArray(data.results)) {
                data.results.forEach((item, idx) => {
                    const btn = buttons[idx];
                    if (!btn) return;
                    if (item.isInstalled) {
                        btn.classList.add('is-installed');
                        btn.innerHTML = `<span class="lang-vi">✓ Đã cài vào Site</span><span class="lang-ja">✓ サイト導入済み</span>`;
                        btn.disabled = true;
                    } else {
                        btn.classList.remove('is-installed');
                        btn.innerHTML = `<span class="lang-vi">🚀 Import vào Site</span><span class="lang-ja">🚀 サイトへ導入</span>`;
                        btn.disabled = false;
                    }
                });
            }
        } catch (e) {
            // Dev server API might be compiling
        }
    }

    // Query API on page load to guarantee live accurate state
    async function syncRegistryState() {
        try {
            const res = await apiFetch('/__api/registry');
            if (!res.ok) return;
            const data = await res.json();
            if (data.success && Array.isArray(data.components)) {
                data.components.forEach(comp => {
                    updateComponentStateInDom(comp.name, comp.isInstalled);
                });
            }
        } catch (e) {
            // Dev server API might be idle or compiling
        }
        await syncVariantCardsStatus();
    }

    // ─────────────────────────────────────────────────────────────
    // CARD COMPONENT PARSER & CODE TABS
    // ─────────────────────────────────────────────────────────────
    window.copySnippetFromCard = function(btn) {
        const card = btn.closest('.cs-card');
        if (!card) return;
        const htmlCode = card.querySelector('.cs-code-panel--html code');
        if (htmlCode) {
            copyRaw(htmlCode.textContent.trim(), t('Đã copy snippet HTML vào clipboard!', 'HTMLスニペットをクリップボードにコピーしました！'));
        }
    };

    window.copyScssFromCard = function(btn) {
        const card = btn.closest('.cs-card');
        if (!card) return;
        const scssCode = card.querySelector('.cs-code-panel--scss code');
        if (scssCode) {
            copyRaw(scssCode.textContent.trim(), t('Đã copy SCSS styles vào clipboard!', 'SCSSスタイルをクリップボードにコピーしました！'));
        }
    };

    window.copyJsFromCard = function(btn) {
        const card = btn.closest('.cs-card');
        if (!card) return;
        const jsCode = card.querySelector('.cs-code-panel--js code');
        if (jsCode) {
            copyRaw(jsCode.textContent.trim(), t('Đã copy JS logic vào clipboard!', 'JSロジックをクリップボードにコピーしました！'));
        }
    };

    window.toggleCodeDrawer = function(btn) {
        const card = btn.closest('.cs-card');
        if (!card) return;
        const drawer = card.querySelector('.cs-card__code-drawer');
        if (!drawer) return;
        drawer.classList.toggle('is-open');
        const isOpen = drawer.classList.contains('is-open');
        card.classList.toggle('is-code-open', isOpen);
        btn.innerHTML = isOpen
            ? `<span class="lang-vi">Ẩn Code</span><span class="lang-ja">コード非表示</span>`
            : `<span class="lang-vi">Xem Code</span><span class="lang-ja">コード表示</span>`;
    };

    window.switchCodeTab = function(tabBtn, targetTab) {
        const card = tabBtn.closest('.cs-card');
        if (!card) return;
        card.querySelectorAll('.cs-code-tab').forEach(b => b.classList.remove('is-active'));
        card.querySelectorAll('.cs-code-panel').forEach(p => p.classList.remove('is-active'));

        tabBtn.classList.add('is-active');
        const panel = card.querySelector(`.cs-code-panel--${targetTab}`);
        if (panel) panel.classList.add('is-active');
    };

    function normalizeIndentation(str) {
        if (!str) return '';
        const lines = str.split('\n');
        if (lines.length <= 1) return str.trim();

        let minIndent = Infinity;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().length === 0) continue;
            const indentMatch = line.match(/^(\s+)/);
            const indent = indentMatch ? indentMatch[1].length : 0;
            if (indent < minIndent) minIndent = indent;
        }

        if (minIndent === Infinity) minIndent = 0;

        const result = [lines[0].trim()];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().length === 0) {
                result.push('');
            } else {
                result.push(line.slice(minIndent).trimEnd());
            }
        }

        return result.join('\n').trim();
    }

    function findMatchingBrace(text, startIdx) {
        let depth = 0;
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inLineComment = false;
        let inBlockComment = false;

        for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            const prev = i > 0 ? text[i - 1] : '';
            const next = i < text.length - 1 ? text[i + 1] : '';

            if (inLineComment) {
                if (char === '\n') inLineComment = false;
                continue;
            }
            if (inBlockComment) {
                if (char === '*' && next === '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }
            if (inSingleQuote) {
                if (char === "'" && prev !== '\\') inSingleQuote = false;
                continue;
            }
            if (inDoubleQuote) {
                if (char === '"' && prev !== '\\') inDoubleQuote = false;
                continue;
            }

            if (char === '/' && next === '/') { inLineComment = true; i++; continue; }
            if (char === '/' && next === '*') { inBlockComment = true; i++; continue; }
            if (char === "'") { inSingleQuote = true; continue; }
            if (char === '"') { inDoubleQuote = true; continue; }

            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) return i + 1;
            }
        }
        return -1;
    }

    function stripFileBoilerplate(scss) {
        if (!scss) return '';
        let cleaned = scss.trim();
        let changed = true;
        while (changed) {
            const before = cleaned;
            cleaned = cleaned.replace(/^\s*@(use|forward)\s+[^;]+;\s*/, '');
            cleaned = cleaned.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
            changed = (cleaned !== before);
        }
        return cleaned.trim();
    }

    function sliceScssForClasses(fullScss, classStr) {
        if (!fullScss || !classStr) return stripFileBoilerplate(fullScss || '');
        const tokens = classStr.split(/\s+/).filter(Boolean);

        // Support single or multiple root classes (e.g. c-card, c-btn, p-header, card), ignoring inview animation classes
        const candidateClasses = tokens
            .filter(c => (/^[clpmo]-/.test(c) || (!c.startsWith('is-') && !c.startsWith('js-') && c !== 'active')) && !c.startsWith('c-inview') && !c.startsWith('js-inview') && !c.startsWith('inview--'))
            .flatMap(c => {
                const base = c.split('--')[0];
                return base.includes('__') ? [base, base.split('__')[0]] : [base];
            });

        const uniqueBases = Array.from(new Set(candidateClasses));
        if (uniqueBases.length === 0 && tokens[0]) {
            const b = tokens[0].split('--')[0];
            uniqueBases.push(b.includes('__') ? b.split('__')[0] : b);
        }

        const extractedBlocks = [];

        for (const baseBlockName of uniqueBases) {
            const regex = new RegExp('(?:^|\\n)([ \\t]*\\.' + baseBlockName.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])[^{]*\\{)', 'm');
            const m = fullScss.match(regex);
            if (!m) continue;

            const startIdx = m.index + (m[0].length - m[1].length);
            const openBraceIdx = fullScss.indexOf('{', startIdx);
            if (openBraceIdx === -1) continue;

            const endIdx = findMatchingBrace(fullScss, openBraceIdx);
            if (endIdx === -1) continue;

            const blockContent = fullScss.slice(startIdx, endIdx);

            const activeMods = tokens
                .filter(c => c.startsWith(baseBlockName + '--'))
                .map(c => c.slice(baseBlockName.length));

            const modRegex = /\n([ \t]*&--([a-zA-Z0-9_-]+)(?![a-zA-Z0-9_-])[^{]*\{)/g;
            let match;
            const allMods = [];
            while ((match = modRegex.exec(blockContent)) !== null) {
                const modName = '--' + match[2];
                const modStart = match.index + 1;
                const modBraceIdx = blockContent.indexOf('{', modStart);
                if (modBraceIdx !== -1) {
                    const modEnd = findMatchingBrace(blockContent, modBraceIdx);
                    if (modEnd !== -1) {
                        allMods.push({ name: modName, start: modStart, end: modEnd });
                    }
                }
            }

            let filteredBlock = '';
            let lastPos = 0;
            for (const mod of allMods) {
                if (!activeMods.includes(mod.name)) {
                    filteredBlock += blockContent.slice(lastPos, mod.start);
                    lastPos = mod.end;
                }
            }
            filteredBlock += blockContent.slice(lastPos);
            filteredBlock = filteredBlock.replace(/\n\s*\n\s*\n+/g, '\n\n');
            extractedBlocks.push(filteredBlock.trim());
        }

        if (extractedBlocks.length === 0) {
            return stripFileBoilerplate(fullScss);
        }

        return extractedBlocks.join('\n\n').trim();
    }

    function sliceJsForCard(jsText, snippetEl, cleanHtml, totalCards = 1) {
        if (!jsText || !jsText.trim()) return '';
        if (totalCards === 1) return jsText.trim();

        const allElements = [snippetEl, ...Array.from(snippetEl.querySelectorAll('*'))];
        const cardClasses = new Set();
        const cardIds = new Set();
        const cardAttrs = new Set();

        allElements.forEach(el => {
            if (el.classList) {
                el.classList.forEach(c => {
                    cardClasses.add(c);
                    if (c.includes('--')) cardClasses.add(c.split('--')[0]);
                    if (c.includes('__')) cardClasses.add(c.split('__')[0]);
                });
            }
            if (el.id) cardIds.add(el.id);
            if (el.attributes) {
                for (let i = 0; i < el.attributes.length; i++) {
                    const attr = el.attributes[i];
                    if (attr.name.startsWith('data-')) {
                        cardAttrs.add(attr.name);
                    }
                }
            }
        });

        let matches = false;
        for (const cls of cardClasses) {
            const reg = new RegExp('\\.' + cls.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])');
            if (reg.test(jsText)) {
                matches = true;
                break;
            }
        }

        if (!matches) {
            for (const id of cardIds) {
                const reg = new RegExp('#' + id.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])');
                if (reg.test(jsText)) {
                    matches = true;
                    break;
                }
            }
        }

        if (!matches) {
            for (const attr of cardAttrs) {
                if (jsText.includes(attr)) {
                    matches = true;
                    break;
                }
            }
        }

        return matches ? jsText.trim() : '';
    }

    function buildCard(el, title, fullClass, scssText, jsText, compName, isInline = false, isLeft = false, cardIndex = undefined, commentTitle = '', totalCards = 1) {
        let snippetEl = el;
        let effectiveClass = fullClass;

        if (el.classList && el.classList.contains('l-container') && el.firstElementChild) {
            snippetEl = el.firstElementChild;
            effectiveClass = snippetEl.className || fullClass;
        }

        effectiveClass = (effectiveClass || '').trim().replace(/\s+/g, ' ');

        if (snippetEl.tagName === 'A' && snippetEl.getAttribute('href') === '#') {
            snippetEl.setAttribute('href', '');
        }
        snippetEl.querySelectorAll('a[href="#"]').forEach(a => a.setAttribute('href', ''));

        // Normalize image src for live preview in /__workbench/
        if (snippetEl.tagName === 'IMG' && snippetEl.getAttribute('src')?.startsWith('./assets/')) {
            snippetEl.setAttribute('src', '.' + snippetEl.getAttribute('src'));
        }
        snippetEl.querySelectorAll('img[src^="./assets/"]').forEach(img => {
            img.setAttribute('src', '.' + img.getAttribute('src'));
        });

        const card = document.createElement('div');
        card.className = `cs-card ${isInline ? 'cs-card--inline-block' : 'cs-card--full'}`;
        card.setAttribute('data-search', `${title} ${effectiveClass}`.toLowerCase());

        let cleanHtml = snippetEl.outerHTML;
        cleanHtml = cleanHtml.replace(/src=["'](?:\.\.\/)+assets\//g, 'src="./assets/');
        cleanHtml = cleanHtml.replace(/\bhref=["']#["']/gi, 'href=""');
        cleanHtml = normalizeIndentation(cleanHtml);
        const escapedHtml = cleanHtml
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const cardScss = sliceScssForClasses(scssText, effectiveClass);
        const cardJs = sliceJsForCard(jsText, snippetEl, cleanHtml, totalCards);
        const escapedScss = (cardScss || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapedJs = (cardJs || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const classTokens = effectiveClass.split(/\s+/).filter(Boolean);
        const badgesHtml = classTokens.map(c => {
            const cleanC = c.replace(/^\./, '');
            return `<span class="cs-card__class-tag" title="Click để copy .${cleanC} / クリックして .${cleanC} をコピー" onclick="event.stopPropagation(); copyRaw('${cleanC}', '${t(`Đã copy class: .${cleanC}`, `クラスをコピーしました: .${cleanC}`)}')">.${cleanC}</span>`;
        }).join(' ');

        const escapedCommentAttr = (commentTitle || '').replace(/"/g, '&quot;');

        card.innerHTML = `
            <div class="cs-card__toolbar">
                <div class="cs-card__title-wrap">
                    <span class="cs-card__title">${title}</span>
                </div>
                <div class="cs-card__actions">
                    <button type="button" class="cs-btn-action cs-btn-action--import" onclick="importCardVariant(this)" data-comp="${compName}" data-class="${effectiveClass}" data-title="${title}" title="Chỉ import riêng component này vào site / このコンポーネントのみサイトへ導入">
                        <span class="lang-vi">🚀 Import vào Site</span>
                        <span class="lang-ja">🚀 サイトへ導入</span>
                    </button>
                    <button type="button" class="cs-btn-action cs-btn-action--copy" onclick="copySnippetFromCard(this)">
                        <span class="lang-vi">📋 Chép HTML</span>
                        <span class="lang-ja">📋 HTMLコピー</span>
                    </button>
                    ${cardScss ? `<button type="button" class="cs-btn-action" onclick="copyScssFromCard(this)">🎨 SCSS</button>` : ''}
                    ${cardJs ? `<button type="button" class="cs-btn-action cs-btn-action--js" onclick="copyJsFromCard(this)">⚡ JS</button>` : ''}
                    <button type="button" class="cs-btn-action cs-btn-action--code" onclick="toggleCodeDrawer(this)">
                        <span class="lang-vi">Xem Code</span>
                        <span class="lang-ja">コード表示</span>
                    </button>
                    <button type="button" class="cs-btn-action cs-btn-action--delete" onclick="deleteCardVariant(this)" data-comp="${compName}" data-class="${effectiveClass}" data-title="${title}" data-card-index="${cardIndex !== undefined ? cardIndex : ''}" data-comment="${escapedCommentAttr}" title="Xóa riêng component '${title}' khỏi Workbench / このコンポーネントをWorkbenchから削除">
                        <span class="lang-vi">🗑 Xóa</span>
                        <span class="lang-ja">🗑 削除</span>
                    </button>
                </div>
            </div>
            <div class="cs-card__preview${isLeft ? ' cs-card__preview--left' : ''}"></div>
            <div class="cs-card__footer">
                ${badgesHtml}
            </div>
            <div class="cs-card__code-drawer">
                <div class="cs-code-tabs">
                    <button type="button" class="cs-code-tab is-active" onclick="switchCodeTab(this, 'html')">HTML</button>
                    ${cardScss ? `<button type="button" class="cs-code-tab" onclick="switchCodeTab(this, 'scss')">SCSS</button>` : ''}
                    ${cardJs ? `<button type="button" class="cs-code-tab" onclick="switchCodeTab(this, 'js')">JavaScript</button>` : ''}
                </div>
                <div class="cs-code-panel cs-code-panel--html is-active">
                    <pre><code>${escapedHtml}</code></pre>
                </div>
                ${cardScss ? `
                <div class="cs-code-panel cs-code-panel--scss">
                    <pre><code>${escapedScss}</code></pre>
                </div>` : ''}
                ${cardJs ? `
                <div class="cs-code-panel cs-code-panel--js">
                    <pre><code>${escapedJs}</code></pre>
                </div>` : ''}
            </div>
        `;

        card.querySelector('.cs-card__preview').appendChild(el);
        return card;
    }

    function formatComponentTitle(cls) {
        if (!cls) return 'Component';
        let clean = cls.replace(/^c-/, '').replace(/^l-/, '');
        if (clean.includes('--cl3')) return '<span class="lang-vi">Grid (3 Cột)</span><span class="lang-ja">グリッド (3列)</span>';
        if (clean.includes('--cl4')) return '<span class="lang-vi">Grid (4 Cột)</span><span class="lang-ja">グリッド (4列)</span>';
        if (clean.includes('--cl5')) return '<span class="lang-vi">Grid (5 Cột)</span><span class="lang-ja">グリッド (5列)</span>';
        if (clean.includes('--middle') && clean.includes('--reverse')) return 'Flex (Reverse + Middle)';
        if (clean.includes('--equal')) return 'Flex Equal 50/50';
        if (clean.includes('--reverse')) return clean.includes('btn') ? '<span class="lang-vi">Nút Reverse</span><span class="lang-ja">反転ボタン</span>' : 'Flex Reverse';
        if (clean.includes('--arrow-between')) return '<span class="lang-vi">Nút Mũi Tên Cách Giữa</span><span class="lang-ja">矢印両端配置ボタン</span>';
        if (clean.includes('--arrow-center')) return '<span class="lang-vi">Nút Mũi Tên Trung Tâm</span><span class="lang-ja">矢印中央配置ボタン</span>';
        if (clean.includes('--arrow')) return '<span class="lang-vi">Nút Có Mũi Tên</span><span class="lang-ja">矢印付きボタン</span>';
        if (clean.includes('--blank')) return '<span class="lang-vi">Link Mở Tab Mới (Blank)</span><span class="lang-ja">別タブリンク (Blank)</span>';
        if (clean.includes('--line')) return '<span class="lang-vi">Tiêu Đề Dạng Line</span><span class="lang-ja">ライン見出し</span>';
        if (clean.includes('--dot')) return '<span class="lang-vi">Tiêu Đề Dạng Dot</span><span class="lang-ja">ドット見出し</span>';
        if (cls.startsWith('c-ttl')) {
            const m = cls.match(/c-ttl(\d+)/);
            if (m) return `Heading ${m[1]}px`;
        }
        if (cls.startsWith('c-txt')) {
            const m = cls.match(/c-txt(\d+)/);
            if (m) return `Text ${m[1]}px`;
        }
        return clean.split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    function getPrecedingComment(node) {
        if (!node) return null;
        let prev = node.previousSibling;
        while (prev) {
            if (prev.nodeType === 8) {
                let text = (prev.nodeValue || '').trim();
                text = text.replace(/^[\s*#-]+/, '').replace(/[\s*#-]+$/, '').trim();
                if (text && !text.startsWith('[') && !text.startsWith('vite') && !text.startsWith('webpack')) {
                    return text;
                }
            } else if (prev.nodeType === 1) {
                break;
            } else if (prev.nodeType === 3 && prev.nodeValue && prev.nodeValue.trim() !== '') {
                break;
            }
            prev = prev.previousSibling;
        }
        return null;
    }

    function extractComponentItems(raw) {
        const items = [];

        function processNode(node, currentWrapper = null) {
            if (!node || node.nodeType !== 1) return;

            const classStr = node.className || '';
            let wrapper = currentWrapper;

            if (typeof classStr === 'string' && classStr.includes('p-component__')) {
                wrapper = node;
                Array.from(node.children).forEach(child => processNode(child, wrapper));
                return;
            }

            if (node.classList.contains('l-container') && node.children.length > 1) {
                Array.from(node.children).forEach(child => processNode(child, wrapper));
                return;
            }

            let snippetTarget = node;
            if (node.classList && node.classList.contains('l-container') && node.children.length === 1) {
                snippetTarget = node.firstElementChild;
            }

            const targetClasses = (snippetTarget.className || '').split(/\s+/).filter(Boolean);
            const matchedClass = targetClasses.find(c => /^[clpmo]-/.test(c) && !c.startsWith('c-inview') && !c.startsWith('js-inview')) ||
                                 targetClasses.find(c => !c.startsWith('is-') && !c.startsWith('js-') && c !== 'active' && !c.startsWith('p-component__') && !c.startsWith('c-inview') && !c.startsWith('js-inview')) ||
                                 targetClasses.find(c => !c.startsWith('c-inview') && !c.startsWith('js-inview')) ||
                                 targetClasses[0] ||
                                 snippetTarget.tagName.toLowerCase();

            if (matchedClass) {
                const comment = getPrecedingComment(node) || getPrecedingComment(snippetTarget);
                const isInline = ['A', 'BUTTON', 'SPAN', 'INPUT', 'LABEL', 'IMG'].includes(snippetTarget.tagName) ||
                                 (wrapper && (wrapper.classList.contains('p-component__item--inline-block') || wrapper.classList.contains('p-component__btns') || wrapper.getAttribute('data-inline') === 'true')) ||
                                 snippetTarget.getAttribute('data-inline') === 'true' ||
                                 targetClasses.some(c => c.includes('btn') || c.includes('link') || c.includes('toggle') || c.includes('totop') || c.includes('badge') || c.includes('tag') || c.includes('pill') || c.includes('icon') || c.includes('switch'));
                items.push({
                    domElement: node,
                    snippetElement: snippetTarget,
                    tagClass: matchedClass,
                    fullClass: targetClasses.join(' '),
                    commentTitle: comment,
                    isInline: isInline,
                    wrapperNode: wrapper
                });
                return;
            }

            Array.from(node.children).forEach(child => processNode(child, wrapper));
        }

        Array.from(raw.children).forEach(child => processNode(child, null));

        if (items.length === 0 && raw.firstElementChild) {
            const el = raw.firstElementChild;
            const inner = el.querySelector('[class*="c-"], [class*="l-"], [class*="p-"]') || el;
            const cls = Array.from(inner.classList || []).find(c => /^[clpmo]-/.test(c)) || inner.tagName.toLowerCase() || 'component';
            const isInline = el.classList.contains('p-component__item--inline-block') || 
                            (typeof el.className === 'string' && el.className.includes('inline-block'));
            items.push({
                domElement: el,
                snippetElement: inner,
                tagClass: cls,
                fullClass: inner.className || '',
                commentTitle: getPrecedingComment(el),
                isInline: isInline,
                wrapperNode: el
            });
        }

        return items;
    }

    function transformSections() {
        const sections = document.querySelectorAll('.cs-section');

        sections.forEach(sec => {
            const title = sec.getAttribute('data-title') || '';
            const file = sec.getAttribute('data-file') || '';
            const compName = sec.getAttribute('data-name') || '';
            const category = sec.getAttribute('data-cat') || 'component';
            const isInstalled = sec.getAttribute('data-installed') === 'true';

            const raw = sec.querySelector('.cs-raw-content');
            if (!raw) return;

            const scssText = sec.querySelector('.cs-raw-scss')?.value || '';
            const jsText = sec.querySelector('.cs-raw-js')?.value || '';

            // Clean Section Header
            const header = document.createElement('div');
            header.className = 'cs-section__header';
            header.innerHTML = `
                <div class="cs-section__header-left">
                    <span class="cs-badge-cat cs-badge-cat--${category}">${category}</span>
                    <h2 class="cs-section__title">${title}</h2>
                    <span class="cs-section__file">📁 ${file}</span>
                </div>
            `;

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'cs-cards-container';

            const items = extractComponentItems(raw);

            items.forEach((item, itemIdx) => {
                const cardTitle = item.commentTitle || formatComponentTitle(item.tagClass);
                const isLeft = item.tagClass.includes('title') || item.tagClass.includes('text') || item.tagClass.includes('bread') || item.tagClass.includes('ttl') || item.tagClass.includes('txt') || item.tagClass.includes('tbl') || ['H1','H2','H3','H4','H5','H6','P','TABLE','UL','OL'].includes(item.snippetElement.tagName);
                const card = buildCard(item.domElement, cardTitle, item.fullClass, scssText, jsText, compName, item.isInline, isLeft, itemIdx, item.commentTitle, items.length);
                cardsContainer.appendChild(card);
            });

            raw.remove();
            sec.appendChild(header);
            sec.appendChild(cardsContainer);

            // Normalize relative preview asset paths (e.g. ./assets/... -> ../assets/...)
            cardsContainer.querySelectorAll('.cs-card__preview img').forEach(img => {
                const rawSrc = img.getAttribute('src');
                if (rawSrc && rawSrc.startsWith('./assets/')) {
                    img.src = '../' + rawSrc.slice(2);
                }
            });

            // Agnostic Dynamic Normalization for Sandbox Previews (100% generic CSS property inspection)
            cardsContainer.querySelectorAll('.cs-card__preview > *').forEach(el => {
                const hint = el.getAttribute('data-preview');
                if (hint === 'fixed') {
                    el.classList.add('cs-is-fixed');
                    return;
                }
                if (hint === 'floating') {
                    el.classList.add('cs-is-floating');
                    return;
                }

                const computed = window.getComputedStyle(el);

                // 1. Fixed or Sticky elements: keep inside card preview
                if (computed.position === 'fixed' || computed.position === 'sticky') {
                    const isSmallWidget = ['A', 'BUTTON', 'SPAN', 'DIV'].includes(el.tagName) && 
                                          (el.offsetWidth <= 140 || computed.borderRadius !== '0px' || (computed.right !== 'auto' && computed.left === 'auto'));
                    if (isSmallWidget) {
                        el.classList.add('cs-is-floating');
                    } else {
                        el.classList.add('cs-is-fixed');
                    }
                }

                // 2. Mobile-only elements (display: none on desktop)
                if (computed.display === 'none') {
                    el.classList.add('cs-is-hidden-mobile');
                }

                // 3. Offscreen translation / opacity 0 (e.g. scroll-to-top or reveal)
                if (computed.opacity === '0' || computed.visibility === 'hidden' || (computed.transform && computed.transform !== 'none' && computed.transform.includes('matrix'))) {
                    try {
                        const m = computed.transform.match(/matrix.*\((.+)\)/);
                        if (m) {
                            const parts = m[1].split(', ');
                            const ty = parseFloat(parts[5]);
                            if (Math.abs(ty) > 30) {
                                el.classList.add('cs-is-offscreen');
                            }
                        }
                    } catch (e) {}
                    if (computed.opacity === '0' || computed.visibility === 'hidden') {
                        el.classList.add('cs-is-offscreen');
                    }
                }
            });
        });

        refreshInstalledCounter();
        syncRegistryState();

        // Activate interactive JS for components in sandbox preview
        setTimeout(() => {
            document.querySelectorAll('.cs-raw-js').forEach(ta => {
                if (!ta.value || !ta.value.trim()) return;
                try {
                    const fn = new Function(ta.value);
                    fn();
                } catch (e) {
                    // Safe ignore
                }
            });
        }, 150);

        // Direct hash navigation inside Workbench
        if (window.location.hash) {
            setTimeout(() => {
                try {
                    const target = document.querySelector(window.location.hash);
                    if (target) target.scrollIntoView({ behavior: 'smooth' });
                } catch (e) {}
            }, 120);
        }
    }

    function initLanguageSwitcher() {
        document.querySelectorAll('[data-lang-btn]').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.getAttribute('data-lang-btn');
                if (lang) setLanguage(lang);
            });
        });
        let currentLang = 'vi';
        try {
            currentLang = localStorage.getItem('wb_lang') || 'vi';
        } catch (_) {}
        setLanguage(currentLang);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            transformSections();
            initLanguageSwitcher();
        });
    } else {
        transformSections();
        initLanguageSwitcher();
    }

    // Live search filter
    const searchInput = document.getElementById('cs-filter-input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll('.cs-card');
            const sections = document.querySelectorAll('.cs-section');

            cards.forEach(card => {
                const searchData = card.getAttribute('data-search') || '';
                if (!query || searchData.includes(query)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });

            sections.forEach(sec => {
                const compName = sec.getAttribute('data-name');
                const visibleCards = sec.querySelectorAll('.cs-card:not([style*="display: none"])');
                const isVisible = (visibleCards.length > 0 || !query);
                sec.style.display = isVisible ? '' : 'none';

                if (compName) {
                    const navItem = document.querySelector(`[data-nav-item="${compName}"]`);
                    if (navItem) navItem.style.display = isVisible ? '' : 'none';
                }
            });

            document.querySelectorAll('.cs-nav__group').forEach(group => {
                const visibleItems = group.querySelectorAll('li:not([style*="display: none"])');
                group.style.display = (visibleItems.length > 0 || !query) ? '' : 'none';
            });
        });
    }

    // Back to Top Controller
    window.scrollToTop = function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    window.addEventListener('scroll', function() {
        const btn = document.getElementById('cs-back-to-top');
        if (!btn) return;
        if (window.scrollY > 300) {
            btn.classList.add('is-show');
        } else {
            btn.classList.remove('is-show');
        }
    }, { passive: true });

    // Isolate Workbench sidebar navigation in capture phase so site scripts never see it
    document.addEventListener('click', function(e) {
        const navLink = e.target.closest('.cs-nav__link');
        if (navLink) {
            e.stopImmediatePropagation();
            e.preventDefault();
            const hash = navLink.getAttribute('href');
            if (hash && hash.startsWith('#')) {
                const target = document.querySelector(hash);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    history.pushState(null, '', hash);
                }
            }
        }
    }, true);
})();
