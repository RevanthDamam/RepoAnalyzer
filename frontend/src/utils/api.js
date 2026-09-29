const API_URL = import.meta.env.VITE_API_URL || "";

const SESSION_KEY = "session_id";

/**
 * Returns the current tab's session ID, generating and persisting one if it
 * doesn't yet exist.  Uses sessionStorage so the ID is automatically cleared
 * when the browser tab is closed.
 */
export function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
}

/**
 * Thin fetch wrapper that transparently injects the X-Session-ID header on
 * every outgoing request.  No component needs to add this header manually.
 */
export function apiFetch(path, options = {}) {
    const sessionId = getSessionId();
    const headers = {
        ...(options.headers || {}),
        "X-Session-ID": sessionId,
    };
    return fetch(`${API_URL}${path}`, { ...options, headers });
}

