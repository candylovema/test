// ===== PC版與手機版全浮動式、拖曳與縮放記憶 UI 系統 =====
(function () {
    const el = id => document.getElementById(id);

    // 注入全方位浮動與縮放 UI 的專用樣式（PC與手機版通用）
    const style = document.createElement('style');
    style.textContent = `
        body {
            overflow: auto !important; /* 允許縮放超出時出現滾動條 */
        }
        
        /* 使左、中、右及日誌列變成可縮放的浮動式視窗 */
        #col-left, #col-center, #col-right, #log-row {
            position: fixed !important;
            margin: 0 !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85) !important;
            border: 2px solid #8d6846 !important;
            border-radius: 6px !important;
            background: #111318 !important;
            display: flex !important;
            flex-direction: column !important;
            resize: both !important;
            overflow: hidden !important;
        }
        
        #col-left.ui-minimized,
        #col-center.ui-minimized,
        #col-right.ui-minimized,
        #log-row.ui-minimized {
            display: none !important;
        }
        
        #col-left {
            width: 340px;
            height: 720px;
            min-width: 280px !important;
            min-height: 250px !important;
        }
        
        #col-center {
            width: 820px;
            height: 560px;
            min-width: 300px !important;
            min-height: 200px !important;
        }
        
        #col-right {
            width: 380px;
            height: 720px;
            min-width: 320px !important;
            min-height: 250px !important;
        }
        
        #log-row {
            width: 820px;
            height: 250px;
            min-width: 300px !important;
            min-height: 120px !important;
        }
        
        #combat-log-panel, #syslog-panel {
            flex: 1 1 0 !important;
            height: 100% !important;
            border: none !important;
            background: transparent !important;
            min-height: 0 !important;
        }
        
        #status-panel {
            flex: 0 0 auto !important;
        }
        
        #squad-panel {
            flex: 1 1 0 !important;
            min-height: 0 !important;
            display: flex !important;
            flex-direction: column !important;
        }
        
        #squad-tab-team, #squad-tab-skill {
            flex: 1 1 0 !important;
            overflow-y: auto !important;
        }

        #tab-content-panel {
            flex: 1 1 0 !important;
            min-height: 0 !important;
            height: auto !important;
        }
        
        #map-view-panel {
            width: 100% !important;
            flex: 1 1 auto !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
            border: none !important;
            background: transparent !important;
        }
        
        #battle-view.area-fit:not(.hidden) {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            aspect-ratio: 16 / 9 !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            align-self: center !important;
        }
        
        /* 讓怪物列表的高度隨戰鬥地圖寬度等比例放大，解決縮放後怪變小隻的問題 */
        #battle-view.area-fit #mob-list,
        #battle-view.area-fit #mob-list:has(.boss-slot),
        #battle-view.area-fit #mob-list:has(.mob-back) {
            height: 56% !important;
        }
        
        #town-view {
            width: 100% !important;
            height: 100% !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
        }
        
        /* 拖曳握把條 */
        .ui-drag-handle {
            height: 28px;
            background: linear-gradient(180deg, #4a3b32, #2d241e);
            border-bottom: 1px solid #8d6846;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px;
            cursor: move;
            user-select: none;
            color: #fde68a;
            font-size: 13px;
            font-weight: bold;
            flex-shrink: 0;
        }
        
        .ui-drag-handle .ui-drag-title {
            pointer-events: none;
        }
        
        /* 自訂原生縮放角把手外觀 */
        #col-left::-webkit-resizer,
        #col-center::-webkit-resizer,
        #col-right::-webkit-resizer,
        #log-row::-webkit-resizer {
            background-color: #8d6846;
            border: 1px solid #4a3b32;
            border-radius: 2px;
            outline: 1px solid rgba(0,0,0,0.5);
        }
    `;
    document.head.appendChild(style);

    window._currentFocusedWindowId = '';

    window.updateWindowZIndices = function () {
        const ids = ['col-left', 'col-center', 'col-right', 'log-row'];
        const prefixes = ['ui_col_left', 'ui_col_center', 'ui_col_right', 'ui_log_row'];
        const focusedId = window._currentFocusedWindowId || '';

        ids.forEach((id, idx) => {
            const target = el(id);
            if (!target) return;

            const prefix = prefixes[idx];
            const isPinned = localStorage.getItem(prefix + '_pinned') === '1';

            // 計算 z-index，置頂為最高(80)，當前點擊為中等(50)，其他為一般(40)
            let z = 40;
            if (isPinned) z = 80;
            else if (id === focusedId) z = 50;

            target.style.setProperty('z-index', z, 'important');

            // 調整按鈕視覺效果
            const pinBtn = target.querySelector('.ui-pin-btn');
            if (pinBtn) {
                pinBtn.style.background = isPinned ? '#8d6846' : '#4a3b32';
                pinBtn.style.color = isPinned ? '#fff' : '#fde68a';
                pinBtn.style.borderColor = isPinned ? '#fde68a' : '#8d6846';
            }
        });
    };

    window.applyGameScale = function (scale) {
        const gameScreen = el('game-screen');
        if (!gameScreen) return;
        
        localStorage.setItem('game_scale', scale);
        
        const slider = el('game-zoom-slider');
        const label = el('game-zoom-val');
        if (slider) slider.value = scale;
        if (label) label.textContent = Math.round(scale * 100) + '%';
        
        // 套用 CSS transform 與自適應寬高比例
        gameScreen.style.transform = `scale(${scale})`;
        gameScreen.style.transformOrigin = 'top left';
        gameScreen.style.width = (100 / scale) + '%';
        gameScreen.style.height = (100 / scale) + '%';
        
        // 重新調整裝備與視窗定位
        if (typeof refreshEquipmentWindow === 'function') refreshEquipmentWindow();
    };

    function toggleControlPanelCollapse() {
        const panel = el('game-control-panel');
        if (!panel) return;
        
        const isCollapsed = localStorage.getItem('ui_control_panel_collapsed') === '1';
        const newCollapsed = !isCollapsed;
        
        localStorage.setItem('ui_control_panel_collapsed', newCollapsed ? '1' : '0');
        applyControlPanelCollapseState();
    }

    function applyControlPanelCollapseState() {
        const panel = el('game-control-panel');
        if (!panel) return;
        
        const isCollapsed = localStorage.getItem('ui_control_panel_collapsed') === '1';
        const contentDiv = panel.querySelector('.control-panel-content');
        const toggleBtn = el('game-control-toggle');
        
        if (contentDiv && toggleBtn) {
            contentDiv.style.display = isCollapsed ? 'none' : 'flex';
            toggleBtn.textContent = isCollapsed ? '▶ 展開' : '◀ 收折';
            toggleBtn.style.borderRadius = isCollapsed ? '0 3px 3px 0' : '0';
        }
    }

    function createControlPanel() {
        if (el('game-control-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'game-control-panel';
        panel.style.cssText = `
            position: fixed;
            top: 6px;
            left: 6px;
            z-index: 100;
            background: rgba(20, 22, 28, 0.95);
            border: 1px solid #8d6846;
            border-radius: 4px;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            font-family: sans-serif;
            pointer-events: auto;
            user-select: none;
        `;

        panel.innerHTML = `
            <div id="game-control-drag" style="cursor:move; padding: 6px 8px; display:flex; align-items:center; background:linear-gradient(180deg, #4a3b32, #2d241e); color:#fde68a; font-weight:bold; font-size:12px; border-right:1px solid #8d6846; border-radius:3px 0 0 3px; height:100%; min-height:28px;">☰ 拖曳</div>
            <button id="game-control-toggle" type="button" style="background:#8d6846;border:1px solid #4a3b32;color:#fff;padding:2px 8px;cursor:pointer;font-size:11px;font-weight:bold;height:100%;min-height:28px;transition:all 0.15s ease;">◀ 收折</button>
            <div class="control-panel-content" style="display:flex; align-items:center; gap:8px; padding: 4px 10px;">
                <span style="font-weight:bold; pointer-events:none; font-size:12px; color:#fde68a;">🔍 畫面縮放</span>
                <button id="game-zoom-minus" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:1px 5px;border-radius:3px;cursor:pointer;font-weight:bold;">-</button>
                <input id="game-zoom-slider" type="range" min="0.5" max="1.5" step="0.05" value="1" style="width:70px;margin:0;cursor:pointer;">
                <button id="game-zoom-plus" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:1px 5px;border-radius:3px;cursor:pointer;font-weight:bold;">+</button>
                <span id="game-zoom-val" style="min-width:34px;text-align:right;font-weight:bold;pointer-events:none;color:#fde68a;font-size:12px;">100%</span>
                <button id="game-zoom-reset" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:1px 5px;border-radius:3px;cursor:pointer;font-size:10px;">1:1</button>
                <span style="color:#8d6846; margin:0 4px; pointer-events:none;">|</span>
                <button id="dock-btn-col-left" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:bold;transition:all 0.15s ease;">👤 狀態</button>
                <button id="dock-btn-col-center" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:bold;transition:all 0.15s ease;">🗺️ 地圖</button>
                <button id="dock-btn-col-right" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:bold;transition:all 0.15s ease;">🎒 背包</button>
                <button id="dock-btn-log-row" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:bold;transition:all 0.15s ease;">📜 日誌</button>
            </div>
        `;

        document.body.appendChild(panel);

        // 還原主控制面板位置
        function restoreControlPanelPosition() {
            let x = localStorage.getItem('ui_control_panel_x');
            let y = localStorage.getItem('ui_control_panel_y');
            if (x !== null && y !== null) {
                panel.style.left = x + 'px';
                panel.style.top = y + 'px';
            } else {
                panel.style.left = '6px';
                panel.style.top = '6px';
            }
        }
        restoreControlPanelPosition();

        // 綁定拖曳功能
        const dragHandle = el('game-control-drag');
        let drag = null;
        dragHandle.onpointerdown = function (e) {
            const rect = panel.getBoundingClientRect();
            drag = {
                id: e.pointerId,
                dx: e.clientX - rect.left,
                dy: e.clientY - rect.top
            };
            dragHandle.setPointerCapture(e.pointerId);
            e.preventDefault();
        };
        dragHandle.onpointermove = function (e) {
            if (!drag || drag.id !== e.pointerId) return;
            let tx = e.clientX - drag.dx;
            let ty = e.clientY - drag.dy;
            panel.style.left = Math.max(0, Math.min(innerWidth - 60, tx)) + 'px';
            panel.style.top = Math.max(0, Math.min(innerHeight - 30, ty)) + 'px';
        };
        function stopDrag(e) {
            if (!drag || drag.id !== e.pointerId) return;
            drag = null;
            localStorage.setItem('ui_control_panel_x', panel.offsetLeft);
            localStorage.setItem('ui_control_panel_y', panel.offsetTop);
        }
        dragHandle.onpointerup = stopDrag;
        dragHandle.onpointercancel = stopDrag;

        // 收折按鈕綁定
        el('game-control-toggle').onclick = toggleControlPanelCollapse;

        // 縮放按鈕邏輯
        const slider = el('game-zoom-slider');
        const plus = el('game-zoom-plus');
        const minus = el('game-zoom-minus');
        const reset = el('game-zoom-reset');

        slider.oninput = function () {
            applyGameScale(parseFloat(this.value));
        };
        plus.onclick = function () {
            let val = Math.min(1.5, parseFloat(slider.value) + 0.05);
            applyGameScale(val);
        };
        minus.onclick = function () {
            let val = Math.max(0.5, parseFloat(slider.value) - 0.05);
            applyGameScale(val);
        };
        reset.onclick = function () {
            applyGameScale(1.0);
        };

        // 工作列按鈕邏輯
        const configs = [
            { id: 'col-left', btnId: 'dock-btn-col-left', key: 'ui_col_left' },
            { id: 'col-center', btnId: 'dock-btn-col-center', key: 'ui_col_center' },
            { id: 'col-right', btnId: 'dock-btn-col-right', key: 'ui_col_right' },
            { id: 'log-row', btnId: 'dock-btn-log-row', key: 'ui_log_row' }
        ];

        configs.forEach(c => {
            const btn = el(c.btnId);
            if (btn) {
                btn.onclick = () => toggleWindowMinimize(c.id, c.key);
            }
        });

        // 載入與初始化視窗收合狀態
        configs.forEach(c => {
            let isMin = localStorage.getItem(c.key + '_minimized') === '1';
            let target = el(c.id);
            let btn = el(c.btnId);
            if (target && btn) {
                target.classList.toggle('ui-minimized', isMin);
                btn.style.opacity = isMin ? '0.5' : '1';
                btn.style.background = isMin ? '#1c1512' : '#4a3b32';
                btn.style.borderColor = isMin ? '#4a3b32' : '#8d6846';
                btn.style.color = isMin ? '#8d6846' : '#fde68a';
            }
        });

        // 套用儲存的縮放值
        let savedScale = localStorage.getItem('game_scale');
        if (savedScale !== null) {
            applyGameScale(parseFloat(savedScale));
        } else {
            applyGameScale(1.0);
        }

        // 初始化收折狀態
        applyControlPanelCollapseState();
    }

    function toggleWindowMinimize(id, key) {
        const target = el(id);
        const exactBtn = el(id === 'col-left' ? 'dock-btn-col-left' : (id === 'col-center' ? 'dock-btn-col-center' : (id === 'col-right' ? 'dock-btn-col-right' : 'dock-btn-log-row')));
        
        if (!target || !exactBtn) return;

        const isMin = !target.classList.contains('ui-minimized');
        target.classList.toggle('ui-minimized', isMin);
        
        localStorage.setItem(key + '_minimized', isMin ? '1' : '0');

        exactBtn.style.opacity = isMin ? '0.5' : '1';
        exactBtn.style.background = isMin ? '#1c1512' : '#4a3b32';
        exactBtn.style.borderColor = isMin ? '#4a3b32' : '#8d6846';
        exactBtn.style.color = isMin ? '#8d6846' : '#fde68a';
    }

    function toggleWindowPin(id, key) {
        const isPinned = localStorage.getItem(key + '_pinned') === '1';
        localStorage.setItem(key + '_pinned', isPinned ? '0' : '1');
        updateWindowZIndices();
    }

    function createDragHandle(targetEl, titleText, onMinimizeClick, onPinClick) {
        let existing = targetEl.querySelector('.ui-drag-handle');
        if (existing) return existing;

        const handle = document.createElement('div');
        handle.className = 'ui-drag-handle';
        handle.innerHTML = `
            <span class="ui-drag-title">${titleText}</span>
            <div style="display:flex;align-items:center;gap:6px;">
                <span class="ui-drag-hint" style="font-size:10px;opacity:0.6;pointer-events:none;margin-right:6px;">::: 拖曳此處 / 右下角可縮放 :::</span>
                <button class="ui-pin-btn" type="button" title="置頂放最前面" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:0px 5px;font-size:11px;line-height:1.4;border-radius:3px;cursor:pointer;font-weight:bold;display:flex;align-items:center;justify-content:center;">📌</button>
                <button class="ui-minimize-btn" type="button" title="最小化" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:0px 6px;font-size:11px;line-height:1.4;border-radius:3px;cursor:pointer;font-weight:bold;display:flex;align-items:center;justify-content:center;">⚊</button>
            </div>
        `;
        
        const pinBtn = handle.querySelector('.ui-pin-btn');
        pinBtn.onclick = function (e) {
            e.stopPropagation();
            onPinClick();
        };

        const minBtn = handle.querySelector('.ui-minimize-btn');
        minBtn.onclick = function (e) {
            e.stopPropagation();
            onMinimizeClick();
        };

        targetEl.insertBefore(handle, targetEl.firstChild);
        return handle;
    }

    function makeElementDraggable(targetEl, titleText, storagePrefix, defaultLeftFn, defaultTopFn, onMinimizeClick, onPinClick) {
        const handle = createDragHandle(targetEl, titleText, onMinimizeClick, onPinClick);
        let drag = null;

        function restorePositionAndSize() {
            targetEl.style.position = 'fixed';
            
            // 還原尺寸
            let savedW = localStorage.getItem(storagePrefix + '_w');
            let savedH = localStorage.getItem(storagePrefix + '_h');
            if (savedW !== null) targetEl.style.width = savedW + 'px';
            if (savedH !== null) targetEl.style.height = savedH + 'px';

            // 還原位置
            let savedX = localStorage.getItem(storagePrefix + '_x');
            let savedY = localStorage.getItem(storagePrefix + '_y');

            let currentScale = parseFloat(localStorage.getItem('game_scale') || '1');

            if (savedX !== null && savedY !== null) {
                let x = parseFloat(savedX);
                let y = parseFloat(savedY);
                if (x >= -200 && x < (innerWidth / currentScale) && y >= -50 && y < (innerHeight / currentScale)) {
                    targetEl.style.left = x + 'px';
                    targetEl.style.top = y + 'px';
                    targetEl.style.right = 'auto';
                    targetEl.style.bottom = 'auto';
                    return;
                }
            }

            let x = defaultLeftFn();
            let y = defaultTopFn();
            targetEl.style.left = x + 'px';
            targetEl.style.top = y + 'px';
            targetEl.style.right = 'auto';
            targetEl.style.bottom = 'auto';
        }

        handle.addEventListener('pointerdown', function (event) {
            if (event.target.closest('button, input, select')) return;
            drag = {
                id: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startLeft: targetEl.offsetLeft,
                startTop: targetEl.offsetTop
            };
            handle.setPointerCapture(event.pointerId);
            targetEl.classList.add('ui-dragging');
            event.preventDefault();
        });

        handle.addEventListener('pointermove', function (event) {
            if (!drag || drag.id !== event.pointerId) return;
            let currentScale = parseFloat(localStorage.getItem('game_scale') || '1');
            let targetX = drag.startLeft + (event.clientX - drag.startX) / currentScale;
            let targetY = drag.startTop + (event.clientY - drag.startY) / currentScale;

            const maxX = (innerWidth / currentScale) - 50;
            const maxY = (innerHeight / currentScale) - 50;
            targetX = Math.max(-150, Math.min(maxX, targetX));
            targetY = Math.max(-10, Math.min(maxY, targetY));

            targetEl.style.left = targetX + 'px';
            targetEl.style.top = targetY + 'px';
        });

        function stopDrag(event) {
            if (!drag || drag.id !== event.pointerId) return;
            drag = null;
            targetEl.classList.remove('ui-dragging');

            localStorage.setItem(storagePrefix + '_x', targetEl.offsetLeft);
            localStorage.setItem(storagePrefix + '_y', targetEl.offsetTop);
        }

        handle.addEventListener('pointerup', stopDrag);
        handle.addEventListener('pointercancel', stopDrag);

        window.addEventListener('resize', restorePositionAndSize);
        restorePositionAndSize();
    }

    function init() {
        const leftCol = el('col-left');
        const centerCol = el('col-center');
        const rightCol = el('col-right');
        const logRow = el('log-row');

        // 1. 建立整合控制台 (包含縮放與視窗 Dock)
        createControlPanel();

        if (logRow) {
            const combat = el('combat-log-panel');
            const sys = el('syslog-panel');
            let wrap = logRow.querySelector('.log-panels-wrap');
            if (!wrap && combat && sys) {
                wrap = document.createElement('div');
                wrap.className = 'log-panels-wrap';
                wrap.style.cssText = 'display:flex; flex-direction:row; gap:16px; flex:1 1 0; min-height:0; width:100%;';
                logRow.appendChild(wrap);
                wrap.appendChild(combat);
                wrap.appendChild(sys);
            }
        }

        let currentScale = parseFloat(localStorage.getItem('game_scale') || '1');

        if (leftCol) {
            makeElementDraggable(
                leftCol, 
                '👤 角色狀態', 
                'ui_col_left',
                () => 16,
                () => 16,
                () => toggleWindowMinimize('col-left', 'ui_col_left'),
                () => toggleWindowPin('col-left', 'ui_col_left')
            );
        }

        if (centerCol) {
            makeElementDraggable(
                centerCol,
                '🗺️ 冒險地圖',
                'ui_col_center',
                () => Math.max(16, Math.round((innerWidth / currentScale) * 0.5 - 410)),
                () => 16,
                () => toggleWindowMinimize('col-center', 'ui_col_center'),
                () => toggleWindowPin('col-center', 'ui_col_center')
            );
        }

        if (rightCol) {
            makeElementDraggable(
                rightCol, 
                '🎒 角色背包與功能', 
                'ui_col_right',
                () => Math.max(16, (innerWidth / currentScale) - 380 - 16),
                () => 16,
                () => toggleWindowMinimize('col-right', 'ui_col_right'),
                () => toggleWindowPin('col-right', 'ui_col_right')
            );
        }

        if (logRow) {
            makeElementDraggable(
                logRow, 
                '📜 遊戲日誌', 
                'ui_log_row',
                () => Math.max(16, Math.round((innerWidth / currentScale) * 0.5 - 410)),
                () => Math.max(16, (innerHeight / currentScale) - 250 - 16),
                () => toggleWindowMinimize('log-row', 'ui_log_row'),
                () => toggleWindowPin('log-row', 'ui_log_row')
            );
        }

        // 綁定點擊自動置前 (Focus on Click) 邏輯
        [leftCol, centerCol, rightCol, logRow].forEach(target => {
            if (target) {
                target.addEventListener('pointerdown', function () {
                    if (window._currentFocusedWindowId !== target.id) {
                        window._currentFocusedWindowId = target.id;
                        updateWindowZIndices();
                    }
                }, { passive: true });
            }
        });

        // 載入預設的 z-index 與置頂狀態
        updateWindowZIndices();

        // 統一在指標放開時，儲存所有視窗的位置與大小（覆蓋拖曳、縮放與邊界改變）
        window.addEventListener('pointerup', function () {
            [['ui_col_left', 'col-left'], ['ui_col_center', 'col-center'], ['ui_col_right', 'col-right'], ['ui_log_row', 'log-row']].forEach(([prefix, id]) => {
                let target = el(id);
                if (target) {
                    let x = target.offsetLeft;
                    let y = target.offsetTop;
                    let w = target.offsetWidth;
                    let h = target.offsetHeight;
                    
                    if (w > 50 && h > 50) {
                        localStorage.setItem(prefix + '_x', x);
                        localStorage.setItem(prefix + '_y', y);
                        localStorage.setItem(prefix + '_w', w);
                        localStorage.setItem(prefix + '_h', h);
                    }
                }
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
