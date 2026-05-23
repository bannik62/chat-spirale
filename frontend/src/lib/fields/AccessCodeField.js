import { FormField } from './FormField.js';

const CODE_LEN = 8;

export class AccessCodeField extends FormField {
  normalize(raw) {
    return String(raw ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, CODE_LEN);
  }

  get isValid() {
    return this.value.length >= 7;
  }

  get error() {
    if (this.isEmpty) return 'Code requis';
    if (!this.isValid) return 'Code à 8 caractères';
    return null;
  }

  toJSON() {
    return this.value;
  }
}
