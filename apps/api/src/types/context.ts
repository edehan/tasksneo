import type { SessionKind } from "@taskflow/db";
import type { Logger } from "pino";

export interface AuthUser {
	userId: string;
	email: string;
}

export interface AuthSession {
	id: string;
	userId: string;
	kind: SessionKind;
	isTrusted: boolean;
	mcpKeyId: string | null;
}

export interface AppVariables {
	authUser?: AuthUser;
	authSession?: AuthSession;
	isAdmin?: boolean;
	requestId?: string;
	logger?: Logger;
}
