import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-router', async (original) => ({ ...await original<typeof import('@tanstack/react-router')>(), useNavigate: () => vi.fn() }));
import { Route } from '@/routes/_authenticated/changer-mot-de-passe';
afterEach(cleanup);
describe('Password visibility', () => {
  it('toggles each field independently without changing its value', () => {
    const Component = Route.options.component;
    if (!Component) throw new Error('Missing component');
    render(<Component />);
    for (const label of ['Mot de passe actuel', 'Nouveau mot de passe', 'Confirmer']) {
      const input = screen.getByLabelText(label);
      fireEvent.change(input, { target: { value: '864209' } });
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.click(screen.getByRole('button', { name: `Afficher le mot de passe — ${label}` }));
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveValue('864209');
      fireEvent.click(screen.getByRole('button', { name: `Masquer le mot de passe — ${label}` }));
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveValue('864209');
    }
  });
});
