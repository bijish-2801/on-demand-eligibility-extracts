// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
      bodySizeLimit: '2mb'
    }
  },
  env: {
    ORACLE_USER: process.env.ORACLE_USER,
    ORACLE_PASSWORD: process.env.ORACLE_PASSWORD,
    ORACLE_CONNECTION_STRING: process.env.ORACLE_CONNECTION_STRING,
  },
  webpack: (config) => {
    config.externals.push(
      ...[
        "@azure/app-configuration",
        "@azure/identity",
        "@azure/keyvault-secrets",
        "oci-common",
        "oci-objectstorage",
        "oci-secrets",
      ],
    );
    config.resolve.preferRelative = true;

    return config;
  },
};

export default nextConfig;