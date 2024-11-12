/**Makes every property in an object and all of its child objects required. */
export type RequiredRecursive<T> = T extends Array<infer A> ? Array<RequiredRecursive<A>> : {
    [P in keyof T]-?: RequiredRecursive<T[P]>;
};
export type isFalseOrUnknown<T> = unknown extends T ? true : false extends T ? true : false;
export type PickFunctionProperties<T extends Record<PropertyKey, unknown>> = Pick<T, keyof T extends infer K extends keyof T ? K extends unknown ? T[K] extends (...args: any[]) => unknown ? K : never : never : never>;
export type OmitFunctionProperties<T extends Record<PropertyKey, unknown>> = Pick<T, keyof T extends infer K extends keyof T ? K extends unknown ? T[K] extends (...args: any[]) => unknown ? never : K : never : never>;
export type Expand<T> = T extends Function ? T : {
    [K in keyof T]: Expand<T[K]>;
};
