import { type Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test.fixture';
import { touchPan } from '../../utils/touch-pan';

/**
 * #10122: the hover play button is out of reach on touch, so there the box at
 * the left of a task row starts and pauses tracking. Swiping right still marks
 * the task done, and a mouse click on the box still does too.
 */

// The shared add-task flow clicks with a mouse; a touch pointerdown switches
// the input intent back to touch, as a finger would.
const switchToTouch = async (page: Page): Promise<void> => {
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' })),
  );
  await expect(page.locator('body')).toHaveClass(/isTouchPrimary/);
};

const switchToMouse = async (page: Page): Promise<void> => {
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse' })),
  );
  await expect(page.locator('body')).toHaveClass(/isMousePrimary/);
};

test.describe('Done box starts and pauses tracking on touch #10122', () => {
  // isMobile makes Chromium report `pointer: coarse`, as on a phone or tablet.
  test.use({ viewport: { width: 1024, height: 900 }, hasTouch: true, isMobile: true });

  test('a tap starts tracking and a second tap pauses it, without completing', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    const title = `${testPrefix}-Track me`;
    await workViewPage.addTask(title);
    const task = taskPage.getTaskByText(title);
    const box = task.locator('done-toggle').first();
    await switchToTouch(page);

    await box.tap();
    await expect(task).toHaveClass(/isCurrent/);
    await expect(task).not.toHaveClass(/isDone/);
    await expect(box).toHaveAttribute('role', 'button');

    await box.tap();
    await expect(task).not.toHaveClass(/isCurrent/);
    await expect(task).not.toHaveClass(/isDone/);
  });

  test('follows live switches between mouse and touch', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    const title = `${testPrefix}-Hybrid`;
    await workViewPage.addTask(title);
    const task = taskPage.getTaskByText(title);
    const box = task.locator('done-toggle').first();
    await switchToMouse(page);

    // Mouse to touch: the tap's own pointerdown flips the intent first.
    await box.tap();
    await expect(page.locator('body')).toHaveClass(/isTouchPrimary/);
    await expect(task).toHaveClass(/isCurrent/);
    await expect(task).not.toHaveClass(/isDone/);

    // Touch to mouse: the box is a done checkbox again and a click completes.
    await switchToMouse(page);
    await expect(box).toHaveAttribute('role', 'checkbox');
    await box.click();
    // The row moves to the done list; its old copy stays in the DOM while
    // the leave animation runs.
    await expect(page.locator('task.isDone', { hasText: title })).toHaveCount(1);
  });

  test('swiping right still marks the task done', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    const title = `${testPrefix}-Swipe done`;
    await workViewPage.addTask(title);
    const task = taskPage.getTaskByText(title);
    await switchToTouch(page);

    const rowBox = await task.boundingBox();
    if (!rowBox) throw new Error('task row has no bounding box');
    // Start right of the done box, on the title.
    const offsetX = rowBox.width * 0.3;
    const halfHeight = rowBox.height / 2;
    await touchPan(page, task, rowBox.width * 0.5, {
      start: { x: rowBox.x + offsetX, y: rowBox.y + halfHeight },
    });
    await expect(page.locator('task.isDone', { hasText: title })).toHaveCount(1);
  });
});
