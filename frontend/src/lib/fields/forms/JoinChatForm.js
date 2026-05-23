import { DisplayNameField } from '../DisplayNameField.js';

/** Rejoindre un salon en tant que formateur (nom fixe par défaut). */
export class JoinChatForm {
  displayName = new DisplayNameField('Formateur');

  toJSON() {
    return { displayName: this.displayName.toJSON() };
  }
}
