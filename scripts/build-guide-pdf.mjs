/**
 * Render public/guide.html to English and Arabic PDFs.
 *
 * The guide is a single bilingual HTML file: `setGuideLang()` flips <html lang>
 * and dir, and the stylesheet's @media print block swaps the dark palette for
 * ink-on-paper. We drive both from Chromium and print each language once, so
 * the PDFs can never drift from the HTML.
 *
 *   npm run guide:pdf
 */
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { access } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
const source = join(publicDir, "guide.html");

const EDITIONS = [
  { lang: "en", file: "broadcast-hub-guide-en.pdf", label: "English" },
  { lang: "ar", file: "broadcast-hub-guide-ar.pdf", label: "العربية" },
];

/** Chromium renders header/footer at its own tiny default size — set it explicitly. */
function footerTemplate(lang) {
  const title =
    lang === "ar" ? "مركز البث — الدليل الكامل" : "Broadcast Hub — Complete User Guide";
  const align = lang === "ar" ? "rtl" : "ltr";
  return `
    <div style="width:100%; padding:0 15mm; font-size:8pt; color:#6b8377;
                font-family:'Segoe UI',sans-serif; direction:${align};
                display:flex; justify-content:space-between;">
      <span>${title}</span>
      <span>bia.massegat.com · <span class="pageNumber"></span>/<span class="totalPages"></span></span>
    </div>`;
}

/**
 * Prefer Playwright's own Chromium; fall back to an installed Chrome. The
 * bundled build is pinned per Playwright version, so a machine that installed
 * browsers for a different version has nothing usable until `npx playwright
 * install chromium` runs — and printing a PDF does not justify that download.
 */
async function launch() {
  try {
    return await chromium.launch();
  } catch (err) {
    if (!/Executable doesn't exist/i.test(String(err?.message))) throw err;
    console.warn("• Bundled Chromium missing — falling back to installed Chrome.");
    return await chromium.launch({ channel: "chrome" });
  }
}

async function main() {
  await access(source); // fail loudly if the guide is missing

  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle" });

    for (const edition of EDITIONS) {
      await page.evaluate((lang) => {
        // Exposed by the guide's own script.
        window.setGuideLang(lang);
        window.setGuideTheme("light");
      }, edition.lang);

      // Let the webfont for this script actually load before we rasterise.
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: "print" });

      const out = join(publicDir, edition.file);
      await page.pdf({
        path: out,
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: footerTemplate(edition.lang),
        margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
      });
      console.log(`✓ ${edition.label.padEnd(8)} → public/${edition.file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("PDF build failed:", err);
  process.exit(1);
});
