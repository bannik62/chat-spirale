import { FormField } from './FormField.js';

export class ChatNameField extends FormField {
  get isValid() {
    return this.value.length >= 2;
  }

  get error() {
    if (this.isEmpty) return 'Nom du salon requis';
    if (!this.isValid) return 'Nom trop court (2 caractères minimum)';
    return null;
  }
}
