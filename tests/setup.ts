import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom does not implement these APIs, and Recharts / matchMedia rely on them.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in window)) {
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock })
}

if (!window.scrollTo) {
  Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() })
}

// jsdom lacks canvas rendering; axe and icon components only need the element.
if (!HTMLCanvasElement.prototype.getContext) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    writable: true,
    value: () => null,
  })
}
