import puppeteer, { type Browser } from "puppeteer";
import { config } from "../config.js";

let browserPromise: Promise<Browser> | null = null;

/**
 * A single shared headless Chromium instance (open source, bundled by
 * Puppeteer — no external service, no API key) backing the local Lighthouse
 * performance audit. Launched lazily on first use and reused for the life of
 * the process; callers must not close it themselves.
 */
export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    browserPromise = puppeteer
      .launch({
        headless: true,
        executablePath: config.chromiumExecutablePath || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          ...(proxy ? [`--proxy-server=${proxy}`] : []),
        ],
      })
      .then((browser) => {
        // If Chromium crashes or is killed out from under us, forget the
        // cached instance instead of handing out a dead browser to every
        // future caller for the rest of the process's life.
        browser.on("disconnected", () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  await browser?.close();
  browserPromise = null;
}
