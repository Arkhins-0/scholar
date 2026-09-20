import { APP_NAME, APP_TAGLINE, ORG_NAME, appUrl } from "@/lib/site";

/**
 * Transactional email. Provider is chosen by EMAIL_PROVIDER:
 *   - "brevo": Brevo transactional API (BREVO_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME)
 *   - anything else / unset: "log" mode, which prints the message to the server log.
 * Delivery failures are swallowed: a notification must never break a workflow action.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  /** Large heading inside the email; defaults to the subject. */
  heading?: string;
  paragraphs: string[];
  /** A one-time code or password, rendered in monospace. */
  code?: { label: string; value: string };
  cta?: { label: string; url: string };
  footnote?: string;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderText(m: EmailMessage): string {
  const lines: string[] = [m.heading ?? m.subject, ""];
  for (const p of m.paragraphs) lines.push(p, "");
  if (m.code) lines.push(`${m.code.label}: ${m.code.value}`, "");
  if (m.cta) lines.push(`${m.cta.label}: ${m.cta.url}`, "");
  if (m.footnote) lines.push(m.footnote, "");
  lines.push(`-- ${APP_NAME} · ${ORG_NAME}`, appUrl("/"));
  return lines.join("\n");
}

export function renderHtml(m: EmailMessage): string {
  const heading = escapeHtml(m.heading ?? m.subject);
  const paragraphs = m.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2328;white-space:pre-line">${escapeHtml(p)}</p>`
    )
    .join("");
  const code = m.code
    ? `<div style="margin:18px 0;border:1px solid #d0d7de;background:#f6f8fa;padding:12px 14px">
         <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#59636e;margin-bottom:4px">${escapeHtml(m.code.label)}</div>
         <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:17px;color:#1f2328;word-break:break-all">${escapeHtml(m.code.value)}</div>
       </div>`
    : "";
  const cta = m.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 8px"><tr><td style="background:#1f883d;border:1px solid #1a7f37">
         <a href="${escapeHtml(m.cta.url)}" style="display:inline-block;padding:10px 18px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(m.cta.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#59636e">If the button does not work, copy this link into your browser:<br><a href="${escapeHtml(m.cta.url)}" style="color:#0969da;word-break:break-all">${escapeHtml(m.cta.url)}</a></p>`
    : "";
  const footnote = m.footnote
    ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#59636e">${escapeHtml(m.footnote)}</p>`
    : "";
  const host = appUrl("/").replace(/^https?:\/\//, "").replace(/\/$/, "");

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(m.subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fa;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d0d7de">
        <tr><td style="padding:18px 28px;border-bottom:1px solid #d0d7de;background:#f6f8fa">
          <img src="${escapeHtml(appUrl("/images/logo-128.png"))}" width="40" height="40" alt="${APP_NAME}" style="display:inline-block;width:40px;height:40px;vertical-align:middle;margin-right:12px;border:1px solid #d0d7de;border-radius:6px;background:#ffffff">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:600;color:#1f2328;vertical-align:middle">${APP_NAME}</span>
          <span style="float:right;font-size:12px;color:#59636e;line-height:24px">${APP_TAGLINE}</span>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;line-height:1.3;color:#1f2328">${heading}</h1>
          ${paragraphs}${code}${cta}${footnote}
        </td></tr>
        <tr><td style="padding:14px 28px;border-top:1px solid #d0d7de;font-size:12px;line-height:1.5;color:#59636e">
          ${ORG_NAME} · <a href="${escapeHtml(appUrl("/"))}" style="color:#0969da;text-decoration:none">${escapeHtml(host)}</a><br>
          You are receiving this because you have an account on the ${APP_TAGLINE}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendEmail(m: EmailMessage): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER ?? "log").toLowerCase();
  const apiKey = process.env.BREVO_API_KEY;

  if (provider !== "brevo" || !apiKey) {
    console.log(`[email:log] to=${m.to} subject="${m.subject}"\n${renderText(m)}`);
    return;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: {
          email: process.env.EMAIL_FROM ?? "no-reply@example.com",
          name: process.env.EMAIL_FROM_NAME ?? APP_NAME,
        },
        to: [{ email: m.to }],
        subject: m.subject,
        htmlContent: renderHtml(m),
        textContent: renderText(m),
        tags: ["scholar-track"],
      }),
    });
    if (!res.ok) {
      console.error("brevo send failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("email send failed", e);
  }
}
