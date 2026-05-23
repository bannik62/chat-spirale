import { EmailField } from './EmailField.js';

/** Liste d'emails sélectionnés (chips). */
export class EmailListField {
  #items = [];

  constructor(initial = []) {
    this.#items = initial.map((e) => new EmailField(e).value).filter(Boolean);
  }

  get items() {
    return [...this.#items];
  }

  get length() {
    return this.#items.length;
  }

  get isEmpty() {
    return this.#items.length === 0;
  }

  get isValid() {
    return this.#items.length > 0 && this.#items.every((e) => e.includes('@'));
  }

  get error() {
    if (this.isEmpty) return 'Au moins une personne requise';
    return null;
  }

  includes(email) {
    const n = new EmailField(email).value;
    return this.#items.includes(n);
  }

  add(email) {
    const n = new EmailField(email).value;
    if (!n.includes('@') || this.#items.includes(n)) return false;
    this.#items = [...this.#items, n];
    return true;
  }

  remove(email) {
    const n = new EmailField(email).value;
    this.#items = this.#items.filter((x) => x !== n);
  }

  clear() {
    this.#items = [];
  }

  toJSON() {
    return [...this.#items];
  }
}
