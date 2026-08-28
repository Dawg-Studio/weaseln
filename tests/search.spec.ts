import { test, expect } from "@playwright/test";

test("able to search", async ({ page }) => {
    const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(
        /\/+$/,
        "",
    );
    await page.goto(`${baseUrl}/search/posts?q=weaseln&feed=relevance`);
    await expect(
        page.getByRole("group", { name: "Sort the feed" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tags" })).toBeVisible();
});
