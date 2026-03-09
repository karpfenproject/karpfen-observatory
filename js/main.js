/**
 * Main Application Logic
 *
 * Orchestrates the observatory: connection dialog flow, API calls,
 * WebSocket setup, and wiring trace/state updates to the UI.
 */
(function () {

    // State
    let currentEnvKey = null;
    let currentModelElement = null;
    let parsedStateMachine = null;
    let clientId = 'observatory-' + Date.now();

    // DOM refs
    const connectDialog = document.getElementById('connect-dialog');
    const connectForm = document.getElementById('connect-form');
    const connectError = document.getElementById('connect-error');
    const envSelection = document.getElementById('env-selection');
    const envSelect = document.getElementById('env-select');
    const elementSelect = document.getElementById('element-select');
    const btnObserve = document.getElementById('btn-observe');
    const dashboard = document.getElementById('dashboard');
    const connectionInfo = document.getElementById('connection-info');
    const btnDisconnect = document.getElementById('btn-disconnect');
    const smName = document.getElementById('sm-name');
    const smContainer = document.getElementById('sm-container');

    // Initialize components
    TracePanel.init(document.getElementById('trace-log'));
    StateMachineRenderer.init(smContainer);

    // --- Connect Form ---

    connectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        connectError.style.display = 'none';

        const ip = document.getElementById('server-ip').value.trim();
        const port = document.getElementById('server-port').value.trim();

        try {
            ApiClient.setServer(ip, port);
            await ApiClient.checkHealth();

            // Fetch environments
            const envs = await ApiClient.getEnvironments();
            if (envs.length === 0) {
                showError('No active environments found. Start an environment first.');
                return;
            }

            // Populate environment dropdown
            envSelect.innerHTML = '';
            for (const env of envs) {
                const opt = document.createElement('option');
                opt.value = env.envKey;
                opt.textContent = env.envKey;
                opt.dataset.elements = JSON.stringify(env.modelElements);
                envSelect.appendChild(opt);
            }

            // Trigger element population
            updateElementSelect();
            envSelection.style.display = 'block';
        } catch (err) {
            showError('Cannot connect to server: ' + err.message);
        }
    });

    envSelect.addEventListener('change', updateElementSelect);

    function updateElementSelect() {
        const selected = envSelect.selectedOptions[0];
        if (!selected) return;
        const elements = JSON.parse(selected.dataset.elements || '[]');
        elementSelect.innerHTML = '';
        for (const el of elements) {
            const opt = document.createElement('option');
            opt.value = el;
            opt.textContent = el;
            elementSelect.appendChild(opt);
        }
    }

    // --- Start Observing ---

    btnObserve.addEventListener('click', async () => {
        connectError.style.display = 'none';
        const envKey = envSelect.value;
        const modelElement = elementSelect.value;

        if (!envKey || !modelElement) {
            showError('Please select an environment and model element.');
            return;
        }

        try {
            // 1. Fetch statemachine source
            const source = await ApiClient.getStateMachineSource(envKey, modelElement);

            // 2. Parse statemachine
            parsedStateMachine = KStatesParser.parse(source);

            // 3. Register for WebSocket
            const accessKey = await ApiClient.registerObservatoryClient(clientId, envKey, modelElement);

            // 4. Connect WebSocket
            const ip = document.getElementById('server-ip').value.trim();
            const port = document.getElementById('server-port').value.trim();

            WebSocketClient.setOnTraceEntry(handleTraceEntry);
            WebSocketClient.setOnDisconnect(handleDisconnect);

            await WebSocketClient.connect(ip, parseInt(port), clientId, envKey, accessKey);

            // 5. Show dashboard
            currentEnvKey = envKey;
            currentModelElement = modelElement;

            connectDialog.style.display = 'none';
            dashboard.style.display = 'flex';
            connectionInfo.textContent = `${envKey} / ${modelElement} @ ${ip}:${port}`;
            smName.textContent = `${modelElement} (${parsedStateMachine.attachedTo})`;

            // 6. Render statemachine
            await StateMachineRenderer.render(parsedStateMachine);

            // Set initial state highlighted
            const initialStack = KStatesParser.getInitialStateStack(parsedStateMachine.states);
            StateMachineRenderer.setActiveStates(initialStack);

        } catch (err) {
            showError('Failed to start observing: ' + err.message);
        }
    });

    // --- Trace handling ---

    function handleTraceEntry(entry) {
        TracePanel.addEntry(entry);

        if (entry.modelElementId !== currentModelElement) return;

        // Update active states on TICK_START (contains current state stack)
        if (entry.eventType === 'TICK_START' || entry.eventType === 'TICK_END') {
            const stack = extractStack(entry);
            if (stack) {
                StateMachineRenderer.setActiveStates(stack.split(','));
            }
        }

        // Also update on TRANSITION_FIRED
        if (entry.eventType === 'TRANSITION_FIRED') {
            const stack = extractNewStack(entry);
            if (stack) {
                StateMachineRenderer.setActiveStates(stack.split(','));
            }
        }
    }

    /** Extract state stack from details or from simple trace message. */
    function extractStack(entry) {
        if (entry.details && entry.details.stack) return entry.details.stack;
        // Simple trace format: "tick #N [State1,State2]"
        const m = entry.message && entry.message.match(/\[([^\]]+)\]/);
        return m ? m[1] : null;
    }

    function extractNewStack(entry) {
        if (entry.details && entry.details.newStack) return entry.details.newStack;
        // Simple trace format for TRANSITION_FIRED: "FromState -> ToState"
        // The "to" state is the new leaf; build stack from parsed SM
        const m = entry.message && entry.message.match(/->\s*(.+)/);
        if (m && parsedStateMachine) {
            const toState = m[1].trim();
            const stack = buildStackForState(toState, parsedStateMachine.states);
            return stack ? stack.join(',') : null;
        }
        return null;
    }

    /** Walk the SM hierarchy to build the state stack for a leaf state. */
    function buildStackForState(name, states, path) {
        path = path || [];
        for (const s of states) {
            const cur = path.concat(s.name);
            if (s.name === name) return cur;
            if (s.innerStates && s.innerStates.length > 0) {
                const found = buildStackForState(name, s.innerStates, cur);
                if (found) return found;
            }
        }
        return null;
    }

    // --- Disconnect ---

    btnDisconnect.addEventListener('click', () => {
        WebSocketClient.disconnect();
        resetToConnectDialog();
    });

    function handleDisconnect() {
        resetToConnectDialog();
    }

    function resetToConnectDialog() {
        dashboard.style.display = 'none';
        connectDialog.style.display = 'flex';
        envSelection.style.display = 'none';
        TracePanel.clear();
        currentEnvKey = null;
        currentModelElement = null;
        parsedStateMachine = null;
        clientId = 'observatory-' + Date.now();
    }

    // --- Helpers ---

    function showError(msg) {
        connectError.textContent = msg;
        connectError.style.display = 'block';
    }

})();
