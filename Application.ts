import path from "path";
import { ApplicationError } from "./classes.js";
import { ArgOptions, CommandHandler, FilledArgOptions, Options } from "./types.js";



export class Application {
	commands: {
		[name: string]: Subcommand | undefined
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
	command(name:string, description:string, handler:CommandHandler, isDefault?:boolean, optionsoptions?:Partial<ArgOptions>, aliases?:string[]):this {
		this.commands[name] = new Subcommand(name, handler, description, {
			namedArgs: optionsoptions?.namedArgs ?? {},
			positionalArgs: optionsoptions?.positionalArgs ?? [],
			aliases: optionsoptions?.aliases ?? {}
		}, isDefault);
		if(aliases) aliases.forEach((alias) => this.alias(alias, name));
		return this;//For daisy chaining
	}
	alias(name:string, target:string){
		this.aliases[name] = target;
		return this;
	}
	runHelpCommand(opts:Options):number {
		if(!(this instanceof Application)){
			throw new ApplicationError("application.runHelpCommand was bound incorrectly. This is most likely an error with cli-app.");
		}
		if(opts.positionalArgs[0]){
			let command = this.commands[opts.positionalArgs[0]];
			if(command){
				console.log(
`Help for command ${command.name}:

Usage: ${this.name} ${command.name} ${
	Object.entries(command.optionsoptions.namedArgs)
	.map(([name, opt]) => 
	//Template literals make stuff easier to read right?
		opt.required ? `--${name}${opt.needsValue ? ` <${name}> ` : ``}` : `[--${name}${opt.needsValue ? ` <${name}> ` : ``}] `
	).join("")
}${
	command.optionsoptions.positionalArgs.map(opt => 
		opt.required ? `<${opt.name}> ` : `[<${opt.name}>] `
	).join("")
}
${
	Object.entries(command.optionsoptions.namedArgs)
	.map(([name, opt]) => 
		`${opt.required ? `<${name}>` : `<${name}>`}: ${opt.description}`
	).join("\n")
}
${
	command.optionsoptions.positionalArgs
	.map((opt) => 
		`${opt.required ? `<${opt.name}>` : `<${opt.name}>`}: ${opt.description}`
	).join("\n")
}
`
				);
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
	static parseArgs(
		providedArgs: string[]
	): Options {
		let parameters: {
			[index: string]: string | null;
		} = {};
		let commands: string[] = [];
		let i = 0;
		if(!providedArgs[0]?.includes("node")){
			throw new ApplicationError("Attempted to parse invalid args. Unless you are running this application in a strange way, this is likely an error with the application itself.");
		}
		let args = providedArgs.slice(2);
		while (true) {
			i++;
			if (i > 1000) {
				throw new ApplicationError("Too many arguments!");
			}
			let arg = args.splice(0, 1)[0];
			if (arg == undefined) break;
			if (arg.startsWith("--")) {
				if (args[0]?.startsWith("-")) parameters[arg.substring(2)] = null;
				else parameters[arg.substring(2)] = args.splice(0, 1)[0] ?? null;
			} else if (arg.startsWith("-")) {
				if (args[0]?.startsWith("-")) parameters[arg.substring(1)] = null;
				else parameters[arg.substring(1)] = args.splice(0, 1)[0] ?? null;
			} else {
				commands.push(arg);
			}
		}
		return {
			positionalArgs: commands,
			namedArgs: parameters
		};
	}
	run(args:string[], options?:{
		throwOnError?:boolean
	}){
		this.sourceDirectory = path.join(process.argv[1], "..");
		let parsedArgs = Application.parseArgs(args);
		let command:Subcommand | undefined;
		let { positionalArgs } = parsedArgs;
		if("help" in parsedArgs.namedArgs){
			command = this.commands["help"]!;
		} else if(this.commands[parsedArgs.positionalArgs[0]]){
			command = this.commands[parsedArgs.positionalArgs[0]];
			positionalArgs.splice(0,1);
		} else if(this.aliases[parsedArgs.positionalArgs[0]]){
			command = this.commands[this.aliases[parsedArgs.positionalArgs[0]]];
			positionalArgs.splice(0,1);
		} else {
			command = Object.values(this.commands).filter(command => command?.defaultCommand)[0] ?? this.commands["help"]!;
		}
		if(command){

			//Loop through each named argument passed
			Object.keys(parsedArgs.namedArgs).forEach(arg => 
				//If the arg is not in the named arguments or the aliases
				(arg in command!.optionsoptions.namedArgs || arg in (command!.optionsoptions.aliases ?? {})) ? "" :
					//Display a warning
					console.warn(`Unknown argument ${arg}`)
			);

			try {
				command.run({
					namedArgs: {
						...Object.fromEntries(
							Object.entries(parsedArgs.namedArgs)
							.map(([name, value]) => 
								[command?.optionsoptions.aliases?.[name] ?? name, value]
							)
						)
					},
					positionalArgs: positionalArgs
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

export class Subcommand {
	optionsoptions:FilledArgOptions;
	constructor(
		public name:string,
		public handler:CommandHandler,
		public description:string = "No description provided",
		optionsoptions:ArgOptions = {namedArgs: {}, positionalArgs: []},
		public defaultCommand:boolean = false
	){
		this.optionsoptions = {
			namedArgs: Object.fromEntries(Object.entries(optionsoptions.namedArgs).map(([key, value]) => [key, {
				description: value.description ?? "No description provided",
				required: value.default ? false : value.required ?? false,
				default: value.default ?? null,
				needsValue: value.needsValue ?? true
			}])),
			aliases: optionsoptions.aliases ?? {},
			positionalArgs: optionsoptions.positionalArgs.map(a => ({
				...a,
				default: a.default ?? null,
				required: a.default ? false : a.required ?? true,
			})) ?? []
		};
		//Validate positional args
		let optionalArgsStarted = false;
		for(let arg of this.optionsoptions.positionalArgs){
			if(optionalArgsStarted && (arg.required || arg.default)) throw new Error("Required positional arguments, or ones with a default value, cannot follow optional ones.\nThis is an error with the application.")
			if(!(arg.required || arg.default)) optionalArgsStarted = true;
		}
	}
	run(options:Options, application:Application){
		if(application.sourceDirectory == "null") throw new Error("application.sourceDirectory is null. Don't call subcommand.run() directly.\nThis is an error with cli-app or the application.");
		const requiredPositionalArgs = this.optionsoptions.positionalArgs.filter(arg => arg.required);
		const valuedPositionalArgs = this.optionsoptions.positionalArgs
			.filter(arg => arg.required || arg.default);
		Object.entries(this.optionsoptions.namedArgs).forEach(([name, opt]) => {
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
		if(options.positionalArgs.length < valuedPositionalArgs.length){
			for(let i = options.positionalArgs.length; i < valuedPositionalArgs.length; i ++){
				if(!valuedPositionalArgs[i].default) throw new ApplicationError(`valuedPositionalArgs[${i}].default is not defined. This is an error with cli-app.`);
				options.positionalArgs[i] = valuedPositionalArgs[i].default!;
			}
		}
		this.handler({
			positionalArgs: options.positionalArgs,
			namedArgs: options.namedArgs
		}, application);
	}
}

