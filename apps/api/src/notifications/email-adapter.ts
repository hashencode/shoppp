import {
  EmailProviderError,
  type EmailMessage,
  type EmailProvider,
  type EmailSendResult,
} from "./port";

interface HttpEmailProviderOptions {
  readonly apiKey?: string;
  readonly endpoint?: string;
  readonly fetcher?: typeof fetch;
}

function failureForStatus(status: number): EmailProviderError {
  if (status === 400 || status === 404 || status === 422) {
    return new EmailProviderError(
      "email_request_invalid",
      "The email provider rejected the message.",
      false,
    );
  }
  if (status === 401 || status === 403) {
    return new EmailProviderError(
      "email_provider_unauthorized",
      "The email provider credentials were rejected.",
      false,
    );
  }
  return new EmailProviderError(
    status === 429 ? "email_provider_rate_limited" : "email_provider_unavailable",
    "The email provider is temporarily unavailable.",
    true,
  );
}

export function createHttpEmailProvider(options: HttpEmailProviderOptions): EmailProvider {
  const fetcher = options.fetcher ?? fetch;
  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      if (!options.endpoint || !options.apiKey) {
        throw new EmailProviderError(
          "email_provider_not_configured",
          "The email provider is not configured.",
          false,
        );
      }
      let response: Response;
      try {
        response = await fetcher(options.endpoint, {
          body: JSON.stringify({
            from: message.from,
            html: message.html,
            subject: message.subject,
            text: message.text,
            to: [message.to],
          }),
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          method: "POST",
        });
      } catch {
        throw new EmailProviderError(
          "email_provider_timeout",
          "The email provider could not be reached.",
          true,
        );
      }
      if (!response.ok) throw failureForStatus(response.status);
      const body = (await response.json()) as { id?: unknown };
      if (typeof body.id !== "string" || !body.id) {
        throw new EmailProviderError(
          "email_provider_response_invalid",
          "The email provider returned an invalid response.",
          true,
        );
      }
      return { id: body.id };
    },
  };
}
