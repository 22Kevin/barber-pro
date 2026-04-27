import { describe, it, expect } from "vitest";

describe("Google Sign-In Secrets", () => {
  it("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID deve estar configurado e ter formato válido", () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId).not.toBe("");
    // Formato: XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
    expect(clientId).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  });

  it("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID deve estar configurado e ter formato válido", () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId).not.toBe("");
    expect(clientId).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  });

  it("EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME deve estar configurado e ter formato válido", () => {
    const scheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
    expect(scheme).toBeDefined();
    expect(scheme).not.toBe("");
    // Formato: com.googleusercontent.apps.XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    expect(scheme).toMatch(/^com\.googleusercontent\.apps\.\d+-[a-z0-9]+$/);
  });

  it("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID deve estar configurado e ter formato válido", () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId).not.toBe("");
    expect(clientId).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  });

  it("Web Client ID e iOS Client ID devem ser diferentes", () => {
    const webId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    expect(webId).not.toBe(iosId);
  });
});
