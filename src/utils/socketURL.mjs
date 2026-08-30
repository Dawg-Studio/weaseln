// ponytail: one env var, one dev default. Set NEXT_PUBLIC_SOCKET_SERVER_URL
// per environment (e.g. the Render URL in production).
const URL =
    process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:5000";

export default URL;
