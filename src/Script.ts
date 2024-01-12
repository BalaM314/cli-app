/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains the code for the Script class, which represents an application that does one thing only.
*/

import * as path from "path";
import { Application, Subcommand } from "./Application.js";
import { ApplicationError, StringBuilder } from "./classes.js";
import { ArgOptions, CommandHandler, SpecificOptions } from "./types.js";


/**
 * Represents an application that does one thing only.
 */
export class Script<A extends Partial<ArgOptions>> {
	defaultCommand:Subcommand<this, ArgOptions>;
	helpCommand:Subcommand<this, ArgOptions>;
	name: string;
	sourceDirectory:string;
	constructor(name:string, description:string, handler:CommandHandler<Script<A>, A>, argOptions?:A){
		this.helpCommand = new Subcommand(
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
		this.name = name;
		this.sourceDirectory = "null";
		this.defaultCommand = new Subcommand<this, A>(name, handler, description, {
			namedArgs: argOptions?.namedArgs ?? {},
			positionalArgs: argOptions?.positionalArgs ?? [],
			aliases: argOptions?.aliases ?? {}
		}, true);
	}
	/**
	 * Runs the help command for this application. Do not call directly.
	 */
	runHelpCommand(opts:SpecificOptions<{
		positionalArgs: [{
			name: "command",
			description: "The command to get help on.",
			required: false
		}],
		namedArgs: {}
	}>):number {
		
		const positionalArgsFragment =
			this.defaultCommand.argOptions.positionalArgs.map(opt =>
				opt.required ? `<${opt.name}>` : `[<${opt.name}>]`
			).join(" ");
		const namedArgsFragment =
			Object.entries(this.defaultCommand.argOptions.namedArgs)
				.map(([name, opt]) =>
					opt.required ? `--${name}${opt.needsValue ? ` <${name}>` : ""}` : `[--${name}${opt.needsValue ? ` <${name}>` : ``}]`
				).join(" ");
		const outputText = new StringBuilder()
		.addLine()
		.addLine(`Help for ${this.name}:`)

		.add(`Usage: ${this.name}`)
		.addWord(positionalArgsFragment)
		.addWord(namedArgsFragment)
		.add("\n")
		.addLine();

		if(Object.entries(this.defaultCommand.argOptions.namedArgs).length != 0){
			Object.entries(this.defaultCommand.argOptions.namedArgs)
			.map(([name, opt]) =>
			`<${name}>: ${opt.description}`
			).forEach(line => outputText.addLine(line));
			outputText.addLine();
		}

		if(this.defaultCommand.argOptions.positionalArgs.length != 0){
			this.defaultCommand.argOptions.positionalArgs
			.map((opt) =>
			`<${opt.name}>: ${opt.description}`
			).forEach(line => outputText.addLine(line));
			outputText.addLine();
		}

		process.stdout.write(outputText.text());
		return 0;
	}
	/**
	 * Runs an application.
	 * @param args Pass process.argv without modifying it.
	 * @param options Used for testing.
	 */
	run(args:string[], options?:{ throwOnError?:boolean }){
		this.sourceDirectory = path.join(process.argv[1], "..");
		let parsedArgs = Application.parseArgs(args);
		let command:Subcommand<this, A>;
		if("help" in parsedArgs.namedArgs || "?" in parsedArgs.namedArgs){
			command = this.helpCommand;
		} else {
			command = this.defaultCommand;
		}
		
		//Loop through each named argument passed
		Object.keys(parsedArgs.namedArgs).forEach(arg =>
			//If the arg is not in the named arguments or the aliases
			(arg in command!.argOptions.namedArgs || arg in (command!.argOptions.aliases ?? {}) || arg == "help" || arg == "?") ? "" :
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
				positionalArgs: parsedArgs.positionalArgs,
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
	}
}