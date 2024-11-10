import type { Expand } from "./types.js";
export interface PositionalArgOptions {
    name: string;
    description: string;
    /**
     * Whether the argument does not need to be specified by the command invoker. Default: false.
     * If true, the command will be called with `undefined` for the value of this argument if it was omitted.
     * Not allowed if a default value was specified.
     */
    optional?: boolean;
    /**A default value for the argument. */
    default?: string | null;
}
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
export type ArgOptions<NamedArgsOptions extends Record<string, ArgData>> = {
    /** Named arguments, which are passed like `--name value` or `--name=value`. */
    namedArgs?: NamedArgsOptions;
    /** Aliases for named args' names. */
    aliases?: Record<string, string>;
    /** Positional arguments, which are passed like `value1 value2`... */
    positionalArgs?: PositionalArgOptions[];
    /**
     * Specifies the behavior if there are more positional args than the command is supposed to accept.
     * @default "ignore".
     */
    positionalArgCountCheck?: "error" | "warn" | "ignore";
    /**
     * Specifies the behavior if there is a named arg that the command does not accept.
     * @default "error".
     */
    unexpectedNamedArgCheck?: "error" | "warn" | "ignore";
};
export interface SpecificOptions<NamedArgsOptions extends Record<string, ArgData>> {
    /**All named args specified with --name value. */
    namedArgs: {} extends NamedArgsOptions ? {} : Record<string, ArgData> extends NamedArgsOptions ? Record<string, string | boolean | undefined | null> : NamedArgs<NamedArgsOptions>;
    /**Positional args specified by simply stating them. */
    positionalArgs: (string | undefined)[];
    commandName: string;
}
/**Generates the type definition for named args based on given argOptions. */
type NamedArgs<NamedArgOpts extends Record<string, ArgData>> = {
    [K in keyof NamedArgOpts]: NamedArgFrom<NamedArgOpts[K]>;
};
type NamedArgFrom<NamedArgOpt extends ArgData> = NamedArgOpt["_valueless"] extends true ? NamedArgOpt["_optional"] extends false ? true : (false | true) : NamedArgOpt["_optional"] extends true ? NamedArgOpt["_default"] extends string ? string : (string | undefined | null) : string;
export type CommandHandler<T extends Record<string, ArgData>> = (opts: Expand<SpecificOptions<T>>, app: Application) => void | number | Promise<void | number>;
export type CommandData = {
    readonly _name: string;
    readonly _description: string | undefined;
    readonly _default: boolean;
    readonly _aliases: string[];
};
export type CommandBuilder = CommandData & {
    description<T extends Partial<CommandBuilder>>(this: T, description: string): Omit<T, "description" | "_description"> & {
        _description: string;
    };
    aliases<T extends Partial<CommandBuilder>>(this: T, ...aliases: string[]): Omit<T, "aliases">;
    default<T extends Partial<CommandBuilder>>(this: T): Omit<T, "default">;
    args<TThis extends Partial<CommandBuilder>, const TArgs extends Record<string, ArgData>>(this: TThis, argOptions: ArgOptions<TArgs>): Omit<TThis, "description" | "aliases" | "args"> & {
        impl(this: CommandData, impl: CommandHandler<TArgs>): void;
    };
};
type ArgData = {
    readonly _optional: boolean;
    readonly _valueless: boolean;
    readonly _default: string | undefined;
    readonly _description: string | undefined;
    readonly _aliases: string[];
};
type ArgBuilder = ArgData & {
    description<T extends Partial<ArgBuilder>, const V extends string>(this: T, description: V): Omit<T, "description"> & {
        _description: V;
    };
    optional<T extends Partial<ArgBuilder>>(this: T): Omit<T, "optional" | "required" | "default" | "_optional" | "valueless"> & {
        _optional: true;
    };
    required<T extends Partial<ArgBuilder>>(this: T): Omit<T, "optional" | "required" | "default" | "_optional" | "valueless"> & {
        _optional: false;
    };
    valueless<T extends Partial<ArgBuilder>>(this: T): Omit<T, "valueless" | "_valueless" | "_optional"> & {
        _valueless: true;
        _optional: true;
    };
    default<T extends Partial<ArgBuilder>, const V extends string>(this: T, value: V): Omit<T, "default" | "_default" | "_optional" | "optional" | "required"> & {
        _default: V;
        _optional: true;
    };
    aliases<T extends Partial<ArgBuilder>>(this: T, ...aliases: string[]): Omit<T, "aliases" | "_aliases"> & {
        _aliases: string[];
    };
};
type InitialArgBuilder = ArgBuilder & {
    readonly _optional: false;
    readonly _valueless: false;
};
export declare const arg: () => InitialArgBuilder;
/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export declare class Application {
    /** The name used to run this application. Will be used in error suggestions. */
    name: string;
    description: string;
    /** Stores all subcommands. */
    commands: Record<string, Subcommand | undefined>;
    /** Stores all command aliases. */
    aliases: {
        [alias: string]: string;
    };
    /** The directory containing this application's main file. Uses slash or backslash dependent on platform. */
    sourceDirectory: string;
    constructor(
    /** The name used to run this application. Will be used in error suggestions. */
    name: string, description: string);
    /**
     * Adds a subcommand to this application.
     * @param handler The function that is called when this subcommand is run.
     * Return value handling:
     * - If the function returns an exit code (sync or async), the app will be closed immediately with that exit code.
     * - If the function returns undefined (sync or async), cli-app will do nothing, and NodeJS's standard behavior will occur.
     * @param argOptions Specifies the args that can be passed to this subcommand through the command line.
     * @param aliases List of alternative names for this command.
     */
    command(name: string): CommandBuilder;
    command(name: string, description: string): Omit<CommandBuilder, "description"> & {
        _description: string;
    };
    /** Creates an alias for a subcommand. */
    alias(alias: string, target: string): this;
    /** Runs the help command for this application. Do not call directly. */
    runHelpCommand(opts: Expand<SpecificOptions<Record<string, ArgData>>>): number;
    /**
     * Parses command line arguments into an object.
     * @param providedArgs Remove JS runtime options from process.argv.
     * @returns Formatted args.
     */
    static parseArgs(providedArgs: readonly string[], valuelessOptions?: readonly string[]): {
        namedArgs: Record<string, string | boolean | undefined | null>;
        positionalArgs: string[];
        /** Set if the first argument passed is a positional argument. */
        firstPositionalArg: string | undefined;
    };
    /**
     * Runs an application.
     * @param args Pass process.argv without modifying it.
     * @param options Used for testing.
     */
    run(rawArgs: string[], { exitProcessOnHandlerReturn, throwOnError, }?: ApplicationRunOptions): Promise<void>;
}
/**
 * Represents one subcommand of an application or script.
 */
export declare class Subcommand {
    name: string;
    handler: CommandHandler<any>;
    description: string;
    defaultCommand: boolean;
    /**
     * Information describing the command-line options that this subcommand accepts.
     */
    argOptions: Required<ArgOptions<Record<string, ArgData>>>;
    constructor(name: string, handler: CommandHandler<any>, description?: string, argOptions?: ArgOptions<Record<string, ArgData>>, defaultCommand?: boolean);
    /** Runs this subcommand. Do not call directly, call the application's run method instead. */
    run(args: string[], application: Application): number | void | Promise<number | void>;
}
export {};
