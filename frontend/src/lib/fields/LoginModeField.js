const MODES = new Set(['participant', 'admin']);

export class LoginModeField {
  #value = 'participant';

  constructor(initial = 'participant') {
    this.#value = MODES.has(initial) ? initial : 'participant';
  }

  get value() {
    return this.#value;
  }

  set value(raw) {
    this.#value = MODES.has(raw) ? raw : 'participant';
  }

  get isParticipant() {
    return this.#value === 'participant';
  }

  get isAdmin() {
    return this.#value === 'admin';
  }

  get isValid() {
    return MODES.has(this.#value);
  }

  toJSON() {
    return this.#value;
  }
}
