// Runtime config for the public preview at schapiro.ai/drat.
// No backend is deployed yet, so these stay as the "not configured" sentinels:
// visiting without a participant code runs the battery in debug mode and stores
// nothing, and visiting WITH one fails loudly rather than silently losing data.
// To collect real data, deploy the backend and replace API_BASE / COMPLETION_URL
// (deploy.sh writes this file automatically).
window.BATTERY_RUNTIME = {
    API_BASE: "__API_BASE__",
    COMPLETION_URL: "__COMPLETION_URL__",
};
