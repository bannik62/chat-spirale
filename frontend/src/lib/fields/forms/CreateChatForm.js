import { ChatNameField } from '../ChatNameField.js';
import { BooleanField } from '../BooleanField.js';

export class CreateChatForm {
  name = new ChatNameField();
  isPermanent = new BooleanField();

  get canSubmit() {
    return this.name.isValid;
  }

  /** @returns {string | null} */
  firstError() {
    return this.name.error;
  }

  toJSON() {
    return {
      name: this.name.toJSON(),
      isPermanent: this.isPermanent.toJSON(),
    };
  }

  reset() {
    this.name.reset();
    this.isPermanent.reset();
  }
}
