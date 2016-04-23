import "rxjs/Rx";
import {Inject, provide, Provider} from "angular2/core";
import {Http, Request, RequestMethod, Headers, RequestOptions, Response, URLSearchParams} from "angular2/http";
import {Observable} from "rxjs/Observable";



export interface ResourceRequestInterceptor {
	(req: Request): any;
}

export interface ResourceResponseInterceptor {
	(observable: Observable<any>): Observable<any>;
}

export interface ResourceParamsBase {
	url?: string,
	path?: string,
	headers?: any,
	params?: any,
	data?: any,
	requestInterceptor?: ResourceRequestInterceptor,
	responseInterceptor?: ResourceResponseInterceptor,
	add2Provides?: boolean
}

export interface ResourceActionBase extends ResourceParamsBase {
	method: RequestMethod,
	isArray?: boolean,
	isPending?: boolean,
	isLazy?: boolean,
}

export interface ResourceResult {
	$resolved?: boolean,
	$observable?: Observable<any>
}



export class Resource {

	constructor( @Inject(Http) protected http: Http) { }

	protected requestInterceptor(req: Request) { }

	protected responseInterceptor(observable: Observable<any>): Observable<any> {
		return observable.map(res => res.json());
	}

	getUrl(): string {
		return '';
	}

	getPath(): string {
		return '';
	}

	getHeaders(): any {
		return {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		};
	}

	getParams(): any {
		return null;
	}

	getData(): any {
		return null;
	}



	@ResourceAction({
		method: RequestMethod.Get
	})
	get(data?: any, callback?: Function): ResourceResult {
		return null;
	}

	@ResourceAction({
		method: RequestMethod.Get,
		isArray: true
	})
	query(data?: any, callback?: Function): ResourceResult {
		return null;
	}


	@ResourceAction({
		method: RequestMethod.Post
	})
	save(data?: any, callback?: Function): ResourceResult {
		return null;
	}


	@ResourceAction({
		method: RequestMethod.Put
	})
	update(data?: any, callback?: Function): ResourceResult {
		return null;
	}


	@ResourceAction({
		method: RequestMethod.Delete
	})
	remove(data?: any, callback?: Function): ResourceResult {
		return null;
	}


	delete(data?: any, callback?: Function): ResourceResult {
		return this.remove(data, callback);
	}

}



// export class ObservableResource<T> extends Observable<T> {
//
// 	returnArray: boolean = false;
//
// 	$ng1() {}
//
// }


function parseUrl(url): any[] {
	let params = [];
	let index: number = url.indexOf('{');
	let lastIndex: number;
	while (index > -1) {
		lastIndex = url.indexOf('}', index);
		if (lastIndex == -1) {
			return params;
		}
		lastIndex++;
		params.push(url.substring(index, lastIndex));
		index = url.indexOf('{', lastIndex);
	}

	return params;
}



export function ResourceAction(action?: ResourceActionBase) {
	return function(target: Resource, propertyKey: string, descriptor: PropertyDescriptor) {

		descriptor.value = function(...args: any[]) {

			let isGetRequest = action.method === RequestMethod.Get;

			// Creating URL
			let url: string =
				(action.url ? action.url : this.getUrl()) +
				(action.path ? action.path : this.getPath());

			// Creating Headers
			let headers = new Headers(action.headers || this.getHeaders());

			// Setting data
			let data = args.length ? args[0] : null;
			let callback = args.length > 1 ? args[1] : null;
			if (typeof data === 'function') {
				if (!callback) {
					callback = data;
					data = null;
				} else if (typeof callback !== 'function') {
					let tmpData = callback;
					callback = data;
					data = tmpData;
				} else {
					data = null;
				}

			}
			let params = Object.assign({}, action.params || this.getParams());

			// Setting default data parameters
			let defData = action.data || this.getData();
			if (defData) {
				if (!data) {
					data = defData;
				} else {
					data = Object.assign(defData, data);
				}
			}



			// Splitting map params
			let mapParam = {};
			for (let key in params) {
				if (typeof params[key] == 'string' && params[key][0] == '@') {
					mapParam[key] = params[key];
					delete params[key];
				}
			}

			let usedPathParams = {};

			// Parsing url for params
			var pathParams = parseUrl(url);

			for (let i = 0; i < pathParams.length; i++) {

				let param = pathParams[i];

				let key: string = param.substr(1, param.length - 2);
				let value: string = null;
				let isMandatory = key[0] == '!';
				if (isMandatory) {
					key = key.substr(1);
				}

				// Do we have mapped path param key
				if (mapParam[key]) {
					key = mapParam[key].substr(1);
				}

				// Getting value from data body
				if (data && data[key] && !(data[key] instanceof Object)) {
					value = data[key];
					usedPathParams[key] = value;
				}

				// Getting default value from params
				if (!value && params[key] && !(params[key] instanceof Object)) {
					value = params[key];
					usedPathParams[key] = value;
				}

				// Well, all is bad and setting value to empty string
				if (!value) {
					// Checking if it's mandatory param
					if (isMandatory) {
						return Observable.create(observer => {
							observer.onError(new Error('Mandatory ' + param + ' path parameter is missing'));
						});
					}
					url = url.substr(0, url.indexOf(param));
					break;
				}

				// Replacing in the url
				url = url.replace(param, value);

			}


			// Removing doulble slashed from final url
			let urlParts: string[] = url.split('//').filter(val => val !== '');
			url = urlParts[0];
			if (urlParts.length > 1) {
				url += '//' + urlParts.slice(1).join('/');
			}


			// Default search params or data

			let body = null;

			let searchParams;
			if (isGetRequest) {
				// GET
				searchParams = Object.assign({}, params, data);
			} else {
				// NON GET
				if (data) {
					body = JSON.stringify(data);
				}
				searchParams = params;
			}

			// Setting search params
			let search: URLSearchParams = new URLSearchParams();
			for (let key in searchParams) {
				if (!usedPathParams[key]) {
					let value = searchParams[key];
					if (value instanceof Object) {
						value = JSON.stringify(value);
					}
					search.append(key, value);
				}
			}



			// Creating request options
			let requestOptions = new RequestOptions({
				method: action.method,
				headers: headers,
				body: body,
				url: url,
				search: search
			});

			// Creating request object
			let req = new Request(requestOptions);

			if (action.requestInterceptor) {
				action.requestInterceptor(req);
			} else {
				this.requestInterceptor(req);
			}

			// Doing the request
			let observable: Observable<Response> = this.http.request(req);

			observable = action.responseInterceptor ?
				action.responseInterceptor(observable) : this.responseInterceptor(observable);

			let ret: ResourceResult;

			if (action.isPending) {
				ret = {};
			} else {
				ret = action.isArray ? [] : {};
			}

			ret.$resolved = false;
			ret.$observable = observable;

			if (action.isPending != null) {
				console.warn('isPending is deprecated. Please use isLazy instead');
				if (action.isLazy == null) {
					action.isLazy = action.isPending;
				}
			}

			if (!action.isLazy) {
				observable.subscribe(
					resp => {

						if (action.isArray) {
							if (!Array.isArray(resp)) {
								console.error('Returned data should be an array. Received', resp);
								return;
							}
							Array.prototype.push.apply(ret, resp);
						} else {
							if (Array.isArray(resp)) {
								console.error('Returned data should be an object. Received', resp);
								return;
							}
							Object.assign(ret, resp);
						}

					},
					err => {},
					() => {
						ret.$resolved = true;
						if (callback) {
							callback(ret);
						}
					}
				);
			}


			return ret;


		}

	};
}


export let RESOURCE_PROVIDERS: Provider[] = [];

export function ResourceProvide(): Function {
	return function() {
		console.warn('ResourceProvide decorator is deprecated.');
	}
}

export function ResourceParams(params: ResourceParamsBase) {

	return function(target: { new (http: Http): Resource }) {

		if (params.add2Provides !== false) {
			RESOURCE_PROVIDERS.push(provide(target, {
				useFactory: (http: Http) => new target(http),
				deps: [Http]
			}));
		}

		if (params.url) {
			target.prototype.getUrl = function() {
				return params.url;
			};
		}

		if (params.path) {
			target.prototype.getPath = function() {
				return params.path;
			};
		}

		if (params.headers) {
			target.prototype.getHeaders = function() {
				return params.headers;
			};
		}

		if (params.params) {
			target.prototype.getParams = function() {
				return params.params;
			};
		}

		if (params.data) {
			target.prototype.getData = function() {
				return params.data;
			};
		}

		if (params.requestInterceptor) {
			target.prototype.requestInterceptor = params.requestInterceptor;
		}

		if (params.responseInterceptor) {
			target.prototype.responseInterceptor = params.responseInterceptor;
		}

	};
}