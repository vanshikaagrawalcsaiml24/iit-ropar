import nodemailer from 'nodemailer';

// ============================================
// SMTP TRANSPORT
// ============================================

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a random token for deletion confirmation
 */
export function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ============================================
// EMAIL TEMPLATES
// ============================================

const baseStyles = `
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background-color: #060d1b;
  color: #f1f5f9;
`;

const cardStyles = `
  background: #0f1f3a;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  margin: 32px auto;
`;

const otpStyles = `
  font-family: 'Courier New', monospace;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 8px;
  color: #60a5fa;
  background: rgba(59,130,246,0.08);
  border: 1px dashed rgba(59,130,246,0.3);
  border-radius: 10px;
  padding: 16px 24px;
  text-align: center;
  margin: 24px 0;
`;

const footerStyles = `
  color: #64748b;
  font-size: 12px;
  text-align: center;
  margin-top: 24px;
`;

// ============================================
// SEND FUNCTIONS
// ============================================

/**
 * Send email verification OTP
 */
export async function sendVerificationEmail(
  to: string,
  username: string,
  code: string
): Promise<boolean> {
  try {
    const mail = getTransporter();
    await mail.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: '🔐 Verify your IIT Ropar FAQ account',
      html: `
        <div style="${baseStyles}">
          <div style="${cardStyles}">
            <h2 style="margin:0 0 8px; font-size:1.4rem;">Welcome, ${username}! 👋</h2>
            <p style="color:#94a3b8; margin:0 0 16px;">
              Enter this verification code to activate your account:
            </p>
            <div style="${otpStyles}">${code}</div>
            <p style="color:#94a3b8; font-size:0.85rem; margin:0;">
              This code expires in <strong>10 minutes</strong>. If you didn't create an account, ignore this email.
            </p>
            <div style="${footerStyles}">
              IIT Ropar FAQ — Crowdsource Knowledge Platform
            </div>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

/**
 * Send account deletion confirmation email
 */
export async function sendDeletionConfirmEmail(
  to: string,
  username: string,
  token: string
): Promise<boolean> {
  try {
    const mail = getTransporter();
    await mail.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: '⚠️ Account Deletion Confirmation — IIT Ropar FAQ',
      html: `
        <div style="${baseStyles}">
          <div style="${cardStyles}">
            <h2 style="margin:0 0 8px; font-size:1.4rem; color:#f87171;">Account Deletion Request ⚠️</h2>
            <p style="color:#94a3b8; margin:0 0 16px;">
              Hi <strong>${username}</strong>, we received a request to permanently delete your account.
            </p>
            <p style="color:#94a3b8; margin:0 0 8px;">
              Enter this confirmation code to proceed:
            </p>
            <div style="${otpStyles}; color:#f87171; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.08);">${token.slice(0, 8).toUpperCase()}</div>
            <p style="color:#f87171; font-size:0.85rem; margin:0 0 16px; font-weight:600;">
              ⚠️ This action is PERMANENT and cannot be undone.
            </p>
            <p style="color:#94a3b8; font-size:0.85rem; margin:0;">
              This code expires in <strong>1 hour</strong>. If you didn't request this, secure your account immediately.
            </p>
            <div style="${footerStyles}">
              IIT Ropar FAQ — Crowdsource Knowledge Platform
            </div>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send deletion email:', error);
    return false;
  }
}

/**
 * Send account locked notification email
 */
export async function sendAccountLockedEmail(
  to: string,
  username: string
): Promise<boolean> {
  try {
    const mail = getTransporter();
    await mail.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: '🔒 Account Locked — IIT Ropar FAQ',
      html: `
        <div style="${baseStyles}">
          <div style="${cardStyles}">
            <h2 style="margin:0 0 8px; font-size:1.4rem; color:#fbbf24;">Account Locked 🔒</h2>
            <p style="color:#94a3b8; margin:0 0 16px;">
              Hi <strong>${username}</strong>, your account has been temporarily locked after 3 failed login attempts.
            </p>
            <p style="color:#94a3b8; margin:0 0 8px;">
              You can unlock your account by:
            </p>
            <ul style="color:#94a3b8; font-size:0.9rem; padding-left:20px;">
              <li>Waiting 15 minutes for the automatic unlock</li>
              <li>Using the "Unlock via Email" option on the login page</li>
            </ul>
            <p style="color:#94a3b8; font-size:0.85rem; margin:16px 0 0;">
              If this wasn't you, someone may be trying to access your account. Consider changing your password.
            </p>
            <div style="${footerStyles}">
              IIT Ropar FAQ — Crowdsource Knowledge Platform
            </div>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send lock email:', error);
    return false;
  }
}

/**
 * Send account unlock OTP email
 */
export async function sendUnlockEmail(
  to: string,
  username: string,
  code: string
): Promise<boolean> {
  try {
    const mail = getTransporter();
    await mail.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: '🔓 Unlock Your Account — IIT Ropar FAQ',
      html: `
        <div style="${baseStyles}">
          <div style="${cardStyles}">
            <h2 style="margin:0 0 8px; font-size:1.4rem;">Unlock Your Account 🔓</h2>
            <p style="color:#94a3b8; margin:0 0 16px;">
              Hi <strong>${username}</strong>, enter this code to unlock your account:
            </p>
            <div style="${otpStyles}">${code}</div>
            <p style="color:#94a3b8; font-size:0.85rem; margin:0;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            <div style="${footerStyles}">
              IIT Ropar FAQ — Crowdsource Knowledge Platform
            </div>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send unlock email:', error);
    return false;
  }
}
