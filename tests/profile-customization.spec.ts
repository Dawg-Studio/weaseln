import { test, expect } from "@playwright/test";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";

test("profile customization settings requires auth", async ({ page }) => {
    const response = await page.goto(`${baseUrl}/settings/profile/customization`);
    // Anonymous -> redirected to /api/auth/signin
    expect(page.url()).toContain("/api/auth/signin");
    expect(response?.status()).toBeLessThan(400);
});