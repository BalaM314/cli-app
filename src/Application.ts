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
import type { Script } from "./Script.js";
import type { ApplicationRunOptions, ArgOptions, CommandHandler, FilledArgOptions, NamedArgOptions, RequiredRecursive, SpecificOptions } from "./types.js";
import { crash, invalidConfig } from "./funcs.js";

/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export class Application {
	/** Stores all subcommands. */
	commands: Record<string, Subcommand<Application, any> | undefined> = {};
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
	command<A extends Partial<ArgOptions>>(name:string, description:string, handler:CommandHandler<Application, A>, isDefault?:boolean, argOptions?:A, aliases?:string[]):this {
		this.commands[name] = new Subcommand<Application, A>(name, handler, description, {
			namedArgs: argOptions?.namedArgs ?? {},
			positionalArgs: argOptions?.positionalArgs ?? [],
			aliases: argOptions?.aliases ?? {},
			positionalArgCountCheck: argOptions?.positionalArgCountCheck,
			unexpectedNamedArgCheck: argOptions?.unexpectedNamedArgCheck,
		}, isDefault);
		if(aliases) aliases.forEach((alias) => this.alias(alias, name));
		return this;//For daisy chaining
	}
	/** Creates an alias for a subcommand. */
	alias(alias:string, target:string){
		this.aliases[alias] = target;
		return this;
	}
	/** Runs the help command for this application. Do not call directly. */
	runHelpCommand(opts:SpecificOptions<{
		positionalArgs: [{
			name: "command",
			description: "The command to get help on.",
			required: false
		}],
		namedArgs: {}
	}>):number {
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
							opt.optional ?
								`[--${name}${opt.valueless ? `` : ` <${name}>`}]`
							: `--${name}${opt.valueless ? `` : ` <${name}>`}`
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
							`<${name}>: ${opt.description}`
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
		const [newArgs, command]:[string[], Subcommand<Application, any>] = (() => {
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
export class Subcommand<App extends Application | Script<ArgOptions>, A extends Partial<ArgOptions>> {
	/**
	 * Information describing the command-line options that this subcommand accepts.
	 */
	argOptions:FilledArgOptions;
	constructor(
		public name:string,
		public handler:CommandHandler<App, A>,
		public description:string = "No description provided",
		argOptions:ArgOptions = {namedArgs: {}, positionalArgs: []},
		public defaultCommand:boolean = false
	){
		//Fill in the provided arg options
		this.argOptions = {
			namedArgs: Object.fromEntries(Object.entries(argOptions.namedArgs).map<[string, RequiredRecursive<NamedArgOptions>]>(([key, value]) => [key, {
				description: value.description ?? "No description provided",
				optional: value.default ? (
					"optional" in value && invalidConfig(`named argument "${key}" has a default value, therefore it is optional, but "optional" was specified again. Please delete the redundant property.`),
					true
				) : value.optional ?? (value.valueless ? true : false),
				default: value.default ?? null,
				valueless: value.valueless ?? false,
				aliases: (value.aliases ?? []).concat(Object.entries(argOptions.aliases ?? {}).filter(([from, to]) => from == key).map(([from, to]) => to)),
			}])),
			aliases: Object.fromEntries<string>([
				...Object.entries(argOptions.aliases ?? []),
				...Object.entries(argOptions.namedArgs).map(([name, opts]) =>
					opts.aliases?.map(alias => [alias, name] as [string, string]) ?? []
				).flat(),
			]),
			positionalArgs: argOptions.positionalArgs.map((a, i) => ({
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

		//Validate named args
		for(const [key, opt] of Object.entries(this.argOptions.namedArgs)){
			if(opt.valueless && opt.default)
				invalidConfig(`in subcommand ${name}: named argument "${key}" with property "valueless" has a default specified, but this is meaningless`);
		}

		//Validate positional args
		let optionalArgsStarted = false;
		for(const arg of this.argOptions.positionalArgs){
			if(optionalArgsStarted && !arg.optional) invalidConfig(`in subcommand ${name}: Required positional arguments, or ones with a default value, cannot follow optional ones.`);
			if(arg.optional) optionalArgsStarted = true;
		}
	}
	/** Runs this subcommand. Do not call directly, call the application's run method instead. */
	run(args:string[], application:App){
		
		if(application.sourceDirectory == "null")
			crash("application.sourceDirectory is null. Don't call subcommand.run() directly.");
		const usageInstructionsMessage = `for usage instructions, run ${application.name} help ${this.name}`;


		const valuelessOptions = Object.entries(this.argOptions.namedArgs)
			.filter(([k, v]) => v.valueless)
			.map(([k, v]) => v.aliases.concat(k)).flat();
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
				if(opt.default){ //If it has a default value, set it to that
					namedArgs[name] = opt.default;
				} else if(opt.optional) {
					if(!opt.valueless){
						namedArgs[name] = name in namedArgs ? null : undefined;
					}
				} else throw new ApplicationError(
					//If it's required, fail with an error
`No value specified for required named argument "${name}".
To specify it, run the command with --${name}${opt.valueless ? "" : " <value>"}
${usageInstructionsMessage}`
				);
			}
			if(opt.valueless){
				//Convert valueless named args to booleans
				namedArgs[name] = (namedArgs[name] === null);
			}
		});

		return (this.handler as CommandHandler<App, any>)({
			commandName: this.name,
			positionalArgs,
			namedArgs,
		}, application);
	}
}

