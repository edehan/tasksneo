import { lookupCountry } from "../lib/ip-geo.js";
import { sendEmail } from "../lib/mailer.js";
import { getLastBrowserSession } from "./session.service.js";
import { getConfigValue } from "./system-config.service.js";

const DEFAULT_APP_TITLE = "TaskNeo";

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildAlertHtml(
	appTitle: string,
	newCountry: string,
	newIp: string,
	newUa: string | null,
) {
	const accentColor = "#2C6E91";
	const safeTitle = escapeHtml(appTitle);

	const deviceInfo = newUa
		? `<p style="margin:0 0 8px;font-size:13px;color:#6b625c;">设备：${escapeHtml(newUa)}</p>`
		: "";

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#fffdf8;border-radius:8px;overflow:hidden;border:1px solid #e8e2d8;">
        <tr><td style="height:4px;background-color:${accentColor};"></td></tr>
        <tr><td style="padding:24px 32px 16px;">
          <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#8a8078;">${safeTitle}</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#2c2825;">你的账户在新地区登录</h2>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2c2825;">我们检测到你的 ${safeTitle} 账户刚刚在<strong>新的地区</strong>登录。</p>
          <p style="margin:0 0 8px;font-size:13px;color:#6b625c;">地区：${escapeHtml(newCountry)}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#6b625c;">IP：${escapeHtml(newIp)}</p>
          ${deviceInfo}
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#2c2825;">如果不是你本人操作，建议尽快修改密码以保障账户安全。</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e8e2d8;">
          <p style="margin:0;font-size:12px;color:#c0b8ad;text-align:center;">
            你收到这封邮件是因为你的 ${safeTitle} 账户触发了安全提醒。
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildAlertText(
	appTitle: string,
	newCountry: string,
	newIp: string,
	newUa: string | null,
): string {
	const lines = [
		`我们检测到你的 ${appTitle} 账户刚刚在新的地区登录。`,
		"",
		`地区：${newCountry}`,
		`IP：${newIp}`,
	];

	if (newUa) {
		lines.push(`设备：${newUa}`);
	}

	lines.push("", "如果不是你本人操作，建议尽快修改密码以保障账户安全。");

	return lines.join("\n");
}

/**
 * Compare the new login location with the last active browser session.
 * If the country differs, send an async email alert (non-blocking).
 */
export async function checkAndSendNewLocationAlert(
	userId: string,
	newIp: string | null,
	newUa: string | null,
	userEmail: string,
	excludeSessionId?: string,
): Promise<void> {
	if (!newIp) return;

	const newCountry = lookupCountry(newIp);
	if (!newCountry) return;

	const lastSession = await getLastBrowserSession(userId, excludeSessionId);
	if (!lastSession?.ipAddress) return;

	const prevCountry = lookupCountry(lastSession.ipAddress);
	if (!prevCountry) return;

	if (prevCountry === newCountry) return;

	const appTitle =
		(await getConfigValue("app.title"))?.trim() || DEFAULT_APP_TITLE;
	const subject = `[${appTitle}] 你的账户在新地区登录`;
	const text = buildAlertText(appTitle, newCountry, newIp, newUa);
	const html = buildAlertHtml(appTitle, newCountry, newIp, newUa);

	await sendEmail(userEmail, subject, text, html);
}
