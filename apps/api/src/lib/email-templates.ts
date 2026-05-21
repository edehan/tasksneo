import type { AppLocale } from "./locale.js";

interface EmailRender {
	subject: string;
	text: string;
	html: string;
}

interface BaseEmailParams {
	appTitle: string;
}

interface LinkEmailParams extends BaseEmailParams {
	url: string;
}

interface EmailChangeVerificationParams extends LinkEmailParams {
	email: string;
}

interface EmailChangeSuccessParams extends BaseEmailParams {
	maskedNewEmail: string;
}

interface TaskNotificationParams extends BaseEmailParams {
	baseUrl: string;
	timezone: string;
	taskId: string;
	className: string;
	classColor: string;
	taskTitle: string;
	dueAt: string | null;
	type: "TASK_PUBLISHED" | "TASK_DUE_REMINDER";
}

interface AnnouncementParams extends BaseEmailParams {
	baseUrl: string;
	title: string;
	content: string;
}

interface CommentParams extends BaseEmailParams {
	baseUrl: string;
	taskId: string;
	className: string;
	classColor: string;
	taskTitle: string;
	commentAuthorName: string;
	commentContent: string;
	isReply: boolean;
}

const LANGUAGE_TAG: Record<AppLocale, string> = {
	en: "en",
	"zh-CN": "zh-CN",
	fr: "fr",
	ja: "ja",
};

const SECURITY_FOOTER: Record<AppLocale, (appTitle: string) => string> = {
	en: (appTitle) =>
		`You received this email because a security action was requested for your ${appTitle} account. This link expires in 1 hour. If this was not you, you can safely ignore this email.`,
	"zh-CN": (appTitle) =>
		`你收到这封邮件是因为 ${appTitle} 账户触发了安全操作请求。链接将在 1 小时后失效；如果不是你本人操作，可以安全忽略本邮件。`,
	fr: (appTitle) =>
		`Vous recevez cet e-mail car une action de securite a ete demandee pour votre compte ${appTitle}. Ce lien expire dans 1 heure. Si ce n'etait pas vous, vous pouvez ignorer cet e-mail.`,
	ja: (appTitle) =>
		`${appTitle} アカウントでセキュリティ操作がリクエストされたため、このメールをお送りしています。このリンクは1時間で期限切れになります。心当たりがない場合は、このメールを無視できます。`,
};

const LINK_HELP: Record<AppLocale, string> = {
	en: "If the button does not work, copy and paste this link into your browser:",
	"zh-CN": "如果按钮无法点击，请复制下面的链接到浏览器打开：",
	fr: "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
	ja: "ボタンが使えない場合は、次のリンクをブラウザにコピーしてください：",
};

const UNSUBSCRIBE: Record<AppLocale, string> = {
	en: "Unsubscribe",
	"zh-CN": "退订通知",
	fr: "Se desabonner",
	ja: "通知を停止",
};

const SENT_BY: Record<AppLocale, string> = {
	en: "Sent by",
	"zh-CN": "此邮件由",
	fr: "Envoye par",
	ja: "送信元",
};

const AUTO_SENT: Record<AppLocale, string> = {
	en: "",
	"zh-CN": "自动发送",
	fr: "",
	ja: "自動送信",
};

const DUE_UNSET: Record<AppLocale, string> = {
	en: "Not set",
	"zh-CN": "未设置",
	fr: "Non defini",
	ja: "未設定",
};

const TASK_LABEL: Record<AppLocale, string> = {
	en: "Task",
	"zh-CN": "任务名称",
	fr: "Tache",
	ja: "タスク",
};

const DUE_LABEL: Record<AppLocale, string> = {
	en: "Due",
	"zh-CN": "截止时间",
	fr: "Echeance",
	ja: "期限",
};

const VIEW_TASK: Record<AppLocale, string> = {
	en: "View Task",
	"zh-CN": "查看任务",
	fr: "Voir la tache",
	ja: "タスクを見る",
};

export function formatDueAt(
	isoString: string | null,
	timezone: string,
	locale: AppLocale,
): string {
	if (!isoString) {
		return DUE_UNSET[locale];
	}

	try {
		const date = new Date(isoString);

		return `${new Intl.DateTimeFormat(locale, {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}).format(date)} (${timezone})`;
	} catch {
		return isoString;
	}
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function lineBreaks(str: string): string {
	return escapeHtml(str).replace(/\n/g, "<br>");
}

function footerLine(
	locale: AppLocale,
	appTitle: string,
	unsubscribeUrl: string,
) {
	const suffix = AUTO_SENT[locale] ? ` ${AUTO_SENT[locale]}` : "";
	return `${SENT_BY[locale]} ${escapeHtml(appTitle)}${suffix} &middot; <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a8078;text-decoration:underline;">${UNSUBSCRIBE[locale]}</a>`;
}

function shell(params: {
	locale: AppLocale;
	appTitle: string;
	accentColor: string;
	body: string;
	footer: string;
	kicker?: string;
}) {
	const safeTitle = escapeHtml(params.appTitle);
	const lang = LANGUAGE_TAG[params.locale];
	const kicker = params.kicker ?? safeTitle;

	return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#fffdf8;border-radius:8px;overflow:hidden;border:1px solid #e8e2d8;">
        <tr><td style="height:4px;background-color:${params.accentColor};"></td></tr>
        <tr><td style="padding:24px 32px 16px;">
          <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#8a8078;">${kicker}</p>
        </td></tr>
        ${params.body}
        <tr><td style="padding:16px 32px;border-top:1px solid #e8e2d8;">
          <p style="margin:0;font-size:12px;color:#c0b8ad;text-align:center;">${params.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaBlock(url: string, label: string, accentColor: string) {
	const safeUrl = escapeHtml(url);
	return `<tr><td style="padding:0 32px 32px;" align="center">
          <a href="${safeUrl}" style="display:inline-block;padding:10px 28px;background-color:${accentColor};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
        </td></tr>`;
}

function linkHelpBlock(locale: AppLocale, url: string) {
	const safeUrl = escapeHtml(url);
	return `<tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b625c;">${LINK_HELP[locale]}</p>
          <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${safeUrl}" style="color:#2C6E91;text-decoration:underline;">${safeUrl}</a></p>
        </td></tr>`;
}

function renderVerificationEmail(params: {
	locale: AppLocale;
	appTitle: string;
	subject: string;
	text: string;
	heading: string;
	bodyHtml: string;
	ctaLabel: string;
	url: string;
}): EmailRender {
	const accentColor = "#2C6E91";
	const body = `<tr><td style="padding:0 32px 24px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#2c2825;">${escapeHtml(params.heading)}</h2>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#2c2825;">${params.bodyHtml}</p>
        </td></tr>
        ${ctaBlock(params.url, params.ctaLabel, accentColor)}
        ${linkHelpBlock(params.locale, params.url)}`;

	return {
		subject: params.subject,
		text: params.text,
		html: shell({
			locale: params.locale,
			appTitle: params.appTitle,
			accentColor,
			body,
			footer: SECURITY_FOOTER[params.locale](params.appTitle),
		}),
	};
}

export function renderRegistrationVerificationEmail(
	locale: AppLocale,
	params: LinkEmailParams,
): EmailRender {
	const byLocale: Record<
		AppLocale,
		Omit<
			Parameters<typeof renderVerificationEmail>[0],
			"locale" | "appTitle" | "url"
		>
	> = {
		en: {
			subject: `[${params.appTitle}] Verify your email`,
			text: `You received this email because someone started a ${params.appTitle} registration with this address.\n\nOpen this link to verify your email:\n${params.url}\n\nFor security, this link is valid for 1 hour. If this was not you, you can safely ignore this email.`,
			heading: "Verify your email",
			bodyHtml: `We received a request to create a ${escapeHtml(params.appTitle)} account with this email. Select the button below to continue.`,
			ctaLabel: "Verify Email",
		},
		"zh-CN": {
			subject: `[${params.appTitle}] 请验证你的邮箱`,
			text: `你收到这封邮件，是因为有人使用此邮箱发起了 ${params.appTitle} 注册。\n\n请打开以下链接完成邮箱验证：\n${params.url}\n\n出于安全考虑，该链接 1 小时内有效。如果不是你本人操作，可以安全忽略本邮件。`,
			heading: "验证你的邮箱",
			bodyHtml: `我们收到了使用此邮箱注册 ${escapeHtml(params.appTitle)} 账户的请求。请点击下方按钮继续。`,
			ctaLabel: "立即验证邮箱",
		},
		fr: {
			subject: `[${params.appTitle}] Verifiez votre e-mail`,
			text: `Vous recevez cet e-mail car quelqu'un a commence une inscription ${params.appTitle} avec cette adresse.\n\nOuvrez ce lien pour verifier votre e-mail :\n${params.url}\n\nPour votre securite, ce lien est valable 1 heure. Si ce n'etait pas vous, vous pouvez ignorer cet e-mail.`,
			heading: "Verifiez votre e-mail",
			bodyHtml: `Nous avons recu une demande de creation de compte ${escapeHtml(params.appTitle)} avec cette adresse. Selectionnez le bouton ci-dessous pour continuer.`,
			ctaLabel: "Verifier l'e-mail",
		},
		ja: {
			subject: `[${params.appTitle}] メールアドレスを確認してください`,
			text: `このメールアドレスで ${params.appTitle} の登録が開始されたため、このメールをお送りしています。\n\n次のリンクを開いてメールアドレスを確認してください：\n${params.url}\n\n安全のため、このリンクは1時間のみ有効です。心当たりがない場合は、このメールを無視できます。`,
			heading: "メールアドレスを確認してください",
			bodyHtml: `このメールアドレスで ${escapeHtml(params.appTitle)} アカウントを作成するリクエストを受け取りました。下のボタンから続行してください。`,
			ctaLabel: "メールを確認",
		},
	};

	return renderVerificationEmail({
		locale,
		appTitle: params.appTitle,
		url: params.url,
		...byLocale[locale],
	});
}

export function renderExistingAccountEmail(
	locale: AppLocale,
	params: LinkEmailParams,
): EmailRender {
	const byLocale: Record<
		AppLocale,
		Omit<
			Parameters<typeof renderVerificationEmail>[0],
			"locale" | "appTitle" | "url"
		>
	> = {
		en: {
			subject: `[${params.appTitle}] Your account already exists`,
			text: `You received this email because someone tried to register a ${params.appTitle} account with this address.\n\nThis email already has a ${params.appTitle} account. If you forgot your password, use this link to reset it or sign in with a one-time link:\n${params.url}\n\nFor security, this link is valid for 1 hour. If this was not you, you can safely ignore this email.`,
			heading: "Account already exists",
			bodyHtml: `This email already has a ${escapeHtml(params.appTitle)} account. If you forgot your password, use the link below to recover your account.`,
			ctaLabel: "Recover Account",
		},
		"zh-CN": {
			subject: `您的 ${params.appTitle} 账号已存在`,
			text: `你收到这封邮件，是因为有人尝试使用此邮箱注册 ${params.appTitle} 账号。\n\n该邮箱已经有一个 ${params.appTitle} 账号。如果你忘记密码，可以使用下面的链接重置密码，或在页面上选择使用一次性链接直接登录：\n${params.url}\n\n出于安全考虑，该链接 1 小时内有效。如果不是你本人操作，可以安全忽略本邮件。`,
			heading: "账号已存在",
			bodyHtml: `该邮箱已经有一个 ${escapeHtml(params.appTitle)} 账号。如果你忘记密码，可以使用下方链接重置密码，或在页面上选择使用一次性链接直接登录。`,
			ctaLabel: "前往账号恢复",
		},
		fr: {
			subject: `[${params.appTitle}] Votre compte existe deja`,
			text: `Vous recevez cet e-mail car quelqu'un a essaye d'inscrire un compte ${params.appTitle} avec cette adresse.\n\nCette adresse possede deja un compte ${params.appTitle}. Si vous avez oublie votre mot de passe, utilisez ce lien pour le reinitialiser ou vous connecter avec un lien a usage unique :\n${params.url}\n\nPour votre securite, ce lien est valable 1 heure. Si ce n'etait pas vous, vous pouvez ignorer cet e-mail.`,
			heading: "Compte deja existant",
			bodyHtml: `Cette adresse possede deja un compte ${escapeHtml(params.appTitle)}. Si vous avez oublie votre mot de passe, utilisez le lien ci-dessous pour recuperer votre compte.`,
			ctaLabel: "Recuperer le compte",
		},
		ja: {
			subject: `[${params.appTitle}] アカウントは既に存在します`,
			text: `このメールアドレスで ${params.appTitle} アカウントの登録が試行されたため、このメールをお送りしています。\n\nこのメールアドレスには既に ${params.appTitle} アカウントがあります。パスワードを忘れた場合は、次のリンクから再設定するか、ワンタイムリンクでサインインできます：\n${params.url}\n\n安全のため、このリンクは1時間のみ有効です。心当たりがない場合は、このメールを無視できます。`,
			heading: "アカウントは既に存在します",
			bodyHtml: `このメールアドレスには既に ${escapeHtml(params.appTitle)} アカウントがあります。パスワードを忘れた場合は、下のリンクからアカウントを復旧できます。`,
			ctaLabel: "アカウントを復旧",
		},
	};

	return renderVerificationEmail({
		locale,
		appTitle: params.appTitle,
		url: params.url,
		...byLocale[locale],
	});
}

export function renderPasswordResetEmail(
	locale: AppLocale,
	params: LinkEmailParams,
): EmailRender {
	const byLocale: Record<
		AppLocale,
		Omit<
			Parameters<typeof renderVerificationEmail>[0],
			"locale" | "appTitle" | "url"
		>
	> = {
		en: {
			subject: `[${params.appTitle}] Reset your password`,
			text: `You received this email because someone requested a password reset for your ${params.appTitle} account.\n\nOpen this link to set a new password:\n${params.url}\n\nFor security, this link is valid for 1 hour. If this was not you, you can safely ignore this email.`,
			heading: "Reset password",
			bodyHtml: `We received a password reset request for your ${escapeHtml(params.appTitle)} account. Select the button below to set a new password.`,
			ctaLabel: "Set New Password",
		},
		"zh-CN": {
			subject: `[${params.appTitle}] 重置你的密码`,
			text: `你收到这封邮件，是因为有人为你的 ${params.appTitle} 账户发起了密码重置请求。\n\n请打开以下链接设置新密码：\n${params.url}\n\n出于安全考虑，该链接 1 小时内有效。如果不是你本人操作，可以安全忽略本邮件。`,
			heading: "重置密码",
			bodyHtml: `我们收到了你的 ${escapeHtml(params.appTitle)} 账户密码重置请求。请点击下方按钮设置新密码。`,
			ctaLabel: "设置新密码",
		},
		fr: {
			subject: `[${params.appTitle}] Reinitialisez votre mot de passe`,
			text: `Vous recevez cet e-mail car une reinitialisation de mot de passe a ete demandee pour votre compte ${params.appTitle}.\n\nOuvrez ce lien pour definir un nouveau mot de passe :\n${params.url}\n\nPour votre securite, ce lien est valable 1 heure. Si ce n'etait pas vous, vous pouvez ignorer cet e-mail.`,
			heading: "Reinitialiser le mot de passe",
			bodyHtml: `Nous avons recu une demande de reinitialisation du mot de passe pour votre compte ${escapeHtml(params.appTitle)}. Selectionnez le bouton ci-dessous pour definir un nouveau mot de passe.`,
			ctaLabel: "Definir un mot de passe",
		},
		ja: {
			subject: `[${params.appTitle}] パスワードを再設定してください`,
			text: `${params.appTitle} アカウントのパスワード再設定がリクエストされたため、このメールをお送りしています。\n\n次のリンクを開いて新しいパスワードを設定してください：\n${params.url}\n\n安全のため、このリンクは1時間のみ有効です。心当たりがない場合は、このメールを無視できます。`,
			heading: "パスワードを再設定",
			bodyHtml: `${escapeHtml(params.appTitle)} アカウントのパスワード再設定リクエストを受け取りました。下のボタンから新しいパスワードを設定してください。`,
			ctaLabel: "新しいパスワードを設定",
		},
	};

	return renderVerificationEmail({
		locale,
		appTitle: params.appTitle,
		url: params.url,
		...byLocale[locale],
	});
}

export function renderEmailChangeVerificationEmail(
	locale: AppLocale,
	params: EmailChangeVerificationParams,
): EmailRender {
	const safeEmail = escapeHtml(params.email);
	const byLocale: Record<
		AppLocale,
		Omit<
			Parameters<typeof renderVerificationEmail>[0],
			"locale" | "appTitle" | "url"
		>
	> = {
		en: {
			subject: `[${params.appTitle}] Confirm your new email`,
			text: `You received this email because someone is trying to change a ${params.appTitle} account email to this address (${params.email}).\n\nIf this was you, open this link to confirm the change:\n${params.url}\n\nUntil confirmed, the account will keep using the previous email. This link is valid for 1 hour. If this was not you, you can safely ignore this email.`,
			heading: "Confirm new email",
			bodyHtml: `We received a request to change a ${escapeHtml(params.appTitle)} account email to this address (<strong>${safeEmail}</strong>). If this was you, select the button below to confirm.`,
			ctaLabel: "Confirm Email Change",
		},
		"zh-CN": {
			subject: `[${params.appTitle}] 确认你的新邮箱`,
			text: `你收到这封邮件，是因为有人正在尝试将一个 ${params.appTitle} 账号的邮箱修改为本邮箱（${params.email}）。\n\n如果这是你本人操作，请打开以下链接确认改绑：\n${params.url}\n\n确认前，该账号仍会继续使用原邮箱。出于安全考虑，该链接 1 小时内有效。如果不是你本人操作，可以安全忽略本邮件。`,
			heading: "确认新邮箱",
			bodyHtml: `我们收到请求：将一个 ${escapeHtml(params.appTitle)} 账号的邮箱修改为本邮箱（<strong>${safeEmail}</strong>）。如果这是你本人操作，请点击下方按钮确认。确认前，该账号仍会继续使用原邮箱。`,
			ctaLabel: "确认邮箱修改",
		},
		fr: {
			subject: `[${params.appTitle}] Confirmez votre nouvel e-mail`,
			text: `Vous recevez cet e-mail car quelqu'un tente de remplacer l'e-mail d'un compte ${params.appTitle} par cette adresse (${params.email}).\n\nSi c'est vous, ouvrez ce lien pour confirmer :\n${params.url}\n\nTant que ce n'est pas confirme, le compte utilisera l'ancienne adresse. Ce lien est valable 1 heure. Si ce n'etait pas vous, vous pouvez ignorer cet e-mail.`,
			heading: "Confirmer le nouvel e-mail",
			bodyHtml: `Nous avons recu une demande de remplacement de l'e-mail d'un compte ${escapeHtml(params.appTitle)} par cette adresse (<strong>${safeEmail}</strong>). Si c'est vous, selectionnez le bouton ci-dessous.`,
			ctaLabel: "Confirmer l'e-mail",
		},
		ja: {
			subject: `[${params.appTitle}] 新しいメールアドレスを確認してください`,
			text: `${params.appTitle} アカウントのメールアドレスをこのアドレス（${params.email}）に変更するリクエストがあったため、このメールをお送りしています。\n\nご本人の操作であれば、次のリンクを開いて確認してください：\n${params.url}\n\n確認が完了するまで、アカウントは以前のメールアドレスを使用します。このリンクは1時間のみ有効です。心当たりがない場合は、このメールを無視できます。`,
			heading: "新しいメールアドレスを確認",
			bodyHtml: `${escapeHtml(params.appTitle)} アカウントのメールアドレスをこのアドレス（<strong>${safeEmail}</strong>）に変更するリクエストを受け取りました。ご本人の操作であれば、下のボタンから確認してください。`,
			ctaLabel: "メール変更を確認",
		},
	};

	return renderVerificationEmail({
		locale,
		appTitle: params.appTitle,
		url: params.url,
		...byLocale[locale],
	});
}

export function renderEmailChangeSuccessEmail(
	locale: AppLocale,
	params: EmailChangeSuccessParams,
): EmailRender {
	const byLocale = {
		en: {
			subject: `[${params.appTitle}] Your email was changed`,
			heading: "Email changed",
			text: `Your ${params.appTitle} account email was changed to ${params.maskedNewEmail}.\n\nIf this was not you, contact support immediately.`,
			body: `Your ${escapeHtml(params.appTitle)} account email was changed to <strong>${escapeHtml(params.maskedNewEmail)}</strong>.<br><br>If this was not you, contact support immediately.`,
		},
		"zh-CN": {
			subject: `[${params.appTitle}] 你的邮箱已修改`,
			heading: "邮箱已修改",
			text: `你的 ${params.appTitle} 账号邮箱已成功修改为 ${params.maskedNewEmail}。\n\n如果这不是你本人操作，请立即联系支持团队。`,
			body: `你的 ${escapeHtml(params.appTitle)} 账号邮箱已成功修改为 <strong>${escapeHtml(params.maskedNewEmail)}</strong>。<br><br>如果这不是你本人操作，请立即联系支持团队。`,
		},
		fr: {
			subject: `[${params.appTitle}] Votre e-mail a ete modifie`,
			heading: "E-mail modifie",
			text: `L'e-mail de votre compte ${params.appTitle} a ete remplace par ${params.maskedNewEmail}.\n\nSi ce n'etait pas vous, contactez immediatement le support.`,
			body: `L'e-mail de votre compte ${escapeHtml(params.appTitle)} a ete remplace par <strong>${escapeHtml(params.maskedNewEmail)}</strong>.<br><br>Si ce n'etait pas vous, contactez immediatement le support.`,
		},
		ja: {
			subject: `[${params.appTitle}] メールアドレスが変更されました`,
			heading: "メールアドレスが変更されました",
			text: `${params.appTitle} アカウントのメールアドレスが ${params.maskedNewEmail} に変更されました。\n\n心当たりがない場合は、すぐにサポートへ連絡してください。`,
			body: `${escapeHtml(params.appTitle)} アカウントのメールアドレスが <strong>${escapeHtml(params.maskedNewEmail)}</strong> に変更されました。<br><br>心当たりがない場合は、すぐにサポートへ連絡してください。`,
		},
	} satisfies Record<
		AppLocale,
		{ subject: string; heading: string; text: string; body: string }
	>;
	const copy = byLocale[locale];

	return {
		subject: copy.subject,
		text: copy.text,
		html: shell({
			locale,
			appTitle: params.appTitle,
			accentColor: "#2C6E91",
			body: `<tr><td style="padding:0 32px 24px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#2c2825;">${escapeHtml(copy.heading)}</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#2c2825;">${copy.body}</p>
        </td></tr>`,
			footer: SECURITY_FOOTER[locale](params.appTitle),
		}),
	};
}

export function renderTaskNotificationEmail(
	locale: AppLocale,
	params: TaskNotificationParams,
): EmailRender {
	const dueText = formatDueAt(params.dueAt, params.timezone, locale);
	const taskUrl = `${params.baseUrl}/tasks/${encodeURIComponent(params.taskId)}`;
	const unsubscribeUrl = `${params.baseUrl}/settings/notifications`;
	const published = params.type === "TASK_PUBLISHED";
	const subject = published
		? {
				en: `[${params.appTitle}] New task: ${params.taskTitle}`,
				"zh-CN": `[${params.appTitle}] 新任务：${params.taskTitle}`,
				fr: `[${params.appTitle}] Nouvelle tache : ${params.taskTitle}`,
				ja: `[${params.appTitle}] 新しいタスク：${params.taskTitle}`,
			}[locale]
		: {
				en: `[${params.appTitle}] Task due soon: ${params.taskTitle}`,
				"zh-CN": `[${params.appTitle}] 任务截止提醒：${params.taskTitle}`,
				fr: `[${params.appTitle}] Tache bientot due : ${params.taskTitle}`,
				ja: `[${params.appTitle}] タスク期限のリマインダー：${params.taskTitle}`,
			}[locale];
	const heading = published
		? {
				en: `Class <strong>${escapeHtml(params.className)}</strong> published a new task`,
				"zh-CN": `班级 <strong>${escapeHtml(params.className)}</strong> 发布了新任务`,
				fr: `La classe <strong>${escapeHtml(params.className)}</strong> a publie une nouvelle tache`,
				ja: `クラス <strong>${escapeHtml(params.className)}</strong> に新しいタスクが公開されました`,
			}[locale]
		: {
				en: `A task in <strong>${escapeHtml(params.className)}</strong> is due soon`,
				"zh-CN": `你在班级 <strong>${escapeHtml(params.className)}</strong> 中有一个任务即将到期`,
				fr: `Une tache dans <strong>${escapeHtml(params.className)}</strong> arrive bientot a echeance`,
				ja: `<strong>${escapeHtml(params.className)}</strong> のタスク期限が近づいています`,
			}[locale];
	const text = published
		? {
				en: `Class ${params.className} published a new task.\n\nTask: ${params.taskTitle}\nDue: ${dueText}`,
				"zh-CN": `班级 ${params.className} 发布了新任务。\n\n任务名称：${params.taskTitle}\n截止时间：${dueText}`,
				fr: `La classe ${params.className} a publie une nouvelle tache.\n\nTache : ${params.taskTitle}\nEcheance : ${dueText}`,
				ja: `クラス ${params.className} に新しいタスクが公開されました。\n\nタスク：${params.taskTitle}\n期限：${dueText}`,
			}[locale]
		: {
				en: `A task in ${params.className} is due soon.\n\nTask: ${params.taskTitle}\nDue: ${dueText}`,
				"zh-CN": `你在班级 ${params.className} 中有一个任务即将到期。\n\n任务名称：${params.taskTitle}\n截止时间：${dueText}`,
				fr: `Une tache dans ${params.className} arrive bientot a echeance.\n\nTache : ${params.taskTitle}\nEcheance : ${dueText}`,
				ja: `${params.className} のタスク期限が近づいています。\n\nタスク：${params.taskTitle}\n期限：${dueText}`,
			}[locale];

	const body = `<tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2c2825;">${heading}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f6f0;border-radius:6px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px;font-size:14px;color:#8a8078;">${TASK_LABEL[locale]}</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#2c2825;">${escapeHtml(params.taskTitle)}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#8a8078;">${DUE_LABEL[locale]}</p>
              <p style="margin:0;font-size:15px;color:#2c2825;">${escapeHtml(dueText)}</p>
            </td></tr>
          </table>
        </td></tr>
        ${ctaBlock(taskUrl, VIEW_TASK[locale], params.classColor || "#7B6CB0")}`;

	return {
		subject,
		text,
		html: shell({
			locale,
			appTitle: params.appTitle,
			accentColor: params.classColor || "#7B6CB0",
			body,
			footer: footerLine(locale, params.appTitle, unsubscribeUrl),
		}),
	};
}

export function renderAnnouncementEmail(
	locale: AppLocale,
	params: AnnouncementParams,
): EmailRender {
	const unsubscribeUrl = `${params.baseUrl}/settings/notifications`;
	const label = {
		en: "System announcement",
		"zh-CN": "系统公告",
		fr: "Annonce systeme",
		ja: "システム告知",
	}[locale];

	return {
		subject: `[${params.appTitle}] ${label}: ${params.title}`,
		text: `${label}\n\n${params.title}\n\n${params.content}`,
		html: shell({
			locale,
			appTitle: params.appTitle,
			accentColor: "#C4785B",
			kicker: `${escapeHtml(params.appTitle)} · ${label}`,
			body: `<tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:18px;font-weight:600;line-height:1.4;color:#2c2825;">${escapeHtml(params.title)}</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#2c2825;">${lineBreaks(params.content)}</p>
        </td></tr>`,
			footer: footerLine(locale, params.appTitle, unsubscribeUrl),
		}),
	};
}

export function renderCommentEmail(
	locale: AppLocale,
	params: CommentParams,
): EmailRender {
	const taskUrl = `${params.baseUrl}/tasks/${encodeURIComponent(params.taskId)}`;
	const unsubscribeUrl = `${params.baseUrl}/settings/notifications`;
	const subject = params.isReply
		? {
				en: `[${params.appTitle}] ${params.commentAuthorName} replied to you on "${params.taskTitle}"`,
				"zh-CN": `[${params.appTitle}] ${params.commentAuthorName} 回复了你的任务评论`,
				fr: `[${params.appTitle}] ${params.commentAuthorName} vous a repondu sur "${params.taskTitle}"`,
				ja: `[${params.appTitle}] ${params.commentAuthorName} さんが「${params.taskTitle}」で返信しました`,
			}[locale]
		: {
				en: `[${params.appTitle}] New comment on "${params.taskTitle}"`,
				"zh-CN": `[${params.appTitle}] 任务「${params.taskTitle}」有新评论`,
				fr: `[${params.appTitle}] Nouveau commentaire sur "${params.taskTitle}"`,
				ja: `[${params.appTitle}] 「${params.taskTitle}」に新しいコメントがあります`,
			}[locale];
	const action = params.isReply
		? {
				en: `${params.commentAuthorName} replied to you`,
				"zh-CN": `${params.commentAuthorName} 回复了你`,
				fr: `${params.commentAuthorName} vous a repondu`,
				ja: `${params.commentAuthorName} さんがあなたに返信しました`,
			}[locale]
		: {
				en: `${params.commentAuthorName} commented`,
				"zh-CN": `${params.commentAuthorName} 发表了评论`,
				fr: `${params.commentAuthorName} a commente`,
				ja: `${params.commentAuthorName} さんがコメントしました`,
			}[locale];
	const heading = {
		en: `${escapeHtml(action)} on a task in <strong>${escapeHtml(params.className)}</strong>`,
		"zh-CN": `${escapeHtml(action)}，来自班级 <strong>${escapeHtml(params.className)}</strong> 的任务`,
		fr: `${escapeHtml(action)} sur une tache dans <strong>${escapeHtml(params.className)}</strong>`,
		ja: `<strong>${escapeHtml(params.className)}</strong> のタスクで${escapeHtml(action)}`,
	}[locale];

	return {
		subject,
		text: `${action} on "${params.taskTitle}" in ${params.className}:\n\n${params.commentContent}`,
		html: shell({
			locale,
			appTitle: params.appTitle,
			accentColor: params.classColor || "#7B6CB0",
			body: `<tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2c2825;">${heading}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f6f0;border-radius:6px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px;font-size:14px;color:#8a8078;">${escapeHtml(params.taskTitle)}</p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#2c2825;">${lineBreaks(params.commentContent)}</p>
            </td></tr>
          </table>
        </td></tr>
        ${ctaBlock(taskUrl, VIEW_TASK[locale], params.classColor || "#7B6CB0")}`,
			footer: footerLine(locale, params.appTitle, unsubscribeUrl),
		}),
	};
}
