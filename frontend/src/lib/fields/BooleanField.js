/**
 * Case à cocher — getter/setter sur `checked`.
 */
export class BooleanField {
  #checked = false;

  constructor(initial = false) {
    this.#checked = Boolean(initial);
  }

  get checked() {
    return this.#checked;
  }

  set checked(raw) {
    this.#checked = Boolean(raw);
  }

  get isValid() {
    return true;
  }

  toJSON() {
    return this.#checked;
  }

  reset() {
    this.#checked = false;
  }
}
