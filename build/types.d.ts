export type PickFunctionProperties<T extends Record<PropertyKey, unknown>> = Pick<T, keyof T extends infer K extends keyof T ? K extends unknown ? T[K] extends (...args: any[]) => unknown ? K : never : never : never>;
export type OmitFunctionProperties<T extends Record<PropertyKey, unknown>> = Pick<T, keyof T extends infer K extends keyof T ? K extends unknown ? T[K] extends (...args: any[]) => unknown ? never : K : never : never>;
export type Expand<T> = T extends Function ? T : {
    [K in keyof T]: Expand<T[K]>;
};
