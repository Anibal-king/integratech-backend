/**
 * Pruebas de QA de extremo a extremo. Corren SIEMPRE contra el entorno aislado de
 * tests/qa (copia de la base, puertos 3100/4400): nunca contra la base real ni producción.
 *
 *   npm run test:e2e                     (compila el sitio de QA y corre todo)
 *   QA_REUSAR_BUILD=1 npm run test:e2e   (reutiliza la compilación anterior)
 *
 * Proyecto «chromium-1366» corre todo; los demás perfiles de la categoría 2 solo las
 * pruebas marcadas @multi. «datos-limite» (@datos) modifica la copia de la base, por eso
 * va al final, solo.
 */
import { defineConfig, devices } from '@playwright/test';
import { WEB, PUERTO_API, PUERTO_WEB } from './qa/entorno.mjs';

const swiftshader = { launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } };
const multi = /@multi/;

export default defineConfig({
  testDir: './e2e',
  outputDir: './resultados/artefactos',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['json', { outputFile: './resultados/resultados.json' }], ['html', { outputFolder: './resultados/html', open: 'never' }]],
  use: {
    baseURL: WEB,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'es-SV',
    timezoneId: 'America/El_Salvador',
  },
  projects: [
    { name: 'chromium-1366', use: { browserName: 'chromium', viewport: { width: 1366, height: 768 }, ...swiftshader }, grepInvert: /@datos/ },
    { name: 'chromium-1920', use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 }, ...swiftshader }, grep: multi },
    { name: 'firefox-1366', use: { browserName: 'firefox', viewport: { width: 1366, height: 768 } }, grep: multi },
    { name: 'iphone-safari', use: { ...devices['iPhone 15'] }, grep: multi },
    { name: 'android-chrome', use: { ...devices['Pixel 7'], ...swiftshader }, grep: multi },
    { name: 'tablet-ipad', use: { ...devices['iPad (gen 11)'] }, grep: multi },
    { name: 'movil-horizontal', use: { ...devices['Pixel 7 landscape'], ...swiftshader }, grep: multi },
    {
      name: 'datos-limite',
      use: { browserName: 'chromium', viewport: { width: 1366, height: 768 }, ...swiftshader },
      grep: /@datos/,
      fullyParallel: false,
      dependencies: ['chromium-1366', 'chromium-1920', 'firefox-1366', 'iphone-safari', 'android-chrome', 'tablet-ipad', 'movil-horizontal'],
    },
  ],
  webServer: [
    { command: 'node tests/qa/backend.mjs', cwd: '..', url: `http://localhost:${PUERTO_API}/api/health`, timeout: 60_000, reuseExistingServer: false, stdout: 'ignore' },
    { command: 'node tests/qa/frontend.mjs', cwd: '..', url: `http://localhost:${PUERTO_WEB}/`, timeout: 400_000, reuseExistingServer: false, stdout: 'ignore' },
  ],
});
