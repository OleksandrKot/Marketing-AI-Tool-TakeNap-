'use client';

import { useEffect } from 'react';

export default function NoScrollDuringLoad() {
  useEffect(() => {
    const className = 'no-scroll';
    try {
      document.documentElement.classList.add(className);
      document.body.classList.add(className);
    } catch (e) {
      // ignore if document not available
    }

    function remove() {
      try {
        document.documentElement.classList.remove(className);
        document.body.classList.remove(className);
      } catch (e) {
        // ignore
      }
    }

    // Block wheel, touchmove and key events to ensure no-scroll is enforced
    const onWheel = (e: WheelEvent) => {
      try {
        e.preventDefault();
      } catch (err) {}
    };
    const onTouchMove = (e: TouchEvent) => {
      try {
        e.preventDefault();
      } catch (err) {}
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // keys that cause scrolling
      const keys = [' ', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (keys.includes(e.key)) {
        try {
          e.preventDefault();
        } catch (err) {}
      }
    };

    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
        remove();
        return;
      }

      window.addEventListener('load', function onLoad() {
        remove();
        window.removeEventListener('load', onLoad);
      });

      // Add listeners with passive: false so we can preventDefault
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('keydown', onKeyDown, { passive: false });

      // Fallback: remove after 4s to avoid stuck state in dev
      const fallback = window.setTimeout(() => {
        try {
          // remove listeners then
          window.removeEventListener('wheel', onWheel);
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('keydown', onKeyDown);
        } catch (err) {}
        remove();
      }, 4000);

      return () => {
        try {
          window.removeEventListener('wheel', onWheel);
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('keydown', onKeyDown);
          window.clearTimeout(fallback);
        } catch (err) {}
        remove();
      };
    }

    return () => remove();
  }, []);

  return null;
}
