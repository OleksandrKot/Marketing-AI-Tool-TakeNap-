'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Hook to persist the selected business ID across navigation
 * Automatically adds business parameter to URLs when navigating to other pages
 */
export function useBusinessPersist() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedBusinessId = searchParams.get('business');

  // Create a wrapper for router.push that preserves business parameter
  const pushWithBusiness = (path: string) => {
    try {
      if (selectedBusinessId) {
        // Add business parameter to the new URL if it doesn't already have one
        const separator = path.includes('?') ? '&' : '?';
        const businessParam = `business=${encodeURIComponent(selectedBusinessId)}`;

        if (!path.includes('business=')) {
          router.push(`${path}${separator}${businessParam}`);
        } else {
          router.push(path);
        }
      } else {
        router.push(path);
      }
    } catch (e) {
      console.debug('Error in pushWithBusiness:', e);
      router.push(path);
    }
  };

  return {
    selectedBusinessId,
    pushWithBusiness,
  };
}
