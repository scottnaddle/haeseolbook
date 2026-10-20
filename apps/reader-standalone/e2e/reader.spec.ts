import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('Standalone Reader E2E', () => {
  test('should import package, read pages, and answer quiz', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('해설북 독립형');

    const samplePath = join(__dirname, '../public/sample-electric-2026-1.0.0.hsbpkg.zip');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(samplePath);

    await expect(page.locator('.success-box')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.success-box')).toContainText('샘플 전기이론');

    await expect(page.locator('.book-grid .book')).toHaveCount(1);

    await page.locator('.book-grid .book a.cta').click();
    await page.waitForURL(/\/read\//);

    await expect(page.locator('.reader-top .title b')).toContainText('샘플 전기이론');

    await expect(page.locator('.page')).toBeVisible({ timeout: 5000 });

    await expect(page.locator('.quiz-grid .qno')).toHaveCount(3);

    await page.locator('.qno').first().click();

    await expect(page.locator('.quiz-card')).toBeVisible();
    await expect(page.locator('.quiz-head b')).toContainText('1번');

    await page.locator('.choice').nth(1).click();

    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.locator('.verdict')).toContainText('정답입니다');

    await expect(page.locator('.solution')).toBeVisible();
    await expect(page.locator('.solution')).toContainText('해설');

    await expect(page.locator('.qno').first()).toHaveClass(/ok/);

    await page.locator('.tabs button').filter({ hasText: '오답노트' }).click();
    await expect(page.locator('.panel-body')).toContainText('틀린 문항이 여기에 모입니다');
  });

  test('should persist data across page reloads', async ({ page }) => {
    await page.goto('/');

    const samplePath = join(__dirname, '../public/sample-electric-2026-1.0.0.hsbpkg.zip');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(samplePath);

    await expect(page.locator('.success-box')).toBeVisible({ timeout: 10000 });

    await page.reload();

    await expect(page.locator('.book-grid .book')).toHaveCount(1);

    await page.locator('.book-grid .book a').first().click();
    await page.waitForURL(/\/read\//);

    const canvasLocator = page.locator('.page .ink.live').first();
    await canvasLocator.hover();
    await page.mouse.down();
    await page.mouse.move(200, 200);
    await page.mouse.move(250, 220);
    await page.mouse.up();

    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForURL(/\/read\//);

    await expect(page.locator('.page')).toBeVisible({ timeout: 5000 });
  });
});
