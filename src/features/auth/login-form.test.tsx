import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
describe('login form', () => {
  it('shows a field error for malformed identity before calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Teléfono o correo electrónico'), {
      target: { value: 'incorrecto' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Entrar a mi wallet/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('correo válido');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('fills a fictitious identity with the demo shortcut', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /Usar cuenta de prueba/ }));
    expect(screen.getByLabelText('Teléfono o correo electrónico')).toHaveValue('alex@demo.mx');
  });
});
