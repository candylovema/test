// ===== PC版全浮動式、拖曳記憶 UI 系統 =====
(function () {
    const el = id => document.getElementById(id);

    // 注入 PC 版浮動 UI 的專用樣式
    const style = document.createElement('style');
    style.textContent = `
        @media (min-width: 769px) {
            /* 使左、中、右及日誌列在 PC 上變成浮動式視窗 */
            #col-left, #col-right, #log-row {
                position: fixed !important;
                margin: 0 !important;
                z-index: 45 !important;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85) !important;
                border: 2px solid #8d6846 !important;
                border-radius: 6px !important;
                background: #111318 !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
            }
            
            #col-left {
                width: 340px !important;
                height: auto !important;
            }
            
            #col-right {
                width: 380px !important;
                height: 680px !important;
            }
            
            #log-row {
                width: 800px !important;
                height: 250px !important;
            }
            
            #combat-log-panel, #syslog-panel {
                flex: 1 1 0 !important;
                height: 100% !important;
                border: none !important;
                background: transparent !important;
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
            
            .ui-drag-handle .ui-drag-hint {
                font-size: 10px;
                opacity: 0.6;
                pointer-events: none;
            }
            
            /* 調整中央欄的地圖和戰鬥畫面 */
            #col-center {
                max-width: calc(100% - 760px) !important;
                margin: 0 auto !important;
                flex: 1 1 auto !important;
                z-index: 10 !important;
            }
            
            #map-view-panel {
                margin: 0 auto !important;
            }
        }
    `;
    document.head.appendChild(style);

    function createDragHandle(targetEl, titleText) {
        // 防止重複建立
        let existing = targetEl.querySelector('.ui-drag-handle');
        if (existing) return existing;

        const handle = document.createElement('div');
        handle.className = 'ui-drag-handle';
        handle.innerHTML = `
            <span class="ui-drag-title">${titleText}</span>
            <span class="ui-drag-hint">::: 按住此處拖曳 :::</span>
        `;
        targetEl.insertBefore(handle, targetEl.firstChild);
        return handle;
    }

    function makeElementDraggable(targetEl, titleText, storagePrefix, defaultLeftFn, defaultTopFn) {
        const handle = createDragHandle(targetEl, titleText);
        let drag = null;

        function restorePosition() {
            if (innerWidth <= 768) {
                // 手機版還原預設排版，移除所有 inline styles
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

            // PC 版浮動配置
            targetEl.style.position = 'fixed';
            
            let savedX = localStorage.getItem(storagePrefix + '_x');
            let savedY = localStorage.getItem(storagePrefix + '_y');

            if (savedX !== null && savedY !== null) {
                let x = parseFloat(savedX);
                let y = parseFloat(savedY);
                // 確保在可視範圍內
                if (x >= -200 && x < innerWidth && y >= -50 && y < innerHeight) {
                    targetEl.style.left = x + 'px';
                    targetEl.style.top = y + 'px';
                    targetEl.style.right = 'auto';
                    targetEl.style.bottom = 'auto';
                    return;
                }
            }

            // 預設位置
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
            const rect = targetEl.getBoundingClientRect();
            drag = {
                id: event.pointerId,
                dx: event.clientX - rect.left,
                dy: event.clientY - rect.top
            };
            handle.setPointerCapture(event.pointerId);
            targetEl.classList.add('ui-dragging');
            event.preventDefault();
        });

        handle.addEventListener('pointermove', function (event) {
            if (!drag || drag.id !== event.pointerId) return;
            let targetX = event.clientX - drag.dx;
            let targetY = event.clientY - drag.dy;

            // 防呆限位
            const maxX = innerWidth - 50;
            const maxY = innerHeight - 50;
            targetX = Math.max(-150, Math.min(maxX, targetX));
            targetY = Math.max(-10, Math.min(maxY, targetY));

            targetEl.style.left = targetX + 'px';
            targetEl.style.top = targetY + 'px';
        });

        function stopDrag(event) {
            if (!drag || drag.id !== event.pointerId) return;
            drag = null;
            targetEl.classList.remove('ui-dragging');

            const rect = targetEl.getBoundingClientRect();
            localStorage.setItem(storagePrefix + '_x', rect.left);
            localStorage.setItem(storagePrefix + '_y', rect.top);
        }

        handle.addEventListener('pointerup', stopDrag);
        handle.addEventListener('pointercancel', stopDrag);

        window.addEventListener('resize', restorePosition);
        restorePosition();
    }

    function init() {
        const leftCol = el('col-left');
        const rightCol = el('col-right');
        const logRow = el('log-row');

        // 1. 調整 log-row 結構，使其在 PC 上可以有橫向並排包裹容器
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

        // 2. 將各面板綁定拖曳功能與座標記憶
        if (leftCol) {
            makeElementDraggable(
                leftCol, 
                '👤 角色狀態', 
                'ui_col_left',
                () => 16,
                () => 16
            );
        }

        if (rightCol) {
            makeElementDraggable(
                rightCol, 
                '🎒 角色背包與功能', 
                'ui_col_right',
                () => Math.max(16, innerWidth - 380 - 16),
                () => 16
            );
        }

        if (logRow) {
            makeElementDraggable(
                logRow, 
                '📜 遊戲日誌', 
                'ui_log_row',
                () => Math.max(16, Math.round(innerWidth * 0.5 - 400)),
                () => Math.max(16, innerHeight - 250 - 16)
            );
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
