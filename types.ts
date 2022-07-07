import { Application } from "./Application";

export interface Options {
	namedArgs: {
		[name: string]: string | undefined;
	};
	positionalArgs: string[];
}
export interface Optionsoptions<argOpts extends Partial<ArgOptions> | Required<ArgOptions>> {
	namedArgs: {
		[option: string]: argOpts;
	};
	aliases?: {
		[name: string]: string;
	}
	positionalArgs: PositionalArgOptions[]
}
export type RequiredOptionsoptions = Optionsoptions<Required<ArgOptions>>;
export type PartialOptionsoptions = Optionsoptions<Partial<ArgOptions>>;
export interface ArgOptions {
	description: string;
	required?: boolean;
	default?: string;
	needsValue?: boolean;
}
export interface PositionalArgOptions extends ArgOptions {
	name: string;
}
export type CommandHandler = (opts:Options, application:Application) => number | void;