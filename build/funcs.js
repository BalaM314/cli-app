/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains the code for the Application class, which represents a command-line application.
*/
export function invalidConfig(message) {
    throw new Error(`cli-app configuration error: ${message}`);
}
export function crash(message) {
    throw new Error(`${message}. This is an error with @balam314/cli-app.`);
}
/**
 * Throws an {@link ApplicationError}, causing the app to terminate with a non-zero exit code and a plain error message.
 * Use this to write guard clauses.
 */
export function fail(message) {
    throw new Error(`${message}. This is an error with @balam314/cli-app.`);
}
