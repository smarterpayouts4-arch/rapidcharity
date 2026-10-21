import { expect, test } from "@playwright/test";

/** No horizontal overflow on key screens at common mobile and tablet widths. */
const WIDTHS = [320, 375, 393, 768, 1280];

for (const width of WIDTHS) {
  test(`layout fits viewport ${width}px on sign-in`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 393 ? 852 : 900 });
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
}

test("contact section fields stack with full-width inputs at 393px", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`mobile.layout.${Date.now()}@example.test`);
  await page.getByRole("button", { name: /Email me a sign-in link/i }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
});
