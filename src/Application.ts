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
	namedArgs:
		{} extends NamedArgsOptions ? {} :
		Record<string, ArgData> extends NamedArgsOptions ? Record<string, string | boolean | undefined | null> :
		NamedArgs<NamedArgsOptions>;
	/**Positional args specified by simply stating them. */
	positionalArgs: (string | undefined)[]; //TODO typedef
	commandName: string;
}

/**Generates the type definition for named args based on given argOptions. */
type NamedArgs<NamedArgOpts extends Record<string, ArgData>> = {
	[K in keyof NamedArgOpts]: NamedArgFrom<NamedArgOpts[K]>;
};

//This code is super cursed. Fix if you know how.
type NamedArgFrom<NamedArgOpt extends ArgData> =
	NamedArgOpt["_valueless"] extends true ?
		NamedArgOpt["_optional"] extends false ? true : (false | true)
	: NamedArgOpt["_optional"] extends true ? NamedArgOpt["_default"] extends string ? string : (string | undefined | null) : string;

export type CommandHandler<T extends Record<string, ArgData>> = 
	(opts: Expand<SpecificOptions<T>>, app: Application) => void | number | Promise<void | number>;



export type CommandData = {
	readonly _name: string;
	readonly _description: string | undefined;
	readonly _default: boolean;
	readonly _aliases: string[];
};
export type CommandBuilder = CommandData & {
	description<T extends Partial<CommandBuilder>>(this:T, description:string):
		Omit<T, "description" | "_description"> & { _description: string };
	aliases<T extends Partial<CommandBuilder>>(this:T, ...aliases:string[]):
		Omit<T, "aliases">;
	default<T extends Partial<CommandBuilder>>(this:T):
		Omit<T, "default">;
	args<TThis extends Partial<CommandBuilder>, const TArgs extends Record<string, ArgData>>(this:TThis, argOptions:ArgOptions<TArgs>):
		Omit<TThis, "description" | "aliases" | "args"> & {
			impl(this:CommandData, impl:CommandHandler<TArgs>):void;
		};
};
type InitialCommandBuilder = CommandBuilder & {
	readonly _default: false;
};



type ArgData = {
	readonly _optional: boolean;
	readonly _valueless: boolean;
	readonly _default: string | undefined;
	readonly _description: string | undefined;
	readonly _aliases: string[];
};
type ArgBuilder = ArgData & {
	description<T extends Partial<ArgBuilder>, const V extends string>(this:T, description:V):
		Omit<T, "description"> & { _description: V; };
	optional<T extends Partial<ArgBuilder>>(this:T):
		Omit<T, "optional" | "required" | "default" | "_optional" | "valueless"> & { _optional: true; };
	required<T extends Partial<ArgBuilder>>(this:T):
		Omit<T, "optional" | "required" | "default" | "_optional" | "valueless"> & { _optional: false; };
	valueless<T extends Partial<ArgBuilder>>(this:T):
		Omit<T, "valueless" | "_valueless" | "_optional"> & { _valueless: true; _optional: true; };
	default<T extends Partial<ArgBuilder>, const V extends string>(this:T, value:V):
		Omit<T, "default" | "_default" | "_optional" | "optional" | "required"> & { _default: V; _optional: true; };
	aliases<T extends Partial<ArgBuilder>>(this:T, ...aliases:string[]):
		Omit<T, "aliases" | "_aliases"> & { _aliases: string[]; };
};
type InitialArgBuilder = ArgBuilder & {
	readonly _optional: false;
	readonly _valueless: false;
};
export const arg:() => InitialArgBuilder = (() => {
	const ArgBuilderPrototype: PickFunctionProperties<ArgBuilder> = {
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
	} satisfies OmitFunctionProperties<InitialArgBuilder> & { __proto__: any; } as never as OmitFunctionProperties<InitialArgBuilder> & typeof ArgBuilderPrototype);
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
	sourceDirectory:string;
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
	 * @param handler The function that is called when this subcommand is run.
	 * Return value handling:
	 * - If the function returns an exit code (sync or async), the app will be closed immediately with that exit code.
	 * - If the function returns undefined (sync or async), cli-app will do nothing, and NodeJS's standard behavior will occur.
	 * @param argOptions Specifies the args that can be passed to this subcommand through the command line.
	 * @param aliases List of alternative names for this command.
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
		} satisfies OmitFunctionProperties<InitialCommandBuilder> & { __proto__: any; } as never as OmitFunctionProperties<InitialCommandBuilder> & typeof CommandBuilderPrototype);
		return builder;
	}
	/** Creates an alias for a subcommand. */
	alias(alias:string, target:string){
		this.aliases[alias] = target;
		return this;
	}
	/** Runs the help command for this application. Do not call directly. */
	runHelpCommand(opts:Expand<SpecificOptions<Record<string, ArgData>>>):number {
		if(!(this instanceof Application)){
			throw new ApplicationError("application.runHelpCommand was bound incorrectly. This is most likely an error with cli-app.");
		}
		if(opts.positionalArgs[0]){
			const commandName = this.commands[opts.positionalArgs[0]] ? opts.positionalArgs[0] : this.aliases[opts.positionalArgs[0]] ?? opts.positionalArgs[0];
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

					.add(`Usage: ${this.name} ${command.name}`)
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
				console.log(`Unknown command ${opts.positionalArgs[0]}. Run ${this.name} help for a list of all commands.`);
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
	async run(rawArgs:string[], {
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
		const [newArgs, command]:[string[], Subcommand] = (() => {
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
	argOptions:Required<ArgOptions<Record<string, ArgData>>>;
	constructor(
		public name:string,
		public handler:CommandHandler<any>,
		public description:string = "No description provided",
		argOptions:ArgOptions<Record<string, ArgData>> = {namedArgs: {}, positionalArgs: []},
		public defaultCommand:boolean = false
	){
		//Fill in the provided arg options
		this.argOptions = {
			namedArgs: Object.fromEntries(Object.entries(argOptions.namedArgs ?? {}).map<[string, ArgData]>(([key, value]) => [key, {
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
	run(args:string[], application:Application){
		
		if(application.sourceDirectory == "null")
			crash("application.sourceDirectory is null. Don't call subcommand.run() directly.");
		const usageInstructionsMessage = `for usage instructions, run ${application.name} help ${this.name}`;


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

