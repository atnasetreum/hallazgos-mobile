export const constants = {
  environments: {
    development: "development",
    production: "production",
  },
};

export const appConfig = {
  apiUrl: process.env.EXPO_PUBLIC_URL_API || "",
  appKey: process.env.EXPO_PUBLIC_APP_KEY || "",
  tokenStorageKey: "token",
};
