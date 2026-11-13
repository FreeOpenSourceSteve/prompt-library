import '@testing-library/jest-dom/vitest';
import { TextEncoder, TextDecoder } from 'node:util';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

Object.assign(globalThis, { TextEncoder, TextDecoder });
afterEach(cleanup);

if (
  typeof HTMLDialogElement !== 'undefined' &&
  !HTMLDialogElement.prototype.showModal
) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}
