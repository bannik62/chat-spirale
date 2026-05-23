import { FormField } from './FormField.js';

const MAX_LEN = 4000;

export class MessageContentField extends FormField {
  normalize(raw) {
    return String(raw ?? '').trim().slice(0, MAX_LEN);
  }

  get isValid() {
    return this.value.length > 0;
  }

  get error() {
    if (this.isEmpty) return 'Message vide';
    return null;
  }

  /** Payload Socket.IO */
  toSocketPayload() {
    return { content: this.value };
  }
}
