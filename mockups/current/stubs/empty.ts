// Native-only modules (Firebase, sound, storage) are not needed to draw screens.
const noop = () => undefined;
const handler: ProxyHandler<any> = { get: (_t, p) => (p === 'default' ? proxy : p === '__esModule' ? true : noop) };
const proxy: any = new Proxy(noop, handler);
export default proxy;
export const getItem = async () => null;
export const setItem = async () => undefined;
