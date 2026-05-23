import { DisplayNameField } from '../DisplayNameField.js';

export class SetDisplayNameForm {
  displayName = new DisplayNameField();

  get canSubmit() {
    return this.displayName.isValid;
  }

  /** @returns {string | null} */
  firstError() {
    return this.displayName.error;
  }

  toJSON() {
    return { displayName: this.displayName.toJSON() };
  }
}
