import { EmailField } from '../EmailField.js';
import { AccessCodeField } from '../AccessCodeField.js';
import { PasswordField } from '../PasswordField.js';
import { LoginModeField } from '../LoginModeField.js';

export class PortalLoginForm {
  email = new EmailField();
  mode = new LoginModeField();
  code = new AccessCodeField();
  password = new PasswordField();

  get canSubmit() {
    if (!this.email.isValid) return false;
    if (this.mode.isParticipant) return this.code.isValid;
    return this.password.isValid;
  }

  /** @returns {string | null} */
  firstError() {
    return (
      this.email.error ||
      (this.mode.isParticipant ? this.code.error : this.password.error) ||
      null
    );
  }

  toJSON() {
    const payload = {
      email: this.email.toJSON(),
      mode: this.mode.toJSON(),
    };
    if (this.mode.isAdmin) {
      return { ...payload, password: this.password.toJSON() };
    }
    return { ...payload, code: this.code.toJSON() };
  }
}
