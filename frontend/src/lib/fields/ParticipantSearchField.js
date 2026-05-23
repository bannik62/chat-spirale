import { FormField } from './FormField.js';

/** Recherche dans le picker — ne part pas telle quelle à l'API. */
export class ParticipantSearchField extends FormField {
  normalize(raw) {
    return String(raw ?? '').trim();
  }

  get isValid() {
    return true;
  }

  get error() {
    return null;
  }

  /** Email candidat si saisie valide */
  get candidateEmail() {
    const q = this.value.toLowerCase();
    return q.includes('@') ? q : null;
  }
}
