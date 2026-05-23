import { EmailField } from '../EmailField.js';
import { EmailListField } from '../EmailListField.js';
import { RoomIdsField } from '../RoomIdsField.js';
import { BooleanField } from '../BooleanField.js';

export class CreateParticipantForm {
  emails = new EmailListField();
  roomIds = new RoomIdsField();
  sendInviteEmail = new BooleanField(true);

  /**
   * @param {string} email
   * @param {{ alreadyRegistered: boolean }} ctx
   */
  payloadForEmail(email, { alreadyRegistered }) {
    const normalized = new EmailField(email).toJSON();
    const shouldSendMail = !alreadyRegistered || this.sendInviteEmail.checked;
    return {
      email: normalized,
      chatRoomIds: this.roomIds.toJSON(),
      sendEmail: shouldSendMail,
    };
  }

  get canSubmit() {
    return this.emails.isValid && this.roomIds.isValid;
  }

  /** @returns {string | null} */
  firstError() {
    return this.emails.error || this.roomIds.error;
  }
}
