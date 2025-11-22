// Resend email integration - from resend blueprint
import { Resend } from 'resend';
import { readFileSync } from 'fs';

let connectionSettings: any;

async function getCredentials() {
  // If project-specific API key is set, use it directly
  if (process.env.RESEND_API_KEY) {
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL || 'support@washapp.ae'
    };
  }

  // Otherwise, use the shared Resend integration
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

export async function sendEmail(
  to: string, 
  subject: string, 
  html: string, 
  attachments?: Array<{ filename: string; path: string }>
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const emailData: any = {
      from: fromEmail,
      to: [to],
      subject,
      html,
    };
    
    // Convert file path attachments to base64 content for Resend
    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments.map(att => {
        try {
          const fileContent = readFileSync(att.path);
          return {
            filename: att.filename,
            content: fileContent.toString('base64'),
          };
        } catch (fileError) {
          console.error(`Failed to read attachment file ${att.path}:`, fileError);
          return null;
        }
      }).filter(Boolean); // Remove failed attachments
    }
    
    await client.emails.send(emailData);
    console.log(`Email sent successfully to ${to} - Subject: ${subject}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    // Don't throw - emails are not critical
  }
}
