import nodemailer, { type Transporter } from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  auth:
    | {
        user: string;
        pass: string;
      }
    | undefined;
}

const globalForSmtp = globalThis as unknown as {
  smtpTransporter: Transporter | undefined;
  smtpConfig: SmtpConfig | undefined;
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function getSmtpConfig(): SmtpConfig {
  if (globalForSmtp.smtpConfig) return globalForSmtp.smtpConfig;

  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = normalizeOptional(process.env.SMTP_USER);
  const pass = normalizeOptional(process.env.SMTP_PASS);
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(portRaw);
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);

  if (!host || !Number.isFinite(port) || !from) {
    throw new Error(
      "SMTP configuration is incomplete. Required: SMTP_HOST, SMTP_PORT, SMTP_FROM."
    );
  }

  if ((user && !pass) || (!user && pass)) {
    throw new Error(
      "SMTP auth configuration is incomplete. Set both SMTP_USER and SMTP_PASS, or leave both empty."
    );
  }

  const config: SmtpConfig = {
    host,
    port,
    secure,
    from,
    auth: user && pass ? { user, pass } : undefined,
  };
  globalForSmtp.smtpConfig = config;
  return config;
}

function getTransporter(): Transporter {
  if (globalForSmtp.smtpTransporter) return globalForSmtp.smtpTransporter;
  const config = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  globalForSmtp.smtpTransporter = transporter;
  return transporter;
}

export async function sendSmtpEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const config = getSmtpConfig();
  const transporter = getTransporter();
  await transporter.sendMail({
    from: config.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
