/**
 * Champ texte de base — normalisation et sérialisation via getter/setter.
 */
export class FormField {
  #value = '';

  constructor(initial = '') {
    this.#value = this.normalize(initial);
  }

  get value() {
    return this.#value;
  }

  set value(raw) {
    this.#value = this.normalize(raw);
  }

  /** @param {unknown} raw */
  normalize(raw) {
    return String(raw ?? '').trim();
  }

  get isEmpty() {
    return this.#value.length === 0;
  }

  get isValid() {
    return !this.isEmpty;
  }

  /** @returns {string | null} */
  get error() {
    if (this.isEmpty) return 'Champ requis';
    return null;
  }

  toJSON() {
    return this.#value;
  }

  reset() {
    this.#value = '';
  }
}
