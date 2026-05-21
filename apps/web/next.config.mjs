/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "export",
  transpilePackages: [
    "@agentcore-pdf-translator/costing",
    "@agentcore-pdf-translator/schemas"
  ],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"]
    };

    return config;
  }
};

export default nextConfig;
