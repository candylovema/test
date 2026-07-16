// ===== PC版全浮動式、拖曳與縮放記憶 UI 系統 =====
(function () {
    const el = id => document.getElementById(id);

    // 注入 PC 版浮動與縮放 UI 的專用樣式
    const style = document.createElement('style');
    style.textContent = `
        body {
            overflow: auto !important; /* 允許縮放超出時出現滾動條 */
        }
        
        @media (min-width: 769px) {
            /* 使左、中、右及日誌列在 PC 上變成可縮放的浮動式視窗 */
            #col-left, #col-center, #col-right, #log-row {
                position: fixed !important;
                margin: 0 !important;
                z-index: 45 !important;
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
                min-width: 450px !important;
                min-height: 300px !important;
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
                min-width: 400px !important;
                min-height: 150px !important;
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
                flex: 1 1 auto !important;
                min-height: 0 !important;
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
        }
    `;
    document.head.appendChild(style);

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

    function createZoomController() {
        if (el('game-zoom-controller')) return;
        
        const controller = document.createElement('div');
        controller.id = 'game-zoom-controller';
        controller.style.cssText = `
            position: fixed;
            top: 6px;
            left: 6px;
            z-index: 100;
            background: rgba(20, 22, 28, 0.95);
            border: 1px solid #8d6846;
            border-radius: 4px;
            padding: 4px 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #fde68a;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            font-family: sans-serif;
            pointer-events: auto;
        `;
        
        controller.innerHTML = `
            <span style="font-weight:bold;pointer-events:none;">🔍 畫面縮放</span>
            <button id="game-zoom-minus" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:1px 5px;border-radius:3px;cursor:pointer;font-weight:bold;">-</button>
            <input id="game-zoom-slider" type="range" min="0.5" max="1.5" step="0.05" value="1" style="width:70px;margin:0;cursor:pointer;">
            <button id="game-zoom-plus" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:1px 5px;border-radius:3px;cursor:pointer;font-weight:bold;">+</button>
            <span id="game-zoom-val" style="min-width:34px;text-align:right;font-weight:bold;pointer-events:none;">100%</span>
            <button id="game-zoom-reset" type="button" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:1px 5px;border-radius:3px;cursor:pointer;font-size:10px;">1:1</button>
        `;
        
        document.body.appendChild(controller);
        
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
        
        let savedScale = localStorage.getItem('game_scale');
        if (savedScale !== null) {
            applyGameScale(parseFloat(savedScale));
        } else {
            applyGameScale(1.0);
        }
    }

    // 建立 PC 視窗工作列（Dock）
    function createWindowsDock() {
        if (el('ui-windows-dock')) return;

        const dock = document.createElement('div');
        dock.id = 'ui-windows-dock';
        dock.style.cssText = `
            position: fixed;
            top: 6px;
            left: 200px;
            z-index: 100;
            background: rgba(20, 22, 28, 0.95);
            border: 1px solid #8d6846;
            border-radius: 4px;
            padding: 4px 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            pointer-events: auto;
        `;

        const configs = [
            { id: 'col-left', name: '👤 狀態', key: 'ui_col_left' },
            { id: 'col-center', name: '🗺️ 地圖', key: 'ui_col_center' },
            { id: 'col-right', name: '🎒 背包', key: 'ui_col_right' },
            { id: 'log-row', name: '📜 日誌', key: 'ui_log_row' }
        ];

        configs.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `dock-btn-${c.id}`;
            btn.style.cssText = `
                background: #4a3b32;
                border: 1px solid #8d6846;
                color: #fde68a;
                padding: 2px 6px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                font-weight: bold;
                transition: all 0.15s ease;
            `;
            btn.textContent = c.name;
            btn.onclick = () => toggleWindowMinimize(c.id, c.key);
            dock.appendChild(btn);
        });

        document.body.appendChild(dock);

        // 根據存檔狀態初始化按鈕樣式與視窗顯示狀態
        configs.forEach(c => {
            let isMin = localStorage.getItem(c.key + '_minimized') === '1';
            let target = el(c.id);
            let btn = el(`dock-btn-${c.id}`);
            if (target && btn) {
                target.classList.toggle('ui-minimized', isMin);
                btn.style.opacity = isMin ? '0.5' : '1';
                btn.style.background = isMin ? '#1c1512' : '#4a3b32';
                btn.style.borderColor = isMin ? '#4a3b32' : '#8d6846';
                btn.style.color = isMin ? '#8d6846' : '#fde68a';
            }
        });
    }

    function toggleWindowMinimize(id, key) {
        const target = el(id);
        const btn = el(`dock-btn-${id}`);
        if (!target || !btn) return;

        const isMin = !target.classList.contains('ui-minimized');
        target.classList.toggle('ui-minimized', isMin);
        
        localStorage.setItem(key + '_minimized', isMin ? '1' : '0');

        btn.style.opacity = isMin ? '0.5' : '1';
        btn.style.background = isMin ? '#1c1512' : '#4a3b32';
        btn.style.borderColor = isMin ? '#4a3b32' : '#8d6846';
        btn.style.color = isMin ? '#8d6846' : '#fde68a';
    }

    function createDragHandle(targetEl, titleText, onMinimizeClick) {
        let existing = targetEl.querySelector('.ui-drag-handle');
        if (existing) return existing;

        const handle = document.createElement('div');
        handle.className = 'ui-drag-handle';
        handle.innerHTML = `
            <span class="ui-drag-title">${titleText}</span>
            <div style="display:flex;align-items:center;gap:12px;">
                <span class="ui-drag-hint" style="font-size:10px;opacity:0.6;pointer-events:none;">::: 拖曳此處 / 右下角可縮放 :::</span>
                <button class="ui-minimize-btn" type="button" title="最小化" style="background:#4a3b32;border:1px solid #8d6846;color:#fde68a;padding:0px 6px;font-size:11px;line-height:1.4;border-radius:3px;cursor:pointer;font-weight:bold;">⚊</button>
            </div>
        `;
        
        const minBtn = handle.querySelector('.ui-minimize-btn');
        minBtn.onclick = function (e) {
            e.stopPropagation();
            onMinimizeClick();
        };

        targetEl.insertBefore(handle, targetEl.firstChild);
        return handle;
    }

    function makeElementDraggable(targetEl, titleText, storagePrefix, defaultLeftFn, defaultTopFn, onMinimizeClick) {
        const handle = createDragHandle(targetEl, titleText, onMinimizeClick);
        let drag = null;

        function restorePositionAndSize() {
            if (innerWidth <= 768) {
                targetEl.style.removeProperty('position');
                targetEl.style.removeProperty('left');
                targetEl.style.removeProperty('top');
                targetEl.style.removeProperty('right');
                targetEl.style.removeProperty('bottom');
                targetEl.style.removeProperty('width');
                targetEl.style.removeProperty('height');
                targetEl.style.removeProperty('display');
                targetEl.style.removeProperty('flex-direction');
                return;
            }

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
            if (innerWidth <= 768) return;
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

        // 1. 創立畫面縮放控制器與工作列（Dock）
        createZoomController();
        createWindowsDock();

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
                () => toggleWindowMinimize('col-left', 'ui_col_left')
            );
        }

        if (centerCol) {
            makeElementDraggable(
                centerCol,
                '🗺️ 冒險地圖',
                'ui_col_center',
                () => Math.max(16, Math.round((innerWidth / currentScale) * 0.5 - 410)),
                () => 16,
                () => toggleWindowMinimize('col-center', 'ui_col_center')
            );
        }

        if (rightCol) {
            makeElementDraggable(
                rightCol, 
                '🎒 角色背包與功能', 
                'ui_col_right',
                () => Math.max(16, (innerWidth / currentScale) - 380 - 16),
                () => 16,
                () => toggleWindowMinimize('col-right', 'ui_col_right')
            );
        }

        if (logRow) {
            makeElementDraggable(
                logRow, 
                '📜 遊戲日誌', 
                'ui_log_row',
                () => Math.max(16, Math.round((innerWidth / currentScale) * 0.5 - 410)),
                () => Math.max(16, (innerHeight / currentScale) - 250 - 16),
                () => toggleWindowMinimize('log-row', 'ui_log_row')
            );
        }

        // 統一在指標放開時，儲存所有視窗的位置與大小（覆蓋拖曳、縮放與邊界改變）
        window.addEventListener('pointerup', function () {
            if (innerWidth <= 768) return;
            
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
