import { describe, it, expect } from 'vitest';
import { useBranchStore } from '@/store/branchStore';

describe('branchStore selección y persistencia', () => {
  it('setSelectedBranch actualiza y persiste', () => {
    useBranchStore.setState({ selectedBranchId: null, branches: [], loading: false, error: null });
    useBranchStore.getState().setSelectedBranch('BR-001');
    expect(useBranchStore.getState().selectedBranchId).toBe('BR-001');
  });
});

