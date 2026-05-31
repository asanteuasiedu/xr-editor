export function __awaiter<T>(
  thisArg: unknown,
  args: unknown,
  P: PromiseConstructor,
  generator: (...generatorArgs: unknown[]) => Generator<unknown, T, unknown>
) {
  function adopt(value: unknown) {
    return value instanceof P ? value : new P((resolve) => resolve(value));
  }

  return new P((resolve, reject) => {
    const iterator = generator.apply(thisArg, Array.isArray(args) ? args : []);

    function fulfilled(value: unknown) {
      try {
        step(iterator.next(value));
      } catch (error) {
        reject(error);
      }
    }

    function rejected(value: unknown) {
      try {
        step((iterator.throw?.(value) ?? iterator.next(value)) as IteratorResult<unknown, T>);
      } catch (error) {
        reject(error);
      }
    }

    function step(result: IteratorResult<unknown, T>) {
      if (result.done) {
        resolve(result.value);
        return;
      }

      adopt(result.value).then(fulfilled, rejected);
    }

    step(iterator.next());
  });
}

export function __rest(source: Record<PropertyKey, unknown>, excluded: PropertyKey[]) {
  const target: Record<PropertyKey, unknown> = {};

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key) && !excluded.includes(key)) {
      target[key] = source[key];
    }
  }

  if (source != null && typeof Object.getOwnPropertySymbols === 'function') {
    for (const symbol of Object.getOwnPropertySymbols(source)) {
      if (!excluded.includes(symbol) && Object.prototype.propertyIsEnumerable.call(source, symbol)) {
        target[symbol] = source[symbol];
      }
    }
  }

  return target;
}
