/**
 * API Client
 *
 * HTTP client for the karpfen-runtime observatory endpoints.
 */
const ApiClient = (() => {

    let baseUrl = '';

    function setServer(ip, port) {
        baseUrl = `http://${ip}:${port}`;
    }

    /**
     * Fetches the list of active environments.
     * @returns {Promise<Array<{envKey: string, modelElements: string[]}>>}
     */
    async function getEnvironments() {
        const res = await fetch(`${baseUrl}/observatory/environments`);
        if (!res.ok) throw new Error(`Failed to fetch environments: ${res.status} ${await res.text()}`);
        return JSON.parse(await res.text());
    }

    /**
     * Fetches the kStates source for a state machine.
     * @param {string} envKey
     * @param {string} modelElement
     * @returns {Promise<string>} - Raw kStates DSL text
     */
    async function getStateMachineSource(envKey, modelElement) {
        const params = new URLSearchParams({ envKey, modelElement });
        const res = await fetch(`${baseUrl}/observatory/statemachine?${params}`);
        if (!res.ok) throw new Error(`Failed to fetch statemachine: ${res.status} ${await res.text()}`);
        return await res.text();
    }

    /**
     * Registers an observatory client for WebSocket access.
     * @param {string} clientId
     * @param {string} envKey
     * @returns {Promise<string>} - Access key for WebSocket authentication
     */
    async function registerObservatoryClient(clientId, envKey, modelElement) {
        const params = new URLSearchParams({ clientId, envKey, modelElement });
        const res = await fetch(`${baseUrl}/observatory/registerClient?${params}`, { method: 'POST' });
        if (!res.ok) throw new Error(`Failed to register client: ${res.status} ${await res.text()}`);
        return await res.text();
    }

    /**
     * Checks server health.
     * @returns {Promise<boolean>}
     */
    async function checkHealth() {
        const res = await fetch(`${baseUrl}/health`);
        return res.ok;
    }

    function getBaseUrl() {
        return baseUrl;
    }

    return { setServer, getEnvironments, getStateMachineSource, registerObservatoryClient, checkHealth, getBaseUrl };
})();
