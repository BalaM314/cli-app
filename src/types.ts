import { Application } from "./Application";
import { Script } from "./Script";

/**Options that are passed to a subcommand handler. */
export interface Options<Opts extends Partial<ArgOptions>> {
	/**All named args specified with --name value. */
	namedArgs: Opts["namedArgs"] extends ArgOptions["namedArgs"] ? namedArgs<Opts["namedArgs"]> : {};
	/**Positional args specified by simply stating them. */
	positionalArgs: string[];
	commandName: string;
}

/**Generates the type definition for named args based on given argOptions. */
type namedArgs<namedArgOpts extends ArgOptions["namedArgs"]> = {
	[K in keyof namedArgOpts]: namedArgFrom<namedArgOpts[K]>;
};

//This code is super cursed. Fix if you know how.
type namedArgFrom<O extends NamedArgOptions> =
	NamedArgOptions extends O ? (string | undefined | null) :
	true extends O["needsValue"] ? 
		(isFalseOrUnknown<O["default"] & O["required"]> extends true ? (string | undefined) : string) :
		(O["required"] extends true ? null : (undefined | null));

/**Arg options that specify what args a command should accept. */
export interface ArgOptions {
	namedArgs: {
		[option: string]: NamedArgOptions;
	};
	/**Aliases for named args' names. */
	aliases?: {
		[name: string]: string;
	}
	positionalArgs: PositionalArgOptions[]
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
export type CommandHandler<App extends Application | Script<ArgOptions>, A extends Partial<ArgOptions>> = (opts:Options<A>, application:Application) => number | void;