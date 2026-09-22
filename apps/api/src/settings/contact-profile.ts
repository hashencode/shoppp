import {
  contactProfileSchema,
  contactSettingsSchema,
  type ContactProfile,
  type ContactSettings,
  type LaunchConfiguration,
  type PublicContact,
  type UpdateContactSettingsRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import { sha256Hex } from "../orders/tokens";
import { defaultLaunchConfiguration } from "./launch-configuration";

const PROFILE_KEY = "contact_profile";
const LAUNCH_KEY = "launch_configuration";
const GUARD_KEY = "contact_write_guard";
const CONTACT_UPDATE_AUDIT_REASON = "Contact settings updated";

interface SettingRow {
  value_json: string;
  updated_at: string;
}
interface KeyedSettingRow extends SettingRow {
  key: string;
}
interface StoredProfile {
  version: string;
  profile: ContactProfile;
}

const emptyProfile: ContactProfile = {
  publishSupportEmail: false,
  publishPrivacyEmail: false,
  publicPhone: null,
  serviceHours: null,
  timeZone: null,
  locations: [],
  socials: [],
};

async function contactRows(db: D1Database): Promise<[SettingRow | null, SettingRow | null]> {
  // A single statement observes one D1 snapshot for the email and publication choices.
  const result = await db
    .prepare("SELECT key, value_json, updated_at FROM settings WHERE key IN (?, ?)")
    .bind(LAUNCH_KEY, PROFILE_KEY)
    .all<KeyedSettingRow>();
  const byKey = new Map(result.results.map(({ key, ...setting }) => [key, setting]));
  return [byKey.get(LAUNCH_KEY) ?? null, byKey.get(PROFILE_KEY) ?? null];
}

async function launchVersion(value: string | null): Promise<string | null> {
  return value === null ? null : sha256Hex(value);
}

function storedProfile(value: string | null): StoredProfile | null {
  if (value === null) return null;
  const decoded = JSON.parse(value) as StoredProfile;
  const profile = contactProfileSchema.parse(decoded.profile);
  if (typeof decoded.version !== "string") throw new Error("Invalid contact profile version");
  return { version: decoded.version, profile };
}

function publicContactFromSettings(
  profile: ContactProfile,
  supportEmail: string,
  privacyContactEmail: string,
): PublicContact {
  return {
    supportEmail: profile.publishSupportEmail ? supportEmail : null,
    privacyEmail: profile.publishPrivacyEmail ? privacyContactEmail : null,
    publicPhone: profile.publicPhone,
    serviceHours: profile.serviceHours,
    timeZone: profile.timeZone,
    locations: profile.locations.filter((location) => location.visible),
    socials: profile.socials.filter((social) => social.visible),
  };
}

export async function getContactSettings(
  context: Context<ApiEnvironment>,
): Promise<ContactSettings> {
  const [launch, profileRow] = await contactRows(context.env.DB);
  const stored = storedProfile(profileRow?.value_json ?? null);
  const profile = stored?.profile ?? emptyProfile;
  const configuration = launch
    ? (JSON.parse(launch.value_json) as LaunchConfiguration)
    : defaultLaunchConfiguration(context);
  return contactSettingsSchema.parse({
    profile,
    supportEmail: configuration.supportEmail,
    privacyContactEmail: configuration.privacyContactEmail,
    launchVersion: await launchVersion(launch?.value_json ?? null),
    profileVersion: stored?.version ?? null,
    updatedAt: profileRow?.updated_at ?? null,
    publicContact: publicContactFromSettings(
      profile,
      configuration.supportEmail,
      configuration.privacyContactEmail,
    ),
  });
}

export async function updateContactSettings(
  context: Context<ApiEnvironment>,
  input: UpdateContactSettingsRequest,
): Promise<ContactSettings> {
  const [launchRow, profileRow] = await contactRows(context.env.DB);
  const currentLaunchVersion = await launchVersion(launchRow?.value_json ?? null);
  const currentProfileVersion = storedProfile(profileRow?.value_json ?? null)?.version ?? null;
  if (
    input.expectedLaunchVersion !== currentLaunchVersion ||
    input.expectedProfileVersion !== currentProfileVersion
  ) {
    throw new ApiError(
      409,
      "contact_settings_conflict",
      "Contact settings changed. Reload before saving.",
    );
  }

  const configuration = launchRow
    ? (JSON.parse(launchRow.value_json) as LaunchConfiguration)
    : defaultLaunchConfiguration(context);
  const now = new Date().toISOString();
  const version = crypto.randomUUID();
  const principal = context.get("principal");
  const statements = [
    // D1 batch is transactional. The invalid JSON branch trips the settings CHECK constraint
    // if either source changed after the initial read, rolling back both writes and the audit.
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, CASE WHEN
         (SELECT value_json FROM settings WHERE key = ?) IS ? AND
         (SELECT value_json FROM settings WHERE key = ?) IS ?
         THEN '{}' ELSE 'invalid' END, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    ).bind(
      GUARD_KEY,
      LAUNCH_KEY,
      launchRow?.value_json ?? null,
      PROFILE_KEY,
      profileRow?.value_json ?? null,
      now,
    ),
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    ).bind(
      LAUNCH_KEY,
      JSON.stringify({
        ...configuration,
        supportEmail: input.supportEmail,
        privacyContactEmail: input.privacyContactEmail,
      }),
      now,
    ),
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    ).bind(PROFILE_KEY, JSON.stringify({ version, profile: input.profile }), now),
    prepareAuditEvent(context.env.DB, {
      action: "settings.contact.update",
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: {
        profileVersion: version,
        locations: input.profile.locations.length,
        socials: input.profile.socials.length,
      },
      reason: CONTACT_UPDATE_AUDIT_REASON,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: PROFILE_KEY,
      targetType: "setting",
    }),
    context.env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(GUARD_KEY),
  ];
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    const fresh = await contactRows(context.env.DB);
    if (
      fresh[0]?.value_json !== launchRow?.value_json ||
      fresh[1]?.value_json !== profileRow?.value_json
    ) {
      throw new ApiError(
        409,
        "contact_settings_conflict",
        "Contact settings changed. Reload before saving.",
      );
    }
    throw error;
  }
  return getContactSettings(context);
}
