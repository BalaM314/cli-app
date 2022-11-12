import path from "path";
import { ApplicationError, StringBuilder } from "./classes.js";
import { Script } from "./Script.js";
import { ArgOptions, CommandHandler, FilledArgOptions, Options } from "./types.js";



export class Application {
	commands: {
		[name: string]: Subcommand<Application, ArgOptions> | undefined
	} = {};
	aliases: {
		[index:string]:string;
	} = {};
	sourceDirectory:string;
	constructor(public name:string, public description:string){
		this.commands["help"] = new Subcommand(
			"help",
			this.runHelpCommand.bind(this),
			"Displays help on all commands or a specific subcommand.",
			{
				positionalArgs: [{
					name: "command",
					description: "The command to get help on.",
					required: false
				}],
				namedArgs: {}
			}
		);
		this.sourceDirectory = "null";
	}
	command<A extends Partial<ArgOptions>>(name:string, description:string, handler:CommandHandler<Application, A>, isDefault?:boolean, argOptions?:A, aliases?:string[]):this {
		this.commands[name] = new Subcommand<Application, A>(name, handler, description, {
			namedArgs: argOptions?.namedArgs ?? {},
			positionalArgs: argOptions?.positionalArgs ?? [],
			aliases: argOptions?.aliases ?? {}
		}, isDefault);
		if(aliases) aliases.forEach((alias) => this.alias(alias, name));
		return this;//For daisy chaining
	}
	alias(name:string, target:string){
		this.aliases[name] = target;
		return this;
	}
	runHelpCommand(opts:Options<{
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
			let commandName = this.commands[opts.positionalArgs[0]] ? opts.positionalArgs[0] : this.aliases[opts.positionalArgs[0]] ?? opts.positionalArgs[0];
			let command = this.commands[commandName];
			if(command){
				const aliases = Object.entries(this.aliases).filter(([alias, name]) => name == commandName).map(([alias, name]) => alias);
				const positionalArgsFragment =
					command.argOptions.positionalArgs.map(opt => 
						opt.required ? `<${opt.name}> ` : `[<${opt.name}>] `
					).join("");
				const namedArgsFragment =
					Object.entries(command.argOptions.namedArgs)
						.map(([name, opt]) => 
							opt.required ? `--${name}${opt.needsValue ? ` <${name}>` : ``}` : `[--${name}${opt.needsValue ? ` <${name}>` : ``}]`
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
			for(let command of Object.values(this.commands)){
				console.log(`\t${command?.name}: ${command?.description}`);
			}

		}
		return 0;
	}
	static splitLineIntoArguments(line:string):string[] {
		if(line.includes(`"`)){
			//aaaaaaaaaaaaaaaaa
			let replacementLine = [];
			let isInString = false;
			for(let char of line){
				if(char == `"`){
					isInString = !isInString;
				}
				if(isInString && char == " "){
					replacementLine.push("\u{F4321}");
				} else {
					replacementLine.push(char);
				}
			}
			return replacementLine.join("").split(" ").map(arg => arg.replaceAll("\u{F4321}", " "));
			//smort logic so `"amogus sus"` is parsed as one arg
		} else {
			return line.split(" ");
		}
	}
	/**
	 * Parses command line arguments into an object.
	 * @param providedArgs Pass process.argv without modifying it.
	 * @returns Formatted args.
	 */
	static parseArgs(providedArgs:string[], valuelessOptions:string[] = []):Omit<Options<ArgOptions>, "commandName"> {
		let parameters: {
			[index: string]: string | null;
		} = {};
		let commands:string[] = [];
		let i = 0;
		if(!providedArgs[0]?.includes("node")){
			throw new ApplicationError("Attempted to parse invalid args. Unless you are running this application in a strange way, this is likely an error with the application itself.");
		}
		let args = providedArgs.slice(2);
		while(true){
			i++;
			if(i > 1000) throw new ApplicationError("Too many arguments!");

			let arg = args.shift(); //Grab the first arg
			if(arg == undefined) break; //If it doesn't exist, return
			if(arg.match(/^--?([\s\S]+)/)){ //Starts with one or two hyphes
				const argName = arg.match(/^--?([\s\S]+)/)![1];
				if(args[0]?.startsWith("-") || valuelessOptions.includes(argName)){
					//If the next arg also starts with a hyphen, or the arg name is valueless, set it to null
					parameters[argName] = null;
				} else {
					//Otherwise, pop off the first arg and set it to that
					parameters[argName] = args.shift() ?? null;
				}
			} else {
				//It's a positional arg
				commands.push(arg);
			}
		}
		return {
			positionalArgs: commands,
			namedArgs: parameters
		};
	}
	run(args:string[], options?:{ throwOnError?:boolean }){
		this.sourceDirectory = path.join(process.argv[1], "..");
		let parsedArgs = Application.parseArgs(args);
		let command:Subcommand<Application, ArgOptions> | undefined;
		let { positionalArgs } = parsedArgs;
		if("help" in parsedArgs.namedArgs){
			command = this.commands["help"]!;
		} else if(this.commands[parsedArgs.positionalArgs[0]]){
			command = this.commands[parsedArgs.positionalArgs[0]];
			positionalArgs.shift();
		} else if(this.aliases[parsedArgs.positionalArgs[0]]){
			command = this.commands[this.aliases[parsedArgs.positionalArgs[0]]];
			positionalArgs.shift();
		} else {
			command = Object.values(this.commands).filter(command => command?.defaultCommand)[0] ?? this.commands["help"]!;
		}
		if(command){

			//Loop through each named argument passed
			Object.keys(parsedArgs.namedArgs).forEach(arg => 
				//If the arg is not in the named arguments or the aliases
				(arg in command!.argOptions.namedArgs || arg in (command!.argOptions.aliases ?? {})) ? "" :
					//Display a warning
					console.warn(`Unknown argument ${arg}`)
			);

			try {
				command.run({
					namedArgs: {
						...Object.fromEntries(
							Object.entries(parsedArgs.namedArgs)
							.map(([name, value]) => 
								[command?.argOptions.aliases?.[name] ?? name, value]
							)
						)
					},
					positionalArgs: positionalArgs,
					commandName: command.name
				}, this);
			} catch(err){
				if(options?.throwOnError) throw err;
				if(err instanceof ApplicationError){
					console.error(`Error: ${err.message}`)
				} else {
					console.error("The command encountered an unhandled runtime error.");
					console.error(err);
				}
			}
		} else {
			console.error(`Unknown command: ${parsedArgs.positionalArgs[0]}\nRun "${this.name} help" for a list of all commands.`);
		}
	}
}

export class Subcommand<App extends Application | Script<ArgOptions>, A extends Partial<ArgOptions>> {
	argOptions:FilledArgOptions;
	constructor(
		public name:string,
		public handler:CommandHandler<App, A>,
		public description:string = "No description provided",
		argOptions:ArgOptions = {namedArgs: {}, positionalArgs: []},
		public defaultCommand:boolean = false
	){
		this.argOptions = {
			namedArgs: Object.fromEntries(Object.entries(argOptions.namedArgs).map(([key, value]) => [key, {
				description: value.description ?? "No description provided",
				required: value.default ? false : value.required ?? false,
				default: value.default ?? null,
				needsValue: value.needsValue ?? true
			}])),
			aliases: Object.fromEntries([
				...Object.entries(argOptions.aliases ?? []),
				...(([] as [string, string][]).concat(
					...Object.entries(argOptions.namedArgs).map(([name, opts]) => opts.aliases?.map(alias => [alias, name] as [string, string]) ?? [])
				))
			]),
			positionalArgs: argOptions.positionalArgs.map(a => ({
				...a,
				default: a.default ?? null,
				required: a.default ? false : a.required ?? true,
			})) ?? []
		};
		//Validate positional args
		let optionalArgsStarted = false;
		for(let arg of this.argOptions.positionalArgs){
			if(optionalArgsStarted && (arg.required || arg.default)) throw new Error("Required positional arguments, or ones with a default value, cannot follow optional ones.\nThis is an error with the application.");
			if(!(arg.required || arg.default)) optionalArgsStarted = true;
		}
	}
	run(options:Options<ArgOptions>, application:App){
		if(application.sourceDirectory == "null") throw new Error("application.sourceDirectory is null. Don't call subcommand.run() directly.\nThis is an error with cli-app or the application.");
		const requiredPositionalArgs = this.argOptions.positionalArgs.filter(arg => arg.required);
		const valuedPositionalArgs = this.argOptions.positionalArgs
			.filter(arg => arg.required || arg.default);
		Object.entries(this.argOptions.namedArgs).forEach(([name, opt]) => {
			if(!options.namedArgs[name]){//If the named arg was not specified
				if(opt.default){//If it has a default value, set it to that
					options.namedArgs[name] = opt.default;
				} else if(opt.required){//If it's required, throw an error
					throw new ApplicationError(`No value specified for required named argument "${name}".`);
				}
			} else {
				if(!opt.needsValue){
					options.namedArgs[name] = options.namedArgs[name] == undefined ? undefined : "true";
				}
			}
		});
		if(options.positionalArgs.length < requiredPositionalArgs.length){
			const missingPositionalArgs = requiredPositionalArgs.slice(options.positionalArgs.length).map(arg => arg.name);
			throw new ApplicationError(`Missing required positional argument${missingPositionalArgs.length == 1 ? "" : "s"} "${missingPositionalArgs.join(", ")}"`);
		}
		if(options.positionalArgs.length > this.argOptions.positionalArgs.length){
			throw new ApplicationError(`Warning: Too many positional arguments (required ${this.argOptions.positionalArgs.length}, provided ${options.positionalArgs.length})"`);
		}
		if(options.positionalArgs.length < valuedPositionalArgs.length){
			for(let i = options.positionalArgs.length; i < valuedPositionalArgs.length; i ++){
				if(!valuedPositionalArgs[i].default) throw new ApplicationError(`valuedPositionalArgs[${i}].default is not defined. This is an error with cli-app.`);
				options.positionalArgs[i] = valuedPositionalArgs[i].default!;
			}
		}
		this.handler({
			...options
		}, application as never);
	}
}

