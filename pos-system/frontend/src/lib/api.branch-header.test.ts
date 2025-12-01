import { describe, it, expect } from 'vitest';

describe('x-branch-id header y param branchId', async () => {
  it('adjunta branch a headers y params', async () => {
    const { api } = await import('@/lib/api');
    const { useBranchStore } = await import('@/store/branchStore');
    useBranchStore.setState({ selectedBranchId: 'BR-XYZ', branches: [], loading: false, error: null });
    const r = await api.request({
      url: '/check',
      method: 'get',
      adapter: async (c) => ({ data: { success: true, data: null }, status: 200, statusText: 'OK', headers: {}, config: c } as any)
    });
    const hdr = (r.config.headers as any)?.['x-branch-id'] || (r.config.headers as any)?.get?.('x-branch-id');
    expect(String(hdr)).toBe('BR-XYZ');
    const params = r.config.params as any;
    expect(String(params?.branchId)).toBe('BR-XYZ');
  });
});
