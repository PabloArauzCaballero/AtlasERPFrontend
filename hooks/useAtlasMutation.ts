'use client';

import { useCallback, useState } from 'react';

interface MutationState<TData> {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: TData | null;
  error: string | null;
}

/** Executes one backend mutation and exposes stable UI state for forms and workflow actions. */
export function useAtlasMutation<TInput, TData>(mutate: (input: TInput) => Promise<TData>) {
  const [state, setState] = useState<MutationState<TData>>({ status: 'idle', data: null, error: null });

  const execute = useCallback(async (input: TInput) => {
    setState({ status: 'loading', data: null, error: null });
    try {
      const data = await mutate(input);
      setState({ status: 'success', data, error: null });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible completar la operación.';
      setState({ status: 'error', data: null, error: message });
      throw error;
    }
  }, [mutate]);

  const reset = useCallback(() => setState({ status: 'idle', data: null, error: null }), []);
  return { ...state, execute, reset, isLoading: state.status === 'loading' };
}
