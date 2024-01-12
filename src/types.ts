/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains type definitions.
*/

import { Application } from "./Application";
import { Script } from "./Script";

/**Options that are passed to a subcommand handler. */
export interface SpecificOptions<Opts extends Partial<ArgOptions>> {
	/**All named args specified with --name value. */
	namedArgs: Opts["namedArgs"] extends ArgOptions["namedArgs"] ? namedArgs<Opts["namedArgs"]> : {};
	/**Positional args specified by simply stating them. */
	positionalArgs: string[];
	commandName: string;
}
export type Options = SpecificOptions<ArgOptions>;

/**Generates the type definition for named args based on given argOptions. */
type namedArgs<namedArgOpts extends ArgOptions["namedArgs"]> = {
	[K in keyof namedArgOpts]: namedArgFrom<namedArgOpts[K]>;
};

//This code is super cursed. Fix if you know how.
type namedArgFrom<O extends NamedArgOptions> =
	NamedArgOptions extends O ? (string | undefined | null) :
	true extends O["needsValue"] ?
		(isFalseOrUnknown<O["default"] & O["required"]> extends true ? (string | undefined) : string) :
		(O["required"] extends true ? "true" : (undefined | "true"));

/**Arg options that specify what args a command should accept. */
export interface ArgOptions {
	namedArgs: {
		[option: string]: NamedArgOptions;
	};
	/**Aliases for named args' names. */
	aliases?: {
		[name: string]: string;
	}
	positionalArgs: PositionalArgOptions[];
	/**
	 * If "warn": prints a warning if there are more positional args than the command is supposed to accept.
	 * If "ignore", ignores.
	 * Default: "ignore".
	 **/
	positionalArgCountCheck?: "warn" | "ignore";
}

/**Makes every property in an object and all of its child objects required. */
export type RequiredRecursive<T> = {
	[P in keyof T]-?: T[P] extends Array<infer A> ? RequiredRecursive<A>[] : T[P] extends Record<string, unknown> ? RequiredRecursive<T[P]> : T[P];
};

export type isFalseOrUnknown<T> = unknown extends T ? true : false extends T ? true : false;

export type FilledArgOptions = RequiredRecursive<ArgOptions>;
export interface NamedArgOptions {
	description: string;
	/**Whether the argument must be specified by the command invoker. Default: false. */
	required?: boolean;
	/**A default value for the argument. */
	default?: string | null;
	/**Whether this argument accepts a value. Default: true. */
	needsValue?: boolean;
	/**List of aliases for this named arg. */
	aliases?: string[];
}
export interface PositionalArgOptions {
	name: string;
	description: string;
	/**Whether the argument must be specified by the command invoker. Default: false. */
	required?: boolean;
	/**A default value for the argument. */
	default?: string | null;
}
export type CommandHandler<App extends Application | Script<ArgOptions>, A extends Partial<ArgOptions>> = (opts:SpecificOptions<A>, application:App) => unknown;