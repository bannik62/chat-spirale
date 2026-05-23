import { FormField } from './FormField.js';

export class PasswordField extends FormField {
  get isValid() {
    return this.value.length > 0;
  }

  get error() {
    if (this.isEmpty) return 'Mot de passe requis';
    return null;
  }
}
