import type { Expand } from "./types.js";
/** Extra options to customize the behavior of {@link Application.run}. */
export type ApplicationRunOptions = {
    /**
     * If the command handler throws an ApplicationError, normally, {@link Application.run} will catch it and print an error message, then resolve.
     * If this option is set, the error will be immediately rethrown, causing Application.run to reject, which will print a stack trace. Useful for writing tests.
     *
     * Default: `false`.
     */
    readonly throwOnError?: boolean;
    /**
     * If this option is set, {@link process.exitCode} will be set when the command handler returns a numeric value. Async operations will continue to run.
     * Otherwise, a numeric return value will cause a promise rejection.
     *
     * Default: `true`.
     */
    readonly setProcessExitCodeOnHandlerReturn?: boolean;
};
/** Passed while defining a command. */
export type PositionalArgOptions = {
    readonly name: string;
    readonly description?: string;
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
export type ArgOptions<TNamedArgs extends Record<string, NamedArgData> = Record<string, NamedArgData>, TPositionalArgs extends PositionalArgOptions[] = PositionalArgOptions[]> = {
    /** Named arguments, which are passed like `--name value` or `--name=value`. */
    readonly namedArgs?: TNamedArgs;
    /** Aliases for named args' names. */
    readonly aliases?: Record<string, string>;
    /** Positional arguments, which are passed like `value1 value2`... */
    readonly positionalArgs?: TPositionalArgs;
    /**
     * Specifies the behavior if there are more positional args than the command is supposed to accept.
     *
     * Default: `"ignore"`.
     */
    readonly positionalArgCountCheck?: "error" | "warn" | "ignore";
    /**
     * Used for the "Usage: " line in the help message. Inserted after the generated usage instructions for all normal positional args.
     * Example: when set to "[-- extraArgs...]", the help message might say `Usage: application --namedArg <namedArg> <requiredPositional> [-- extraArgs...]`
     */
    readonly positionalArgsText?: string;
    /**
     * Specifies the behavior if there is a named arg that the command does not accept.
     *
     * Default: `"error"`.
     */
    readonly unexpectedNamedArgCheck?: "error" | "warn" | "ignore";
    /**
     * Whether to interpret `app commandName --help` as `app help commandName`.
     *
     * Default: `true`.
     */
    readonly allowHelpNamedArg?: boolean;
};
/** Computes the type of the arguments passed to a command's handler, given the parameters defined previously. */
export type ComputeOptions<TNamedArgs extends Record<string, NamedArgData> = Record<string, NamedArgData>, TPositionalArgs extends PositionalArgOptions[] = PositionalArgOptions[]> = {
    /** All named args specified with --name value. */
    readonly namedArgs: {} extends TNamedArgs ? {} : Record<string, NamedArgData> extends TNamedArgs ? Record<string, string | boolean | undefined | null> : NamedArgs<TNamedArgs>;
    /** Positional args specified by simply stating them. */
    readonly positionalArgs: PositionalArgOptions extends TPositionalArgs ? string[] : {
        [K in keyof TPositionalArgs]: TPositionalArgs[K]["default"] extends string ? string : TPositionalArgs[K]["optional"] extends true ? (string | undefined) : string;
    };
    /** The name of the subcommand. */
    readonly commandName: string;
    /** All named and positional arguments passed to the command, not including the command name. */
    readonly unparsedArgs: readonly string[];
    /**
     * The first 2 arguments from process.argv.
     * Should have the value `["node", "/path/to/file.js"]`
     */
    readonly nodeArgs: readonly [string, string];
};
/** Computes the type of the named arguments passed to a command's handler, given the named arg parameters defined previously. */
type NamedArgs<NamedArgOpts extends Record<string, NamedArgData>> = {
    -readonly [K in keyof NamedArgOpts]: NamedArgFrom<NamedArgOpts[K]>;
};
/**
 * Computes the type of one named argument given the configuration information.
 ** Returns `string` if it is required.
 ** Returns `string | undefined` if it is optional.
 ** Returns `boolean` if it is a valueless named argument.
 ** Returns `true` if it is a valueless and required named argument.
 */
type NamedArgFrom<NamedArgOpt extends NamedArgData> = NamedArgOpt["~valueless"] extends true ? NamedArgOpt["~optional"] extends false ? true : (false | true) : NamedArgOpt["~optional"] extends true ? NamedArgOpt["~default"] extends string ? string : (string | undefined | null) : string;
/** The handler for a subcommand, which is the function that gets run when the command is invoked. */
export type CommandHandler<TNamedArgs extends Record<string, NamedArgData>, TPositionalArgs extends PositionalArgOptions[]> = (opts: Expand<ComputeOptions<TNamedArgs, TPositionalArgs>>, app: Application) => void | number | Promise<void | number>;
/** The data that gets filled out by the command builder. */
export type CommandData = {
    /** Please use the builder methods instead of this property. */ readonly "~name": string;
    /** Please use the builder methods instead of this property. */ readonly "~description": string | undefined;
    /** Please use the builder methods instead of this property. */ readonly "~default": boolean;
    /** Please use the builder methods instead of this property. */ readonly "~aliases": string[];
};
/** Contains functions that use the builder pattern to produce a {@link CommandData}. */
export type CommandBuilder = CommandData & {
    /** Sets the description for this subcommand. */
    description<T extends Partial<CommandBuilder>>(this: T, description: string): Omit<T, "description" | "~description"> & {
        "~description": string;
    };
    /** Adds additional names that can be used to run this subcommand. */
    aliases<T extends Partial<CommandBuilder>>(this: T, ...aliases: string[]): Omit<T, "aliases">;
    /** Makes this subcommand the default command, which will be invoked if the user does not specify a subcommand. Only one subcommand can be marked as the default one. */
    default<T extends Partial<CommandBuilder>>(this: T): Omit<T, "default">;
    /** Defines the type of the parameters this command accepts. */
    args<TThis extends Partial<CommandBuilder>, const TNamedArgs extends Record<string, NamedArgData>, const TPositionalArgs extends PositionalArgOptions[]>(this: TThis, argOptions: ArgOptions<TNamedArgs, TPositionalArgs>): Omit<TThis, "description" | "aliases" | "args"> & {
        /**
         * Sets the function that will be called when this command is run.
         *
         * Return value handling:
         * - If the function returns an exit code (sync or async), the app will be closed immediately with that exit code.
         * - If the function returns undefined (sync or async), cli-app will do nothing, and NodeJS's standard behavior will occur.
         */
        impl(this: CommandData, impl: CommandHandler<TNamedArgs, TPositionalArgs>): void;
    };
};
/** The data that gets filled out by the named argument builder. */
type NamedArgData = {
    /** Please use the builder methods instead of this property. */ readonly "~optional": boolean;
    /** Please use the builder methods instead of this property. */ readonly "~valueless": boolean;
    /** Please use the builder methods instead of this property. */ readonly "~default": string | undefined;
    /** Please use the builder methods instead of this property. */ readonly "~description": string | undefined;
    /** Please use the builder methods instead of this property. */ readonly "~aliases": string[];
};
/** Contains functions that use the builder pattern to produce a {@link NamedArgData}. */
type NamedArgBuilder = NamedArgData & {
    /** Sets the description for this named argument. Used in help messages. */
    description<T extends Partial<NamedArgBuilder>, const V extends string>(this: T, description: V): Omit<T, "description"> & {
        "~description": V;
    };
    /**
     * Marks this named argument as optional.
     * Named arguments are required by default.
     *
     * The value provided to the command handler will be a string if one was passed, `undefined` if it was omitted, and `null` if the argument was specified without a value.
     */
    optional<T extends Partial<NamedArgBuilder>>(this: T): Omit<T, "optional" | "required" | "default" | "~optional" | "valueless"> & {
        "~optional": true;
    };
    /**
     * Marks this valueless named argument as required.
     * This will force the user to pass this named argument. Useful for confirmations, like "--potentially-destructive-action".
     *
     * The value provided to the command handler will be of type `true` and can be ignored.
     */
    required<T extends Partial<NamedArgBuilder> & {
        "~valueless": true;
    }>(this: T): Omit<T, "optional" | "required" | "default" | "~optional" | "valueless"> & {
        "~optional": false;
    };
    /**
     * Marks this named argument as valueless.
     * For example: the "verbose" option doesn't accept a value, so the command `app --verbose value1` can be parsed as `app value1 --verbose`, not `app --verbose=value1`.
     * The provided to the handler will be `true` if this argument was specified, and `false` otherwise.
     */
    valueless<T extends Partial<NamedArgBuilder>>(this: T): Omit<T, "valueless" | "optional" | "~valueless" | "~optional" | "default"> & {
        "~valueless": true;
        "~optional": true;
    } & Pick<NamedArgBuilder, "required">;
    /**
     * Specifies a default value for this named argument. If the user does not specify a value for this named argument, the default value will be used.
     *
     * Also marks this argument as optional.
     */
    default<T extends Partial<NamedArgBuilder>, const V extends string>(this: T, value: V): Omit<T, "default" | "~default" | "~optional" | "optional" | "required" | "valueless"> & {
        "~default": V;
        "~optional": true;
    };
    /**
     * Specifies aliases for this named argument. Providing one single-character alias is recommended.
     */
    aliases<T extends Partial<NamedArgBuilder>>(this: T, ...aliases: string[]): Omit<T, "aliases" | "~aliases"> & {
        "~aliases": string[];
    };
};
/** The initial state of the named argument builder, with defaults. */
type NamedArgBuilderInitial = Omit<NamedArgBuilder, "required"> & {
    /** Please use the builder methods instead of this property. */ readonly "~optional": false;
    /** Please use the builder methods instead of this property. */ readonly "~valueless": false;
};
/** Helper function to define a named argument. Uses the builder pattern. */
export declare const arg: () => NamedArgBuilderInitial;
/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export declare class Application {
    /** The name used to run this application. Will be used in error suggestions. */
    name: string;
    /** A description for this application. Will be used in help messages. */
    description: string;
    /** Stores all subcommands. */
    commands: Record<string, Subcommand>;
    /** Stores all command aliases. */
    aliases: Record<string, string>;
    /** The default subcommand, which is run if the user does not specify a subcommand. */
    defaultSubcommand: Subcommand;
    /** The directory containing this application's main file. Uses slash or backslash dependent on platform. */
    sourceDirectory: string;
    private currentRunOptions;
    constructor(
    /** The name used to run this application. Will be used in error suggestions. */
    name: string, 
    /** A description for this application. Will be used in help messages. */
    description: string);
    /**
     * Adds a subcommand to this application.
     * Uses the builder pattern.
     *
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
        "~description": string;
    };
    /**
     * Same as {@link command()}, but for applications with only one subcommand.
     *
     * The name and description will be the same as the application's name and description, and the command will be set as default.
     *
     * This will slightly change the display of help messages, to make them more applicable for an application with only one subcommand.
     *
     * Example usage:
     * ```
     * myApp.onlyCommand()
     * 	.args({
     * 		namedArgs: {
     * 			arg1: arg(),
     * 		}
     * 	})
     * 	.impl((args) => {
     * 		console.log(`Hello ${args.arg1}`);
     * 	})
     * ```
     *
     * Without onlyCommand:
     * ```sh
     * $ my-app help
     * my-app: Description for my-app
     * Usage: my-app [subcommand] [options]
     * 	List of all subcommands:
     *
     * 	my-app: Description for my-app
     * $ my-app help my-app
     * Help for subcommand my-app:
     * Description for my-app
     * Usage: my-app my-app [--arg <arg>]
     *
     * <arg>: No description provided
     * ```
     * This is confusing.
     *
     * With onlyCommand:
     * ```sh
     * $ my-app help
     * Help for command my-app:
     * Description for my-app.
     * Usage: my-app [--arg <arg>]
     *
     * <arg>: No description provided
     * ```
     */
    onlyCommand(): Omit<Omit<Omit<CommandBuilder, "description"> & {
        "~description": string;
    }, "default">, "aliases">;
    /**
     * Creates a new category of commands, which can be invoked by passing the category name before the command name.
     *
     * Example usage:
     * ```
     * myApp.category("category1", "For category1 related commands.", cat => {
     * 	cat.command("subcommand1")
     * 		.description("Does subcommand1 things.")
     * 		.args({})
     * 		.impl(() => {});
     * 	cat.command("subcommand2")
     * 		.description("Does subcommand2 things.")
     * 		.args({})
     * 		.impl(() => {});
     * });
     * ```
     * At the command line:
     * - `myApp category1 subcommand1`
     * - `myApp category1 --help`
     * - `myApp help category1`
     * - `myApp category1 help subcommand2`
     */
    category(name: string, description: string, callback: (app: Omit<Application, "onlyCommand" | "run">) => unknown): this;
    /** Creates an alias for a subcommand. */
    alias(alias: string, target: string): this;
    /** Returns the name of this application's only command, if it exists. If there are zero or multiple commands, returns undefined. */
    getOnlyCommand(): string | undefined;
    /** Runs the help command for this application. Do not call directly. */
    private runHelpCommand;
    /**
     * Parses command line arguments into an object.
     * @param providedArgs Remove JS runtime options from process.argv.
     * @param valuelessOptions List of named arguments that do not have a corresponding value.
     *
     * If an argument follows one of these named arguments, it will be interpreted as a positional argument.
     *
     * Example: `--arg1 value1` will normally be parsed as `{arg1: "value1"}`,
     *
     * but if valuelessOptions includes arg1, then it will be parsed as `{arg1: true}, ["value1"]`
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
    run(rawArgs: readonly string[], runOptions?: ApplicationRunOptions): Promise<void>;
}
/**
 * Represents one subcommand of an application or script.
 */
export declare class Subcommand {
    name: string;
    handler: CommandHandler<any, any>;
    description: string | undefined;
    defaultCommand: boolean;
    /**
     * Information describing the command-line options that this subcommand accepts.
     */
    argOptions: Required<ArgOptions<Record<string, NamedArgData>>>;
    /**
     * Set to an {@link Application} if this subcommand is a category.
     */
    subcategoryApp: Application | null;
    constructor(name: string, handler: CommandHandler<any, any>, //use any to avoid contravariance
    description: string | undefined, argOptions?: ArgOptions<Record<string, NamedArgData>>, defaultCommand?: boolean);
    /** Runs this subcommand. Do not call directly, call the application's run method instead. */
    run(args: readonly string[], nodeArgs: [string, string], application: Application): number | void | Promise<number | void>;
}
export {};
