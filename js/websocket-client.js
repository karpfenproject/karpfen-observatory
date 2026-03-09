/**
 * WebSocket Client
 *
 * Manages the WebSocket connection to the karpfen-runtime for receiving
 * real-time trace entries and state change updates.
 */
const WebSocketClient = (() => {

    let ws = null;
    let onTraceEntry = null;
    let onStateChange = null;
    let onDisconnect = null;

    /**
     * Connects to the runtime WebSocket and authenticates.
     * @param {string} ip - Server IP
     * @param {number} port - Server port
     * @param {string} clientId - Client identifier
     * @param {string} envKey - Environment key
     * @param {string} accessKey - Access key from registerObservatoryClient
     */
    function connect(ip, port, clientId, envKey, accessKey) {
        return new Promise((resolve, reject) => {
            const url = `ws://${ip}:${port}/ws`;
            ws = new WebSocket(url);

            ws.onopen = () => {
                // Send authentication message: clientId:envKey:accessKey
                ws.send(`${clientId}:${envKey}:${accessKey}`);
                console.log('[WebSocket] Connected and authenticated');
                resolve();
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    handleMessage(msg);
                } catch (e) {
                    console.warn('[WebSocket] Failed to parse message:', event.data);
                }
            };

            ws.onerror = (event) => {
                console.error('[WebSocket] Error:', event);
                reject(new Error('WebSocket connection failed'));
            };

            ws.onclose = () => {
                console.log('[WebSocket] Connection closed');
                ws = null;
                if (onDisconnect) onDisconnect();
            };
        });
    }

    function handleMessage(msg) {
        // Expected format from OutgoingMessage.toJson():
        // { environmentKey, clientId, messageType, payload }
        const messageType = msg.messageType;
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;

        if (messageType === 'trace' && onTraceEntry) {
            onTraceEntry(payload);
        } else if (messageType === 'stateChange' && onStateChange) {
            onStateChange(payload);
        }
    }

    function disconnect() {
        if (ws) {
            ws.close();
            ws = null;
        }
    }

    function isConnected() {
        return ws !== null && ws.readyState === WebSocket.OPEN;
    }

    /**
     * Sets callback for trace entries.
     * @param {Function} callback - (traceEntry) => void
     */
    function setOnTraceEntry(callback) {
        onTraceEntry = callback;
    }

    /**
     * Sets callback for state change notifications.
     * @param {Function} callback - (stateChange) => void
     */
    function setOnStateChange(callback) {
        onStateChange = callback;
    }

    /**
     * Sets callback for disconnect events.
     * @param {Function} callback - () => void
     */
    function setOnDisconnect(callback) {
        onDisconnect = callback;
    }

    return { connect, disconnect, isConnected, setOnTraceEntry, setOnStateChange, setOnDisconnect };
})();
