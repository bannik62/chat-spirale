/** IDs de salons cochés (checkboxes). */
export class RoomIdsField {
  #ids = [];

  constructor(initial = []) {
    this.#ids = [...initial];
  }

  get ids() {
    return [...this.#ids];
  }

  get length() {
    return this.#ids.length;
  }

  get isEmpty() {
    return this.#ids.length === 0;
  }

  get isValid() {
    return this.#ids.length > 0;
  }

  get error() {
    if (this.isEmpty) return 'Au moins un salon requis';
    return null;
  }

  includes(id) {
    return this.#ids.includes(id);
  }

  toggle(id) {
    if (this.#ids.includes(id)) {
      this.#ids = this.#ids.filter((x) => x !== id);
    } else {
      this.#ids = [...this.#ids, id];
    }
  }

  setDefault(ids) {
    if (this.#ids.length === 0 && ids.length > 0) {
      this.#ids = [ids[0]];
    }
  }

  toJSON() {
    return [...this.#ids];
  }
}
