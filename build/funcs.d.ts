/** Call this function when the user has specified an invalid configuration. */
export declare function invalidConfig(message: string): never;
/** Call this function when an invariant is violated, or when something should be impossible. */
export declare function crash(message: string): never;
/**
 * Throws an {@link ApplicationError}, causing the app to terminate with a non-zero exit code and a plain error message. (no stacktrace)
 *
 * Use this to write guard clauses.
 */
export declare function fail(message: string, exitCode?: number): never;
