import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const LAN_HOSTS = ["192.168.*.*", "10.*.*.*", "172.*.*.*", "localhost"];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.2.2",
    "127.0.0.1",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
    // Phones on the same Wi-Fi opening http://<computer IP>:8888 during local development.
    ...LAN_HOSTS,
  ],
  // Local development only: let admin saves (Server Actions) work from a phone on the home Wi-Fi.
  ...(isDev ? { experimental: { serverActions: { allowedOrigins: LAN_HOSTS } } } : {}),
};

export default nextConfig;
