import { FormField } from './FormField.js';

export class EmailField extends FormField {
  normalize(raw) {
    return String(raw ?? '').trim().toLowerCase();
  }

  get isValid() {
    const v = this.value;
    return v.length > 0 && v.includes('@') && v.includes('.');
  }

  get error() {
    if (this.isEmpty) return 'Email requis';
    if (!this.isValid) return 'Email invalide';
    return null;
  }
}
