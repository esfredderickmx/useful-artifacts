import { useMemo } from 'react';
import type { Decoration } from '@/types/decoration';

export function useDecorator<TValue extends string, TKeys extends keyof Decoration>(
    decorations: Record<TValue, Pick<Decoration, TKeys>>,
    value: TValue | null | undefined,
): Pick<Decoration, TKeys> | null {
    return useMemo(() => (value != null ? decorations[value] : null), [decorations, value]);
}
