"use strict";

const nodemailer = require("nodemailer");

function smtpConfigured() {
  return Boolean(
    process.env.HEALTH_SMTP_HOST &&
      process.env.HEALTH_SMTP_USER &&
      process.env.HEALTH_SMTP_PASS,
  );
}

function getTransport() {
  const port = Number(process.env.HEALTH_SMTP_PORT || 587);
  const secure = process.env.HEALTH_SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host: process.env.HEALTH_SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: process.env.HEALTH_SMTP_USER,
      pass: process.env.HEALTH_SMTP_PASS,
    },
    authMethod: process.env.HEALTH_SMTP_AUTH_METHOD || "LOGIN",
  });
}

async function sendHealthEmail({ subject, body }) {
  const to = process.env.HEALTH_ALERT_TO || "dawidnowak@owocni.pl";
  if (!smtpConfigured()) {
    console.warn("HEALTH SMTP not configured — skip email:", subject);
    return { skipped: true, to, subject };
  }
  const from =
    process.env.HEALTH_SMTP_FROM || process.env.HEALTH_SMTP_USER || to;
  const info = await getTransport().sendMail({
    from,
    to,
    subject,
    text: body,
  });
  return { skipped: false, to, subject, messageId: info.messageId };
}

module.exports = {
  smtpConfigured,
  sendHealthEmail,
};
