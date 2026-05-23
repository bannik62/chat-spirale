import { EmailListField } from '../EmailListField.js';

export class InviteInRoomForm {
  emails = new EmailListField();
  sendEmailForNew = true;

  toJSON() {
    return {
      emails: this.emails.toJSON(),
      sendEmailForNew: this.sendEmailForNew,
    };
  }

  get canSubmit() {
    return this.emails.isValid;
  }

  /** @returns {string | null} */
  firstError() {
    return this.emails.error;
  }
}
