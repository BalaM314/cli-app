import type { Application } from "./Application.js";
import type { Script } from "./Script.js";
/**Options that are passed to a subcommand handler. */
export interface SpecificOptions<Opts extends Partial<ArgOptions>> {
    /**All named args specified with --name value. */
    namedArgs: Opts["namedArgs"] extends ArgOptions["namedArgs"] ? namedArgs<Opts["namedArgs"]> : {};
    /**Positional args specified by simply stating them. */
    positionalArgs: string[];
    commandName: string;
}
export type Options = SpecificOptions<ArgOptions>;
/**Generates the type definition for named args based on given argOptions. */
type namedArgs<namedArgOpts extends ArgOptions["namedArgs"]> = {
    [K in keyof namedArgOpts]: namedArgFrom<namedArgOpts[K]>;
};
type namedArgFrom<O extends NamedArgOptions> = NamedArgOptions extends O ? (string | undefined | null) : true extends O["needsValue"] ? (isFalseOrUnknown<O["default"] & O["required"]> extends true ? (string | undefined) : string) : (O["required"] extends true ? "true" : (undefined | "true"));
/**Arg options that specify what args a command should accept. */
export interface ArgOptions {
    namedArgs: Record<string, NamedArgOptions>;
    /**Aliases for named args' names. */
    aliases?: Record<string, string>;
    positionalArgs: PositionalArgOptions[];
    /**
     * If "warn": prints a warning if there are more positional args than the command is supposed to accept.
     * If "ignore", ignores.
     * Default: "ignore".
     **/
    positionalArgCountCheck?: "warn" | "ignore";
}
/**Makes every property in an object and all of its child objects required. */
export type RequiredRecursive<T> = T extends Array<infer A> ? RequiredRecursive<A>[] : {
    [P in keyof T]-?: RequiredRecursive<T[P]>;
};
export type isFalseOrUnknown<T> = unknown extends T ? true : false extends T ? true : false;
export type FilledArgOptions = RequiredRecursive<ArgOptions>;
export interface NamedArgOptions {
    description: string;
    /**Whether the argument must be specified by the command invoker. Default: false. */
    required?: boolean;
    /**A default value for the argument. */
    default?: string | null;
    /**Whether this argument accepts a value. Default: true. */
    needsValue?: boolean;
    /**List of aliases for this named arg. */
    aliases?: string[];
}
export interface PositionalArgOptions {
    name: string;
    description: string;
    /**Whether the argument must be specified by the command invoker. Default: false. */
    required?: boolean;
    /**A default value for the argument. */
    default?: string | null;
}
export type CommandHandler<App extends Application | Script<ArgOptions>, A extends Partial<ArgOptions>> = (opts: SpecificOptions<A>, application: App) => number | void | Promise<number | void>;
export type ApplicationRunOptions = {
    /**
     * If the command handler throws an ApplicationError, normally, this function will catch it and print an error message.
     * If this option is set, the error will be immediately rethrown. Useful for writing tests.
     * @default false
     */
    throwOnError?: boolean;
    /**
     * If this option is set, {@link process.exit()} will be called when the command handler returns a numeric exit code.
     * Otherwise, this function will throw an error if the exit code is non-zero.
     * @default true
     */
    exitProcessOnHandlerReturn?: boolean;
};
export {};
