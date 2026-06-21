import { Configuration, PublicClientApplication } from "@azure/msal-browser";
import { env } from "./env.config";

export const msalConfig: Configuration = {
  auth: {
    clientId: env.entraClientId,
    authority: `https://login.microsoftonline.com/${env.entraTenantId}`,
    redirectUri: `${env.appUrl}/login`,
    postLogoutRedirectUri: env.appUrl,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);
