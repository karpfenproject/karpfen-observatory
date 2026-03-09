/**
 * Trace Panel
 *
 * Manages the trace log display on the left panel.
 * Receives trace entries from the WebSocket and renders them with filtering.
 */
const TracePanel = (() => {

    let logEl = null;
    let autoScroll = true;
    let maxEntries = 100;

    // Filter state — maps category name to whether it's shown
    const filters = {
        tick: true,
        entry: true,
        'do': true,
        transition: true,
        event: true,
        error: true
    };

    // Map TraceEventType to filter category
    const typeToCategory = {
        TICK_START: 'tick',
        TICK_END: 'tick',
        STATE_ENTRY_EXEC: 'entry',
        STATE_ENTRY_SKIP: 'entry',
        STATE_DO_EXEC: 'do',
        STATE_DO_SKIP: 'do',
        TRANSITION_FIRED: 'transition',
        TRANSITION_SKIPPED_LOOP: 'transition',
        TRANSITION_CHECK: 'transition',
        EVENT_RECEIVED: 'event',
        EVENT_CONSUMED: 'event',
        ACTION_ERROR: 'error',
        ENGINE_ERROR: 'error',
        INITIAL_STATE: 'transition',
        ENGINE_START: 'transition',
        ENGINE_STOP: 'transition'
    };

    function init(logElement) {
        logEl = logElement;

        // Wire up filter checkboxes
        document.getElementById('filter-tick')?.addEventListener('change', e => { filters.tick = e.target.checked; applyFilters(); });
        document.getElementById('filter-entry')?.addEventListener('change', e => { filters.entry = e.target.checked; applyFilters(); });
        document.getElementById('filter-do')?.addEventListener('change', e => { filters['do'] = e.target.checked; applyFilters(); });
        document.getElementById('filter-transition')?.addEventListener('change', e => { filters.transition = e.target.checked; applyFilters(); });
        document.getElementById('filter-event')?.addEventListener('change', e => { filters.event = e.target.checked; applyFilters(); });
        document.getElementById('filter-error')?.addEventListener('change', e => { filters.error = e.target.checked; applyFilters(); });
    }

    /**
     * Adds a trace entry to the log.
     * @param {Object} entry - Trace entry: { timestamp, modelElementId, eventType, message, details }
     */
    function addEntry(entry) {
        if (!logEl) return;

        const div = document.createElement('div');
        div.className = 'trace-entry type-' + entry.eventType;
        div.dataset.category = typeToCategory[entry.eventType] || 'other';

        const time = formatTimestamp(entry.timestamp);
        const short = formatCompact(entry);

        div.textContent = `${time}  ${short}`;

        // Apply current filter
        const cat = div.dataset.category;
        if (!filters[cat]) {
            div.style.display = 'none';
        }

        logEl.appendChild(div);

        // Trim old entries
        while (logEl.children.length > maxEntries) {
            logEl.removeChild(logEl.firstChild);
        }

        // Auto-scroll
        if (autoScroll) {
            logEl.scrollTop = logEl.scrollHeight;
        }
    }

    function applyFilters() {
        if (!logEl) return;
        for (const child of logEl.children) {
            const cat = child.dataset.category;
            child.style.display = filters[cat] ? '' : 'none';
        }
    }

    function clear() {
        if (logEl) logEl.innerHTML = '';
    }

    function formatTimestamp(ts) {
        const d = new Date(ts);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        const ms = String(d.getMilliseconds()).padStart(3, '0');
        return `${h}:${m}:${s}.${ms}`;
    }

    function formatCompact(entry) {
        // If the server already sent a compact message (simpleTrace), use it directly
        return entry.message || entry.eventType;
    }

    return { init, addEntry, clear };
})();
