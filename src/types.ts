/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains type definitions.
*/

export type PickFunctionProperties<T extends Record<PropertyKey, unknown>> = Pick<T, keyof T extends infer K extends keyof T ? K extends unknown ? T[K] extends (...args:any[]) => unknown ? K : never : never : never>
export type OmitFunctionProperties<T extends Record<PropertyKey, unknown>> = Pick<T, keyof T extends infer K extends keyof T ? K extends unknown ? T[K] extends (...args:any[]) => unknown ? never : K : never : never>
export type Expand<T> = T extends Function ? T : {
	[K in keyof T]: Expand<T[K]>;
};

