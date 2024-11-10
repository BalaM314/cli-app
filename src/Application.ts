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
import { crash, invalidConfig } from "./funcs.js";

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
export interface PositionalArgOptions {
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
}

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
export interface ComputeOptions<TNamedArgs extends Record<string, NamedArgData> = Record<string, NamedArgData>> {
	/** All named args specified with --name value. */
	readonly namedArgs:
		{} extends TNamedArgs ? {} :
		Record<string, NamedArgData> extends TNamedArgs ? Record<string, string | boolean | undefined | null> :
		NamedArgs<TNamedArgs>;
	/** Positional args specified by simply stating them. */
	readonly positionalArgs: (string | undefined)[]; //TODO typedef
	readonly commandName: string;
}

type NamedArgs<NamedArgOpts extends Record<string, NamedArgData>> = {
	[K in keyof NamedArgOpts]: NamedArgFrom<NamedArgOpts[K]>;
};

type NamedArgFrom<NamedArgOpt extends NamedArgData> =
	NamedArgOpt["_valueless"] extends true ?
		NamedArgOpt["_optional"] extends false ? true : (false | true)
	: NamedArgOpt["_optional"] extends true ? NamedArgOpt["_default"] extends string ? string : (string | undefined | null) : string;

export type CommandHandler<T extends Record<string, NamedArgData>> = 
	(opts: Expand<ComputeOptions<T>>, app: Application) => void | number | Promise<void | number>;


//Command builder
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
	description<T extends Partial<CommandBuilder>>(this:T, description:string):
		Omit<T, "description" | "_description"> & { _description: string };
	/** Adds additional names that can be used to run this subcommand. */
	aliases<T extends Partial<CommandBuilder>>(this:T, ...aliases:string[]):
		Omit<T, "aliases">;
	/** Makes this subcommand the default command, which will be invoked if the user does not specify a subcommand. Only one subcommand can be marked as the default one. */
	default<T extends Partial<CommandBuilder>>(this:T):
		Omit<T, "default">;
	/** Defines the type of the parameters this command accepts. */
	args<TThis extends Partial<CommandBuilder>, const TArgs extends Record<string, NamedArgData>>(this:TThis, argOptions:ArgOptions<TArgs>):
		Omit<TThis, "description" | "aliases" | "args"> & {
			/**
			 * Sets the function that will be called when this command is run.
			 * 
			 * Return value handling:
			 * - If the function returns an exit code (sync or async), the app will be closed immediately with that exit code.
			 * - If the function returns undefined (sync or async), cli-app will do nothing, and NodeJS's standard behavior will occur.
			 */
			impl(this:CommandData, impl:CommandHandler<TArgs>):void;
		};
};
/** The initial state of the command builder, with defaults. */
type CommandBuilderInitial = CommandBuilder & {
	readonly _default: false;
};


//Arg builder
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
	description<T extends Partial<NamedArgBuilder>, const V extends string>(this:T, description:V):
		Omit<T, "description"> & { _description: V; };
	optional<T extends Partial<NamedArgBuilder>>(this:T):
		Omit<T, "optional" | "required" | "default" | "_optional" | "valueless"> & { _optional: true; };
	required<T extends Partial<NamedArgBuilder>>(this:T):
		Omit<T, "optional" | "required" | "default" | "_optional" | "valueless"> & { _optional: false; };
	valueless<T extends Partial<NamedArgBuilder>>(this:T):
		Omit<T, "valueless" | "_valueless" | "_optional"> & { _valueless: true; _optional: true; };
	default<T extends Partial<NamedArgBuilder>, const V extends string>(this:T, value:V):
		Omit<T, "default" | "_default" | "_optional" | "optional" | "required"> & { _default: V; _optional: true; };
	aliases<T extends Partial<NamedArgBuilder>>(this:T, ...aliases:string[]):
		Omit<T, "aliases" | "_aliases"> & { _aliases: string[]; };
};
/** The initial state of the named argument builder, with defaults. */
type NamedArgBuilderInitial = NamedArgBuilder & {
	readonly _optional: false;
	readonly _valueless: false;
};
/** Helper function to define a named argument. Uses the builder pattern. */
export const arg:() => NamedArgBuilderInitial = (() => {
	const ArgBuilderPrototype: PickFunctionProperties<NamedArgBuilder> = {
		description(description){
			return { ...this, _description: description, __proto__: ArgBuilderPrototype };
		},
		optional(){
			return { ...this, _optional: true, __proto__: ArgBuilderPrototype };
		},
		required(){
			return { ...this, _optional: false, __proto__: ArgBuilderPrototype };
		},
		valueless(){
			return { ...this, _valueless: true, _optional: true, __proto__: ArgBuilderPrototype };
		},
		default(value){
			return { ...this, _default: value, _optional: true, __proto__: ArgBuilderPrototype };
		},
		aliases(...aliases){
			return { ...this, _aliases: aliases, __proto__: ArgBuilderPrototype };
		},
	};
	return () => ({
		__proto__: ArgBuilderPrototype,
		_default: undefined,
		_description: undefined,
		_optional: false,
		_valueless: false,
		_aliases: [],
	} satisfies OmitFunctionProperties<NamedArgBuilderInitial> & { __proto__: any; } as never as OmitFunctionProperties<NamedArgBuilderInitial> & typeof ArgBuilderPrototype);
})();

/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export class Application {
	/** Stores all subcommands. */
	commands: Record<string, Subcommand | undefined> = {};
	/** Stores all command aliases. */
	aliases: {
		[alias: string]: string;
	} = {};
	/** The directory containing this application's main file. Uses slash or backslash dependent on platform. */
	public sourceDirectory:string;
	constructor(
		/** The name used to run this application. Will be used in error suggestions. */
		public name:string,
		public description:string
	){
		this.commands["help"] = new Subcommand(
			"help",
			this.runHelpCommand.bind(this),
			"Displays help on all commands or a specific subcommand.",
			{
				positionalArgs: [{
					name: "command",
					description: "The command to get help on.",
					optional: true
				}],
				namedArgs: {},
				positionalArgCountCheck: "ignore",
				unexpectedNamedArgCheck: "warn",
			}
		);
		this.sourceDirectory = "null";
	}
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
	command(name:string):CommandBuilder;
	command(name:string, description:string):Omit<CommandBuilder, "description"> & { _description: string };
	command(name:string, description?:string):Omit<CommandBuilder, "description"> {
		const app = this;
		const CommandBuilderPrototype: PickFunctionProperties<CommandBuilder> = {
			description(description){
				return { ...this, _description: description, __proto__: CommandBuilderPrototype };
			},
			aliases(...aliases) {
				return { ...this, _aliases: aliases, __proto__: CommandBuilderPrototype };
			},
			default() {
				return { ...this, _default: true, __proto__: CommandBuilderPrototype };
			},
			args(argOptions){
				return {
					...this,
					impl(impl){
						app.commands[name] = new Subcommand(this._name, impl, this._description, argOptions, this._default);
						this._aliases.forEach(alias => app.aliases[alias] = name);
					}
				};
			},
		};
		const builder:CommandBuilder = ({
			__proto__: CommandBuilderPrototype,
			_name: name,
			_default: false,
			_description: description,
			_aliases: [],
		} satisfies OmitFunctionProperties<CommandBuilderInitial> & { __proto__: any; } as never as OmitFunctionProperties<CommandBuilderInitial> & typeof CommandBuilderPrototype);
		return builder;
	}
	/**
	 * Same as {@link command()}, but for applications with only one subcommand. This will slightly change the display of help messages.
	 */
	onlyCommand(){
		if(Object.keys(this.commands).length > 1) invalidConfig(`onlyCommand() is not valid here: there are already other commands defined`);
		return this.command(this.name, this.description).default();
	}
	/** Creates an alias for a subcommand. */
	alias(alias:string, target:string){
		this.aliases[alias] = target;
		return this;
	}
	getOnlyCommand():string | undefined {
		const commands = Object.keys(this.commands).filter(c => c != "help");
		if(commands.length == 1) return commands[0];
		else return undefined;
	}
	/** Runs the help command for this application. Do not call directly. */
	private runHelpCommand(opts:Expand<ComputeOptions<Record<string, NamedArgData>>>):number {
		const firstPositionalArg = opts.positionalArgs[0] ?? this.getOnlyCommand();
		if(firstPositionalArg){
			const commandName = this.commands[firstPositionalArg] ? firstPositionalArg : this.aliases[firstPositionalArg] ?? firstPositionalArg;
			const command = this.commands[commandName];
			if(command){
				const aliases = Object.entries(this.aliases).filter(([alias, name]) => name == commandName).map(([alias, name]) => alias);
				const positionalArgsFragment =
					command.argOptions.positionalArgs.map(opt =>
						opt.optional ? `[<${opt.name}>]` : `<${opt.name}>`
					).join(" ");
				const namedArgsFragment =
					Object.entries(command.argOptions.namedArgs)
						.map(([name, opt]) =>
							opt._optional ?
								`[--${name}${opt._valueless ? `` : ` <${name}>`}]`
							: `--${name}${opt._valueless ? `` : ` <${name}>`}`
						).join(" ");
				const outputText = new StringBuilder()
					.addLine()
					.addLine(`Help for command ${command.name}:`)

					.add((this.name == command.name && command.defaultCommand) ? `Usage: ${this.name}` : `Usage: ${this.name} ${command.name}`)
					.addWord(positionalArgsFragment)
					.addWord(namedArgsFragment)
					.add("\n")
					.addLine();

				if(Object.entries(command.argOptions.namedArgs).length != 0){
					Object.entries(command.argOptions.namedArgs)
						.map(([name, opt]) =>
							`<${name}>: ${opt._description}`
						).forEach(line => outputText.addLine(line));
					outputText.addLine();
				}

				if(command.argOptions.positionalArgs.length != 0){
					command.argOptions.positionalArgs
						.map((opt) =>
							`<${opt.name}>: ${opt.description}`
						).forEach(line => outputText.addLine(line));
					outputText.addLine();
				}

				outputText.addLine(aliases.length != 0, `Aliases: ${aliases.join(", ")}`);
				process.stdout.write(outputText.text());
			} else {
				console.log(`Unknown command ${firstPositionalArg}. Run ${this.name} help for a list of all commands.`);
			}
		} else {
			console.log(
`${this.name}: ${this.description}

Usage: ${this.name} [command] [options]
	List of all commands:
`
			);
			for(const command of Object.values(this.commands)){
				console.log(`\t${command?.name}: ${command?.description}`);
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
	 * @returns Formatted args.
	 */
	static parseArgs(providedArgs:readonly string[], valuelessOptions:readonly string[] = []):{
		namedArgs: Record<string, string | boolean | undefined | null>;
		positionalArgs: string[];
		/** Set if the first argument passed is a positional argument. */
		firstPositionalArg: string | undefined;
	} {
		const namedArgs: Record<string, string | null> = {};
		const positionalArgs:string[] = [];
		let i = 0;
		const args = providedArgs.slice();
		let firstPositionalArg: string | undefined = undefined;
		while(true){
			i++;
			if(i > 1000) throw new ApplicationError("Too many arguments!");

			const arg = args.shift(); //Grab the first arg
			if(arg == undefined) break; //If it doesn't exist, return
			if(arg == "--"){ //Arg separator
				//Everything else should be considered a positional argument
				positionalArgs.push(arg, ...args);
				break;
			} else if(arg.match(/^--([\s\S]+?)=([\s\S]+?)$/)){ //--name=value form
				const [, name, value] = arg.match(/^--([\s\S]+?)=([\s\S]+?)$/)!;
				namedArgs[name] = value;
			} else if(arg.match(/^--([\s\S]+)/)){ //Starts with two hyphens
				const argName = arg.match(/^--([\s\S]+)/)![1];
				if(args[0]?.startsWith("-") || valuelessOptions.includes(argName)){
					//If the next arg also starts with a hyphen, or the arg name is valueless, set it to null
					namedArgs[argName] = null;
				} else {
					//Otherwise, pop off the first arg and set it to that
					namedArgs[argName] = args.shift() ?? null;
				}
			} else if(arg.match(/^-(\w+)/)){ //Starts with one hyphen
				const argName = arg.match(/^-(\w+)/)![1];
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
	public async run(rawArgs:readonly string[], {
		exitProcessOnHandlerReturn = true,
		throwOnError = false,
	}:ApplicationRunOptions = {}):Promise<void> {
		//This function does as little work as possible, and calls Subcommand.run()
		this.sourceDirectory = path.join(fs.realpathSync(rawArgs[1]), "..");

		//We need to do some argument parsing to determine which subcommand to run
		//but, once the subcommand has been determined, valueless args may change the parse result
		//solution: parse args twice
		//this can lead to ambiguous commands: `command --valueless parameter subcommand`
		//solution: do not allow named arguments before the subcommand name
		const args = rawArgs.slice(2);
		const { namedArgs, firstPositionalArg } = Application.parseArgs(args);
		//Set "help" to the default command: if someone runs `command nonexistentsubcommand ...rest`,
		//it will get interpreted as `command help nonexistentsubcommand ...rest`, which will generate the correct error message.
		const defaultCommand = Object.values(this.commands).filter(command => command?.defaultCommand)[0] ?? this.commands["help"]!; //TODO compute in .command()
		const [newArgs, command]:readonly [string[], Subcommand] = (() => {
			if("help" in namedArgs || "?" in namedArgs){
				return [args, this.commands["help"]!];
			} else if(firstPositionalArg && this.commands[firstPositionalArg]){
				return [args.slice(1), this.commands[firstPositionalArg]];
			} else if(firstPositionalArg && this.aliases[firstPositionalArg]){
				return [args.slice(1), this.commands[this.aliases[firstPositionalArg]]
					?? invalidConfig(`Subcommand "${firstPositionalArg}" was aliased to ${this.aliases[firstPositionalArg]}, which is not a valid command`)];
			} else return [args, defaultCommand];
		})();

		try {
			const result = await command.run(newArgs, this);
			if(typeof result == "number"){
				if(exitProcessOnHandlerReturn) process.exit(result);
				else if(result != 0) throw new Error(`Non-zero exit code: ${result}`);
			}
		} catch(err){
			if(throwOnError) throw err;
			if(err instanceof ApplicationError){
				console.error(`Error: ${err.message}`);
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
	constructor(
		public name:string,
		public handler:CommandHandler<any>,
		public description:string = "No description provided",
		argOptions:ArgOptions<Record<string, NamedArgData>> = {namedArgs: {}, positionalArgs: []},
		public defaultCommand:boolean = false
	){
		//Fill in the provided arg options
		this.argOptions = {
			namedArgs: Object.fromEntries(Object.entries(argOptions.namedArgs ?? {}).map<[string, NamedArgData]>(([key, value]) => [key, {
				_description: value._description ?? "No description provided",
				_optional: value._optional,
				_default: value._default,
				_valueless: value._valueless,
				_aliases: value._aliases.concat(Object.entries(argOptions.aliases ?? {}).filter(([from, to]) => from == key).map(([from, to]) => to)),
			}])),
			aliases: Object.fromEntries<string>([
				...Object.entries(argOptions.aliases ?? []),
				...Object.entries(argOptions.namedArgs ?? {}).map(([name, opts]) =>
					opts._aliases?.map(alias => [alias, name] as const) ?? []
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
			unexpectedNamedArgCheck: argOptions.unexpectedNamedArgCheck ?? "error",
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
	run(args:readonly string[], application:Application){
		
		if(application.sourceDirectory == "null")
			crash("application.sourceDirectory is null. Don't call subcommand.run() directly.");
		const usageInstructionsMessage = application.getOnlyCommand() != null ?
			`for usage instructions, run ${application.name} --help`
		:	`for usage instructions, run ${application.name} help ${this.name}`;


		const valuelessOptions = Object.entries(this.argOptions.namedArgs)
			.filter(([k, v]) => v._valueless)
			.map(([k, v]) => v._aliases.concat(k)).flat();
		const { namedArgs, positionalArgs }:{
			namedArgs: Record<string, string | boolean | undefined | null>;
			positionalArgs: (string | undefined)[];
		} = Application.parseArgs(args, valuelessOptions);


		//Handle positional args
		if(positionalArgs.length > this.argOptions.positionalArgs.length){
			//Count check
			const message = `this command expects at most ${this.argOptions.positionalArgs.length} positional arguments, but ${positionalArgs.length} arguments were passed`;
			if(this.argOptions.positionalArgCountCheck == "error") throw new ApplicationError(message + `\n` + usageInstructionsMessage);
			else if(this.argOptions.positionalArgCountCheck == "warn") console.warn(`Warning: ` + message);
		}
		for(const [i, arg] of this.argOptions.positionalArgs.entries()){
			if(i >= positionalArgs.length){
				if(arg.default != null) positionalArgs[i] = arg.default;
				else if(arg.optional) positionalArgs[i] = undefined;
				else throw new ApplicationError(
`Missing required positional argument "${arg.name}"
this command expects at least ${this.argOptions.positionalArgs.filter(o => !o.optional).length} positional arguments, but ${positionalArgs.length} arguments were passed
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
					const message = `Unexpected argument --${name}${value === null ? "" : `=${value}`}`;
					if(this.argOptions.unexpectedNamedArgCheck == "warn") console.warn(message);
					else if(this.argOptions.unexpectedNamedArgCheck == "error") throw new ApplicationError(message + "\n" + usageInstructionsMessage);
				}
			});
		}
		Object.entries(this.argOptions.namedArgs).forEach(([name, opt]) => {
			if(namedArgs[name] == null){ //If the named arg was not specified or was left blank
				if(opt._default != null){ //If it has a default value, set it to that
					namedArgs[name] = opt._default;
				} else if(opt._optional) {
					if(!opt._valueless){
						namedArgs[name] = name in namedArgs ? null : undefined;
					}
				} else throw new ApplicationError(
					//If it's required, fail with an error
`No value specified for required named argument "${name}".
To specify it, run the command with --${name}${opt._valueless ? "" : " <value>"}
${usageInstructionsMessage}`
				);
			}
			if(opt._valueless){
				//Convert valueless named args to booleans
				namedArgs[name] = (namedArgs[name] === null);
			}
		});

		return this.handler({
			commandName: this.name,
			positionalArgs,
			namedArgs,
		}, application);
	}
}

