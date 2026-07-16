// ===== 可拖曳共用倉庫視窗（資料操作沿用 js/12-npc-quests.js）=====
(function () {
    let drag = null;
    function el(id) { return document.getElementById(id); }

    window.warehouseWindowIsOpen = function () {
        const win = el('warehouse-window');
        return !!win && !win.classList.contains('hidden');
    };

    window.openWarehouseWindow = function () {
        const win = el('warehouse-window');
        const content = el('warehouse-window-content');
        if (!win || !content) return;
        win.classList.remove('hidden');
        win.setAttribute('aria-hidden', 'false');
        if (typeof renderWarehouseNPC === 'function') renderWarehouseNPC(content);
    };

    window.closeWarehouseWindow = function () {
        const win = el('warehouse-window');
        if (!win) return;
        win.classList.add('hidden');
        win.setAttribute('aria-hidden', 'true');
    };

    function init() {
        const frame = el('warehouse-window-frame');
        const handle = el('warehouse-window-drag');
        const close = el('warehouse-window-close');
        if (!frame || !handle || !close) return;
        close.onclick = closeWarehouseWindow;

        // Restore saved position
        let savedX = localStorage.getItem('wh_window_x');
        let savedY = localStorage.getItem('wh_window_y');
        if (savedX !== null && savedY !== null) {
            let x = parseFloat(savedX);
            let y = parseFloat(savedY);
            if (x >= -100 && x < innerWidth && y >= -100 && y < innerHeight) {
                frame.style.left = x + 'px';
                frame.style.top = y + 'px';
                frame.style.transform = 'none';
            }
        }

        handle.addEventListener('pointerdown', function (event) {
            if (event.target.closest('button, input, select')) return;
            drag = {
                id: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startLeft: frame.offsetLeft,
                startTop: frame.offsetTop
            };
            handle.setPointerCapture(event.pointerId);
            frame.classList.add('is-dragging');
            event.preventDefault();
        });
        handle.addEventListener('pointermove', function (event) {
            if (!drag || drag.id !== event.pointerId) return;
            let currentScale = parseFloat(localStorage.getItem('game_scale') || '1');
            let targetX = drag.startLeft + (event.clientX - drag.startX) / currentScale;
            let targetY = drag.startTop + (event.clientY - drag.startY) / currentScale;

            const maxX = Math.max(0, (innerWidth / currentScale) - frame.offsetWidth);
            const maxY = Math.max(0, (innerHeight / currentScale) - frame.offsetHeight);
            frame.style.left = Math.max(0, Math.min(maxX, targetX)) + 'px';
            frame.style.top = Math.max(0, Math.min(maxY, targetY)) + 'px';
            frame.style.transform = 'none';
        });
        function stop(event) {
            if (!drag || drag.id !== event.pointerId) return;
            drag = null;
            frame.classList.remove('is-dragging');
            
            localStorage.setItem('wh_window_x', frame.offsetLeft);
            localStorage.setItem('wh_window_y', frame.offsetTop);
        }
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
