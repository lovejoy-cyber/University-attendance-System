/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Never expose secrets to the client. Only NEXT_PUBLIC_* vars reach the browser bundle.
  poweredByHeader: false,
};
export default nextConfig;
