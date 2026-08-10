import { sortear } from './sorteo';

describe('sortear', () => {
  it('devuelve n elementos cuando hay más que n', () => {
    const res = sortear([1, 2, 3, 4, 5], 3);
    expect(res).toHaveLength(3);
  });

  it('no repite elementos', () => {
    const res = sortear([1, 2, 3, 4, 5], 3);
    expect(new Set(res).size).toBe(res.length);
  });

  it('cada elemento devuelto pertenece al array original', () => {
    const original = [1, 2, 3, 4, 5];
    const res = sortear(original, 3);
    expect(res.every((x) => original.includes(x))).toBe(true);
  });

  it('devuelve todos los elementos (sin repetir) cuando hay menos que n', () => {
    const res = sortear([1, 2], 5);
    expect(res).toHaveLength(2);
    expect(new Set(res)).toEqual(new Set([1, 2]));
  });

  it('devuelve un array vacío si el original está vacío', () => {
    expect(sortear([], 3)).toEqual([]);
  });

  it('no muta el array original', () => {
    const original = [1, 2, 3];
    sortear(original, 2);
    expect(original).toEqual([1, 2, 3]);
  });
});
