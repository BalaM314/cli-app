
export class ApplicationError extends Error {
	constructor(message?:string){
		super(message);
		this.name = "ApplicationError";
	}
}

/**Useful for building very long strings. */
export class StringBuilder {
	buffer:string = "";
	constructor(){return this;}

	add(message:string):StringBuilder;
	add(condition:boolean, message:string):StringBuilder;
	add(arg1:any, arg2?:any){
		if(typeof arg1 == "string"){
			this.buffer += arg1;
		} else if(arg1){
			this.buffer += arg2;
		}
		return this;
	}

	addWord(message:string):StringBuilder;
	addWord(condition:boolean, message:string):StringBuilder;
	addWord(arg1:any, arg2?:any){
		if(typeof arg1 == "string" && arg1.length != 0){
			this.buffer += " ";
			this.buffer += arg1;
		} else if(arg1){
			this.buffer += " ";
			this.buffer += arg2;
		}
		return this;
	}

	addLine():StringBuilder;
	addLine(message:string):StringBuilder;
	addLine(condition:boolean, message:string):StringBuilder;
	addLine(arg1?:any, arg2?:any){
		if(arg1 == undefined){
			this.buffer += "\n";
		} else if(typeof arg1 == "string"){
			this.buffer += arg1;
			this.buffer += "\n";
		} else if(arg1){
			this.buffer += arg2;
			this.buffer += "\n";
		}
		return this;
	}

	text(){return this.buffer;}
}
