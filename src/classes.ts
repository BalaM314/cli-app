/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains utility classes.
*/

export class ApplicationError extends Error {
	constructor(message?:string, public exitCode = 1){
		super(message);
		this.name = "ApplicationError";
	}
}

/**Useful for building very long strings. */
export class StringBuilder {
	buffer = "";
	constructor(){return this;}

	add(message:string):StringBuilder;
	add(condition:boolean, message:string):StringBuilder;
	add(arg1:string | boolean, arg2?:string){
		if(typeof arg1 == "string"){
			this.buffer += arg1;
		} else if(arg1){
			this.buffer += arg2;
		}
		return this;
	}

	addWord(message:string):StringBuilder;
	addWord(condition:boolean, message:string):StringBuilder;
	addWord(arg1:string | boolean, arg2?:string){
		if(typeof arg1 == "string" && arg1.length != 0){
			this.buffer += " ";
			this.buffer += arg1;
		} else if(arg1){
			this.buffer += " ";
			this.buffer += arg2;
		}
		return this;
	}

	/** Adds a newline. */
	addLine():StringBuilder;
	/** Adds a string followed by a newline. If the string is empty or undefined, does nothing. */
	addLine(message:string | undefined):StringBuilder;
	/** Adds `message` followed by a newline if `condition` is true. */
	addLine(condition:boolean, message:string):StringBuilder;
	addLine(arg1?:string | boolean, arg2?:string){
		if(arguments.length === 0){
			this.buffer += "\n";
		} else if(arguments.length == 1){
			if(typeof arg1 == "string" && arg1.trim().length > 0){
				this.buffer += arg1;
				this.buffer += "\n";
			}
		} else if(arguments.length == 2){
			if(arg1 === true){
				this.buffer += arg2;
				this.buffer += "\n";
			}
		}
		return this;
	}

	text(){return this.buffer;}
}
