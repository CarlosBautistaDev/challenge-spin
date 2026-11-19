import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Usar cuenta de prueba' }).click();
  await page.getByRole('button', { name: 'Entrar a mi wallet' }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$24,500.00');
}
async function fillDraft(page: Page) {
  await page.getByRole('link', { name: 'Enviar dinero', exact: true }).first().click();
  await page.getByRole('radio', { name: /Ana López/ }).check();
  await page.getByLabel('¿Cuánto quieres enviar?').fill('1250.50');
  await page.getByLabel('Concepto', { exact: true }).fill('Borrador conservado');
}

test('draft survives navigation and a background refresh failure without losing keyboard position on edit', async ({
  page,
}) => {
  await signIn(page);
  await fillDraft(page);
  await page.getByRole('link', { name: 'Contactos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tus personas favoritas.' })).toBeVisible();
  const initialRefresh = page.waitForResponse(
    (response) => response.url().includes('/api/wallet?state=normal') && response.status() === 200,
  );
  await page.getByRole('link', { name: 'Enviar dinero', exact: true }).first().click();
  await (await initialRefresh).finished();
  await expect(page.getByLabel('¿Cuánto quieres enviar?')).toHaveValue('1250.50');
  await expect(page.getByLabel('Concepto', { exact: true })).toHaveValue('Borrador conservado');
  await page.route('**/api/wallet?state=normal', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'NETWORK', message: 'Actualización temporalmente no disponible.' } },
    }),
  );
  const failedRefresh = page.waitForResponse(
    (response) => response.url().includes('/api/wallet?state=normal') && response.status() === 503,
  );
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await failedRefresh;
  await expect(page.locator('.refresh-warning')).toBeVisible();
  await expect(page.getByLabel('¿Cuánto quieres enviar?')).toHaveValue('1250.50');
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  await page.getByRole('button', { name: 'Editar datos' }).press('Enter');
  await expect(page.getByLabel('¿Cuánto quieres enviar?')).toBeFocused();
  await page.unroute('**/api/wallet?state=normal');
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.locator('.refresh-warning')).toHaveCount(0);
  await expect(page.getByLabel('Concepto', { exact: true })).toHaveValue('Borrador conservado');
});

test('a real lost HTTP response is recovered through GET without resending the payment', async ({
  page,
}) => {
  await signIn(page);
  await fillDraft(page);
  await page.getByText('Laboratorio de la demo', { exact: true }).click();
  await page.getByLabel('Resultado del siguiente envío').selectOption('success');
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  let posts = 0;
  let committedId = '';
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/transfers' && request.method() === 'POST')
      posts += 1;
  });
  await page.route('**/api/transfers', async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    committedId = (await response.json()).id;
    await route.abort('connectionfailed');
  });
  await page.getByRole('button', { name: 'Confirmar envío' }).click();
  await expect(page.locator('.transfer-error')).toBeVisible();
  await page.unroute('**/api/transfers');
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$23,249.50');
  await expect(page.locator('.active-transfer-notice')).toBeVisible();
  await page.reload();
  await expect(page.locator('.active-transfer-notice')).toBeVisible();
  await page.getByRole('link', { name: 'Enviar dinero', exact: true }).first().click();
  const lookup = page.waitForResponse(
    (response) =>
      response.url().includes('/api/operations/') && response.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Verificar resultado' }).click();
  expect((await lookup).status()).toBe(200);
  await expect(page).toHaveURL(/\/transfer$/);
  await page.getByRole('link', { name: 'Ver comprobante', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/receipt/${committedId}$`));
  expect(posts).toBe(1);
  await page.getByRole('link', { name: 'Volver a mi wallet' }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$23,249.50');
});

test('contact creation preserves focus and long identities stay legible in a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await signIn(page);
  await page.getByRole('link', { name: 'Contactos', exact: true }).click();
  const add = page.getByRole('button', { name: 'Nuevo contacto' });
  await add.press('Enter');
  await page.getByRole('button', { name: 'Guardar contacto' }).press('Enter');
  await expect(page.getByLabel('Nombre del contacto')).toBeFocused();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).press('Enter');
  await expect(add).toBeFocused();
  await add.press('Enter');
  await page.getByLabel('Nombre del contacto').fill('Mariana del Carmen Rodríguez López');
  await page
    .getByLabel('Teléfono o correo del contacto')
    .fill('mariana.rodriguez.contacto.muy.largo@example.com');
  await page.getByRole('button', { name: 'Guardar contacto' }).press('Enter');
  await expect(add).toBeFocused();
  await page.getByRole('link', { name: 'Enviar dinero', exact: true }).first().click();
  const recipient = page.getByRole('radio', { name: /Mariana del Carmen/ });
  await expect(recipient).toBeVisible();
  await recipient.check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('expired session removes private content before a new login in the same tab', async ({
  page,
  context,
}) => {
  await signIn(page);
  await fillDraft(page);
  await context.clearCookies();
  await page.getByRole('link', { name: 'Contactos', exact: true }).click();
  await expect(page.getByRole('link', { name: /Ir al inicio de sesión/ })).toBeVisible();
  await expect(page.getByLabel('¿Cuánto quieres enviar?')).toHaveCount(0);
  await page.getByRole('link', { name: /Ir al inicio de sesión/ }).click();
  await page.getByLabel('Teléfono o correo electrónico').fill('new-session@example.com');
  await page.getByRole('button', { name: 'Entrar a mi wallet' }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$24,500.00');
  await page.getByRole('link', { name: 'Enviar dinero', exact: true }).first().click();
  await expect(page.getByLabel('¿Cuánto quieres enviar?')).toHaveValue('');
});

test('completion after navigating to Home stays there and permits a fresh transfer', async ({
  page,
}) => {
  await signIn(page);
  await fillDraft(page);
  await page.getByText('Laboratorio de la demo', { exact: true }).click();
  await page.getByLabel('Resultado del siguiente envío').selectOption('success');
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  let release!: () => void;
  let observed!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  await page.route('**/api/transfers', async (route) => {
    observed();
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Confirmar envío' }).click();
  await started;
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.locator('.active-transfer-notice')).toContainText('Tu envío está en proceso.');
  release();
  await expect(page.locator('.active-transfer-notice')).toContainText('Tu envío se confirmó.');
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('link', { name: 'Ver comprobante', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible();
  await page.getByRole('link', { name: 'Hacer otro envío', exact: true }).click();
  await expect(page.getByLabel('¿Cuánto quieres enviar?')).toHaveValue('');
  await expect(page.getByLabel('Concepto', { exact: true })).toHaveValue('');
  await expect(page.locator('.small-balance')).toContainText('$23,249.50');
});
