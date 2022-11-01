import { Application } from "./Application";

export interface Options {
	namedArgs: {
		[name: string]: string | undefined | null;
	};
	positionalArgs: string[];
}
export interface ArgOptions {
	namedArgs: {
		[option: string]: NamedArgOptions;
	};
	aliases?: {
		[name: string]: string;
	}
	positionalArgs: PositionalArgOptions[]
}

/**Makes every property in an object and all of its child objects required. */
export type RequiredRecursive<T> = {
	[P in keyof T]-?: T[P] extends Array<infer A> ? RequiredRecursive<A>[] : T[P] extends Record<string, unknown> ? RequiredRecursive<T[P]> : T[P];
};


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
export type CommandHandler = (opts:Options, application:Application) => number | void;