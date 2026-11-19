import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Usar cuenta de prueba' }).click();
  await page.getByRole('button', { name: 'Entrar a mi wallet' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$24,500.00');
}
async function prepareTransfer(page: Page, scenario = 'success') {
  await page.goto('/transfer');
  await page.getByRole('radio', { name: /Ana López/ }).check();
  await page.getByLabel('¿Cuánto quieres enviar?').fill('1250.50');
  await page.getByLabel('Concepto', { exact: true }).fill('Cena del viernes');
  await page.getByText('Laboratorio de la demo', { exact: true }).click();
  await page.getByLabel('Resultado del siguiente envío').selectOption(scenario);
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  await expect(page.getByRole('heading', { name: 'Todo listo para tu envío.' })).toBeVisible();
}
async function a11y(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test('login validates, simulates errors, persists the session and logs out', async ({ page }) => {
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login$/);
  await a11y(page);
  await page.getByLabel('Teléfono o correo electrónico').fill('incorrecto');
  await page.getByRole('button', { name: 'Entrar a mi wallet' }).click();
  await expect(page.locator('#identity-error')).toContainText('correo válido');
  await page.getByLabel('Teléfono o correo electrónico').fill('error@demo.mx');
  await page.getByRole('button', { name: 'Entrar a mi wallet' }).click();
  await expect(page.locator('.error-state')).toContainText('No pudimos iniciar');
  await page.getByRole('button', { name: 'Usar cuenta de prueba' }).click();
  await page.getByRole('button', { name: 'Entrar a mi wallet' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.reload();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$24,500.00');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login$/);
});

test('successful transfer updates balance, receipt survives refresh and remains accessible', async ({
  page,
}) => {
  await login(page);
  await a11y(page);
  await prepareTransfer(page);
  await a11y(page);
  await page.getByRole('button', { name: 'Confirmar envío' }).click();
  await expect(page).toHaveURL(/\/transfer$/);
  const receiptHref = await page
    .getByRole('link', { name: 'Ver comprobante', exact: true })
    .getAttribute('href');
  expect(receiptHref).toMatch(/^\/receipt\//);
  await page.getByRole('link', { name: 'Volver a mi wallet' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('link', { name: 'Enviar dinero', exact: true }).first().click();
  await expect(page.getByLabel('¿Cuánto quieres enviar?')).toHaveValue('');
  await expect(page.getByLabel('Concepto', { exact: true })).toHaveValue('');
  await expect(page.getByRole('radio', { name: /Ana López/ })).not.toBeChecked();
  await page.getByRole('link', { name: 'Volver a mi wallet' }).click();
  const movement = page.getByRole('link', { name: /Ana López.*Cena del viernes/ });
  await expect(movement).toHaveAttribute('href', receiptHref ?? '');
  await movement.click();
  await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible();
  await expect(page.locator('.review-amount')).toHaveText('$1,250.50');
  await page.reload();
  await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible();
  await a11y(page);
  await page.getByRole('link', { name: 'Volver a mi wallet' }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$23,249.50');
  await page.getByRole('link', { name: /Ana López.*Cena del viernes/ }).click();
  await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible();
});

for (const scenario of ['network', 'insufficient', 'unknown', 'timeout']) {
  test(`recovers from ${scenario} without duplicate debit`, async ({ page }) => {
    await login(page);
    await prepareTransfer(page, scenario);
    await page.getByRole('button', { name: 'Confirmar envío' }).click();
    await expect(page.locator('.transfer-error')).toBeVisible();
    await page.getByLabel('Resultado del siguiente envío').selectOption('success');
    if (scenario === 'insufficient') {
      await page.getByRole('button', { name: 'Reintentar envío', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Verificar resultado', exact: true }).click();
      if (scenario !== 'timeout') {
        await page.getByRole('button', { name: 'Reintentar mismo envío', exact: true }).click();
      }
    }
    await expect(page).toHaveURL(/\/transfer$/);
    await page.getByRole('link', { name: 'Ver comprobante', exact: true }).click();
    await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible();
    await page.getByRole('link', { name: 'Volver a mi wallet' }).click();
    await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$23,249.50');
  });
}

test('requires recipient and valid amount, and enforces available balance', async ({ page }) => {
  await login(page);
  await page.goto('/transfer');
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  await expect(page.getByText('Elige una persona para tu envío.')).toBeVisible();
  await page.getByRole('radio', { name: /Ana López/ }).check();
  for (const amount of ['0', '-10', '0.001', '1e3', '25000']) {
    await page.getByLabel('¿Cuánto quieres enviar?').fill(amount);
    await page.getByRole('button', { name: 'Revisar envío' }).click();
    await expect(page.locator('#amount-error')).toBeVisible();
  }
  await page.getByLabel('¿Cuánto quieres enviar?').fill('0.01');
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  await expect(page.getByRole('heading', { name: 'Todo listo para tu envío.' })).toBeVisible();
  await expect(page.locator('.review-amount')).toHaveText('$0.01');
  await page.getByRole('button', { name: 'Editar datos' }).click();
  await expect(page.getByLabel('¿Cuánto quieres enviar?')).toHaveValue('0.01');
});

test('saves a new recipient and uses it for a transfer', async ({ page }) => {
  await login(page);
  await page.goto('/transfer');
  await page.getByRole('button', { name: 'Nuevo contacto' }).click();
  await page.getByLabel('Nombre del contacto').fill('Mariana Torres');
  await page.getByLabel('Teléfono o correo del contacto').fill('mariana@example.com');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByRole('radio', { name: /Mariana Torres/ })).toBeChecked();
  await page.getByLabel('¿Cuánto quieres enviar?').fill('100');
  await page.getByText('Laboratorio de la demo', { exact: true }).click();
  await page.getByLabel('Resultado del siguiente envío').selectOption('success');
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  await page.getByRole('button', { name: 'Confirmar envío' }).click();
  await expect(page).toHaveURL(/\/transfer$/);
  await page.getByRole('link', { name: 'Ver comprobante', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible();
  await expect(page.locator('.review-recipient')).toContainText('Mariana Torres');
  await page.goto('/contacts');
  await page.getByLabel('Buscar contactos').fill('Mariana');
  await expect(page.getByRole('heading', { name: 'Mariana Torres' })).toBeVisible();
});

test('home empty and error states recover and layout stays within the viewport', async ({
  page,
}) => {
  await login(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Ocultar saldo' }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).not.toContainText('$24,500.00');
  await page.getByText('Laboratorio de la demo', { exact: true }).click();
  await page.getByLabel('Estado del Home').selectOption('empty');
  await expect(
    page.getByRole('heading', { name: 'Tu próximo movimiento empieza aquí' }),
  ).toBeVisible();
  await page.getByLabel('Estado del Home').selectOption('error');
  await expect(page.locator('.error-state')).toContainText('No pudimos cargar');
  await page.getByLabel('Estado del Home').selectOption('normal');
  await expect(page.getByRole('heading', { name: 'Tu actividad reciente' })).toBeVisible();
});

test('recovers a pending operation after navigating away and reloading', async ({ page }) => {
  await login(page);
  await prepareTransfer(page, 'timeout');
  await page.getByRole('button', { name: 'Confirmar envío' }).click();
  await expect(page.locator('.transfer-error')).toContainText('Verifiquemos');
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$23,249.50');
  await page.goto('/transfer');
  await expect(page.locator('.transfer-error')).toContainText('envío pendiente');
  await expect(page.locator('.review-recipient')).toContainText('Ana López');
  await page.getByRole('button', { name: 'Verificar resultado' }).click();
  await expect(page).toHaveURL(/\/transfer$/);
  await page.getByRole('link', { name: 'Ver comprobante', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a mi wallet' }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$23,249.50');
});

test('blocks review while saving a new contact', async ({ page }) => {
  await login(page);
  await page.goto('/transfer');
  await page.getByRole('radio', { name: /Ana López/ }).check();
  await page.getByLabel('¿Cuánto quieres enviar?').fill('100');
  await page.getByRole('button', { name: 'Nuevo contacto' }).click();
  await page.getByLabel('Nombre del contacto').fill('Mariana Torres');
  await page.getByLabel('Teléfono o correo del contacto').fill('mariana@example.com');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByRole('button', { name: 'Revisar envío' })).toBeDisabled();
  await expect(page.getByRole('radio', { name: /Mariana Torres/ })).toBeChecked();
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  await expect(page.locator('.review-recipient')).toContainText('Mariana Torres');
});

test('another tab changing the session invalidates the reviewed screen', async ({
  page,
  context,
}) => {
  await login(page);
  await prepareTransfer(page);
  const second = await context.newPage();
  await second.goto('/login');
  await second.getByLabel('Teléfono o correo electrónico').fill('other@example.com');
  await second.getByRole('button', { name: 'Entrar a mi wallet' }).click();
  await expect(second).toHaveURL(/\/home$/);
  await expect(page).toHaveURL(/\/login$/);
  await expect(second.getByLabel('Saldo de tu wallet')).toContainText('$24,500.00');
  await second.close();
});

test('offers sign-in recovery if the session expires before confirmation', async ({
  page,
  context,
}) => {
  await login(page);
  await prepareTransfer(page);
  await context.clearCookies();
  await page.getByRole('button', { name: 'Confirmar envío' }).click();
  await expect(page.getByRole('link', { name: 'Ir al inicio de sesión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar envío' })).toHaveCount(0);
});

test('refreshes the real balance when another payment consumes the funds', async ({ page }) => {
  await login(page);
  await prepareTransfer(page, 'success');
  const wallet = await (await page.request.get('/api/wallet')).json();
  const spent = await page.request.post('/api/transfers', {
    data: {
      walletId: wallet.id,
      amountCents: 2400000,
      recipientId: 'ana',
      concept: 'Otro envío',
      idempotencyKey: crypto.randomUUID(),
    },
    headers: { 'x-demo-scenario': 'success' },
  });
  expect(spent.status()).toBe(201);
  await page.getByRole('button', { name: 'Confirmar envío' }).click();
  await expect(page.locator('.transfer-error')).toContainText('No hay fondos suficientes');
  await expect(page.locator('.small-balance')).toContainText('$500.00');
  await page.getByRole('button', { name: 'Editar datos' }).click();
  await page.getByRole('button', { name: 'Revisar envío' }).click();
  await expect(page.locator('#amount-error')).toContainText('supera tu saldo');
});
