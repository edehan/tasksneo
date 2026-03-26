export interface AuthUser {
	userId: string;
	email: string;
}

export interface AppVariables {
	authUser?: AuthUser;
	isAdmin?: boolean;
}
