import type { Browser, BrowserContext } from "playwright";

type BrowserManagerState = {
  browser: Browser | null;
  refs: number;
  launchPromise: Promise<Browser> | null;
};

const state: BrowserManagerState = {
  browser: null,
  refs: 0,
  launchPromise: null,
};

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: ["--font-render-hinting=none", "--disable-dev-shm-usage"],
  });
}

export async function acquireBrowser(): Promise<Browser> {
  state.refs += 1;

  if (state.browser) {
    return state.browser;
  }

  if (!state.launchPromise) {
    state.launchPromise = launchBrowser().then((browser) => {
      state.browser = browser;
      return browser;
    });
  }

  return state.launchPromise;
}

export async function releaseBrowser(): Promise<void> {
  state.refs = Math.max(0, state.refs - 1);
  if (state.refs > 0 || !state.browser) return;

  await state.browser.close();
  state.browser = null;
  state.launchPromise = null;
}

export async function withBrowserContext<T>(
  fn: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  const browser = await acquireBrowser();
  const context = await browser.newContext({
    javaScriptEnabled: true,
    locale: "ru-RU",
  });

  try {
    return await fn(context);
  } finally {
    await context.close();
    await releaseBrowser();
  }
}

export async function shutdownBrowserManager(): Promise<void> {
  state.refs = 0;
  if (state.browser) {
    await state.browser.close();
    state.browser = null;
  }
  state.launchPromise = null;
}
