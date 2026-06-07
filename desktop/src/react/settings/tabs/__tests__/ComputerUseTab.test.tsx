/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const hanaFetchMock = vi.fn();

vi.mock('../../api', () => ({
  hanaFetch: (...args: unknown[]) => hanaFetchMock(...args),
}));

vi.mock('../../helpers', () => ({
  t: (key: string) => {
    if (key === 'settings.computerUse.experimentalWarning') {
      return 'Computer use 功能属于测试阶段，而且对模型性能要求较高，请在知晓所有风险后开启，目前已验证某些软件下不按预期工作，建议只是尝鲜。';
    }
    return key;
  },
}));

vi.mock('../../widgets/Toggle', () => ({
  Toggle: ({ on, onChange }: { on: boolean; onChange?: (next: boolean) => void }) => (
    <button type="button" data-testid={`computer-toggle-${on ? 'on' : 'off'}`} onClick={() => onChange?.(!on)}>
      toggle
    </button>
  ),
}));

import { ComputerUseTab } from '../ComputerUseTab';
import { useSettingsStore } from '../../store';

afterEach(() => {
  cleanup();
  hanaFetchMock.mockReset();
  useSettingsStore.setState({ toastMessage: '', toastType: '', toastVisible: false });
});

function jsonResponse(body: unknown) {
  return { json: async () => body } as Response;
}

describe('ComputerUseTab', () => {
  it('renders the experimental risk warning near the top of the Computer Use page', async () => {
    hanaFetchMock.mockResolvedValue(jsonResponse({
      selectedProviderId: 'macos:cua',
      settings: { enabled: false, require_app_approval: false, app_approvals: [] },
      status: {
        providers: [{ providerId: 'macos:cua', status: { available: true, permissions: [] } }],
        activeLease: null,
      },
    }));

    render(<ComputerUseTab />);

    await waitFor(() => expect(hanaFetchMock).toHaveBeenCalledWith('/api/preferences/computer-use'));
    const warning = screen.getByTestId('computer-use-experimental-warning');

    expect(warning.textContent || '').toContain('Computer use 功能属于测试阶段');
    expect(warning.textContent || '').toContain('建议只是尝鲜');
  });

  it('shows a toast when requesting permissions fails', async () => {
    hanaFetchMock
      .mockResolvedValueOnce(jsonResponse({
        selectedProviderId: 'macos:cua',
        settings: { enabled: false, require_app_approval: false, app_approvals: [] },
        status: {
          providers: [{ providerId: 'macos:cua', status: { available: false, reason: 'binary-not-found', permissions: [] } }],
          activeLease: null,
        },
      }))
      .mockRejectedValueOnce(new Error('hanaFetch /api/preferences/computer-use/request-permissions: 400 Bad Request'));

    render(<ComputerUseTab />);

    await waitFor(() => expect(hanaFetchMock).toHaveBeenCalledWith('/api/preferences/computer-use'));
    fireEvent.click(screen.getByText('settings.computerUse.requestPermissions'));

    await waitFor(() => {
      expect(useSettingsStore.getState().toastType).toBe('error');
      expect(useSettingsStore.getState().toastMessage).toContain('400 Bad Request');
    });
  });

  it('tells the user to grant Hanako Computer Use when a missing permission pane is opened', async () => {
    hanaFetchMock
      .mockResolvedValueOnce(jsonResponse({
        selectedProviderId: 'macos:cua',
        settings: { enabled: true, require_app_approval: false, app_approvals: [] },
        status: {
          providers: [{ providerId: 'macos:cua', status: { available: true, permissions: [{ name: 'Accessibility', granted: false }] } }],
          activeLease: null,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        nextMissingPermission: 'accessibility',
        systemSettings: { opened: true, kind: 'accessibility' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        selectedProviderId: 'macos:cua',
        settings: { enabled: true, require_app_approval: false, app_approvals: [] },
        status: {
          providers: [{ providerId: 'macos:cua', status: { available: true, permissions: [{ name: 'Accessibility', granted: false }] } }],
          activeLease: null,
        },
      }));

    render(<ComputerUseTab />);

    await waitFor(() => expect(hanaFetchMock).toHaveBeenCalledWith('/api/preferences/computer-use'));
    fireEvent.click(screen.getByText('settings.computerUse.requestPermissions'));

    await waitFor(() => {
      expect(useSettingsStore.getState().toastType).toBe('success');
      expect(useSettingsStore.getState().toastMessage).toBe('settings.computerUse.requestPermissionsOpened');
    });
  });

  it('saves the per-app approval toggle', async () => {
    hanaFetchMock
      .mockResolvedValueOnce(jsonResponse({
        selectedProviderId: 'macos:cua',
        settings: { enabled: true, require_app_approval: false, app_approvals: [] },
        status: {
          providers: [{ providerId: 'macos:cua', status: { available: true, permissions: [] } }],
          activeLease: null,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        settings: { enabled: true, require_app_approval: true, app_approvals: [] },
      }))
      .mockResolvedValueOnce(jsonResponse({
        selectedProviderId: 'macos:cua',
        settings: { enabled: true, require_app_approval: true, app_approvals: [] },
        status: {
          providers: [{ providerId: 'macos:cua', status: { available: true, permissions: [] } }],
          activeLease: null,
        },
      }));

    render(<ComputerUseTab />);

    await waitFor(() => expect(screen.getByText('settings.computerUse.requireAppApproval')).toBeTruthy());
    const toggles = screen.getAllByTestId('computer-toggle-off');
    fireEvent.click(toggles[0]);

    await waitFor(() => {
      expect(hanaFetchMock).toHaveBeenCalledWith('/api/preferences/computer-use', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ settings: { require_app_approval: true } }),
      }));
    });
  });
});
