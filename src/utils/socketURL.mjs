import { SOCKET } from "../constants.js";
const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV;
let URL = SOCKET.dev;
if (env === "production") URL = SOCKET.prod;

export default URL;
