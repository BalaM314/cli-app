/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains the code for the Application class, which represents a command-line application.
*/

import path from "node:path";
import fs from "node:fs";
import { ApplicationError, StringBuilder } from "./classes.js";
import type { Expand, OmitFunctionProperties, PickFunctionProperties } from "./types.js";
import { crash, fail, invalidConfig } from "./funcs.js";

//#region Types
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

//No need to use the builder pattern here, because there is no option that requires another option to make sense.
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
}

/** Passed while defining a command. */
export type ArgOptions<
	TNamedArgs extends Record<string, NamedArgData> = Record<string, NamedArgData>,
	TPositionalArgs extends PositionalArgOptions[] = PositionalArgOptions[],
> = {
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
export type ComputeOptions<
	TNamedArgs extends Record<string, NamedArgData> = Record<string, NamedArgData>,
	TPositionalArgs extends PositionalArgOptions[] = PositionalArgOptions[],
> = {
	/** All named args specified with --name value. */
	readonly namedArgs:
		{} extends TNamedArgs ? {} :
		Record<string, NamedArgData> extends TNamedArgs ? Record<string, string | boolean | undefined | null> :
		NamedArgs<TNamedArgs>;
	/** Positional args specified by simply stating them. */
	readonly positionalArgs: PositionalArgOptions extends TPositionalArgs ?
		string[]
	: {
		[K in keyof TPositionalArgs]:
			TPositionalArgs[K]["default"] extends string ? string :
			TPositionalArgs[K]["optional"] extends true ? (string | undefined) :
			string
	}
	/** The name of the subcommand. */
	readonly commandName: string;
	/** All named and positional arguments passed to the command, not including the command name. */
	readonly unparsedArgs: readonly string[];
	/**
	 * The first 2 arguments from process.argv.
	 * Should have the value `["node", "/path/to/file.js"]`
	 */
	readonly nodeArgs: readonly [string, string];
}

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
type NamedArgFrom<NamedArgOpt extends NamedArgData> =
	NamedArgOpt["~valueless"] extends true ?
		NamedArgOpt["~optional"] extends false ? true : (false | true)
	: NamedArgOpt["~optional"] extends true ? NamedArgOpt["~default"] extends string ? string : (string | undefined | null) : string;

/** The handler for a subcommand, which is the function that gets run when the command is invoked. */
export type CommandHandler<
	TNamedArgs extends Record<string, NamedArgData>,
	TPositionalArgs extends PositionalArgOptions[],
> = 
	(opts: Expand<ComputeOptions<TNamedArgs, TPositionalArgs>>, app: Application) => void | number | Promise<void | number>;

//#endregion
//#region Command builder

/** The data that gets filled out by the command builder. */
export type CommandData = {
	//Properties are prefixed with ~ because it is sorted after all alphabetic characters, so the intellisense list suggests functions first.
	/** Please use the builder methods instead of this property. */ readonly "~name": string;
	/** Please use the builder methods instead of this property. */ readonly "~description": string | undefined;
	/** Please use the builder methods instead of this property. */ readonly "~default": boolean;
	/** Please use the builder methods instead of this property. */ readonly "~aliases": string[];
};
/** Contains functions that use the builder pattern to produce a {@link CommandData}. */
export type CommandBuilder = CommandData & {
	/** Sets the description for this subcommand. */
	description<T extends Partial<CommandBuilder>>(this:T, description:string):
		Omit<T, "description" | "~description"> & { "~description": string };
	/** Adds additional names that can be used to run this subcommand. */
	aliases<T extends Partial<CommandBuilder>>(this:T, ...aliases:string[]):
		Omit<T, "aliases">;
	/** Makes this subcommand the default command, which will be invoked if the user does not specify a subcommand. Only one subcommand can be marked as the default one. */
	default<T extends Partial<CommandBuilder>>(this:T):
		Omit<T, "default">;
	/** Defines the type of the parameters this command accepts. */
	args
	<
		TThis extends Partial<CommandBuilder>,
		const TNamedArgs extends Record<string, NamedArgData>,
		const TPositionalArgs extends PositionalArgOptions[],
	>(this:TThis, argOptions:ArgOptions<TNamedArgs, TPositionalArgs>):
		Omit<TThis, "description" | "aliases" | "args"> & {
			/**
			 * Sets the function that will be called when this command is run.
			 * 
			 * Return value handling:
			 * - If the function returns an exit code (sync or async), the app will be closed immediately with that exit code.
			 * - If the function returns undefined (sync or async), cli-app will do nothing, and NodeJS's standard behavior will occur.
			 */
			impl(this:CommandData, impl:CommandHandler<TNamedArgs, TPositionalArgs>):void;
		};
};
/** The initial state of the command builder, with defaults. */
type CommandBuilderInitial = CommandBuilder & {
	readonly "~default": false;
};

//#endregion
//#region Arg builder

/** The data that gets filled out by the named argument builder. */
type NamedArgData = {
	//Properties are prefixed with ~ because it is sorted after all alphabetic characters, so the intellisense list suggests functions first.
	/** Please use the builder methods instead of this property. */ readonly "~optional": boolean;
	/** Please use the builder methods instead of this property. */ readonly "~valueless": boolean;
	/** Please use the builder methods instead of this property. */ readonly "~default": string | undefined;
	/** Please use the builder methods instead of this property. */ readonly "~description": string | undefined;
	/** Please use the builder methods instead of this property. */ readonly "~aliases": string[];
};
/** Contains functions that use the builder pattern to produce a {@link NamedArgData}. */
type NamedArgBuilder = NamedArgData & {
	/** Sets the description for this named argument. Used in help messages. */
	description<T extends Partial<NamedArgBuilder>, const V extends string>(this:T, description:V):
		Omit<T, "description"> & { "~description": V; };
	/**
	 * Marks this named argument as optional.
	 * Named arguments are required by default.
	 * 
	 * The value provided to the command handler will be a string if one was passed, `undefined` if it was omitted, and `null` if the argument was specified without a value.
	 */
	optional<T extends Partial<NamedArgBuilder>>(this:T):
		Omit<T, "optional" | "required" | "default" | "~optional" | "valueless"> & { "~optional": true; };
	/**
	 * Marks this valueless named argument as required.
	 * This will force the user to pass this named argument. Useful for confirmations, like "--potentially-destructive-action".
	 * 
	 * The value provided to the command handler will be of type `true` and can be ignored. 
	 */
	required<T extends Partial<NamedArgBuilder> & { "~valueless": true; }>(this:T):
		Omit<T, "optional" | "required" | "default" | "~optional" | "valueless"> & { "~optional": false; };
	/**
	 * Marks this named argument as valueless.
	 * For example: the "verbose" option doesn't accept a value, so the command `app --verbose value1` can be parsed as `app value1 --verbose`, not `app --verbose=value1`.
	 * The provided to the handler will be `true` if this argument was specified, and `false` otherwise.
	 */
	valueless<T extends Partial<NamedArgBuilder>>(this:T):
		Omit<T, "valueless" | "optional" | "~valueless" | "~optional" | "default"> & { "~valueless": true; "~optional": true; } & Pick<NamedArgBuilder, "required">;
	/**
	 * Specifies a default value for this named argument. If the user does not specify a value for this named argument, the default value will be used.
	 * 
	 * Also marks this argument as optional.
	 */
	default<T extends Partial<NamedArgBuilder>, const V extends string>(this:T, value:V):
		Omit<T, "default" | "~default" | "~optional" | "optional" | "required" | "valueless"> & { "~default": V; "~optional": true; };
	/**
	 * Specifies aliases for this named argument. Providing one single-character alias is recommended.
	 */
	aliases<T extends Partial<NamedArgBuilder>>(this:T, ...aliases:string[]):
		Omit<T, "aliases" | "~aliases"> & { "~aliases": string[]; };
};
/** The initial state of the named argument builder, with defaults. */
type NamedArgBuilderInitial = Omit<NamedArgBuilder, "required"> & {
	//Properties are prefixed with ~ because it is sorted after all alphabetic characters, so the intellisense list suggests functions first.
	/** Please use the builder methods instead of this property. */ readonly "~optional": false;
	/** Please use the builder methods instead of this property. */ readonly "~valueless": false;
};
/** Helper function to define a named argument. Uses the builder pattern. */
export const arg:() => NamedArgBuilderInitial = (() => {
	const ArgBuilderPrototype: PickFunctionProperties<NamedArgBuilder> = {
		description(description){
			return { ...this, "~description": description, __proto__: ArgBuilderPrototype };
		},
		optional(){
			return { ...this, "~optional": true, __proto__: ArgBuilderPrototype };
		},
		required(){
			return { ...this, "~optional": false, __proto__: ArgBuilderPrototype };
		},
		valueless(){
			//Assertion: the required() function is still on the prototype chain
			return { ...this, "~valueless": true, "~optional": true, __proto__: ArgBuilderPrototype } as never;
		},
		default(value){
			return { ...this, "~default": value, "~optional": true, __proto__: ArgBuilderPrototype };
		},
		aliases(...aliases){
			return { ...this, "~aliases": aliases, __proto__: ArgBuilderPrototype };
		},
	};
	return () => ({
		__proto__: ArgBuilderPrototype,
		"~default": undefined,
		"~description": undefined,
		"~optional": false,
		"~valueless": false,
		"~aliases": [],
	} satisfies OmitFunctionProperties<NamedArgBuilderInitial> & { __proto__: unknown; } as never as OmitFunctionProperties<NamedArgBuilderInitial> & typeof ArgBuilderPrototype);
})();
//#endregion
//#region Main logic
/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export class Application {
	/** Stores all subcommands. */
	commands: Record<string, Subcommand> = {};
	/** Stores all command aliases. */
	aliases: Record<string, string> = {};
	/** The default subcommand, which is run if the user does not specify a subcommand. */
	defaultSubcommand: Subcommand;
	/** The directory containing this application's main file. Uses slash or backslash dependent on platform. */
	public sourceDirectory: string;
	private currentRunOptions: ApplicationRunOptions | null = null;
	constructor(
		/** The name used to run this application. Will be used in error suggestions. */
		public name: string,
		/** A description for this application. Will be used in help messages. */
		public description: string,
		public options: {
			/**
			 * If provided, this is joined to the end of the directory containing the executed file when determining source directory.
			 * Example: if the main file's path is `/foo/app/build/cli.js` and the source directory suffix is `..`,
			 * the source directory will be `/foo/app` instead of `/foo/app/build`.
			 */
			sourceDirectorySuffix?: string;
		} = {}
	){
		const helpCommand = new Subcommand(
			"help",
			this.runHelpCommand.bind(this),
			"Displays help information about all subcommands or a specific subcommand.",
			{
				positionalArgs: [{
					name: "subcommand",
					description: "The subcommand to get information about.",
					optional: true
				}],
				namedArgs: {},
				positionalArgCountCheck: "ignore",
				unexpectedNamedArgCheck: "warn",
			}
		);
		this.commands["help"] = helpCommand;
		this.defaultSubcommand = helpCommand;
		this.sourceDirectory = "null";
	}
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
	command(name:string):CommandBuilder;
	command(name:string, description:string):Omit<CommandBuilder, "description"> & { "~description": string };
	command(name:string, description?:string):Omit<CommandBuilder, "description"> {
		const app = this;
		const CommandBuilderPrototype: PickFunctionProperties<CommandBuilder> = {
			description(description){
				return { ...this, "~description": description, __proto__: CommandBuilderPrototype };
			},
			aliases(...aliases) {
				return { ...this, "~aliases": aliases, __proto__: CommandBuilderPrototype };
			},
			default() {
				return { ...this, "~default": true, __proto__: CommandBuilderPrototype };
			},
			args(argOptions){
				return {
					...this,
					impl(impl){
						if(app.commands[name]) invalidConfig(`Cannot register a subcommand with name "${name}" because there is already a subcommand with that name`);
						const subcommand = new Subcommand(this["~name"], impl, this["~description"], argOptions, this["~default"]);
						app.commands[name] = subcommand;
						if(this["~default"]) app.defaultSubcommand = subcommand;
						this["~aliases"].forEach(alias => app.aliases[alias] = name);
					}
				};
			},
		};
		const builder:CommandBuilder = ({
			__proto__: CommandBuilderPrototype,
			"~name": name,
			"~default": false,
			"~description": description,
			"~aliases": [],
		} satisfies OmitFunctionProperties<CommandBuilderInitial> & { __proto__: unknown; } as never as OmitFunctionProperties<CommandBuilderInitial> & typeof CommandBuilderPrototype);
		return builder;
	}
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
	onlyCommand(){
		if(Object.keys(this.commands).length > 1)
			invalidConfig(`onlyCommand() is not valid here: there are already other commands defined`);
		return this.command(this.name, this.description).default().aliases();
	}
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
	category(name:string, description:string, callback:(app:Omit<Application, "onlyCommand" | "run">) => unknown){
		const category = new Application(`${this.name} ${name}`, description);
		this.command(name).description(description).args({
			unexpectedNamedArgCheck: "ignore",
			positionalArgCountCheck: "ignore",
			allowHelpNamedArg: false,
		}).impl((opts, app) => {
			return category.run(opts.nodeArgs.concat(opts.unparsedArgs), this.currentRunOptions!);
		});
		this.commands[name]!.subcategoryApp = category;
		callback(category);
		return this;
	}
	/** Creates an alias for a subcommand. */
	alias(alias:string, target:string){
		this.aliases[alias] = target;
		return this;
	}
	/** Returns the name of this application's only command, if it exists. If there are zero or multiple commands, returns undefined. */
	getOnlyCommand():string | undefined {
		const commands = Object.entries(this.commands).filter(([name, command]) => name != "help");
		if(commands.length == 1){
			const [name, command] = commands[0]!;
			if(name == this.name) return name;
		}
		return undefined;
	}
	/** Runs the help command for this application. Do not call directly. */
	private runHelpCommand(opts:Expand<ComputeOptions<Record<string, NamedArgData>>>):number {
		const firstPositionalArg = opts.positionalArgs[0] ?? this.getOnlyCommand();
		if(firstPositionalArg){
			const commandName = this.commands[firstPositionalArg] ? firstPositionalArg : this.aliases[firstPositionalArg] ?? firstPositionalArg;
			const command = this.commands[commandName];
			if(command){
				if(command.subcategoryApp){
					return command.subcategoryApp.runHelpCommand({
						commandName: "help",
						namedArgs: opts.namedArgs,
						nodeArgs: opts.nodeArgs,
						unparsedArgs: opts.unparsedArgs,
						positionalArgs: opts.positionalArgs.slice(1),
					});
				}
				const aliases = Object.entries(this.aliases).filter(([alias, name]) => name == commandName).map(([alias, name]) => alias);
				const positionalArgsFragment =
					command.argOptions.positionalArgs.map(opt =>
						opt.optional ? `[<${opt.name}>]` : `<${opt.name}>`
					).join(" ");
				const namedArgsFragment =
					Object.entries(command.argOptions.namedArgs)
						.map(([name, opt]) =>
							opt["~optional"] ?
								`[--${name}${opt["~valueless"] ? `` : ` <${name}>`}]`
							: `--${name}${opt["~valueless"] ? `` : ` <${name}>`}`
						).join(" ");
				const outputText = new StringBuilder()
					.addLine()
					.addLine(`Help for ${this.getOnlyCommand() ? "command" : "subcommand"} ${command.name}:`)
					.addLine(command.description)
					.add((this.name == command.name && command.defaultCommand) ? `Usage: ${this.name}` : `Usage: ${this.name} ${command.name}`)
					.addWord(namedArgsFragment)
					.addWord(positionalArgsFragment)
					.addWord(command.argOptions.positionalArgsText)
					.addLine()
					.addLine();

				if(Object.entries(command.argOptions.namedArgs).length != 0){
					Object.entries(command.argOptions.namedArgs)
						.map(([name, opt]) =>
							opt["~description"] ? `<${name}>: ${opt["~description"]}` : `<${name}>`
						).forEach(line => outputText.addLine(line));
					outputText.addLine();
				}

				if(command.argOptions.positionalArgs.length != 0){
					command.argOptions.positionalArgs
						.map((opt) =>
							opt.description ? `<${opt.name}>: ${opt.description}` : `<${opt.name}>`
						).forEach(line => outputText.addLine(line));
					outputText.addLine();
				}

				outputText.addLine(aliases.length != 0, `Aliases: ${aliases.join(", ")}`);
				process.stdout.write(outputText.text());
			} else {
				console.log(`Unknown subcommand ${firstPositionalArg}. Run ${this.name} help for a list of all commands.`);
			}
		} else {
			console.log(
`${this.name}: ${this.description}

Usage: ${this.name} [subcommand] [options]
	List of all subcommands:
`
			);
			for(const command of Object.values(this.commands)){
				console.log(`\t${command.name}: ${command.description ?? "No description provided."}`);
			}
			for(const [alias, name] of Object.entries(this.aliases)){
				console.log(`\t${alias}: alias for ${name}`);
			}

		}
		return 0;
	}
	
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
	static parseArgs(providedArgs:readonly string[], valuelessOptions:readonly string[] = []):{
		namedArgs: Record<string, string | boolean | undefined | null>;
		positionalArgs: string[];
		/** Set if the first argument passed is a positional argument. */
		firstPositionalArg: string | undefined;
	} {
		const __nameEqualsValue = /^--([\s\S]+?)=([\s\S]*?)$/;
		const __name = /^--([\s\S]+)/;
		const _name = /^-(\w+)/;

		const namedArgs: Record<string, string | null> = {};
		const positionalArgs:string[] = [];
		const args = providedArgs.slice();
		let firstPositionalArg: string | undefined = undefined;
		for(let i = 1 ;; i ++){

			const arg = args.shift(); //Grab the first arg
			if(arg == undefined) break; //If it doesn't exist, return

			let matchResult;
			if(arg == "--"){ //Arg separator
				//Everything else should be considered a positional argument
				positionalArgs.push(arg, ...args);
				break;
			} else if((matchResult = arg.match(__nameEqualsValue) as [string, string, string] | null)){ //--name=value form
				const [, name, value] = matchResult;
				namedArgs[name] = value;
			} else if((matchResult = arg.match(__name) as [string, string] | null)){ //Starts with two hyphens
				const argName = matchResult[1];
				if(args[0]?.startsWith("-") || valuelessOptions.includes(argName)){
					//If the next arg also starts with a hyphen, or the arg name is valueless, set it to null
					namedArgs[argName] = null;
				} else {
					//Otherwise, pop off the first arg and set it to that
					namedArgs[argName] = args.shift() ?? null;
				}
			} else if((matchResult = arg.match(_name) as [string, string] | null)){ //Starts with one hyphen
				const argName = matchResult[1];
				//Compound arg form:
				//iftop -nPNi eth0 means
				//iftop -n -P -N -i eth0
				const shortArgs = [...argName];
				const lastShortArg = shortArgs.pop()!; //\w+ means at least one character must have matched
				if(args[0]?.startsWith("-") || valuelessOptions.includes(lastShortArg)){
					//If the next arg also starts with a hyphen, or the arg name is valueless, set it to null
					namedArgs[lastShortArg] = null;
				} else {
					//Otherwise, pop off the first arg and set it to that
					namedArgs[lastShortArg] = args.shift() ?? null;
				}
				for(const arg of shortArgs){
					namedArgs[arg] = null;
				}
			} else {
				//It's a positional arg
				positionalArgs.push(arg);
				if(i == 1){
					firstPositionalArg = arg;
				}
			}
		}
		return {
			positionalArgs,
			namedArgs,
			firstPositionalArg
		};
	}
	/**
	 * Runs an application.
	 * @param args Pass process.argv without modifying it.
	 * @param options Used for testing.
	 */
	public async run(rawArgs:readonly string[], runOptions:ApplicationRunOptions = {}):Promise<void> {
		//This function does as little work as possible, and calls Subcommand.run()
		
		if(rawArgs.length < 2) crash(`Application.run() received invalid argv: process.argv should start with "node path/to/filename.js"`);
		const nodeArgs = rawArgs.slice(0, 2) as [string, string];
		const {
			setProcessExitCodeOnHandlerReturn = true,
			throwOnError = false,
		} = runOptions;

		this.currentRunOptions = runOptions;
		this.sourceDirectory = path.join(fs.realpathSync(rawArgs[1]!), "..", this.options.sourceDirectorySuffix ?? "");

		//We need to do some argument parsing to determine which subcommand to run
		//but, once the subcommand has been determined, valueless args may change the parse result
		//solution: parse args twice
		//this can lead to ambiguous commands: `command --valueless parameter subcommand`
		//solution: do not allow named arguments before the subcommand name
		const args = rawArgs.slice(2);
		const { namedArgs, firstPositionalArg } = Application.parseArgs(args);
		//Set "help" to the default command: if someone runs `command nonexistentsubcommand ...rest`,
		//it will get interpreted as `command help nonexistentsubcommand ...rest`, which will generate the correct error message.

		let [newArgs, command]:readonly [string[], Subcommand] = (() => {
			if(firstPositionalArg && this.commands[firstPositionalArg]){
				return [args.slice(1), this.commands[firstPositionalArg]];
			} else if(firstPositionalArg && this.aliases[firstPositionalArg]){
				return [args.slice(1), this.commands[this.aliases[firstPositionalArg]]
					?? invalidConfig(`Subcommand "${firstPositionalArg}" was aliased to ${this.aliases[firstPositionalArg]}, which is not a valid subcommand`)];
			} else return [args, this.defaultSubcommand];
		})();
		if(command.argOptions.allowHelpNamedArg){
			if("help" in namedArgs || "?" in namedArgs){
				command = this.commands["help"]!;
				//Revert removal of the first arg, the help command needs that
				newArgs = args;
			}
		}

		try {
			const result = await command.run(newArgs, nodeArgs, this);
			if(typeof result == "number"){
				if(setProcessExitCodeOnHandlerReturn) process.exitCode = result;
				else if(result != 0) throw new Error(`Non-zero exit code: ${result}`);
			}
		} catch(err){
			if(throwOnError) throw err;
			if(err instanceof ApplicationError){
				console.error(`Error: ${err.message}`);
				if(setProcessExitCodeOnHandlerReturn) process.exitCode = err.exitCode;
			} else {
				console.error("The command encountered an unhandled runtime error.");
				console.error(err);
			}
		}
	}
}

/**
 * Represents one subcommand of an application or script.
 */
export class Subcommand {
	/**
	 * Information describing the command-line options that this subcommand accepts.
	 */
	argOptions:Required<ArgOptions<Record<string, NamedArgData>>>;
	/**
	 * Set to an {@link Application} if this subcommand is a category.
	 */
	subcategoryApp: Application | null = null;
	constructor(
		public name:string,
		public handler:CommandHandler<any, any>, //use any to avoid contravariance
		public description:string | undefined,
		argOptions:ArgOptions<Record<string, NamedArgData>> = {namedArgs: {}, positionalArgs: []},
		public defaultCommand = false,
	){
		//Fill in the provided arg options
		this.argOptions = {
			namedArgs: Object.fromEntries(Object.entries(argOptions.namedArgs ?? {}).map<[string, NamedArgData]>(([key, value]) => [key, {
				"~description": value["~description"] ?? "No description provided",
				"~optional": value["~optional"],
				"~default": value["~default"],
				"~valueless": value["~valueless"],
				"~aliases": value["~aliases"].concat(Object.entries(argOptions.aliases ?? {}).filter(([from, to]) => from == key).map(([from, to]) => to)),
			}])),
			aliases: Object.fromEntries<string>([
				...Object.entries(argOptions.aliases ?? []),
				...Object.entries(argOptions.namedArgs ?? {}).map(([name, opts]) =>
					opts["~aliases"]?.map(alias => [alias, name] as const) ?? []
				).flat(),
			]),
			positionalArgs: (argOptions.positionalArgs ?? []).map((a, i) => ({
				...a,
				default: a.default ?? null,
				optional: a.default ? (
					"optional" in a && invalidConfig(`in subcommand ${name}: positional argument ${i} has a default value, therefore it is optional, but "optional" was specified again. Please delete the redundant property.`),
					true
				) : a.optional ?? false,
			})) ?? [],
			positionalArgCountCheck: argOptions.positionalArgCountCheck ?? "ignore",
			positionalArgsText: argOptions.positionalArgsText ?? "",
			unexpectedNamedArgCheck: argOptions.unexpectedNamedArgCheck ?? "error",
			allowHelpNamedArg: argOptions.allowHelpNamedArg ?? true,
		};

		//Validating named args is not necessary as the command builder already does that

		//Validate positional args
		let optionalArgsStarted = false;
		for(const arg of this.argOptions.positionalArgs){
			if(optionalArgsStarted && !arg.optional) invalidConfig(`in subcommand ${name}: Required positional arguments, or ones with a default value, cannot follow optional ones.`);
			if(arg.optional) optionalArgsStarted = true;
		}
	}
	/** Runs this subcommand. Do not call directly, call the application's run method instead. */
	run(args:readonly string[], nodeArgs:[string, string], application:Application){
		
		if(application.sourceDirectory == "null")
			crash("application.sourceDirectory is null. Don't call subcommand.run() directly.");
		const usageInstructionsMessage = application.getOnlyCommand() != null ?
			`for usage instructions, run ${application.name} --help`
		:	`for usage instructions, run ${application.name} help ${this.name}`;


		const valuelessOptions = Object.entries(this.argOptions.namedArgs)
			.filter(([k, v]) => v["~valueless"])
			.map(([k, v]) => v["~aliases"].concat(k)).flat();
		const { namedArgs, positionalArgs }:{
			namedArgs: Record<string, string | boolean | undefined | null>;
			positionalArgs: Array<string | undefined>;
		} = Application.parseArgs(args, valuelessOptions);


		//Handle positional args
		if(positionalArgs.length > this.argOptions.positionalArgs.length){
			//Count check
			const message = `this subcommand expects at most ${this.argOptions.positionalArgs.length} positional arguments, but ${positionalArgs.length} arguments were passed`;
			if(this.argOptions.positionalArgCountCheck == "error") fail(message + `\n` + usageInstructionsMessage);
			else if(this.argOptions.positionalArgCountCheck == "warn") console.warn(`Warning: ` + message);
		}
		for(const [i, arg] of this.argOptions.positionalArgs.entries()){
			if(i >= positionalArgs.length){
				if(arg.default != null) positionalArgs[i] = arg.default;
				else if(arg.optional) positionalArgs[i] = undefined;
				else fail(
`Missing required positional argument "${arg.name}"
this subcommand expects at least ${this.argOptions.positionalArgs.filter(o => !o.optional).length} positional arguments, but ${positionalArgs.length} arguments were passed
${usageInstructionsMessage}`
				);
			}
		}

		//Handle named args
		Object.entries(namedArgs).forEach(([name, value]) => {
			const aliased = this.argOptions.aliases[name];
			if(aliased){
				namedArgs[aliased] ??= value;
				delete namedArgs[name];
			}
		});
		if(this.argOptions.unexpectedNamedArgCheck != "ignore"){
			Object.entries(namedArgs).forEach(([name, value]) => {
				//excess check
				//If the arg is not in the named arguments or the aliases
				if(!(name in this.argOptions.namedArgs || name in this.argOptions.aliases || name == "help" || name == "?")){
					const message = `Unexpected argument --${name}${value === null ? "" : `=${value!}`}`;
					if(this.argOptions.unexpectedNamedArgCheck == "warn") console.warn(message);
					else if(this.argOptions.unexpectedNamedArgCheck == "error") fail(message + "\n" + usageInstructionsMessage);
				}
			});
		}
		Object.entries(this.argOptions.namedArgs).forEach(([name, opt]) => {
			if(namedArgs[name] == null){ //If the named arg was not specified or was left blank
				if(opt["~default"] != null){ //If it has a default value, set it to that
					namedArgs[name] = opt["~default"];
				} else if(opt["~optional"]) {
					if(!opt["~valueless"]){
						namedArgs[name] = name in namedArgs ? null : undefined;
					}
				} else fail(
					//If it's required, fail with an error
`No value specified for required named argument "${name}".
To specify it, run the command with --${name}${opt["~valueless"] ? "" : " <value>"}
${usageInstructionsMessage}`
				);
			}
			if(opt["~valueless"]){
				//Convert valueless named args to booleans
				namedArgs[name] = (namedArgs[name] === null);
			}
		});

		return this.handler({
			commandName: this.name,
			positionalArgs: positionalArgs as ComputeOptions["positionalArgs"],
			namedArgs,
			unparsedArgs: args,
			nodeArgs,
		}, application);
	}
}
//#endregion

