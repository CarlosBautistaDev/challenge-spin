import { expect, test } from '@playwright/test';

test('production build with demo controls disabled hides the lab and ignores forced Home scenarios', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Usar cuenta de prueba' }).click();
  await page.getByRole('button', { name: 'Entrar a mi wallet' }).click();
  await expect(page.getByLabel('Saldo de tu wallet')).toContainText('$24,500.00');
  await expect(page.getByText('Laboratorio de la demo', { exact: true })).toHaveCount(0);
  const response = await page.request.get('/api/wallet?state=error');
  expect(response.status()).toBe(200);
  expect((await response.json()).movements).toHaveLength(4);
  expect(response.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole('link', { name: 'Enviar dinero', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Revisar envío' })).toBeVisible();
  await expect(page.getByLabel('Resultado del siguiente envío')).toHaveCount(0);
});
