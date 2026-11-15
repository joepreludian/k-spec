import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// Polyfills Radix UI primitives expect in a browser but jsdom lacks.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView ||= () => {};
  Element.prototype.hasPointerCapture ||= () => false;
  Element.prototype.setPointerCapture ||= () => {};
  Element.prototype.releasePointerCapture ||= () => {};
}
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}

// jsdom has no PointerEvent; Radix (Select, DropdownMenu) only opens on
// pointerdown events whose pointerType is "mouse".
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
    }
  }
  window.PointerEvent = PointerEvent;
  globalThis.PointerEvent = PointerEvent;
}
