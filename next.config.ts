import type { NextConfig } from "next";

// No outputFileTracingIncludes needed: the generator uses engineType =
// "client" (Rust-free, driver-adapter-only mode), so there is no native
// query-engine binary to trace/copy into the Vercel deployment bundle.
const nextConfig: NextConfig = {};

export default nextConfig;
