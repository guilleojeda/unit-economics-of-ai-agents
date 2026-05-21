export const buildInfo = {
  sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "local",
  stage: process.env.NEXT_PUBLIC_BUILD_STAGE ?? "local",
  region: process.env.NEXT_PUBLIC_BUILD_REGION ?? "local",
  apiBasePath: process.env.NEXT_PUBLIC_API_BASE_PATH ?? "/api"
} as const;
