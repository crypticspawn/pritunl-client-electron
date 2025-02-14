import http from "http"
import https from "https"
import tls from "tls"
import * as Logger from "./Logger"
import * as Errors from "./Errors"

export var DefaultTimeout = 20

export class Response {
	response: http.IncomingMessage
	headers: Map<string, string>
	status: number
	message: string
	data: string

	constructor(res: http.IncomingMessage) {
		this.response = res
		this.status = res.statusCode
		this.message = res.statusMessage
		this.data = ""
	}

	get(key: string): string {
		if (this.headers) {
			return this.headers.get(key)
		}

		let curKey: string = null
		let headers = new Map<string, string>()

		for (let item of this.response.rawHeaders) {
			if (curKey) {
				headers.set(curKey, item)
				curKey = null
			} else {
				curKey = item
			}
		}

		this.headers = headers

		return this.headers.get(key)
	}

	json(): any {
		try {
			return JSON.parse(this.data || null)
		} catch(err) {
			err = new Errors.ReadError(err, "Request: JSON parse failed")
			throw err
		}
	}

	jsonPassive(): any {
		try {
			return JSON.parse(this.data || null)
		} catch {
			return null
		}
	}

	string(): string {
		return this.data
	}
}

export class Request {
	ssl: boolean
	skipVerify: boolean
	hostname: string
	port: number
	socketPath: string
	ttl: number
	method: string
	path: string
	headers: Map<string, string>
	data: string

	constructor() {
		this.headers = new Map<string, string>()
	}

	tcp(host: string): Request {
		let hosts = host.split("://")

		this.ssl = hosts[0] === "https"

		hosts = hosts[1].split(":")

		if (hosts.length > 1) {
			this.port = parseInt(hosts.pop(), 10)
		} else {
			if (this.ssl) {
				this.port = 443
			} else {
				this.port = 80
			}
		}

		this.hostname = hosts.join(":")

		return this
	}

	unix(path: string): Request {
		this.socketPath = path
		return this
	}

	timeout(timeout: number): Request {
		this.ttl = timeout * 1000
		return this
	}

	get(path: string): Request {
		this.method = "GET"
		this.path = path
		return this
	}

	put(path: string): Request {
		this.method = "PUT"
		this.path = path
		return this
	}

	post(path: string): Request {
		this.method = "POST"
		this.path = path
		return this
	}

	delete(path: string): Request {
		this.method = "DELETE"
		this.path = path
		return this
	}

	set(key: string, value: string): Request {
		this.headers.set(key, value)
		return this
	}

	secure(secure: boolean): Request {
		this.skipVerify = !secure
		return this
	}

	send(data: string|object): Request {
		if (typeof data === "string") {
			this.data = data
		} else {
			this.headers.set("Content-Type", "application/json")
			this.data = JSON.stringify(data)
		}

		return this
	}

	end(): Promise<Response> {
		return new Promise<Response>((resolve, reject): void => {
			try {
				let options: https.RequestOptions = {
					path: this.path,
					method: this.method,
					headers: Object.fromEntries(this.headers)
				}

				if (this.socketPath) {
					options.socketPath = this.socketPath
				} else {
					options.hostname = this.hostname
					options.port = this.port
				}

				if (this.skipVerify) {
					options.rejectUnauthorized = false
				}

				options.timeout = this.ttl || (DefaultTimeout * 1000)

				let callback = (nodeResp: http.IncomingMessage) => {
					let resp = new Response(nodeResp)

					nodeResp.on("data", (data) => {
						if (data) {
							resp.data += data.toString()
						}
					})

					nodeResp.on("end", () => {
						resolve(resp)
					})
				}

				let req: http.ClientRequest
				if (this.ssl) {
					req = https.request(options, callback)
				} else {
					req = http.request(options, callback)
				}

				req.on("timeout", () => {
					let err = new Errors.RequestError(null, "Request: Timeout error")
					req.destroy(err)
					Logger.error(err)
					reject(err)
				})

				req.on("error", (err) => {
					err = new Errors.RequestError(err, "Request: Client error")
					Logger.error(err)
					reject(err)
				})

				if (this.data) {
					req.write(this.data)
				}

				req.end()
			} catch (err) {
				err = new Errors.RequestError(err, "Request: Exception")
				Logger.error(err)
				reject(err)
			}
		})
	}
}
