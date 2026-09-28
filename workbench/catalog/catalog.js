/* ==========================================================================
   DYNAMIC CARD PARSER, INTERACTIVE WEB IMPORT & WORKBENCH ENGINE
   ========================================================================== */
(function() {
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
        const msg = customMsg || `Đã sao chép vào bộ nhớ tạm!`;
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

    window.copyCliCommand = function(compName) {
        const cmd = `npm run add ${compName}`;
        copyRaw(cmd, `Đã copy lệnh: "${cmd}" (Chạy trong terminal để import)`);
    };

    window.setViewport = function(mode, btn) {
        document.querySelectorAll('.cs-viewport-btn').forEach(b => b.classList.remove('is-active'));
        if (btn) btn.classList.add('is-active');

        const wrapper = document.getElementById('cs-viewport-container');
        if (!wrapper) return;

        wrapper.classList.remove('is-tablet', 'is-mobile');
        if (mode === 'tablet') wrapper.classList.add('is-tablet');
        if (mode === 'mobile') wrapper.classList.add('is-mobile');
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
    window.importComponent = async function(compName, btn) {
        if (!compName) return;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `⏳ Đang import...`;

        try {
            const res = await fetch(`/__api/import?component=${encodeURIComponent(compName)}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🎉 ${data.message || 'Đã import thành công vào site chính!'}`, '🚀');
                updateComponentStateInDom(compName, true);
                if (Array.isArray(data.installedDependencies)) {
                    data.installedDependencies.forEach(dep => updateComponentStateInDom(dep, true));
                }
            } else if (data.conflict) {
                if (confirm(`⚠️ Component "${compName}" đã có file SCSS/JS tùy chỉnh trong site.\nBạn có chắc muốn GHI ĐÈ để lấy bản gốc từ Workbench không?`)) {
                    const forceRes = await fetch(`/__api/import?component=${encodeURIComponent(compName)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ force: true })
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
                showToast(`❌ Lỗi: ${data.message || 'Không thể import'}`, '⚠️');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            showToast(`❌ Không thể kết nối tới Dev API Server: ${err.message}`, '⚠️');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    window.removeComponent = async function(compName, btn) {
        if (!compName) return;
        if (!confirm(`Bạn có chắc muốn gỡ component "${compName}" khỏi site chính?`)) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `⏳ Đang gỡ...`;

        try {
            const res = await fetch(`/__api/remove?component=${encodeURIComponent(compName)}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🗑 ${data.message || 'Đã gỡ bỏ khỏi site chính!'}`, '✔');
                updateComponentStateInDom(compName, false);
            } else if (data.conflict) {
                if (confirm(`⚠️ CẢNH BÁO MẤT CODE:\nFile của "${compName}" trong site đã được chỉnh sửa khác với bản mẫu.\nNếu gỡ bỏ, các đoạn code bạn đã viết thêm sẽ BỊ XÓA!\n\nBạn có chắc chắn muốn gỡ bỏ hoàn toàn không?`)) {
                    const forceRes = await fetch(`/__api/remove?component=${encodeURIComponent(compName)}`, {
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
                showToast(`❌ Lỗi: ${data.message || 'Không thể gỡ bỏ'}`, '⚠️');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            showToast(`❌ Lỗi kết nối: ${err.message}`, '⚠️');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    function updateComponentStateInDom(compName, isInstalled) {
        // Update section attribute
        const sec = document.getElementById(`sec-${compName}`);
        if (sec) sec.setAttribute('data-installed', isInstalled ? 'true' : 'false');

        // Update dot in sidebar
        const dot = document.getElementById(`dot-${compName}`);
        if (dot) {
            if (isInstalled) dot.classList.add('is-installed');
            else dot.classList.remove('is-installed');
        }

        // Update action container
        const actBox = document.getElementById(`actions-${compName}`);
        if (actBox) {
            const secTitle = sec?.getAttribute('data-title') || compName;
            if (isInstalled) {
                actBox.innerHTML = `
                    <button type="button" class="cs-btn-import is-installed" title="Toàn bộ nhóm ${secTitle} đã được cài đặt trong site">
                        ✓ Cả bộ đã cài
                    </button>
                    <button type="button" class="cs-btn-remove" title="Gỡ cả bộ component ${secTitle} khỏi site chính" onclick="removeComponent('${compName}', this)">
                        🗑 Gỡ cả bộ
                    </button>
                `;
            } else {
                actBox.innerHTML = `
                    <button type="button" class="cs-btn-import" title="Import toàn bộ các biến thể của nhóm ${secTitle} vào site chính. (Để chỉ cài 1 component, hãy bấm 'Import vào Site' trên từng card bên dưới)" onclick="importComponent('${compName}', this)">
                        📦 Import cả bộ ${secTitle}
                    </button>
                `;
            }
        }

        refreshInstalledCounter();
    }

    function refreshInstalledCounter() {
        const total = document.querySelectorAll('.cs-section').length;
        const installed = document.querySelectorAll('.cs-section[data-installed="true"]').length;
        const pill = document.getElementById('cs-installed-stat');
        if (pill) {
            pill.innerHTML = `Đã cài vào site: <strong style="color:${installed > 0 ? '#10b981' : '#64748b'}">${installed}/${total}</strong>`;
        }
    }

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

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `⏳ Đang import...`;

        try {
            const res = await fetch('/__api/import-variant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component: compName,
                    classStr: classStr,
                    variantTitle: title,
                    scssCode: scssCode
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🎉 ${data.message || `Đã import riêng component "${title}" vào site!`}`, '🚀');
                btn.classList.add('is-installed');
                btn.innerHTML = `✓ Đã cài vào Site`;
                btn.disabled = true;
                if (typeof syncVariantCardsStatus === 'function') {
                    syncVariantCardsStatus();
                }
                syncRegistryState();
            } else {
                showToast(`❌ Lỗi: ${data.message || 'Không thể import'}`, '⚠️');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            showToast(`❌ Lỗi kết nối: ${err.message}`, '⚠️');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    async function syncVariantCardsStatus() {
        const buttons = document.querySelectorAll('.cs-btn-action--import');
        if (buttons.length === 0) return;

        const items = Array.from(buttons).map(b => ({
            component: b.getAttribute('data-comp'),
            classStr: b.getAttribute('data-class')
        }));

        try {
            const res = await fetch('/__api/check-variants', {
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
                        btn.innerHTML = `✓ Đã cài vào Site`;
                        btn.disabled = true;
                    } else {
                        btn.classList.remove('is-installed');
                        btn.innerHTML = `🚀 Import vào Site`;
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
            const res = await fetch('/__api/registry');
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
            copyRaw(htmlCode.textContent.trim(), 'Đã copy snippet HTML vào clipboard!');
        }
    };

    window.copyScssFromCard = function(btn) {
        const card = btn.closest('.cs-card');
        if (!card) return;
        const scssCode = card.querySelector('.cs-code-panel--scss code');
        if (scssCode) {
            copyRaw(scssCode.textContent.trim(), 'Đã copy SCSS styles vào clipboard!');
        }
    };

    window.copyJsFromCard = function(btn) {
        const card = btn.closest('.cs-card');
        if (!card) return;
        const jsCode = card.querySelector('.cs-code-panel--js code');
        if (jsCode) {
            copyRaw(jsCode.textContent.trim(), 'Đã copy JS logic vào clipboard!');
        }
    };

    window.toggleCodeDrawer = function(btn) {
        const card = btn.closest('.cs-card');
        if (!card) return;
        const drawer = card.querySelector('.cs-card__code-drawer');
        if (!drawer) return;
        drawer.classList.toggle('is-open');
        btn.textContent = drawer.classList.contains('is-open') ? 'Ẩn Code' : 'Xem Code';
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

    function extractFileHeader(fullScss) {
        if (!fullScss) return '';
        let header = '';

        // 1. All @use and @forward statements
        const useMatches = fullScss.match(/@(use|forward)\s+[^;]+;/g) || [];
        if (useMatches.length > 0) {
            header += useMatches.join('\n') + '\n\n';
        }

        // 2. Banner comment (/*! ... */ or /* ... */ at top of file)
        const bannerMatch = fullScss.match(/^(?:\s*@(use|forward)[^;]+;\s*)*(\/\*[\s\S]*?\*\/)/);
        if (bannerMatch && bannerMatch[2]) {
            header += bannerMatch[2].trim() + '\n\n';
        }

        // 3. File-level variables ($var: ...;)
        const varMatches = fullScss.match(/(?:^|\n)(\$[a-zA-Z0-9_-]+\s*:[^;]+;)/g) || [];
        if (varMatches.length > 0) {
            header += varMatches.map(v => v.trim()).join('\n') + '\n\n';
        }

        // 4. File-level @mixin and @function blocks
        const mixinRegex = /(?:^|\n)([ \t]*@(mixin|function)\s+[a-zA-Z0-9_-]+[^{]*\{)/g;
        let mMatch;
        while ((mMatch = mixinRegex.exec(fullScss)) !== null) {
            const startPos = mMatch.index + (mMatch[0].length - mMatch[1].length);
            const bracePos = fullScss.indexOf('{', startPos);
            if (bracePos !== -1) {
                const endPos = findMatchingBrace(fullScss, bracePos);
                if (endPos !== -1) {
                    header += fullScss.slice(startPos, endPos).trim() + '\n\n';
                }
            }
        }

        return header.trim();
    }

    function sliceScssForClasses(fullScss, classStr) {
        if (!fullScss || !classStr) return fullScss || '';
        const tokens = classStr.split(/\s+/).filter(Boolean);

        // Support single or multiple root classes (e.g. c-card, c-btn, p-header, card)
        const candidateClasses = tokens
            .filter(c => /^[clpmo]-/.test(c) || (!c.startsWith('is-') && !c.startsWith('js-') && c !== 'active'))
            .map(c => c.split('--')[0]);

        const uniqueBases = Array.from(new Set(candidateClasses));
        if (uniqueBases.length === 0 && tokens[0]) {
            uniqueBases.push(tokens[0].split('--')[0]);
        }

        const headers = extractFileHeader(fullScss);
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

        if (extractedBlocks.length === 0) return fullScss;

        return (headers ? headers.trim() + '\n\n' : '') + extractedBlocks.join('\n\n').trim();
    }

    function buildCard(el, title, fullClass, scssText, jsText, compName, isInline = false, isLeft = false) {
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
        const escapedScss = (cardScss || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapedJs = (jsText || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const classTokens = effectiveClass.split(/\s+/).filter(Boolean);
        const badgesHtml = classTokens.map(c => {
            const cleanC = c.replace(/^\./, '');
            return `<span class="cs-card__class-tag" title="Click để copy .${cleanC}" onclick="event.stopPropagation(); copyRaw('${cleanC}', 'Đã copy class: .${cleanC}')">.${cleanC}</span>`;
        }).join(' ');

        card.innerHTML = `
            <div class="cs-card__toolbar">
                <span class="cs-card__title">${title}</span>
                <div class="cs-card__actions">
                    <button type="button" class="cs-btn-action cs-btn-action--import" onclick="importCardVariant(this)" data-comp="${compName}" data-class="${effectiveClass}" data-title="${title}" title="Chỉ import riêng component này vào site">🚀 Import vào Site</button>
                    <button type="button" class="cs-btn-action cs-btn-action--copy" onclick="copySnippetFromCard(this)">📋 Copy HTML</button>
                    ${cardScss ? `<button type="button" class="cs-btn-action" onclick="copyScssFromCard(this)">🎨 SCSS</button>` : ''}
                    ${jsText ? `<button type="button" class="cs-btn-action cs-btn-action--js" onclick="copyJsFromCard(this)">⚡ JS</button>` : ''}
                    <button type="button" class="cs-btn-action" onclick="toggleCodeDrawer(this)">Xem Code</button>
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
                    ${jsText ? `<button type="button" class="cs-code-tab" onclick="switchCodeTab(this, 'js')">JavaScript</button>` : ''}
                </div>
                <div class="cs-code-panel cs-code-panel--html is-active">
                    <pre><code>${escapedHtml}</code></pre>
                </div>
                ${cardScss ? `
                <div class="cs-code-panel cs-code-panel--scss">
                    <pre><code>${escapedScss}</code></pre>
                </div>` : ''}
                ${jsText ? `
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
        if (clean.includes('--cl3')) return 'Grid (3 Cột)';
        if (clean.includes('--cl4')) return 'Grid (4 Cột)';
        if (clean.includes('--cl5')) return 'Grid (5 Cột)';
        if (clean.includes('--middle') && clean.includes('--reverse')) return 'Flex (Reverse + Middle)';
        if (clean.includes('--equal')) return 'Flex Equal 50/50';
        if (clean.includes('--reverse')) return clean.includes('btn') ? 'Nút Reverse' : 'Flex Reverse';
        if (clean.includes('--arrow-between')) return 'Nút Mũi Tên Cách Giữa';
        if (clean.includes('--arrow-center')) return 'Nút Mũi Tên Trung Tâm';
        if (clean.includes('--arrow')) return 'Nút Có Mũi Tên';
        if (clean.includes('--blank')) return 'Link Mở Tab Mới (Blank)';
        if (clean.includes('--line')) return 'Tiêu Đề Dạng Line';
        if (clean.includes('--dot')) return 'Tiêu Đề Dạng Dot';
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
            const matchedClass = targetClasses.find(c => /^[clpmo]-/.test(c)) ||
                                 targetClasses.find(c => !c.startsWith('is-') && !c.startsWith('js-') && c !== 'active' && !c.startsWith('p-component__')) ||
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

            // Enhanced Section Header with Live Import / Remove Action
            const header = document.createElement('div');
            header.className = 'cs-section__header';
            header.innerHTML = `
                <div class="cs-section__header-left">
                    <span class="cs-badge-cat cs-badge-cat--${category}">${category}</span>
                    <h2 class="cs-section__title">${title}</h2>
                    <span class="cs-section__file">📁 ${file}</span>
                </div>
                <div class="cs-section__header-actions">
                    <div id="actions-${compName}" style="display:inline-flex;align-items:center;gap:6px;">
                        ${isInstalled ? `
                        <button type="button" class="cs-btn-import is-installed" title="Toàn bộ nhóm ${title} đã được cài đặt trong site">
                            ✓ Cả bộ đã cài
                        </button>
                        <button type="button" class="cs-btn-remove" title="Gỡ cả bộ component ${title} khỏi site chính" onclick="removeComponent('${compName}', this)">
                            🗑 Gỡ cả bộ
                        </button>
                        ` : `
                        <button type="button" class="cs-btn-import" title="Import toàn bộ các biến thể của nhóm ${title} vào site chính. (Để chỉ cài 1 component, hãy bấm 'Import vào Site' trên từng card bên dưới)" onclick="importComponent('${compName}', this)">
                            📦 Import cả bộ ${title}
                        </button>
                        `}
                    </div>

                    <button type="button" class="cs-btn-cli" title="Click để copy lệnh CLI" onclick="copyCliCommand('${compName}')">
                        <code>⚡ npm run add ${compName}</code>
                    </button>
                    <button type="button" class="cs-btn-action cs-btn-action--copy" onclick="copyRaw(document.querySelector('#sec-${compName} .cs-raw-ejs').value, 'Đã copy toàn bộ template ${file}!')">
                        📋 EJS
                    </button>
                    ${scssText ? `
                    <button type="button" class="cs-btn-action" onclick="copyRaw(document.querySelector('#sec-${compName} .cs-raw-scss').value, 'Đã copy toàn bộ SCSS của ${compName}!')">
                        🎨 SCSS
                    </button>` : ''}
                    ${jsText ? `
                    <button type="button" class="cs-btn-action cs-btn-action--js" onclick="copyRaw(document.querySelector('#sec-${compName} .cs-raw-js').value, 'Đã copy toàn bộ JavaScript của ${compName}!')">
                        ⚡ JS
                    </button>` : ''}
                </div>
            `;

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'cs-cards-container';

            const items = extractComponentItems(raw);

            items.forEach((item) => {
                const cardTitle = item.commentTitle || formatComponentTitle(item.tagClass);
                const isLeft = item.tagClass.includes('title') || item.tagClass.includes('text') || item.tagClass.includes('bread') || item.tagClass.includes('ttl') || item.tagClass.includes('txt') || item.tagClass.includes('tbl') || ['H1','H2','H3','H4','H5','H6','P','TABLE','UL','OL'].includes(item.snippetElement.tagName);
                const card = buildCard(item.domElement, cardTitle, item.fullClass, scssText, jsText, compName, item.isInline, isLeft);
                cardsContainer.appendChild(card);
            });

            raw.remove();
            sec.appendChild(header);
            sec.appendChild(cardsContainer);

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', transformSections);
    } else {
        transformSections();
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
                const visibleCards = sec.querySelectorAll('.cs-card:not([style*="display: none"])');
                sec.style.display = (visibleCards.length > 0 || !query) ? '' : 'none';
            });
        });
    }
})();
