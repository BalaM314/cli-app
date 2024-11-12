import type { Expand } from "./types.js";
/** Extra options to customize the behavior of {@link Application.run}. */
export type ApplicationRunOptions = {
    /**
     * If the command handler throws an ApplicationError, normally, this function will catch it and print an error message.
     * If this option is set, the error will be immediately rethrown. Useful for writing tests.
     * @default false
     */
    readonly throwOnError?: boolean;
    /**
     * If this option is set, {@link process.exit()} will be called when the command handler returns a numeric exit code.
     * Otherwise, this function will throw an error if the exit code is non-zero.
     * @default true
     */
    readonly exitProcessOnHandlerReturn?: boolean;
};
/** Passed while defining a command. */
export type PositionalArgOptions = {
    readonly name: string;
    readonly description: string;
    /**
     * Whether the argument does not need to be specified by the command invoker. Default: false.
     * If true, the command will be called with `undefined` for the value of this argument if it was omitted.
     * Not allowed if a default value was specified.
     */
    readonly optional?: boolean;
    /**A default value for the argument. */
    readonly default?: string | null;
};
/** Passed while defining a command. */
export type ArgOptions<TNamedArgs extends Record<string, NamedArgData> = Record<string, NamedArgData>> = {
    /** Named arguments, which are passed like `--name value` or `--name=value`. */
    readonly namedArgs?: TNamedArgs;
    /** Aliases for named args' names. */
    readonly aliases?: Record<string, string>;
    /** Positional arguments, which are passed like `value1 value2`... */
    readonly positionalArgs?: PositionalArgOptions[];
    /**
     * Specifies the behavior if there are more positional args than the command is supposed to accept.
     * @default "ignore".
     */
    readonly positionalArgCountCheck?: "error" | "warn" | "ignore";
    /**
     * Specifies the behavior if there is a named arg that the command does not accept.
     * @default "error".
     */
    readonly unexpectedNamedArgCheck?: "error" | "warn" | "ignore";
};
/** Computes the type of the arguments passed to a command's handler, given the parameters defined previously. */
export type ComputeOptions<TNamedArgs extends Record<string, NamedArgData> = Record<string, NamedArgData>> = {
    /** All named args specified with --name value. */
    readonly namedArgs: {} extends TNamedArgs ? {} : Record<string, NamedArgData> extends TNamedArgs ? Record<string, string | boolean | undefined | null> : NamedArgs<TNamedArgs>;
    /** Positional args specified by simply stating them. */
    readonly positionalArgs: Array<string | undefined>;
    readonly commandName: string;
};
type NamedArgs<NamedArgOpts extends Record<string, NamedArgData>> = {
    [K in keyof NamedArgOpts]: NamedArgFrom<NamedArgOpts[K]>;
};
type NamedArgFrom<NamedArgOpt extends NamedArgData> = NamedArgOpt["_valueless"] extends true ? NamedArgOpt["_optional"] extends false ? true : (false | true) : NamedArgOpt["_optional"] extends true ? NamedArgOpt["_default"] extends string ? string : (string | undefined | null) : string;
export type CommandHandler<T extends Record<string, NamedArgData>> = (opts: Expand<ComputeOptions<T>>, app: Application) => void | number | Promise<void | number>;
/** The data that gets filled out by the command builder. */
export type CommandData = {
    readonly _name: string;
    readonly _description: string | undefined;
    readonly _default: boolean;
    readonly _aliases: string[];
};
/** Contains functions that use the builder pattern to produce a {@link CommandData}. */
export type CommandBuilder = CommandData & {
    /** Sets the description for this subcommand. */
    description<T extends Partial<CommandBuilder>>(this: T, description: string): Omit<T, "description" | "_description"> & {
        _description: string;
    };
    /** Adds additional names that can be used to run this subcommand. */
    aliases<T extends Partial<CommandBuilder>>(this: T, ...aliases: string[]): Omit<T, "aliases">;
    /** Makes this subcommand the default command, which will be invoked if the user does not specify a subcommand. Only one subcommand can be marked as the default one. */
    default<T extends Partial<CommandBuilder>>(this: T): Omit<T, "default">;
    /** Defines the type of the parameters this command accepts. */
    args<TThis extends Partial<CommandBuilder>, const TArgs extends Record<string, NamedArgData>>(this: TThis, argOptions: ArgOptions<TArgs>): Omit<TThis, "description" | "aliases" | "args"> & {
        /**
         * Sets the function that will be called when this command is run.
         *
         * Return value handling:
         * - If the function returns an exit code (sync or async), the app will be closed immediately with that exit code.
         * - If the function returns undefined (sync or async), cli-app will do nothing, and NodeJS's standard behavior will occur.
         */
        impl(this: CommandData, impl: CommandHandler<TArgs>): void;
    };
};
/** The data that gets filled out by the named argument builder. */
type NamedArgData = {
    readonly _optional: boolean;
    readonly _valueless: boolean;
    readonly _default: string | undefined;
    readonly _description: string | undefined;
    readonly _aliases: string[];
};
/** Contains functions that use the builder pattern to produce a {@link NamedArgData}. */
type NamedArgBuilder = NamedArgData & {
    description<T extends Partial<NamedArgBuilder>, const V extends string>(this: T, description: V): Omit<T, "description"> & {
        _description: V;
    };
    optional<T extends Partial<NamedArgBuilder>>(this: T): Omit<T, "optional" | "required" | "default" | "_optional" | "valueless"> & {
        _optional: true;
    };
    required<T extends Partial<NamedArgBuilder>>(this: T): Omit<T, "optional" | "required" | "default" | "_optional" | "valueless"> & {
        _optional: false;
    };
    valueless<T extends Partial<NamedArgBuilder>>(this: T): Omit<T, "valueless" | "_valueless" | "_optional"> & {
        _valueless: true;
        _optional: true;
    };
    default<T extends Partial<NamedArgBuilder>, const V extends string>(this: T, value: V): Omit<T, "default" | "_default" | "_optional" | "optional" | "required"> & {
        _default: V;
        _optional: true;
    };
    aliases<T extends Partial<NamedArgBuilder>>(this: T, ...aliases: string[]): Omit<T, "aliases" | "_aliases"> & {
        _aliases: string[];
    };
};
/** The initial state of the named argument builder, with defaults. */
type NamedArgBuilderInitial = NamedArgBuilder & {
    readonly _optional: false;
    readonly _valueless: false;
};
/** Helper function to define a named argument. Uses the builder pattern. */
export declare const arg: () => NamedArgBuilderInitial;
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
    aliases: Record<string, string>;
    /** The directory containing this application's main file. Uses slash or backslash dependent on platform. */
    sourceDirectory: string;
    constructor(
    /** The name used to run this application. Will be used in error suggestions. */
    name: string, description: string);
    /**
     * Adds a subcommand to this application.
     * Uses the builder pattern.
     * Example usage:
     * ```
     * myApp.command("subcommand1")
     * 	.description("Does subcommand1 things.")
     * 	.aliases("Subcommand1", "sub-command-1")
     * 	.args({
     * 		namedArgs: {
     * 			arg1: arg().description("Used for argument1 things.").optional(),
     * 			arg2: arg().default("foo"),
     * 			arg3: arg().description("This argument doesn't accept a value, pass it by itself, like `--arg3`")
     * 				.valueless().required(),
     * 		}
     * 	})
     * 	.impl((args) => {
     * 		args.arg1; //=> string | null | undefined
     * 		args.arg2; //=> string
     * 		args.arg3: //=> true
     * 	})
     * ```
     */
    command(name: string): CommandBuilder;
    command(name: string, description: string): Omit<CommandBuilder, "description"> & {
        _description: string;
    };
    /**
     * Same as {@link command()}, but for applications with only one subcommand. This will slightly change the display of help messages.
     */
    onlyCommand(): Omit<Omit<CommandBuilder, "description"> & {
        _description: string;
    }, "default">;
    /** Creates an alias for a subcommand. */
    alias(alias: string, target: string): this;
    getOnlyCommand(): string | undefined;
    /** Runs the help command for this application. Do not call directly. */
    private runHelpCommand;
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
    run(rawArgs: readonly string[], { exitProcessOnHandlerReturn, throwOnError, }?: ApplicationRunOptions): Promise<void>;
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
    argOptions: Required<ArgOptions<Record<string, NamedArgData>>>;
    constructor(name: string, handler: CommandHandler<any>, description?: string, argOptions?: ArgOptions<Record<string, NamedArgData>>, defaultCommand?: boolean);
    /** Runs this subcommand. Do not call directly, call the application's run method instead. */
    run(args: readonly string[], application: Application): number | void | Promise<number | void>;
}
export {};
