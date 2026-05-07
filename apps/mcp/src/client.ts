export class TaskFlowApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
	) {
		super(message);
	}
}

interface McpExchangeResult {
	token: string;
	user: {
		id: string;
		email: string;
		nickname: string | null;
	};
}

export class TaskFlowClient {
	private token: string | null = null;
	private loginPromise: Promise<void> | null = null;
	private readonly apiUrl: string;
	private readonly mcpKey: string | null;

	constructor(config: {
		apiUrl: string;
		mcpKey?: string;
	}) {
		this.apiUrl = config.apiUrl.replace(/\/+$/, "");
		this.mcpKey = config.mcpKey ?? null;
	}

	async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		await this.ensureAuth();
		try {
			return await this.rawRequest<T>(method, path, body);
		} catch (err) {
			if (err instanceof TaskFlowApiError && err.status === 401) {
				// Session expired — exchange MCP key once and retry.
				this.token = null;
				await this.ensureAuth();
				return this.rawRequest<T>(method, path, body);
			}
			throw err;
		}
	}

	private async ensureAuth(): Promise<void> {
		if (this.token) return;

		if (this.loginPromise) {
			await this.loginPromise;
			return;
		}

		this.loginPromise = this.exchangeMcpKey();
		try {
			await this.loginPromise;
		} finally {
			this.loginPromise = null;
		}
	}

	private async exchangeMcpKey(): Promise<void> {
		if (!this.mcpKey) {
			throw new TaskFlowApiError(
				401,
				"NO_MCP_KEY",
				"Not authenticated. Set TASKFLOW_MCP_KEY before starting the MCP server.",
			);
		}

		const result = await this.rawRequest<McpExchangeResult>(
			"POST",
			"/auth/mcp",
			{ key: this.mcpKey },
			true,
		);
		this.token = result.token;
	}

	private async rawRequest<T>(
		method: string,
		path: string,
		body?: unknown,
		skipAuth = false,
	): Promise<T> {
		const headers: Record<string, string> = {};

		if (!skipAuth && this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}

		if (body !== undefined) {
			headers["Content-Type"] = "application/json";
		}

		let response: Response;
		try {
			response = await fetch(`${this.apiUrl}${path}`, {
				method,
				headers,
				body: body !== undefined ? JSON.stringify(body) : undefined,
			});
		} catch {
			throw new TaskFlowApiError(
				0,
				"CONNECTION_ERROR",
				`Cannot connect to TaskNeo API at ${this.apiUrl}. Make sure the server is running.`,
			);
		}

		if (!response.ok) {
			let code = "HTTP_ERROR";
			let message = `Request failed with status ${response.status}`;

			try {
				const json = (await response.json()) as {
					error?: string;
					code?: string;
				};
				if (json.error) message = json.error;
				if (json.code) code = json.code;
			} catch {
				// ignore parse errors
			}

			throw new TaskFlowApiError(response.status, code, message);
		}

		if (response.status === 204) {
			return undefined as T;
		}

		return (await response.json()) as T;
	}
}
