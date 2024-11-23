export declare function invalidConfig(message: string): never;
export declare function crash(message: string): never;
/**
 * Throws an {@link ApplicationError}, causing the app to terminate with a non-zero exit code and a plain error message.
 * Use this to write guard clauses.
 */
export declare function fail(message: string, exitCode?: number): never;
