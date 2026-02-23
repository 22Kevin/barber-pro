import { describe, it, expect } from "vitest";

describe("Google Credentials Validation", () => {
  it("should have GOOGLE_MAPS_API_KEY set", () => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    expect(key).toBeDefined();
    expect(key).toMatch(/^AIza/);
  });

  it("should have GOOGLE_CLIENT_ID set", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId).toContain(".apps.googleusercontent.com");
  });

  it("should have GOOGLE_CLIENT_SECRET set", () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    expect(secret).toBeDefined();
    expect(secret?.length).toBeGreaterThan(10);
  });

  it("should validate Google Maps API key format", async () => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    // Validate key format: starts with AIzaSy and is 39 chars
    expect(key).toMatch(/^AIzaSy[A-Za-z0-9_-]{33}$/);
  });
});
