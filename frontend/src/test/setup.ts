import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({
  matches: false, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false },
}) })
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
// jsdom cannot measure pseudo-elements used by the Ant Design table scrollbar.
const computedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = (element: Element) => computedStyle(element)
