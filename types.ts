import { Application } from "./Application";

export interface Options {
	namedArgs: {
		[name: string]: string | undefined;
	};
	positionalArgs: string[];
}
export interface Optionsoptions {
	namedArgs: {
		[option: string]: ArgOptions;
	};
	aliases?: {
		[name: string]: string;
	}
	positionalArgs: PositionalArgOptions[]
}
export interface ArgOptions {
	description: string;
	required?: boolean;
	default?: string;
}
export interface PositionalArgOptions extends ArgOptions {
	name: string;
}
export type CommandHandler = (opts:Options, application:Application) => number | void;