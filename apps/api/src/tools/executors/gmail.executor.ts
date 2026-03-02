const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Base64url encode a string (RFC 4648 §5).
 */
function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class GmailExecutor {
  async execute(
    action: string,
    params: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    switch (action) {
      case 'send_email':
        return this.sendEmail(params, accessToken);
      default:
        throw new Error(`Unknown Gmail action: ${action}`);
    }
  }

  private async sendEmail(
    params: Record<string, unknown>,
    accessToken: string,
  ) {
    const to = String(params.to ?? '');
    const subject = String(params.subject ?? '');
    const body = String(params.body ?? '');
    if (!to) throw new Error('Missing required parameter: to');
    if (!subject) throw new Error('Missing required parameter: subject');

    // Build RFC 2822 MIME message
    const mimeMessage = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ].join('\r\n');

    const raw = base64urlEncode(mimeMessage);

    const res = await fetch(`${GMAIL_API}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      throw new Error(`Gmail API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return {
      messageId: data.id,
      threadId: data.threadId,
    };
  }
}
