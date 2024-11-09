/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains type definitions.
*/

import type { Application } from "./Application.js";
import type { Script } from "./Script.js";

/**Options that are passed to a subcommand handler. */
export interface SpecificOptions<Opts extends Partial<ArgOptions>> {
	/**All named args specified with --name value. */
	namedArgs:
		ArgOptions extends Opts ? Record<string, string | boolean | undefined | null> :
		Opts["namedArgs"] extends {} ? NamedArgs<Opts["namedArgs"]> : {};
	/**Positional args specified by simply stating them. */
	positionalArgs: (string | undefined)[]; //TODO typedef
	commandName: string;
}
export type Options = SpecificOptions<ArgOptions>;

/**Generates the type definition for named args based on given argOptions. */
type NamedArgs<NamedArgOpts extends ArgOptions["namedArgs"]> = {
	[K in keyof NamedArgOpts]: NamedArgFrom<NamedArgOpts[K]>;
};

//This code is super cursed. Fix if you know how.
type NamedArgFrom<O extends NamedArgOptions> =
	O["valueless"] extends true ?
		O["optional"] extends false ? true : (false | true)
	: O["optional"] extends true ? (string | undefined | null) : string;

/**Arg options that specify what args a command should accept. */
export interface ArgOptions {
	namedArgs: Record<string, NamedArgOptions>;
	/**Aliases for named args' names. */
	aliases?: Record<string, string>;
	positionalArgs: PositionalArgOptions[];
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
}

/**Makes every property in an object and all of its child objects required. */
export type RequiredRecursive<T> = 
	T extends Array<infer A> ? RequiredRecursive<A>[] :
	{
		[P in keyof T]-?: RequiredRecursive<T[P]>;
	};
;

export type isFalseOrUnknown<T> = unknown extends T ? true : false extends T ? true : false;

export type FilledArgOptions = RequiredRecursive<ArgOptions>;
export interface NamedArgOptions {
	description: string;
	/**
	 * Whether the argument does not need to be specified by the command invoker.
	 * If true, the command will be called with `undefined` for the value of this argument if it was omitted, and `null` if it was passed but without a value.
	 * Not allowed if "default" is also set.
	 * @default false (required) unless needsValue is true.
	 */
	optional?: boolean;
	/**A default value for the argument. */
	default?: string | null;
	/**
	 * Whether this argument does not accept a value.
	 * If true: the argument will be set to `true` if provided, otherwise `false`.
	 * @default false
	 */
	valueless?: boolean;
	/**List of aliases for this named arg. */
	aliases?: string[];
}
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
export type CommandHandler<App extends Application | Script<ArgOptions>, A extends Partial<ArgOptions>> =
	(opts:SpecificOptions<A>, application:App) => number | void | Promise<number | void>;

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

