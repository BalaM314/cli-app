
import path from "node:path";
import { ApplicationError } from "../../build/classes.js";
import { Application, ApplicationRunOptions } from "../../src/Application.js";

process.chdir(path.join(import.meta.dirname, ".."));

export function applicationError(message:string):jasmine.AsymmetricMatcher<unknown> {
	return {
		asymmetricMatch(received){
			return received instanceof ApplicationError && received.message.includes(message);
		},
		jasmineToString(){
			return `<ApplicationError ${message}>`;
		}
	};
}

export function error(message:string):jasmine.AsymmetricMatcher<unknown> {
	return {
		asymmetricMatch(received){
			return received instanceof Error && received.constructor === Error && received.message.includes(message);
		},
		jasmineToString(){
			return `<ApplicationError ${message}>`;
		}
	};
}

export function delay(ms:number):Promise<void> {
	return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function types<A, B>():[A] extends [B] ? [B] extends [A] ? {
	areEqual():void;
} : false : false {
	return {
		areEqual(){
			//empty
		}
	} as never;
}

export const testOptions:ApplicationRunOptions = {
	throwOnError: true,
	setProcessExitCodeOnHandlerReturn: false,
};

export const fakePathToApp = path.join(process.cwd(), "build/test.js");

export function runApp(app:Application, parameters: string[]){
	return app.run(["node", fakePathToApp, ...parameters], testOptions);
}

