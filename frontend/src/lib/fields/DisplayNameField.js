import { FormField } from './FormField.js';

export class DisplayNameField extends FormField {
  normalize(raw) {
    return String(raw ?? '').trim().replace(/\s+/g, ' ');
  }

  get isValid() {
    return this.value.length >= 2;
  }

  get error() {
    if (this.isEmpty) return 'Prénom ou pseudo requis';
    if (!this.isValid) return '2 caractères minimum';
    return null;
  }
}
