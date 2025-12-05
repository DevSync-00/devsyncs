/**
 * React rendering optimization utilities.
 * 
 * Provides utilities to optimize React component rendering.
 */

import * as React from 'react';

/**
 * Memoized component props comparison.
 */
export function shallowEqual<T extends Record<string, any>>(
  objA: T,
  objB: T
): boolean {
  if (Object.is(objA, objB)) {
    return true;
  }

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (
      !Object.prototype.hasOwnProperty.call(objB, key) ||
      !Object.is(objA[key], objB[key])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Creates a memoized component with shallow comparison.
 */
export function memoShallow<T extends React.ComponentType<any>>(
  Component: T
): React.MemoExoticComponent<T> {
  return React.memo(Component, shallowEqual);
}

/**
 * Custom hook for debounced value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for throttled value.
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastRan = React.useRef<number>(Date.now());

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, delay - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return throttledValue;
}

/**
 * Custom hook for memoized callback.
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return React.useCallback(callback, deps);
}

/**
 * Custom hook for memoized value.
 */
export function useMemoizedValue<T>(
  value: T,
  deps: React.DependencyList
): T {
  return React.useMemo(() => value, deps);
}

/**
 * Custom hook for virtual scrolling.
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleItems = React.useMemo(() => {
    const totalItems = items.length;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan
    );
    const endIndex = Math.min(
      totalItems - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visible: Array<{ index: number; data: T }> = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visible.push({
        index: i,
        data: items[i],
      });
    }

    return {
      items: visible,
      startIndex,
      endIndex,
      totalHeight: totalItems * itemHeight,
      offsetY: startIndex * itemHeight,
    };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  return {
    ...visibleItems,
    setScrollTop,
  };
}

