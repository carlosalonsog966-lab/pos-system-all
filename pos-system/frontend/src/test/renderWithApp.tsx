import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import App from '@/App';

export type TestRole = 'admin' | 'manager' | 'employee' | 'cashier';

export function setTestRole(role: TestRole) {
  (globalThis as any).__TEST_ROLE__ = role;
}

export function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<App />);
}

// Helpers de aserción comunes
export async function assertRedirect(to: string) {
  const target = to.startsWith('#') ? to : `#${to}`;
  await waitFor(() => {
    expect(window.location.hash).toContain(target);
  });
}

export function assertNoSpinner(text: string) {
  expect(screen.queryByText(text)).toBeNull();
}

// Aserción de spinner: si se pasa texto, busca por texto;
// en caso contrario, busca por testId genérico "loading-spinner"
export async function assertSpinner(text?: string) {
  if (text) {
    expect(await screen.findByText(text)).toBeTruthy();
    return;
  }
  expect(await screen.findByTestId('loading-spinner')).toBeTruthy();
}
