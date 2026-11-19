import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
describe('login form', () => {
  function mount(client = new QueryClient()) {
    return render(
      <QueryClientProvider client={client}>
        <LoginForm />
      </QueryClientProvider>,
    );
  }
  it('removes the prior session cache and recovery payload after a new login', async () => {
    const client = new QueryClient();
    client.setQueryData(['receipt', 'old-wallet', 'old-payment'], { private: 'previous session' });
    sessionStorage.setItem('spin-pending:v1:old-wallet', 'previous session');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ user: { name: 'Alex', identity: 'alex@demo.mx' } }),
    );
    mount(client);
    fireEvent.click(screen.getByRole('button', { name: /Usar cuenta de prueba/ }));
    fireEvent.click(screen.getByRole('button', { name: /Entrar a mi wallet/ }));
    await waitFor(() =>
      expect(client.getQueryData(['receipt', 'old-wallet', 'old-payment'])).toBeUndefined(),
    );
    expect(sessionStorage.getItem('spin-pending:v1:old-wallet')).toBeNull();
  });
  it('shows a field error for malformed identity before calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mount();
    fireEvent.change(screen.getByLabelText('Teléfono o correo electrónico'), {
      target: { value: 'incorrecto' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Entrar a mi wallet/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('correo válido');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('fills a fictitious identity with the demo shortcut', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Usar cuenta de prueba/ }));
    expect(screen.getByLabelText('Teléfono o correo electrónico')).toHaveValue('alex@demo.mx');
  });
});
