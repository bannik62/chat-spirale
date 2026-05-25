import { FormField } from './FormField.js';

export class DisplayNameField extends FormField {
  normalize(raw) {
    return String(raw ?? '').replace(/\s+/g, ' ').slice(0, 64);
  }

  get isValid() {
    return this.value.trim().length >= 2;
  }

  toJSON() {
    return this.value.trim();
  }

  get error() {
    if (this.isEmpty) return 'Prénom ou pseudo requis';
    if (!this.isValid) return '2 caractères minimum';
    return null;
  }
}
