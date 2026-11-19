const nativeFetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args);

export const fetch = nativeFetch;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;

export default nativeFetch;
