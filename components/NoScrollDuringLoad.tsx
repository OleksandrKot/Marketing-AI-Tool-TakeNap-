'use client';

import { useEffect, useState } from 'react';

export default function NoScrollDuringLoad() {
  const [blocked, setBlocked] = useState(true);

  useEffect(() => {
    const className = 'no-scroll';

    function addClass() {
      try {
        document.documentElement.classList.add(className);
        document.body.classList.add(className);
      } catch (e) {}
    }
    function removeClass() {
      try {
        document.documentElement.classList.remove(className);
        document.body.classList.remove(className);
      } catch (e) {}
    }

    // Prevent scroll-related events only when blocked
    const onWheel = (e: WheelEvent) => {
      if (document.body.classList.contains(className)) {
        try {
          e.preventDefault();
        } catch (err) {}
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (document.body.classList.contains(className)) {
        try {
          e.preventDefault();
        } catch (err) {}
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!document.body.classList.contains(className)) return;
      const keys = [' ', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (keys.includes(e.key)) {
        try {
          e.preventDefault();
        } catch (err) {}
      }
    };

    // Detect visible "Loading" indicators in the DOM and toggle block
    const loadingRegex = /\bLoading(?:\.{1,3}|…)?\b/i;

    let checkTimer: number | null = null;
    function isElementVisible(el: Element) {
      try {
        const r = (el as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      } catch (e) {
        return true;
      }
    }

    function checkForLoading() {
      if (checkTimer) window.clearTimeout(checkTimer);
      checkTimer = window.setTimeout(() => {
        try {
          // quick selectors
          const selectors = ['[data-loading]', '.loading', '[aria-busy="true"]'];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
              setBlocked(true);
              addClass();
              return;
            }
          }

          // Search for text nodes containing "Loading" (case-insensitive)
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
          let node: Node | null = walker.nextNode();
          while (node) {
            const txt = node.textContent;
            if (txt && loadingRegex.test(txt)) {
              const parent = node.parentElement;
              if (parent && isElementVisible(parent)) {
                setBlocked(true);
                addClass();
                return;
              }
            }
            node = walker.nextNode();
          }

          // not found
          setBlocked(false);
          removeClass();
        } catch (e) {
          // noop
        }
      }, 120);
    }

    // Observe DOM changes to detect Loading... appearing/disappearing
    const observer = new MutationObserver(() => checkForLoading());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Listen for load event to clear initial block
    function onLoad() {
      checkForLoading();
      try {
        window.removeEventListener('load', onLoad);
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      // initial check
      addClass();
      checkForLoading();

      window.addEventListener('load', onLoad);
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('keydown', onKeyDown, { passive: false });

      // fallback to remove block after 8s to avoid stuck state
      const fallback = window.setTimeout(() => {
        setBlocked(false);
        removeClass();
      }, 8000);

      return () => {
        try {
          observer.disconnect();
          window.removeEventListener('load', onLoad);
          window.removeEventListener('wheel', onWheel as EventListener);
          window.removeEventListener('touchmove', onTouchMove as EventListener);
          window.removeEventListener('keydown', onKeyDown as EventListener);
          if (checkTimer) window.clearTimeout(checkTimer);
          window.clearTimeout(fallback);
        } catch (e) {}
        removeClass();
      };
    }
  }, []);

  // Render a transparent overlay to capture scrollbar clicks and pointer events when blocked
  if (!blocked) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
    />
  );
}
