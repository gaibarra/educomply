import '@testing-library/jest-dom';

// Polyfill scrollIntoView in jsdom
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = function() { /* noop */ } as any;
}
